import { describe, expect, it } from "vitest";
import { publicRequestOrigin } from "./request-origin";

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
