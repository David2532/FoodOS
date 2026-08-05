import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchListener = (event: {
  request: { method: string; mode: string; url: string };
  respondWith: (response: Promise<Response | undefined>) => void;
}) => void;

async function fetchListenerFromServiceWorker(): Promise<FetchListener> {
  let listener: FetchListener | undefined;
  const worker = {
    addEventListener: (event: string, candidate: FetchListener) => {
      if (event === "fetch") listener = candidate;
    },
    location: { origin: "https://foodos.test" },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() }
  };
  const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");

  new vm.Script(source).runInNewContext({
    URL,
    Promise,
    self: worker,
    caches: {}
  });

  if (!listener) throw new Error("Service worker did not register a fetch listener");
  return listener;
}

describe("PWA OAuth navigation safety", () => {
  it("never replaces a root OAuth code callback with the offline page", async () => {
    const listener = await fetchListenerFromServiceWorker();
    const respondWith = vi.fn();

    listener({
      request: { method: "GET", mode: "navigate", url: "https://foodos.test/?code=one-time-code" },
      respondWith
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it("keeps the confirmation route on the network even without a query string", async () => {
    const listener = await fetchListenerFromServiceWorker();
    const respondWith = vi.fn();

    listener({
      request: { method: "GET", mode: "navigate", url: "https://foodos.test/auth/confirm" },
      respondWith
    });

    expect(respondWith).not.toHaveBeenCalled();
  });
});
