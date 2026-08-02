# FoodOS ultimate commercial delivery plan

Status: **master index and critical path**. Detailed contracts live in the linked source
documents; this plan makes their dependencies and release order explicit.

## North-star outcome

FoodOS ships as a Germany-first commercial iOS/Android product with a companion web app
and portable Supabase backend. A household can securely scan and confirm product/batch
data, distinguish MHD from use-by, manage inventory and consumption, understand personal
ingredient relevance, plan meals and shopping, purchase Premium, exercise privacy rights,
receive source-backed recall warnings, and recover from offline/provider/account/update
failures.

No production or store-release claim is valid without signed legal/country gates,
automated functional/security/privacy evidence, real artifact provenance, a tested
rollback/restore path, and operational visibility.

## Sources of truth

| Area | Binding document |
|---|---|
| Commercial scope, tiers, ads, markets | `plans/COMMERCIAL_PRODUCT_PLAN.md` |
| User behavior | `plans/USER_FLOWS.md` |
| Architecture and boundaries | `plans/ARCHITECTURE_PLAN.md` |
| Ordered implementation | `plans/IMPLEMENTATION_PLAN.md` |
| Test strategy and release proof | `plans/QUALITY_ENGINEERING_PLAN.md` |
| Minimum flow/risk coverage | `plans/TEST_TRACEABILITY_MATRIX.md` |
| Errors, telemetry and incidents | `plans/OBSERVABILITY_AND_ERROR_CONSOLE.md` |
| CEO, revenue, usage, costs and tax | `plans/CEO_CONTROL_CENTER.md` and `design-ceo.md` |
| Auth and Docker operations | `plans/AUTH_AND_SELF_HOSTING.md` |
| Store submission | `plans/APP_STORE_RELEASE_PLAN.md` |
| Product design | `design.md` and `mockups/README.md` |
| Adaptive UI, accessibility and performance | `plans/UI_UX_PERFORMANCE_PLAN.md` |
| UX research and usability evidence | `plans/UX_RESEARCH_AND_USABILITY_TESTING.md` |
| Legal/data baseline | `legal/COMPLIANCE_MATRIX.md` and `legal/DATA_PROCESSING_REGISTER.md` |
| Red-team priorities | `plans/GAP_AUDIT_AND_OPTIMIZATION.md` |
| Competition and product validation | `plans/COMPETITIVE_RESEARCH_AND_VALIDATION.md` |
| Food safety and recalls | `plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md` |
| Offline data integrity | `plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md` |
| Security, AI/OCR and OTA | `plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md` |
| Company risk automation | `plans/CEO_RISK_AUTOMATION.md` |

## Workstreams

### W1 – Product and domain correctness

- GS1/EAN/OCR/manual scan and source/confidence model;
- batch-level MHD/use-by/lot/quantity/storage/provenance;
- official-source recall ingestion with exact/possible/text-candidate match states;
- inventory ledger, FEFO, atomic consumption and reconciliation;
- nutrition/portion/unit/time calculations and missing-data behavior;
- deterministic ingredient relevance without universal harm/medical claims;
- meal planning and shopping shortage derivation preserving user intent.

### W2 – Identity, authorization and data lifecycle

- verified email, mandatory TOTP/AAL2, non-helpdesk recovery and session/device management;
- household roles/invites/owner transfer and full RLS actor matrix;
- separated sensitive-profile, analytics, marketing, image and ad choices;
- export, correction, withdrawal, deletion, processor propagation and backup tombstones;
- support/admin separation with audited, minimized access.

### W3 – Web, native and offline platform

- Next.js web/account/support/admin surfaces;
- Expo/React Native app with native scanner, secure storage, notifications and haptics;
- versioned API/contracts shared with pure domain packages;
- versioned local projection/outbox, idempotency, per-entity conflict rules, tombstones
  and visible sync state;
- app upgrade/backward compatibility and expand/contract database migrations;
- compact/medium/expanded platform layouts with preserved task state;
- semantic design tokens/components, platform accessibility, measured web/native
  performance and OS permission behavior.

### W4 – External data and providers

- Open Food Facts license/provenance/cache/rate-limit/correction boundary;
- OCR on-device first, explicit cloud upload and short raw-image retention;
- approved German/EU recall sources, freshness/coverage and schema-drift quarantine;
- model registry/evaluation, signed OTA channel and provider/update rollback;
- SMTP, push, ads/CMP, analytics and support vendor contracts;
- StoreKit/Play Billing verification, entitlements, webhooks and reconciliation;
- timeout, circuit breaker, fallback, kill switch and cost ceiling per provider.

### W5 – Monetization and commercial operations

- Free/Premium entitlement matrix with safety/security/rights never paywalled;
- pricing experiment, subscription disclosures, restore/cancel/refund flows;
- contextual-only advertising outside sensitive flows, inappropriate-ad reporting;
- legal entity, tax/VAT, bookkeeping, invoices/store statements and support/refunds;
- developer accounts, store assets, beta cohorts, country storefront allowlists;
- problem interviews, concierge/closed beta, willingness-to-pay and continue/pivot/stop
  decision before full native/monetization investment;
- name/trademark/domain/content/dependency rights clearance before public brand spend;
- immutable Apple/Google/web/ad finance sources, exact ledger, payout/bank
  reconciliation, DATEV/tax-adviser workflow and CEO Control Center.

### W6 – Security, privacy, food law and accessibility

- DPIA, ROPA, TOMs, processor agreements, transfers, retention and incident procedure;
- OWASP ASVS/API/MASVS verification, threat modeling and abuse/rate controls;
- food-date/ingredient/nutrition copy and claims specialist review;
- medical-device/intended-purpose, Product Liability Directive, Cyber Resilience Act,
  consumer cancellation and DSA applicability review;
- BFSG/applicability and WCAG/platform-assistive-technology evidence;
- WCAG 2.2 AA, VoiceOver/TalkBack, accessible authentication, large text, target size,
  focus-not-obscured and reduced-motion proof for the exact release;
- App Privacy/Data Safety/CMP declarations proven against actual network behavior;
- Germany country pack before launch and independent pack per later market.

### W7 – Quality and release evidence

- stable requirement, risk and test IDs with code-owner traceability;
- unit/property/mutation/component/API/DB/integration/web/mobile test layers;
- privacy/security/accessibility/load/resilience/restore/store-sandbox gates;
- Core Web Vitals, route bundle, native startup/frame/memory and visual/state regression
  evidence on pinned route/device matrices;
- zero accepted C0/C1 flakes/skips and regression tests for every fixed defect;
- signed evidence manifest binding tests, source, dependencies, migrations and binaries;
- beta, canary, staged rollout, production synthetic and automatic stop/rollback;
- recall, offline state-machine, OCR-model and signed OTA compatibility evidence.

### W8 – Operations and customer trust

- privacy-safe OpenTelemetry pipeline and issue backend;
- FoodOS Ops Console, SLO/error budgets, alerts and release-proof view;
- on-call/support ownership proportional to published expectations;
- incident, breach, billing, provider, deletion, backup and rollback runbooks;
- encrypted backup/restore drills, capacity/cost monitoring and patch cadence;
- public status/support/deletion paths and honest user communication.
- CEO action queue connecting sourced money/product metrics with release, issue,
  compliance, provider and support state without mixing grains or claiming causality;
- C13/C14 company risk and corporate/platform calendar with source freshness, owner,
  automation authority, deadline, evidence and reversible containment.

## Critical delivery path

### Phase V – Prove the problem before the platform

Deliver:

- German target-user interviews and observed current workarounds;
- prototype tests covering normal EAN, unknown product, OCR ambiguity, recall and offline;
- representative task-based usability rounds following the research plan, including
  MHD/use-by and ingredient-uncertainty comprehension plus accessibility participants;
- concierge beta with measured capture burden, repeat trusted use, support cost and a real
  price test;
- product-name/trademark/domain/store-name discovery and an owned clearance decision;
- continue/narrow/pivot/stop journal with provisional KPI definitions.

Gate V:

- one narrow segment demonstrates recurring value and tolerable capture effort;
- no user must believe a normal EAN contains a concrete MHD;
- full native/ads/AI investment is paused if repeat use or willingness to pay is absent;
- all dashboard beta targets remain `PROVISIONAL` until a sourced baseline exists.
- no unresolved critical usability/safety/privacy misunderstanding survives a retest.

### Phase A – Prove the foundation

Deliver:

- monorepo target and domain/contracts boundaries;
- local pinned Supabase stack, repeatable migrations/seeds and pgTAP harness;
- verified email + mandatory TOTP/AAL2 + household onboarding/RLS matrix;
- test IDs, coverage, Playwright smoke, CI evidence skeleton;
- semantic design-token/component baseline, deterministic UI-state fixtures, visual and
  accessibility harness, web bundle budget plus lab performance baseline;
- typed errors, correlation IDs, redaction tests and minimal Ops issue ingestion;
- threat model, secure lost-factor/ops break-glass design and key/access inventory;
- CEO Release/Error cockpit using real CI/Ops sources; finance cards remain `NO SOURCE`
  until authoritative connectors exist;
- F00 privacy choices, data classification, legal/source surfaces;
- Docker build, backup and clean-machine restore baseline.

Gate A:

- unrelated/AAL1 access is impossible at DB and API levels;
- CI can recreate the stack and prove its exact commit/migration;
- forbidden telemetry canaries never reach the backend;
- critical public/auth web routes meet initial bundle/lab budgets and accessibility smoke;
- no work on ads or paid subscriptions before this gate.

### Phase B – Complete the trusted food loop

Deliver vertical slices F02–F05 in order: scan/batch, relevance, inventory/consumption,
nutrition, plan/shopping. Each slice includes pure rules, DB transaction/RLS, provider
contract, integration, web/native UI states, E2E, telemetry and runbook updates.

Add F07 recall ingestion/matching before any “food safety/recall” store claim and prove
F08 offline operation semantics for each critical mutation before native launch.

Gate B:

- ordinary EAN never fabricates a date;
- post-use-by stock is never recommended;
- inventory/log/ledger reconcile under retry and concurrency;
- unknown nutrition/ingredient data stays unknown;
- offline/conflict and provider-outage recovery preserve user intent;
- an applicable recall overrides MHD/planning and a stale source never renders “clear”.

### Phase C – Native product and account rights

Deliver:

- native iOS/Android application, secure sessions, scanner and offline queue;
- versioned local sync projection/outbox, signed OTA runtime compatibility and rollback;
- push/local reminders with timezone/DST and privacy behavior;
- export/deletion/withdrawal/owner-transfer workflows;
- accessibility/device matrix, Maestro and native API tests;
- adaptive tablet/foldable layouts plus native startup/frame/memory baselines in release
  builds on pinned low/mid/reference devices;
- TestFlight and Google internal/required closed beta.

Gate C:

- F00–F08 pass on real supported devices and web;
- deletion survives backup-restore verification;
- platform crash/ANR/hang and privacy gates pass;
- Core Web Vitals and native startup/frame/memory gates pass with no hidden broken device
  cohort; assistive-technology users reach the same critical outcomes;
- no WebView-only implementation or security bypass for reviewers;
- stale/removed devices cannot write and kill/relaunch cannot lose confirmed local intent;
- model/update canary rollback and MFA recovery game day pass.

### Phase D – Monetization under control

Deliver:

- StoreKit/Play Billing products, server entitlement verification and webhooks;
- restore/pending/grace/refund/revoke/offline behavior;
- Premium feature gates and subscription management;
- CMP-gated contextual ads with compile-time payload allowlist and kill switch;
- invalid-traffic placement/source guardrails and independent global ad disablement;
- financial reconciliation, refund/support and ad-report operations.
- Apple/Google/ad provisional ingestion followed by monthly final report, payout and bank
  reconciliation; CEO revenue/subscription/cost views with source trust labels.

Gate D:

- no wrongful charge/access and no sensitive ad/analytics payload;
- core safety/security/privacy functions remain free;
- actual store/network declarations match the release build;
- F06 plus billing chaos/reconciliation tests pass.

### Phase E – Commercial release

Deliver:

- full security/privacy/food/accessibility/legal review and Germany country pack;
- load/capacity/soak, backup restore, incident game day and rollout rehearsal;
- signed SBOM/provenance/test evidence for web, container, iOS and Android artifacts;
- production infrastructure, SLO dashboards, support/on-call and status communication;
- C13/C14 risk/corporate calendar using sourced cash, deadlines, access and platform state;
- finance close, tax-adviser-approved mappings, GoBD-oriented source retention and DATEV
  evidence workflow before any “tax due/filed/paid” claim;
- staged beta→canary→country rollout with automated stop criteria.

Gate E:

- Release Console says `PROVEN` for the exact artifacts;
- all C0/C1 findings closed and zero critical flakes/skips/not-run tests;
- legal/store owners sign the exact build/vendor/country configuration;
- post-deploy production synthetic and reconciliation pass before wider rollout.

## Release-blocking risk register

| Risk | Prevention/proof | Stop condition |
|---|---|---|
| Cross-household or AAL bypass | restrictive RLS, API auth, actor matrix, adversarial tests | any unauthorized row/existence disclosure |
| Wrong MHD/use-by conclusion | separate types, confirmation, deterministic rules, property/mutation/E2E | any fabricated date or unsafe recommendation |
| Stock/data corruption | ledger, transactions, locks, idempotency, reconciliation | negative/mismatched or duplicate effect |
| Sensitive data in telemetry/ads | typed allowlist, Collector redaction, network canaries | any forbidden field/vendor request |
| Wrong subscription entitlement | signed webhook/receipt, event ledger/reconciliation | wrongful charge, access or revoke |
| Deletion/export failure | lifecycle jobs, processor status, tombstones, restore drill | incomplete export or resurrected/deletable data |
| Provider/license failure | adapter/cache/provenance, OFF license boundary, fallback/kill switch | source/license breach or no safe fallback |
| Old app/schema incompatibility | version contracts, expand/contract migration, upgrade tests | supported client loses/corrupts data |
| Store rejection | native value, privacy/deletion/billing review, reviewer mode | unresolved guideline/country-pack gap |
| Operational blind spot | typed errors, OTel, Ops Console, synthetics/runbooks | critical flow has no safe detection/recovery |
| Unsustainable cost/abuse | quotas, rate limits, cache, budgets and alerts | uncontrolled provider/telemetry/cloud spend |
| Support/incident incapacity | defined coverage, severity targets and escalation owners | product promises exceed staffed response |
| Recall miss/false certainty | official-source coverage, lot-aware match tiers, stale state, specialist review | affected/use-by-invalid batch suggested or outage shown as clear |
| Offline duplicate/loss | local durable outbox, idempotency, revisions, tombstones, model tests | lost confirmed intent, duplicate effect or stale-member write |
| MFA/admin recovery abuse | pre-enrolled recovery, no support-only AAL2, break-glass audit | identity cannot be recovered safely or privileged bypass exists |
| OCR/model regression | model registry, per-field confirmation, eval/canary/rollback | false high-confidence date/type regression or no manual fallback |
| OTA/supply-chain compromise | signing, runtime fingerprint, provenance, two-person release | unsigned/wrong-runtime update or untraceable artifact |
| Liquidity/corporate failure | sourced 13-week cash, entity calendar, owner/adviser escalation | stale inputs shown green or survival deadline ownerless |
| Brand/IP failure | DPMA/EUIPO/domain/asset/license review and renewal calendar | unresolved infringement/takedown or unknown critical license |

## Frequently missed requirements now included

- timezones, DST, date-only semantics, decimal comma, units and rounding;
- app upgrade/downgrade, stale offline client and schema compatibility;
- concurrent household devices, ambiguous timeout and idempotency collision;
- source maps, exact build/release correlation and test-evidence authenticity;
- SMTP delivery/abuse, push token lifecycle and lock-screen privacy;
- store billing event ordering, grace/refund/revoke and financial reconciliation;
- ad/analytics SDK behavior before/after every consent combination;
- restored backups replaying deletion tombstones;
- Open Food Facts licensing/corrections and private-image contribution separation;
- alert fatigue, on-call reality, customer support/refund and status communication;
- cost budgets for OCR, provider APIs, telemetry, storage, CI/mobile builds and support;
- kill switches that cannot turn off mandatory security or user rights;
- Google personal developer account closed-test requirements where applicable;
- official recall coverage/permissions, lot ambiguity and corrections/retractions;
- lost TOTP/CEO break-glass without a support backdoor;
- OCR model version/evaluation, OTA signature/runtime fingerprint and rollback;
- trademark/domain/content/dependency rights and medical/intended-purpose copy register;
- StaRUG-style crisis monitoring, 13-week liquidity coverage and entity-specific deadlines;
- AdMob invalid-traffic monitoring and platform-account concentration/appeal evidence.

## Decision and ownership discipline

Each P0 decision records date, owner, alternatives, security/privacy/legal impact,
rollback path and review date. Every gate has one accountable owner even if several
people contribute. “The tool was green” is not an owner or an acceptance reason.

## Final definition of commercial done

FoodOS is commercially done for one release only when the exact web/container/iOS/
Android artifacts are traceably built from the approved commit, all required automated
and manual evidence is current and passing, the Germany country pack and vendor list are
signed, production can be observed/recovered/deleted/restored safely, and staged rollout
health is proven. Completion is reassessed for every release and every new country.
