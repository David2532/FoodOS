import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  claims: null as Record<string, unknown> | null,
  error: null as unknown
}));

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
  }
}));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: testState.claims }, error: testState.error }) }
  })
}));
vi.mock("@/features/auth/password-reset-screen", () => ({ PasswordResetScreen: () => null }));

import PasswordResetPage from "./page";

describe("password reset admission", () => {
  beforeEach(() => {
    testState.error = null;
    testState.claims = {
      sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
      session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
      amr: [{ method: "password", timestamp: 1_785_843_422 }]
    };
  });

  it("redirects a freshly signed-in AAL1 session instead of rendering the reset form", async () => {
    await expect(PasswordResetPage()).rejects.toThrow("redirect:/?auth_error=recovery");
  });

  it("renders only a session proven by the recovery authentication method", async () => {
    testState.claims = {
      sub: "18f4292d-778e-4384-9ab7-70b98b1acadb",
      session_id: "f3cd9fd6-7684-4f2f-b2d5-6047399e43f0",
      amr: [{ method: "recovery", timestamp: 1_785_843_422 }]
    };

    await expect(PasswordResetPage()).resolves.toBeTruthy();
  });
});
