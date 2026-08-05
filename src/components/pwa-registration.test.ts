import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEventListener = (event: unknown) => void;

async function serviceWorkerHarness({
  cacheKeys = [],
  cachedOfflineResponse
}: {
  cacheKeys?: string[];
  cachedOfflineResponse?: Response;
} = {}) {
  const listeners = new Map<string, WorkerEventListener>();
  const skipWaiting = vi.fn();
  const claim = vi.fn();
  const deleteCache = vi.fn().mockResolvedValue(true);
  const match = vi.fn().mockResolvedValue(cachedOfflineResponse);
  const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");

  new vm.Script(source).runInNewContext({
    URL,
    Promise,
    Response,
    fetch: vi.fn().mockRejectedValue(new Error("offline")),
    self: {
      addEventListener: (event: string, listener: WorkerEventListener) => listeners.set(event, listener),
      location: { origin: "https://foodos.test" },
      skipWaiting,
      clients: { claim }
    },
    caches: {
      delete: deleteCache,
      keys: vi.fn().mockResolvedValue(cacheKeys),
      match,
      open: vi.fn().mockResolvedValue({ addAll: vi.fn().mockResolvedValue(undefined) })
    }
  });

  return { claim, deleteCache, listeners, match, skipWaiting };
}

function callListener(listeners: Map<string, WorkerEventListener>, type: string, event: object) {
  const listener = listeners.get(type);
  if (!listener) throw new Error(`Service worker did not register a ${type} listener`);
  listener(event);
}

describe("PWA service worker", () => {
  it("never replaces a root OAuth code callback with the offline page", async () => {
    const { listeners } = await serviceWorkerHarness();
    const respondWith = vi.fn();

    callListener(listeners, "fetch", {
      request: { method: "GET", mode: "navigate", url: "https://foodos.test/?code=one-time-code" },
      respondWith
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it("keeps the confirmation route on the network even without a query string", async () => {
    const { listeners } = await serviceWorkerHarness();
    const respondWith = vi.fn();

    callListener(listeners, "fetch", {
      request: { method: "GET", mode: "navigate", url: "https://foodos.test/auth/confirm" },
      respondWith
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it("deletes only obsolete FoodOS caches and preserves unrelated origin caches", async () => {
    const { claim, deleteCache, listeners } = await serviceWorkerHarness({
      cacheKeys: ["foodos-static-v1", "foodos-static-v2", "foodos-static-v3", "workbox-precache-v9", "another-app"]
    });
    let activation: Promise<unknown> | undefined;

    callListener(listeners, "activate", {
      waitUntil: (promise: Promise<unknown>) => { activation = promise; }
    });
    await activation;

    expect(deleteCache.mock.calls.map(([cacheName]) => cacheName)).toEqual(["foodos-static-v1", "foodos-static-v2"]);
    expect(claim).toHaveBeenCalledOnce();
  });

  it("waits for an explicit update message before activating", async () => {
    const { listeners, skipWaiting } = await serviceWorkerHarness();

    expect(skipWaiting).not.toHaveBeenCalled();
    callListener(listeners, "message", { data: { type: "IGNORED" } });
    expect(skipWaiting).not.toHaveBeenCalled();
    callListener(listeners, "message", { data: { type: "SKIP_WAITING" } });
    expect(skipWaiting).toHaveBeenCalledOnce();
  });

  it("returns a safe 503 response if both the network and cached offline document are unavailable", async () => {
    const { listeners, match } = await serviceWorkerHarness();
    let navigation: Promise<Response> | undefined;

    callListener(listeners, "fetch", {
      request: { method: "GET", mode: "navigate", url: "https://foodos.test/inventory" },
      respondWith: (response: Promise<Response>) => { navigation = response; }
    });
    const response = await navigation;

    expect(match).toHaveBeenCalledWith("/offline");
    expect(response?.status).toBe(503);
    await expect(response?.text()).resolves.toContain("FoodOS ist gerade offline");
  });
});
