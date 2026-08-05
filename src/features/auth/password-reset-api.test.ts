import { afterEach, describe, expect, it, vi } from "vitest";
import { retryRecoverySessionRevocation, updatePasswordFromRecovery } from "./password-reset-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("password reset API client", () => {
  it("accepts only a confirmed server completion", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ status: "complete" }), { status: 200 }));
    globalThis.fetch = fetchSpy as typeof fetch;

    await expect(updatePasswordFromRecovery({ newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" })).resolves.toEqual({ kind: "complete" });
    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/password-reset", expect.objectContaining({ method: "POST" }));
  });

  it("keeps an explicit retry state when the server cannot revoke sessions", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ status: "password-updated-revocation-pending" }), { status: 409 })) as typeof fetch;

    await expect(retryRecoverySessionRevocation()).resolves.toEqual({ kind: "revocation-required" });
  });

  it("fails closed on malformed or unavailable server responses", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ status: "invented" }), { status: 200 })) as typeof fetch;
    await expect(retryRecoverySessionRevocation()).resolves.toEqual({ kind: "error" });

    globalThis.fetch = vi.fn(async () => { throw new Error("offline"); }) as typeof fetch;
    await expect(retryRecoverySessionRevocation()).resolves.toEqual({ kind: "error" });
  });
});
