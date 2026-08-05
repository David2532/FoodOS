import { describe, expect, it } from "vitest";
import { COMMERCIAL_PLANS, isBillingLabEnvironment, resolveEntitlement } from "./entitlements";

const now = new Date("2026-08-05T12:00:00.000Z");

describe("commercial entitlements", () => {
  it("keeps safety, security and account rights available on every plan", () => {
    for (const plan of Object.values(COMMERCIAL_PLANS)) {
      expect(plan.capabilities).toMatchObject({
        accountSecurity: true,
        foodSafety: true,
        dataExport: true,
        accountDeletion: true
      });
    }
  });

  it("applies the exact Free, Plus and Family product limits and prices", () => {
    expect(COMMERCIAL_PLANS.free.capabilities).toMatchObject({
      maxHouseholds: 1,
      maxActiveInventoryItems: 50,
      smartPlansPerMonth: 3,
      adFree: false
    });
    expect(COMMERCIAL_PLANS.plus).toMatchObject({ monthlyPriceEur: 3.99, annualPriceEur: 29.99 });
    expect(COMMERCIAL_PLANS.family).toMatchObject({
      monthlyPriceEur: 5.99,
      annualPriceEur: 44.99,
      capabilities: { maxHouseholdMembers: 5 }
    });
  });

  it("grants a non-renewing 14-day Plus trial without a card", () => {
    expect(resolveEntitlement({
      kind: "trial",
      startedAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2026-08-15T00:00:00.000Z",
      cardRequired: false,
      autoRenews: false
    }, now)).toMatchObject({ plan: "plus", state: "trialing", autoRenews: false, preservesDataOnExpiry: true });
  });

  it("falls back to Free after a trial without deleting data", () => {
    expect(resolveEntitlement({
      kind: "trial",
      startedAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-15T00:00:00.000Z",
      cardRequired: false,
      autoRenews: false
    }, now)).toMatchObject({ plan: "free", reason: "trial_ended", preservesDataOnExpiry: true });
  });

  it("fails closed for malformed trials and unverified paid state", () => {
    expect(resolveEntitlement({
      kind: "trial",
      startedAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2026-08-20T00:00:00.000Z",
      cardRequired: false,
      autoRenews: false
    }, now).plan).toBe("free");
    expect(resolveEntitlement({
      kind: "paid",
      plan: "family",
      provider: "apple",
      status: "expired",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      periodEndsAt: "2026-09-01T00:00:00.000Z",
      autoRenews: false
    }, now).plan).toBe("free");
  });

  it("enables the lab only in local development, tests or Vercel Preview", () => {
    expect(isBillingLabEnvironment({ NODE_ENV: "development" })).toBe(true);
    expect(isBillingLabEnvironment({ NODE_ENV: "test" })).toBe(true);
    expect(isBillingLabEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
    expect(isBillingLabEnvironment({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
    expect(isBillingLabEnvironment({ NODE_ENV: "production" })).toBe(false);
  });
});
