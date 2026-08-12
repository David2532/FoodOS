/**
 * @typedef {"low" | "medium" | "high" | "critical"} RiskLevel
 * @typedef {{
 *   risk: RiskLevel;
 *   docs: string[];
 *   code: string[];
 *   tests: string[];
 *   checks: string[];
 *   gates: { migrationOrRls: boolean; uiE2e: boolean; productionBuild: boolean };
 *   fullVerifyWhen: string[];
 * }} AgentScope
 */

const defineScope = (scope) => Object.freeze(scope);

/** @type {Record<string, AgentScope>} */
export const SCOPES = Object.freeze({
  auth: defineScope({
    risk: "critical",
    docs: ["plans/AUTH_AND_SELF_HOSTING.md", "plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md", "plans/USER_FLOWS.md"],
    code: ["src/features/auth/**", "src/app/auth/**", "src/app/api/auth/**", "src/lib/supabase/**", "supabase/config.toml"],
    tests: ["src/features/auth/**/*.test.*", "src/app/auth/**/*.test.*", "e2e-auth/**", "supabase/tests/**"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["session, callback, middleware or shared auth contracts change", "handoff of an authentication release"],
  }),
  account: defineScope({
    risk: "high",
    docs: ["docs/ACCOUNT_SETTINGS_AND_PASSWORDS.md", "plans/AUTH_AND_SELF_HOSTING.md", "legal/DATA_PROCESSING_REGISTER.md"],
    code: ["src/features/settings/**", "src/app/api/account/**", "src/app/api/auth/**", "src/domain/password*"],
    tests: ["src/features/settings/**/*.test.*", "src/domain/password.test.ts", "e2e-auth/password-recovery.spec.ts"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["password, deletion, export or session revocation changes"],
  }),
  inventory: defineScope({
    risk: "critical",
    docs: ["plans/USER_FLOWS.md", "plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md", "plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md"],
    code: ["src/components/inventory-view.tsx", "src/contracts/inventory.ts", "src/infrastructure/foodos-repository.ts", "src/app/api/inventory/**"],
    tests: ["src/domain/expiry.test.ts", "src/domain/offline-outbox.test.ts", "supabase/tests/**", "e2e-auth/authenticated-core.spec.ts"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["quantity, date, event-ledger or transaction semantics change"],
  }),
  catalog: defineScope({
    risk: "high",
    docs: ["docs/PUBLIC_CATALOG_OPERATIONS.md", "plans/ARCHITECTURE_PLAN.md", "legal/COMPLIANCE_MATRIX.md"],
    code: ["src/features/catalog/**", "src/lib/open-food-facts*", "src/lib/product-cache*", "scripts/*catalog*", "supabase/migrations/*catalog*"],
    tests: ["scripts/public-catalog-core.test.mjs", "src/lib/*catalog*.test.ts", "src/lib/open-food-facts*.test.ts", "supabase/tests/0015_public_product_catalog_security.sql"],
    checks: ["npm run test:unit:changed", "npm run test:db", "npm run catalog:verify"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: false },
    fullVerifyWhen: ["activation, sealing, source allowlist or public API contract changes"],
  }),
  scan: defineScope({
    risk: "critical",
    docs: ["plans/USER_FLOWS.md", "plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md", "plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md"],
    code: ["src/components/scan-view.tsx", "src/domain/gs1*", "src/infrastructure/expiry-ocr-adapter*", "src/app/api/products/**"],
    tests: ["src/domain/gs1.test.ts", "src/infrastructure/expiry-ocr-adapter.test.ts", "e2e/**"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:e2e"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["barcode parsing, expiry confirmation or persisted scan intent changes"],
  }),
  planning: defineScope({
    risk: "high",
    docs: ["plans/USER_FLOWS.md", "plans/COMMERCIAL_PRODUCT_PLAN.md"],
    code: ["src/components/plan-view.tsx", "src/app/api/planning/**", "src/infrastructure/foodos-repository.ts"],
    tests: ["src/lib/food-math.test.ts", "supabase/tests/**", "e2e-auth/authenticated-core.spec.ts"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: false },
    fullVerifyWhen: ["persisted plan or nutrition aggregation changes"],
  }),
  shopping: defineScope({
    risk: "high",
    docs: ["plans/USER_FLOWS.md", "plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md"],
    code: ["src/components/shopping-view.tsx", "src/app/api/shopping/**", "src/infrastructure/foodos-repository.ts"],
    tests: ["src/domain/offline-outbox.test.ts", "supabase/tests/**", "e2e-auth/authenticated-core.spec.ts"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: false },
    fullVerifyWhen: ["missing-quantity or manual-intent reconciliation changes"],
  }),
  nutrition: defineScope({
    risk: "high",
    docs: ["plans/USER_FLOWS.md", "plans/COMMERCIAL_PRODUCT_PLAN.md", "legal/COMPLIANCE_MATRIX.md"],
    code: ["src/lib/food-math*", "src/domain/ingredient-relevance*", "src/components/today-view*", "src/app/api/food-log/**"],
    tests: ["src/lib/food-math.test.ts", "src/domain/ingredient-relevance.test.ts", "src/components/today-view.test.tsx"],
    checks: ["npm run test:unit:changed", "npm run typecheck"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: false },
    fullVerifyWhen: ["calorie, macro, personal relevance or health copy changes"],
  }),
  privacy: defineScope({
    risk: "critical",
    docs: ["legal/DATA_PROCESSING_REGISTER.md", "legal/COMPLIANCE_MATRIX.md", "plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md"],
    code: ["src/features/privacy/**", "src/domain/privacy*", "src/infrastructure/privacy-repository.ts", "src/app/api/privacy/**"],
    tests: ["src/domain/privacy.test.ts", "src/features/privacy/**/*.test.*", "supabase/tests/**", "e2e-auth/**"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["consent, export, deletion, retention or telemetry boundaries change"],
  }),
  recalls: defineScope({
    risk: "critical",
    docs: ["docs/RECALL_INGESTION.md", "plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md", "legal/COMPLIANCE_MATRIX.md"],
    code: ["src/domain/recall*", "src/infrastructure/recall/**", "src/app/api/jobs/recalls/**", "supabase/migrations/*recall*"],
    tests: ["src/domain/recall.test.ts", "src/infrastructure/recall/**/*.test.ts", "supabase/tests/**"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["source approval, matching, freshness or correction behavior changes"],
  }),
  offline: defineScope({
    risk: "critical",
    docs: ["plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md", "plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md"],
    code: ["src/domain/offline-outbox*", "src/infrastructure/offline-outbox.ts", "src/components/outbox-status*", "src/app/offline/**"],
    tests: ["src/domain/offline-outbox.test.ts", "src/components/outbox-status.test.tsx", "e2e-auth/logout-offline-cleanup.spec.ts"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["encryption, outbox replay, conflict or tombstone behavior changes"],
  }),
  billing: defineScope({
    risk: "critical",
    docs: ["plans/COMMERCIAL_PRODUCT_PLAN.md", "plans/APP_STORE_RELEASE_PLAN.md"],
    code: ["src/domain/entitlements*", "src/features/billing/**", "src/app/api/billing/**", "supabase/migrations/*billing*"],
    tests: ["src/domain/entitlements*.test.*", "src/features/billing/**/*.test.*", "supabase/tests/**", "e2e-auth/**"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["entitlements, prices, webhook or store purchase semantics change"],
  }),
  ops: defineScope({
    risk: "critical",
    docs: ["plans/CEO_CONTROL_CENTER.md", "plans/CEO_RISK_AUTOMATION.md", "design-ceo.md"],
    code: ["src/features/ops/**", "src/app/ops/**", "src/domain/ops-finance*", "src/infrastructure/ops-finance-repository.ts", "src/app/api/ops/**"],
    tests: ["src/domain/ops-finance.test.ts", "src/features/ops/**/*.test.*", "supabase/tests/0018_ops_finance_security.sql"],
    checks: ["npm run test:unit:changed", "npm run typecheck", "npm run test:db", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["money, role, source-trust, reconciliation or action authority changes"],
  }),
  database: defineScope({
    risk: "critical",
    docs: ["plans/ARCHITECTURE_PLAN.md", "plans/QUALITY_ENGINEERING_PLAN.md"],
    code: ["supabase/migrations/**", "supabase/tests/**", "supabase/config.toml"],
    tests: ["supabase/tests/**"],
    checks: ["npm run test:db", "npm run typecheck"],
    gates: { migrationOrRls: true, uiE2e: false, productionBuild: false },
    fullVerifyWhen: ["shared RPC, grant, RLS, trigger or generated type contracts change"],
  }),
  ui: defineScope({
    risk: "medium",
    docs: [
      "plans/PRODUCT_NORTH_STAR.md",
      "plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md",
      "plans/USER_FLOWS.md",
      "design.md",
      "plans/UI_UX_PERFORMANCE_PLAN.md",
      "docs/agent/CODEX_UI_AGENT_ARCHITECTURE.md",
      "docs/agent/UI_AND_ASSET_AGENT_CONTRACT.md",
    ],
    code: ["src/components/**", "src/features/**", "src/app/**", "src/app/globals.css", "public/assets/**"],
    tests: ["src/**/*.test.tsx", "e2e/**"],
    checks: ["npm run test:unit:changed", "npm run lint", "npm run typecheck", "npm run test:e2e"],
    gates: { migrationOrRls: false, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["root layout, navigation, global styles, design tokens or critical responsive flow changes"],
  }),
  deployment: defineScope({
    risk: "critical",
    docs: ["README.md", "plans/AUTH_AND_SELF_HOSTING.md", "docs/RELEASE_CHECKLIST.md"],
    code: ["next.config.ts", "vercel.json", "Dockerfile", "docker-compose*.yml", ".github/workflows/**", ".env.example"],
    tests: ["e2e/**", "e2e-auth/**", "supabase/tests/**"],
    checks: ["npm run verify:full", "npm run test:db", "npm run test:e2e", "npm run test:e2e:auth"],
    gates: { migrationOrRls: true, uiE2e: true, productionBuild: true },
    fullVerifyWhen: ["always before release handoff; external deployment checks remain separate"],
  }),
});

export function validateScopes(scopes = SCOPES) {
  const risks = new Set(["low", "medium", "high", "critical"]);
  const requiredArrays = ["docs", "code", "tests", "checks", "fullVerifyWhen"];

  for (const [name, scope] of Object.entries(scopes)) {
    if (!/^[a-z]+$/.test(name) || !risks.has(scope.risk)) {
      throw new TypeError(`Invalid scope metadata: ${name}`);
    }
    for (const key of requiredArrays) {
      if (!Array.isArray(scope[key]) || scope[key].some((entry) => typeof entry !== "string" || entry.length === 0)) {
        throw new TypeError(`Invalid ${key} entries for scope: ${name}`);
      }
    }
    for (const gate of ["migrationOrRls", "uiE2e", "productionBuild"]) {
      if (typeof scope.gates?.[gate] !== "boolean") {
        throw new TypeError(`Invalid ${gate} gate for scope: ${name}`);
      }
    }
  }
  return scopes;
}

export function listScopes() {
  return Object.keys(SCOPES).sort();
}

export function getScope(name) {
  validateScopes();
  const scope = SCOPES[name];
  if (!scope) {
    throw new RangeError(`Unknown scope "${name}". Use --list to see supported scopes.`);
  }
  return scope;
}

validateScopes();
