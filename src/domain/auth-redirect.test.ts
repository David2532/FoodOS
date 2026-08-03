import { describe, expect, it } from "vitest";
import { oauthCallbackUrl, safeAuthNextPath } from "./auth-redirect";

describe("authentication redirects", () => {
  it.each([
    [null, "/"],
    ["", "/"],
    ["dashboard", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["/inventory?filter=soon#batch", "/inventory?filter=soon#batch"]
  ])("normalizes %s without allowing an external redirect", (candidate, expected) => {
    expect(safeAuthNextPath(candidate)).toBe(expected);
  });

  it("builds one same-origin callback with an encoded internal destination", () => {
    expect(oauthCallbackUrl("https://foodos.example", "/inventory?filter=soon")).toBe(
      "https://foodos.example/auth/confirm?next=%2Finventory%3Ffilter%3Dsoon"
    );
  });
});
