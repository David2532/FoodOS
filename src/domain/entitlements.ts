export type CommercialPlan = "free" | "plus" | "family";
export type PaidProvider = "apple" | "google" | "stripe";

export type EntitlementInput =
  | { kind: "free" }
  | {
    kind: "trial";
    startedAt: string;
    endsAt: string;
    cardRequired: false;
    autoRenews: false;
  }
  | {
    kind: "paid";
    plan: Exclude<CommercialPlan, "free">;
    provider: PaidProvider;
    status: "active" | "grace" | "expired" | "revoked";
    verifiedAt: string;
    periodEndsAt: string;
    autoRenews: boolean;
  };

export type PlanCapabilities = {
  maxHouseholds: number;
  maxHouseholdMembers: number;
  maxActiveInventoryItems: number | null;
  smartPlansPerMonth: number | null;
  advancedStats: boolean;
  pantryOptimization: boolean;
  adFree: boolean;
  accountSecurity: true;
  foodSafety: true;
  dataExport: true;
  accountDeletion: true;
};

export const COMMERCIAL_PLANS = {
  free: {
    name: "Free",
    monthlyPriceEur: null,
    annualPriceEur: null,
    capabilities: {
      maxHouseholds: 1,
      maxHouseholdMembers: 1,
      maxActiveInventoryItems: 50,
      smartPlansPerMonth: 3,
      advancedStats: false,
      pantryOptimization: false,
      adFree: false,
      accountSecurity: true,
      foodSafety: true,
      dataExport: true,
      accountDeletion: true
    }
  },
  plus: {
    name: "Plus",
    monthlyPriceEur: 3.99,
    annualPriceEur: 29.99,
    capabilities: {
      maxHouseholds: 1,
      maxHouseholdMembers: 1,
      maxActiveInventoryItems: null,
      smartPlansPerMonth: null,
      advancedStats: true,
      pantryOptimization: true,
      adFree: true,
      accountSecurity: true,
      foodSafety: true,
      dataExport: true,
      accountDeletion: true
    }
  },
  family: {
    name: "Family",
    monthlyPriceEur: 5.99,
    annualPriceEur: 44.99,
    capabilities: {
      maxHouseholds: 1,
      maxHouseholdMembers: 5,
      maxActiveInventoryItems: null,
      smartPlansPerMonth: null,
      advancedStats: true,
      pantryOptimization: true,
      adFree: true,
      accountSecurity: true,
      foodSafety: true,
      dataExport: true,
      accountDeletion: true
    }
  }
} as const satisfies Record<CommercialPlan, {
  name: string;
  monthlyPriceEur: number | null;
  annualPriceEur: number | null;
  capabilities: PlanCapabilities;
}>;

export type ResolvedEntitlement = {
  plan: CommercialPlan;
  state: "free" | "trialing" | "active" | "grace";
  reason: "free" | "trial_active" | "paid_verified" | "trial_ended" | "invalid_or_unverified";
  validUntil?: string;
  autoRenews: boolean;
  preservesDataOnExpiry: true;
  capabilities: PlanCapabilities;
};

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1_000;

function timestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function freeEntitlement(reason: ResolvedEntitlement["reason"]): ResolvedEntitlement {
  return {
    plan: "free",
    state: "free",
    reason,
    autoRenews: false,
    preservesDataOnExpiry: true,
    capabilities: COMMERCIAL_PLANS.free.capabilities
  };
}

export function resolveEntitlement(input: EntitlementInput, now = new Date()): ResolvedEntitlement {
  if (input.kind === "free") return freeEntitlement("free");
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return freeEntitlement("invalid_or_unverified");

  if (input.kind === "trial") {
    const startedAt = timestamp(input.startedAt);
    const endsAt = timestamp(input.endsAt);
    const validWindow = startedAt !== undefined
      && endsAt !== undefined
      && endsAt - startedAt === TRIAL_DURATION_MS
      && nowMs >= startedAt;
    if (!validWindow) return freeEntitlement("invalid_or_unverified");
    if (nowMs >= endsAt) return freeEntitlement("trial_ended");
    return {
      plan: "plus",
      state: "trialing",
      reason: "trial_active",
      validUntil: input.endsAt,
      autoRenews: false,
      preservesDataOnExpiry: true,
      capabilities: COMMERCIAL_PLANS.plus.capabilities
    };
  }

  const verifiedAt = timestamp(input.verifiedAt);
  const periodEndsAt = timestamp(input.periodEndsAt);
  const verified = verifiedAt !== undefined
    && verifiedAt <= nowMs
    && periodEndsAt !== undefined
    && periodEndsAt > nowMs
    && (input.status === "active" || input.status === "grace");
  if (!verified) return freeEntitlement("invalid_or_unverified");
  return {
    plan: input.plan,
    state: input.status === "grace" ? "grace" : "active",
    reason: "paid_verified",
    validUntil: input.periodEndsAt,
    autoRenews: input.autoRenews,
    preservesDataOnExpiry: true,
    capabilities: COMMERCIAL_PLANS[input.plan].capabilities
  };
}

export function isBillingLabEnvironment(environment: {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}): boolean {
  return environment.NODE_ENV === "development"
    || environment.NODE_ENV === "test"
    || environment.VERCEL_ENV === "preview";
}
