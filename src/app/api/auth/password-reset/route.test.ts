import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  claims: {
    sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
    session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
    amr: [{ method: "password", timestamp: 1_785_843_422 }]
  } as Record<string, unknown>,
  getClaimsError: null as unknown,
  updateUser: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: testState.claims }, error: testState.getClaimsError }),
      updateUser: testState.updateUser,
      signOut: testState.signOut
    }
  })
}));

import { POST } from "./route";

interface PostOptions {
  forwardedHost?: string;
  forwardedProtocol?: string;
  host?: string;
  origin?: string | null;
  requestUrl?: string;
}

function post(body: unknown, options: PostOptions = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (Object.hasOwn(options, "origin")) {
    if (options.origin !== null && options.origin !== undefined) headers.set("origin", options.origin);
  } else headers.set("origin", "https://foodos.test");
  if (options.host !== undefined) headers.set("host", options.host);
  else headers.set("host", "foodos.test");
  if (options.forwardedHost !== undefined) headers.set("x-forwarded-host", options.forwardedHost);
  if (options.forwardedProtocol !== undefined) headers.set("x-forwarded-proto", options.forwardedProtocol);

  return POST(new Request("https://foodos.test/api/auth/password-reset", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  }));
}

describe("recovery password reset API", () => {
  beforeEach(() => {
    vi.stubEnv("FOODOS_APP_ORIGIN", "https://foodos.test");
    testState.claims = {
      sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
      session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
      amr: [{ method: "password", timestamp: 1_785_843_422 }]
    };
    testState.getClaimsError = null;
    testState.updateUser.mockReset();
    testState.signOut.mockReset();
    testState.updateUser.mockResolvedValue({ error: null });
    testState.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a direct same-origin request before rejecting a normal AAL1 session", async () => {
    const response = await post({ action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" });

    expect(response.status).toBe(401);
    expect(testState.updateUser).not.toHaveBeenCalled();
    expect(testState.signOut).not.toHaveBeenCalled();
  });

  it("updates only a recovery-proven session and immediately revokes all sessions", async () => {
    testState.claims = {
      sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
      session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
      amr: [{ method: "recovery", timestamp: 1_785_843_422 }]
    };

    const response = await post({ action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "complete" });
    expect(testState.updateUser).toHaveBeenCalledWith({ password: "A-new-password-2026!" });
    expect(testState.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("never reports completion when global session revocation fails", async () => {
    testState.claims = {
      sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
      session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
      amr: [{ method: "recovery", timestamp: 1_785_843_422 }]
    };
    testState.signOut.mockResolvedValue({ error: new Error("provider unavailable") });

    const response = await post({ action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ status: "password-updated-revocation-pending" });
  });

  it("requires a same-origin request before processing a password", async () => {
    const response = await post(
      { action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" },
      { origin: "https://elsewhere.test" }
    );

    expect(response.status).toBe(403);
    expect(testState.updateUser).not.toHaveBeenCalled();
  });

  it("never trusts Host or forwarded headers as the password-reset origin", async () => {
    testState.claims = {
      sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
      session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
      amr: [{ method: "recovery", timestamp: 1_785_843_422 }]
    };

    const response = await post(
      { action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" },
      {
        host: "evil.example",
        origin: "https://evil.example",
        forwardedHost: "evil.example",
        forwardedProtocol: "https"
      }
    );

    expect(response.status).toBe(403);
    expect(testState.updateUser).not.toHaveBeenCalled();
    expect(testState.signOut).not.toHaveBeenCalled();
  });

  it("uses the configured canonical origin despite reverse-proxy headers", async () => {
    vi.stubEnv("FOODOS_APP_ORIGIN", "https://app.foodos.test");
    const response = await post(
      { action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" },
      {
        host: "internal.foodos.test",
        origin: "https://app.foodos.test",
        forwardedHost: "app.foodos.test",
        forwardedProtocol: "https"
      }
    );

    expect(response.status).toBe(401);
    expect(testState.updateUser).not.toHaveBeenCalled();
  });

  it("fails closed when the canonical public origin is absent or malformed", async () => {
    vi.stubEnv("FOODOS_APP_ORIGIN", "https://foodos.test/unsafe-path");
    const malformed = await post(
      { action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" }
    );
    vi.stubEnv("FOODOS_APP_ORIGIN", "");
    const missing = await post(
      { action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" }
    );

    expect(malformed.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(testState.updateUser).not.toHaveBeenCalled();
  });

  it("fails closed for missing or malformed origins", async () => {
    const missing = await post(
      { action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" },
      { origin: null }
    );
    const malformed = await post(
      { action: "reset", newPassword: "A-new-password-2026!", passwordConfirmation: "A-new-password-2026!" },
      { origin: "not-an-origin" }
    );

    expect(missing.status).toBe(403);
    expect(malformed.status).toBe(403);
    expect(testState.updateUser).not.toHaveBeenCalled();
  });
});
