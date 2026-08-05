import { afterEach, describe, expect, it, vi } from "vitest";
import { authCallbackOriginForBrowser, authCallbackOriginForRequest, publicRequestOrigin } from "./request-origin";

function request(url: string, headers: HeadersInit = {}): Request {
  return new Request(url, { headers });
}

describe("publicRequestOrigin", () => {
  it("uses a normal HTTP(S) request URL when no proxy headers are present", () => {
    expect(publicRequestOrigin(request("https://foodos.test/auth/confirm"))).toBe("https://foodos.test");
  });

  it("prefers the public Host when a standalone server internally uses localhost", () => {
    expect(publicRequestOrigin(request("http://localhost:3101/auth/confirm", {
      host: "127.0.0.1:3101"
    }))).toBe("http://127.0.0.1:3101");
  });

  it("uses complete forwarded public host and protocol information", () => {
    expect(publicRequestOrigin(request("http://localhost:3101/auth/confirm", {
      host: "internal.foodos.test",
      "x-forwarded-host": "127.0.0.1:3101",
      "x-forwarded-proto": "http"
    }))).toBe("http://127.0.0.1:3101");
  });

  it("falls back to the request URL for malformed forwarding headers", () => {
    expect(publicRequestOrigin(request("http://localhost:3101/auth/confirm", {
      "x-forwarded-host": "127.0.0.1:3101/unsafe",
      "x-forwarded-proto": "http"
    }))).toBe("http://localhost:3101");
  });
});

describe("canonical auth callback origins", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the configured production origin and ignores manipulated proxy hosts", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FOODOS_APP_ORIGIN", "https://app.foodos.example");

    expect(authCallbackOriginForRequest(request("https://internal.invalid/auth/confirm", {
      host: "evil.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https"
    }))).toBe("https://app.foodos.example");
  });

  it("fails closed in production when the configured origin is missing or malformed", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FOODOS_APP_ORIGIN", "https://app.foodos.example/unsafe-path");
    expect(authCallbackOriginForRequest(request("http://127.0.0.1:3000/auth/confirm"))).toBeNull();

    vi.stubEnv("FOODOS_APP_ORIGIN", "");
    expect(authCallbackOriginForBrowser(null, "http://127.0.0.1:3000")).toBeNull();
  });

  it("preserves only a safe loopback fallback outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FOODOS_APP_ORIGIN", "");

    expect(authCallbackOriginForRequest(request("http://localhost:3101/auth/confirm", {
      host: "127.0.0.1:3101"
    }))).toBe("http://127.0.0.1:3101");
    expect(authCallbackOriginForBrowser(null, "http://localhost:3000")).toBe("http://localhost:3000");
    expect(authCallbackOriginForBrowser(null, "https://preview-attacker.example")).toBeNull();
  });
});
