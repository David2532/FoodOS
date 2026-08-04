# FoodOS repository map for humans and Codex

Status: **orientation and precedence contract** · Last updated: **2026-08-04**

This file is the shortest safe entry point after `AGENTS.md`. It separates what exists
today from the commercial target and tells an implementation agent which documents are
binding for a change.

## Current truth

### Implemented in this repository

- Next.js/TypeScript consumer prototype;
- collapsed email plus Apple/Google PKCE entry points, SSR sessions and mandatory TOTP/AAL2 gates;
- transactional household/product/batch/inventory/nutrition/planning schema, RLS and pgTAP coverage;
- Open Food Facts barcode lookup, full-text catalog search, purpose-limited normalization,
  AAL2 household cache and generationierten öffentlichen Katalog-Importcode;
- append-only versioned privacy-choice ledger with necessary-only defaults and in-app withdrawal;
- adaptive FoodOS consumer UI with compact bottom navigation and desktop rail;
- deterministic domain/provider/API tests plus Pixel-7/Desktop Playwright and axe coverage;
- encrypted durable mutation outbox for the currently allowlisted idempotent mutations;
- Next.js standalone Docker image and a self-hosting compose hand-off;
- comprehensive product, legal-risk, quality, operations and commercial target plans.

### Planned but not yet proven

- production Supabase/Vercel environment and verified public URL;
- applied managed migration `0015` plus a verified active public catalog generation;
- native Expo iOS/Android applications and store releases;
- durable offline private read projection, canonical revisions and conflict/tombstone implementation;
- live official recall ingestion and correction pipeline;
- OCR/model governance implementation;
- complete mutation/component/load/security/restore/native/Maestro suite;
- signed OTA rollout/rollback system;
- live billing, contextual ads, finance reconciliation, CEO/Ops consoles and tax workflow;
- external legal, privacy, food-claims, accessibility and country-pack approvals.

Do not convert a plan into a completion claim. Verify code, environment, test artifact and
production state separately.

## Required read order

1. `AGENTS.md` — repository-wide safety and engineering rules.
2. `README.md` — current setup, stack, documentation index and maturity.
3. This map — implementation status and document precedence.
4. `plans/MASTER_PLAN.md` — validation gates and commercial critical path.
5. `plans/IMPLEMENTATION_PLAN.md` — ordered delivery stages.
6. The exact flow in `plans/USER_FLOWS.md` and its specialist plans below.
7. `plans/QUALITY_ENGINEERING_PLAN.md` plus `plans/TEST_TRACEABILITY_MATRIX.md`.
8. `design.md`, `plans/UI_UX_PERFORMANCE_PLAN.md` and `mockups/README.md` for UI work.
9. `CODEX_PROMPT.md` only for the full multi-stage build assignment; do not treat it as a
   claim that all stages should be attempted in one unsafe change.

## Source map

| Change area | Read before editing | Must update together when contract changes |
|---|---|---|
| product scope/tier/ads | `COMMERCIAL_PRODUCT_PLAN.md`, `MASTER_PLAN.md` | README, flow, legal/data register, tests |
| auth/2FA/households | `AUTH_AND_SELF_HOSTING.md`, F01, security plan | migration/RLS, env/setup, C0 tests |
| barcode/GS1/OCR/product | F02, architecture, food-safety and AI plans | schema/provider contract, fixtures, tests, UI states |
| public product catalog | `docs/PUBLIC_CATALOG_OPERATIONS.md`, F02, architecture, compliance matrix | import generation, source/license evidence, RLS/RPC tests, activation/recovery evidence |
| MHD/use-by/recall | F02/F07, food-safety plan, compliance matrix | domain rules, UI copy, source/freshness, C0 tests |
| ingredient relevance | F03, commercial/legal boundaries | ruleset/version, explanations, unknown state, tests |
| inventory/consumption | F04, offline/data-integrity plan | transaction/RPC, ledger reconciliation, tests |
| plan/shopping | F05, commercial plan | unit rules, manual-intent preservation, tests |
| offline/sync | F08, offline/data-integrity plan | API/version/outbox/tombstone contract, native E2E |
| privacy/export/delete | F00/F06, legal register, security plan | consent/retention/job/schema, network/privacy tests |
| UI/design/accessibility | `design.md`, UI/UX performance plan, mockup catalogue | component/state specs, screenshots, accessibility/perf evidence |
| user research | UX research plan, competitor-validation plan | finding IDs, decision log, roadmap gate |
| tests/CI/release proof | quality plan and traceability matrix | scripts/workflows/evidence registry |
| errors/telemetry | observability plan and data register | typed taxonomy, allowlist, runbooks, privacy tests |
| billing/ads/stores | commercial and app-store plans | entitlements/CMP/store declarations, sandbox/network tests |
| CEO/Ops/finance/risk | CEO plans and `design-ceo.md` | metric/source registry, reconciliation, action authorization |
| deployment/self-hosting | auth/self-hosting plan, deploy README | Docker/compose/env/migrations/runbooks/restore evidence |

## Precedence when documents disagree

Resolve deliberately; do not silently choose the easiest text.

1. Applicable law, signed country pack and approved legal/security/food-safety decision.
2. C0 safety, privacy, authorization, billing and data-integrity invariants.
3. Canonical user-flow outcome and authoritative domain/data contract.
4. Specialist plan for the affected subsystem.
5. `design.md` and UI/UX performance rules.
6. Illustrative mockup/prompt.
7. Existing prototype behavior.

Generated mockups never override navigation, copy, dates, data, risk or state logic. If a
valid decision changes a higher-level contract, update every downstream document and
test in the same pull request or create an explicit migration issue.

## One vertical slice workflow

1. Inspect `git status`, current tests and actual code path.
2. Select one flow/outcome and assign requirement/risk/test IDs.
3. Write state, validation, persistence, authorization, telemetry and recovery contracts.
4. Change the smallest cohesive domain/data/API/UI surface.
5. Add meaningful tests at the lowest level and at the boundary where the risk appears.
6. Run `npm run verify` plus relevant real-stack/E2E/security/accessibility/performance
   gates that exist for the slice.
7. Perform visual QA for all relevant states and viewports.
8. Update setup, migration, source map, plan and evidence status truthfully.
9. Commit one coherent change and open a draft PR using the repository template.

## Definition of ready

A slice is ready when it has:

- a user problem and target group backed by evidence or a named hypothesis;
- a flow ID, risk class and explicit in/out scope;
- authoritative data source and unknown/failure behavior;
- privacy/legal/security review triggers identified;
- acceptance criteria and test plan;
- a rollback/disable strategy for provider, schema, billing, model or risky UI changes;
- no unresolved decision that would cause incompatible implementations.

## Definition of done

A slice is done only when:

- the authoritative state is persisted atomically/idempotently as required;
- authorization and tenant boundaries are proven at the database/API boundary;
- loading/empty/error/offline/stale/conflict/permission states are implemented where
  relevant;
- accessibility, responsive and performance budgets pass;
- tests are `PASS` for the exact commit/artifact without hiding retry/skip/blocker state;
- no forbidden data appears in logs, analytics, ads, URLs or third-party requests;
- migrations, env contract, documentation and runbook are current;
- rollout, monitoring and rollback are owned;
- “implemented”, “deployed” and “commercially approved” are reported as separate facts.

## Repository-level commands

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run verify
```

`npm run verify` is the current local baseline. The larger suite in the quality plan is a
target until its tooling and real environments exist; missing evidence remains
`NOT_RUN`/`NOT_PROVEN`, never green.
