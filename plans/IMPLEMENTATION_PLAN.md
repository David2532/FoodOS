# FoodOS implementation plan

Status: **ordered MVP delivery plan**. A stage is complete only when its exit gate is
green. Do not build later polish on top of a broken persistence or security boundary.

## Stage -1 – Product, brand and risk validation

Deliver:

- V1–V4 discovery from `plans/COMPETITIVE_RESEARCH_AND_VALIDATION.md`;
- staged research, representative recruitment, task fixtures and critical-issue retests
  from `plans/UX_RESEARCH_AND_USABILITY_TESTING.md`;
- measured scan/date/reconciliation usability with normal and unknown German products;
- concierge beta, willingness-to-pay test and continue/narrow/pivot/stop journal;
- preliminary DPMA/EUIPO/domain/store-name and asset/license inventory for counsel;
- initial threat model, provider concentration map and company-risk register;
- CEO cards remain schema/mockups with `NO SOURCE` until live sources exist.

Exit gate:

- a narrow segment shows recurring trusted use with acceptable capture/support burden;
- users understand EAN versus package date and all C0 comprehension issues are retested;
- users can distinguish MHD/use-by, personal relevance and unknown/stale/recall states
  without moderator teaching;
- product name and launch scope have owners and no known blocking conflict;
- later native, AI and monetization spend has an evidence-backed decision.

## Stage 0 – Baseline and product skeleton

Deliver:

- run and record `npm run verify` baseline;
- map existing components, mock data, route handlers, schema, and current Supabase client;
- establish feature/domain/infrastructure boundaries incrementally;
- add typed result/error conventions and shared async UI-state primitives;
- confirm semantic design-token layers, canonical five-tab navigation and compact/medium/
  expanded layout rules from `plans/UI_UX_PERFORMANCE_PLAN.md`;
- measure current route bundles and lab performance before setting an exception-free
  baseline; scanner code is isolated from non-scan startup routes.

Exit gate:

- existing Today, Inventory, Scan, Plan, and Shopping views still render;
- no unrelated user work removed;
- lint, typecheck, tests, and build pass.
- baseline screenshots, accessibility smoke and bundle report exist for the exact commit.

## Stage 0Q – Quality, telemetry and release-proof foundation

Deliver:

- machine-readable requirement/risk/test inventory using stable IDs from the Quality
  Plan and Traceability Matrix;
- Vitest coverage, property-test and targeted mutation-test harness;
- local Supabase reset/seed/db-lint/pgTAP pipeline and AAL/RLS actor fixtures;
- Playwright web E2E with first-failure traces and true PASS/FLAKY/FAIL reporting;
- deterministic component/state harness, visual regression, axe plus manual keyboard/
  screen-reader checklist, Lighthouse CI and bundle-budget reporting;
- typed error taxonomy, correlation/flow/release identifiers and telemetry field allowlist;
- OpenTelemetry Collector redaction test plus initial issue/release backend;
- CI evidence manifest skeleton bound to commit, lockfile, migrations and build digest.

Exit gate:

- PR lane recreates the local stack and executes L0–L7 critical smoke within target;
- a deliberately broken C0 rule, RLS policy and privacy canary each fail the correct gate;
- a retried test appears as FLAKY, and missing/stale evidence appears NOT PROVEN;
- an injected safe error links flow→trace→release with no forbidden telemetry field.
- an intentional focus, CLS or bundle regression fails the matching UI/performance gate.

## Stage 1 – Authentication, mandatory 2FA, onboarding, and RLS

Deliver:

- current official Supabase SSR/browser session setup;
- German verified-email sign-in and redirect/recovery states;
- TOTP enrollment/challenge, AAL1/AAL2 gate, factor recovery/replacement security events;
- pre-enrolled one-time recovery material and reviewed lost-factor ceremony with no
  helpdesk-only AAL2 bypass; separate audited ops break-glass design;
- transactional first-household onboarding;
- authenticated shell and profile/household context;
- RLS policies and tests for AAL1 denial, AAL2 access, and two-household isolation;
- local preview mode remains clearly labeled and cannot masquerade as persistence.

Exit gate:

- F01 acceptance path passes after reload;
- second user cannot select/update/delete first household data;
- no secret reaches client bundles or logs;
- lost-factor and privileged recovery adversarial tests pass and notify/revoke correctly.

## Stage 1A – Privacy baseline and account rights

Deliver:

- age/market gate and versioned, separated privacy choices;
- data classification, logging allowlist, processor/subprocessor inventory;
- privacy/imprint/terms/source surfaces and Open Food Facts attribution;
- in-app/web export and deletion orchestration with recent AAL2;
- automated retention skeleton for OCR artifacts, logs, exports, and backups.

Exit gate:

- F00 and account-rights portion of F06 pass;
- “only necessary” emits no nonessential SDK traffic;
- deletion/export and privacy text match `legal/DATA_PROCESSING_REGISTER.md`.

## Stage 2 – Product scan to persistent batch

Deliver:

- camera permission/recovery, manual barcode, EAN/UPC/GS1 decode;
- local cache-first product lookup and validated OFF fallback;
- normalized metadata with provenance and confidence;
- manual unknown-product path;
- GS1 AI parsing for `01`, `10`, `15`, `17`, `21`;
- OCR adapter boundary, low-confidence review, and complete manual MHD/lot fallback;
- product and physical batch persistence with idempotent save;
- recall-source adapter boundary, immutable notice/provenance schema and exact/possible/
  text-candidate match engine; no production feed claim before terms/coverage approval.

Exit gate:

- F02 acceptance and failure paths pass;
- camera closes after successful decode;
- no invented MHD, nutrition, ingredient, or product image is persisted;
- scan flow screenshots pass 360/390/430 px visual QA;
- camera/scanner code remains lazy, permission/manual recovery is accessible and local
  decode-to-usable-result meets the approved route/device performance budget;
- F07 recall/stale-source behavior passes and an in-date recalled batch is excluded.

## Stage 3 – Personal ingredient relevance

Deliver:

- food-risk profile for allergens, exclusions, preferences, and optional exposure notes;
- normalization and deterministic relevance rules;
- five stable relevance levels with reason, evidence/source, confidence, and version;
- product ingredient screen using real available metadata;
- profile edit triggers deterministic recalculation or cache invalidation.

Exit gate:

- F03 acceptance path passes;
- personal conflicts sort first; unknown never appears as green;
- no E-number-only harm rating or medical diagnosis wording;
- rule tests cover representative allergen, additive, missing-data, and override cases.

## Stage 4 – Inventory and consumption ledger

Deliver:

- inventory grouped by product and physical batch with FEFO-aware ordering;
- storage, quantity/unit, opened date, MHD/use-by distinction, cost and status;
- batch detail actions: consume, correct, move, open, dispose;
- atomic consumption mutation and inventory event ledger;
- portion/unit conversion with explicit unsupported states;
- Today reads persisted log and inventory data.

Exit gate:

- F04 acceptance and idempotency tests pass;
- concurrent/repeated request cannot silently create negative or double-reduced stock;
- dashboard changes exactly once and survives reload;
- expiry actions always provide a next step.

## Stage 5 – Daily and weekly nutrition

Deliver:

- editable calorie and macro targets with optional existing-user defaults;
- day/week aggregation with transparent missing nutrition handling;
- remaining-target language and bounded carryover, default maximum 10%;
- consistent portion basis and source display;
- accessible progress visualization with text equivalents.

Exit gate:

- deterministic daily/week calculations match fixtures;
- missing nutrition is excluded and labeled, never counted as zero silently;
- Today and detailed week view pass visual/accessibility checks.

## Stage 6 – Meal plan and shopping derivation

Deliver:

- recipes/meals, portions, day slots, aggregate nutrition;
- suggestions prioritizing suitable expiring inventory;
- unit-aware ingredient aggregation and usable-inventory subtraction;
- generated shortages plus preserved manual shopping items;
- grouped shopping mode, persistent check state, optional source-backed price estimates;
- regeneration/revision behavior without deleting user intent.

Exit gate:

- F05 acceptance path passes;
- incompatible units are never merged silently;
- manual items survive recalculation;
- Plan and Shopping boards are reflected in hierarchy while canonical navigation and
  real behavior remain correct.

## Stage 7 – Native apps, PWA, accessibility, and resilience

Deliver:

- installable manifest/icons and useful offline shell;
- Expo/React Native apps with native scan, secure session storage, offline queue,
  notifications, deep links, haptics, and OS accessibility;
- compact/medium/expanded window layouts using native Apple/Android navigation/materials
  without stretched-phone tablet UI or unreadable translucent critical content;
- versioned local projection/outbox and the entity conflict/tombstone rules in
  `plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md`;
- signed OTA channels, runtime fingerprints, two-person production publish, staged
  guardrails and tested rollback without production anti-bricking overrides;
- honest offline/cache messaging and retry behavior;
- camera/privacy explanation, profile and household deletion path, data notice;
- keyboard, focus, touch targets, reduced motion, screenreader announcements;
- release-build startup/frame/frozen-frame/memory/battery measurement on the pinned
  low/mid/reference phone, tablet/foldable and poor-network matrix;
- optimized generated assets and `ASSETS.md` maintenance;
- rate limiting, timeouts, structured errors, safe logs.

Exit gate:

- PWA install audit and offline recovery smoke pass;
- critical flows meet WCAG 2.2 AA target checks;
- VoiceOver/TalkBack, Dynamic Type/font scaling, 44 pt iOS/48 dp Android targets,
  accessible auth and Reduce Motion critical-path evidence passes;
- web Core Web Vitals and native startup/frame/memory targets in the UI/UX plan pass with
  no hidden failing device/route cohort;
- no overflow at 320/360/390/430 px and no keyboard-obscured primary action;
- F08 multi-device/kill/relaunch/stale-member/tombstone/upgrade tests pass;
- wrong-runtime/unsigned/regressing OTA is rejected or automatically paused/rolled back.

## Stage 8 – Monetization and store commerce

Deliver:

- server-verified StoreKit/Play Billing entitlements, restore/refund/revoke handling;
- Free/Premium gates from `plans/COMMERCIAL_PRODUCT_PLAN.md`;
- consent-gated contextual/non-personalized ad adapter with a compile-time payload
  allowlist and zero ad placements in sensitive flows;
- subscription management, purchase terms, inappropriate-ad reporting;
- invalid-traffic monitoring, test-ad enforcement, placement/source anomaly and global
  ad kill switch independent of the core product;
- network/privacy tests and real App Privacy/Data Safety/CMP inventory.

Exit gate:

- F06 sandbox purchase/restore/expiry paths pass on both platforms;
- forbidden personal/product/health fields never reach ad/analytics/crash vendors;
- core safety, security, export, deletion, and consent refusal are not paywalled;
- ad serving can be disabled without affecting Premium, inventory, recall or rights.

## Stage 8C – CEO Control Center and financial truth

Deliver:

- separate AAL2 `/ops` app, roles/audit and CEO Today action queue;
- signed CI/Ops Release, Test, Error and Incident views first;
- Apple/Google subscription/order and AdMob provisional connectors with freshness/status;
- immutable monthly financial report ingestion, exact double-entry ledger and correction
  chain; no floating-point money;
- payout→bank and transaction→entitlement reconciliation with unknown-line review queue;
- versioned metric catalogue for revenue, MRR, churn, usage, cost and margin;
- tax trust states, deadline/source workflow and validated DATEV export for adviser review;
- data quality, connector failure, role/privacy and CEO Playwright E2E tests;
- C13/C14 risk and corporate/platform calendar from `plans/CEO_RISK_AUTOMATION.md`,
  including 13-week sourced cash, legal/platform deadlines and A0–A3 action controls.

Exit gate:

- every card exposes definition/source/period/freshness/trust state;
- estimates cannot render as final, reconciled, adviser-approved, filed or paid;
- final monthly numbers reconcile to final reports and bank/accounting evidence;
- production excludes all sandbox/test transactions and personal food/health analytics;
- stale, missing, unknown or mismatched sources block final/green status;
- tax adviser approves entity/chart/tax mappings before operational tax use;
- stale survival inputs never render green; forbidden autonomous legal/safety actions are
  technically impossible and reversible A2 containment is game-day tested.

## Stage 9 – Deployment and production proof

Deliver:

- final migrations applied to an EU-region Supabase project;
- auth redirect URLs and production environment variables configured;
- Vercel deployment in an EU-near region;
- production smoke for auth, protected mutation, product lookup, navigation, and RLS;
- logs/console checked; deployment evidence recorded;
- FoodOS Ops Console release proof, service/flow health, providers/jobs and alert routing;
- recall/sync/model/OTA state, access/key inventory and credential/certificate expiry;
- signed SBOM/provenance/evidence manifest for web/container/native artifacts;
- Git branch/commits and draft PR if GitHub access is available.

Exit gate:

- full `npm run verify` and browser smoke suite pass on the deployed revision;
- production URL is opened and verified, not inferred from a CLI message;
- exact migration revision and environment-variable names are documented;
- the Release Console says PROVEN for the exact deployed artifact; no required result is
  flaky, skipped, blocked, stale or missing;
- if external access is missing, all local stages are complete and exactly one minimal
  access blocker is reported without inventing a URL.

## Stage 10 – Legal and store release

Deliver:

- completed DPIA/ROPA/TOM/vendor/transfer/retention evidence and incident drill;
- signed Germany country pack, food-claim and accessibility review;
- BGB §312k direct-web cancellation review, MDR intended-purpose/claims review, Cyber
  Resilience Act/Product Liability/DSA applicability and trademark/IP clearance;
- native build traffic audit, App Privacy/Data Safety declarations, reviewer path;
- subscription/consumer/tax/legal-entity readiness and store evidence pack;
- storefront allowlist that contains only approved countries.

Exit gate:

- every gate in `plans/APP_STORE_RELEASE_PLAN.md` is signed against the exact build;
- no open P0 legal, privacy, food-safety, security, commerce, or deletion finding;
- Apple/Google production release is verified or the exact external review blocker is
  reported without claiming approval;
- recall-source rights/coverage and company/entity/adviser/insurance responsibilities are
  signed for the exact release.

## Cross-stage definition of done

Every completed vertical slice must include:

- domain and UI states, including relevant failure/recovery paths;
- validation and authorization at the trust boundary;
- appropriate unit/integration/browser tests;
- mobile visual QA against `design.md` and `mockups/README.md`;
- no dead mocks, debug output, duplicated rules, or abandoned abstractions;
- updated migration/environment/setup docs when contracts changed;
- a concise completion note referencing the flow ID and executed checks.
