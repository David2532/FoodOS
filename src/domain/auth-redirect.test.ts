import { describe, expect, it } from "vitest";
import { oauthCallbackUrl, safeAuthNextPath, safeNonRecoveryNextPath } from "./auth-redirect";

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

  it("keeps the password-reset destination inside the callback origin", () => {
    expect(oauthCallbackUrl("https://foodos.example", "/auth/passwort-zuruecksetzen")).toBe(
      "https://foodos.example/auth/confirm?next=%2Fauth%2Fpasswort-zuruecksetzen"
    );
  });

  it("never lets an ordinary confirmation steer into the password-reset route", () => {
    expect(safeNonRecoveryNextPath("/auth/passwort-zuruecksetzen")).toBe("/");
    expect(safeNonRecoveryNextPath("/auth/passwort-zuruecksetzen?from=mail")).toBe("/");
    expect(safeNonRecoveryNextPath("/inventory")).toBe("/inventory");
  });
});
