import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((destination: string): never => {
    throw new Error(`redirect:${destination}`);
  })
}));

vi.mock("next/navigation", () => ({ redirect: navigation.redirect }));
vi.mock("@/components/food-os-app", () => ({ FoodOsApp: () => null }));
vi.mock("@/features/auth/mfa-gate", () => ({ MfaGate: () => null }));
vi.mock("@/features/auth/onboarding-screen", () => ({ OnboardingScreen: () => null }));
vi.mock("@/features/auth/auth-frame", () => ({ AuthFrame: () => null }));
vi.mock("@/features/privacy/eligibility-privacy-gate", () => ({ EligibilityPrivacyGate: () => null }));
vi.mock("@/features/privacy/privacy-record-gate", () => ({ PrivacyRecordGate: () => null }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => false }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/infrastructure/foodos-repository", () => ({ loadFoodOsSnapshot: vi.fn() }));
vi.mock("@/infrastructure/privacy-repository", () => ({ loadCurrentPrivacyChoices: vi.fn() }));

import Home from "./page";

describe("root OAuth fallback", () => {
  it("forwards only a Supabase authorization code to the PKCE confirmation route", async () => {
    await expect(Home({ searchParams: Promise.resolve({ code: "code/with+symbols" }) }))
      .rejects
      .toThrow("redirect:/auth/confirm?code=code%2Fwith%2Bsymbols");
  });
});
