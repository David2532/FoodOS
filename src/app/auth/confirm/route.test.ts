import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getClaims: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      exchangeCodeForSession: testState.exchangeCodeForSession,
      verifyOtp: testState.verifyOtp,
      getClaims: testState.getClaims
    }
  })
}));

import { GET } from "./route";

const normalClaims = {
  sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
  session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
  amr: [{ method: "password", timestamp: 1_785_843_422 }]
};

const recoveryClaims = {
  ...normalClaims,
  amr: [{ method: "recovery", timestamp: 1_785_843_422 }]
};

function successfulSession() {
  return { data: { session: { access_token: "signed-access-token" } }, error: null };
}

describe("auth confirmation route", () => {
  beforeEach(() => {
    testState.exchangeCodeForSession.mockReset();
    testState.verifyOtp.mockReset();
    testState.getClaims.mockReset();
    testState.exchangeCodeForSession.mockResolvedValue(successfulSession());
    testState.verifyOtp.mockResolvedValue(successfulSession());
    testState.getClaims.mockResolvedValue({ data: { claims: normalClaims }, error: null });
  });

  it("denies a direct reset-route next value after an ordinary AAL1 code exchange", async () => {
    const response = await GET(new Request("https://foodos.test/auth/confirm?code=normal&next=%2Fauth%2Fpasswort-zuruecksetzen"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://foodos.test/");
    expect(testState.getClaims).toHaveBeenCalledWith("signed-access-token");
  });

  it("accepts only a server-verified recovery AMR and forces the reset destination", async () => {
    testState.getClaims.mockResolvedValue({ data: { claims: recoveryClaims }, error: null });

    const response = await GET(new Request("https://foodos.test/auth/confirm?code=recovery&next=%2Finventory"));

    expect(response.headers.get("location")).toBe("https://foodos.test/auth/passwort-zuruecksetzen");
  });

  it("preserves the public host for a local callback when the standalone request URL is localhost", async () => {
    testState.getClaims.mockResolvedValue({ data: { claims: recoveryClaims }, error: null });

    const response = await GET(new Request("http://localhost:3101/auth/confirm?code=recovery", {
      headers: { host: "127.0.0.1:3101" }
    }));

    expect(response.headers.get("location")).toBe("http://127.0.0.1:3101/auth/passwort-zuruecksetzen");
  });

  it("does not trust a recovery type or next parameter when the verified claim is missing", async () => {
    const response = await GET(new Request("https://foodos.test/auth/confirm?token_hash=untrusted&type=recovery&next=%2Fauth%2Fpasswort-zuruecksetzen"));

    expect(response.headers.get("location")).toBe("https://foodos.test/");
    expect(testState.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "untrusted" });
  });
});
