# FoodOS quality engineering and release-evidence plan

Status: **binding commercial quality plan**. A feature is not complete because it works
once on a developer machine. It is complete only when its contract, negative paths,
security boundary, telemetry, automated tests, and evidence are attached to the exact
release artifact.

## Quality objective

FoodOS handles private household data, potentially health-related profiles, food-date
warnings, subscriptions, and shared inventory mutations. Testing therefore has five
simultaneous goals:

1. prove deterministic business rules;
2. prove frontend, backend, database, and native integrations work together;
3. prove tenants, AAL levels, privacy choices, and sensitive data stay isolated;
4. prove failures are recoverable and diagnostically visible without leaking data;
5. prove the artifact released is the artifact that passed the gates.

Code coverage alone is not proof. FoodOS combines examples, boundary tables,
property-based testing, mutation testing, database/RLS tests, contract tests, real-stack
integration tests, web/mobile E2E, security tests, performance tests, and production
synthetics.

## What “test every method” means

Every item in this test surface requires an automated positive, boundary, and relevant
negative test or an explicit reviewed exemption:

- exported pure domain rule or calculation;
- use case/application service and every typed outcome;
- parser, normalizer, mapper, unit/date conversion, and validation schema;
- public API route, server action, webhook, queue/job handler, and provider adapter;
- Postgres function/RPC, trigger, constraint, migration, and RLS policy;
- stateful UI component whose behavior cannot be proven through a flow test alone;
- each critical user-flow branch in `plans/USER_FLOWS.md`;
- each privacy, billing, advertisement, and account-rights boundary;
- each operational recovery command that can affect production data.

Do not add assertion-free tests for trivial re-exports, static type declarations,
framework glue, generated code, or purely decorative markup just to inflate a number.
An exemption records symbol/path, rationale, reviewer, linked higher-level test, expiry,
and risk. Unreviewed exemptions and expired exemptions fail CI.

## Traceability contract

Every test uses a stable ID:

`Q-<AREA>-<BEHAVIOR>-<LEVEL>-<NUMBER>`

Examples:

- `Q-SCAN-GS1-UNIT-001`
- `Q-AUTH-AAL2-DB-004`
- `Q-INV-CONSUME-INT-002`
- `Q-PRIV-NO-AD-PAYLOAD-E2E-001`

Each requirement record maps:

```text
requirement ID → flow ID → risk → code owner → contracts → test IDs
→ environments → evidence artifacts → release gate
```

CI validates that every P0/P1 requirement has at least one executable test and that every
critical risk has tests at two different levels. A Markdown checkbox is never accepted
as test evidence.

## Test architecture

| Level | Main scope | Planned tooling | Runs |
|---|---|---|---|
| L0 Static | format, lint, strict types, dead code, boundaries | ESLint, TypeScript, architecture rules | every push |
| L1 Unit | pure functions, schemas, state reducers | Vitest; Jest only where Expo requires it | local + every PR |
| L2 Property/mutation | broad input space and test effectiveness | fast-check, StrykerJS | targeted PR + nightly |
| L3 Component | UI behavior and accessibility semantics | Testing Library, user-event, axe | every PR |
| L4 Contract | routes, webhooks, external adapters, schemas | Vitest contract harness, recorded fixtures | every PR |
| L5 Database | schema, constraints, functions, triggers, RLS | local Supabase, pgTAP, DB lint | every PR |
| L6 Integration | Next/native clients + real local Supabase + jobs | Docker Compose test environment | every PR/merge |
| L7 Web E2E | browser-visible flows and network behavior | Playwright Chromium/Firefox/WebKit | smoke PR; full merge |
| L8 Mobile E2E | real native builds and OS behavior | Maestro on iOS/Android; native tests as needed | merge/nightly/release |
| L9 Security/privacy | ASVS/MASVS/API, data-flow and SDK leakage | CodeQL, dependency/secret scan, DAST, custom assertions | PR/nightly/release |
| L10 Performance | latency, throughput, resources, soak | k6 thresholds and platform profiling | nightly/release |
| L11 Resilience | outages, retries, conflicts, restore | fault injection, provider stubs, restore drills | nightly/release |
| L12 Production | non-destructive end-to-end health | synthetic accounts/data and store vitals | continuous/post-deploy |

## Detailed test requirements

### L0 – static and architectural checks

- strict TypeScript with no new `any`, unchecked casts, non-null assertions, or ignored
  diagnostics without a reviewed reason;
- lint, format, unused export/dependency detection, client/server import boundaries;
- ban client imports of service-role secrets and server-only modules;
- generated inventory of API routes, RPCs, jobs, webhooks, exported domain operations,
  environment variables, SDKs, and database migrations;
- generated inventory of recall sources, AI/OCR model versions, OTA channels/runtime
  fingerprints, signing roles, claims and company-risk automation actions;
- dependency lockfile integrity, license allow/deny list, secret scan, container/IaC
  validation, SBOM and vulnerability review;
- migration filename/order and schema-drift check.

### L1 – deterministic unit tests

Critical domain modules target 100% statement and branch coverage:

- GS1 AIs `01`, `10`, `15`, `17`, `21`, delimiters, invalid check digits and ambiguity;
- MHD/use-by state across locale, timezone, DST, leap year, invalid/missing date;
- quantity/unit conversions, rounding, portion basis, incompatible units;
- calories/macros, missing nutrition, weekly aggregation and bounded carryover;
- FEFO selection without recommending post-use-by stock;
- ingredient normalization, personal exclusion precedence, unknown state and stable sort;
- recall exact/possible/text-candidate/unchecked matching, precedence and retraction;
- offline operation state/revision/conflict/tombstone and payload-version upgrade rules;
- shopping aggregation/subtraction and preservation of manual user intent;
- typed error mapping, retry classification and telemetry redaction.

Application services target at least 90% branch coverage. Overall repository thresholds
start at 85% statements and 80% branches, then ratchet upward; coverage may never fall on
a changed critical module. A line executed without a meaningful assertion does not count
as adequate evidence during review.

### L2 – property-based and mutation tests

Property-based tests use reproducible seeds and shrink failing cases. High-value
properties include:

- parse→normalize→format is stable for valid GS1 inputs;
- consumption never increases stock and cannot produce a negative tracked balance;
- repeating an idempotent request produces one ledger effect;
- shopping shortage is never negative and decreases monotonically as usable stock rises;
- compatible unit aggregation is associative within defined rounding tolerance;
- unknown external data never becomes a confirmed zero or green assessment;
- post-use-by stock is never selected as consumable by any generated plan;
- redaction output never contains forbidden key/value classes;
- concurrent schedules preserve invariants regardless of operation order.
- fuzzy recall text can never produce an exact match, and a stale source cannot produce
  a clear state;
- any outbox delivery/reordering schedule yields at most one accepted server effect;
- deletion tombstones dominate every generated stale-device mutation sequence.

StrykerJS runs against pure domain and privacy-redaction packages. Target mutation score:
at least 85% for food-date, inventory, auth decision, privacy, billing entitlement, and
ingredient relevance rules; at least 75% for other owned domain code. A surviving
critical mutant blocks release even when the aggregate score passes.

### L3 – component and accessibility tests

Test behavior through roles, labels, visible text, focus, keyboard/touch actions, and
screenreader announcements rather than implementation selectors. Cover loading, empty,
success, validation error, provider error, offline, permission denied, conflict,
low-confidence, long German content, reduced motion, and destructive confirmation.

Automated axe checks are a floor, not full accessibility proof. Release checks include
VoiceOver, TalkBack, dynamic type/zoom, focus order, contrast, external keyboard, switch
control basics, reduced motion, and the manual scanner fallback.

Component fixtures also cover compact/medium/expanded window composition, 200% web
zoom, maximum useful native text sizes, 44 pt iOS/48 dp Android targets, focus not hidden
by sticky chrome, password/TOTP paste/autofill, ad success/timeout without layout shift
and every semantic status without color. Deterministic visual snapshots are reviewed for
intent; updating a baseline is not evidence that a change is correct.

### L4 – API and provider contracts

Every endpoint is tested for:

- valid request/response and versioned schema;
- malformed JSON, missing/extra fields, wrong content type and maximum sizes;
- unauthenticated, AAL1, wrong household/role, expired/revoked session;
- rate limit, timeout, cancellation, retry/backoff and circuit-open behavior;
- duplicate idempotency key and same key with different payload;
- provider not found, invalid payload, partial fields, slow response and outage;
- safe error response with correlation ID and no stack/secret/PII;
- method/path restrictions, cache headers and security headers.

Open Food Facts/official-recall/OCR/ad/billing tests use licensed deterministic fixtures in CI. Live
third-party APIs run only in a small scheduled contract-canary suite with rate limits;
they do not decide ordinary PR success and never receive private test data.

Webhook tests verify signature, timestamp tolerance, replay protection, out-of-order and
duplicate events, unknown product/SKU, refund/revocation, delayed delivery, poison event,
and auditable dead-letter recovery.

Recall adapters additionally verify immutable source revisions, jurisdiction/coverage,
freshness, corrections/retractions and quarantine on schema drift. AI/OCR contracts bind
the enabled provider/model version, retention/training setting and approved evaluation.
OTA contracts bind channel, signature, runtime fingerprint, artifact evidence and
rollback target.

### L5 – database and RLS

Use Supabase CLI plus pgTAP against a freshly reset local stack. Test:

- every table/column/type/default/constraint/index/foreign key expected by contracts;
- every function, trigger, transaction, invariant and permission grant;
- anonymous, AAL1, AAL2 owner, AAL2 member, removed member, unrelated household,
  service job and support/admin role;
- select/insert/update/delete separately, including attempted foreign IDs and joins;
- health/profile column visibility and least-privilege support access;
- simultaneous consumption, correction and plan generation under row locks;
- recall source revisions/match visibility, idempotent alerts and household isolation;
- offline operation idempotency payload hash/base revision, canonical change set and
  deletion tombstone precedence;
- idempotency and ledger reconciliation after retry/timeout;
- forward migration from every supported production version;
- schema drift, destructive migration review, backup/restore and deletion tombstones.

Database tests begin a transaction and roll back unless the test explicitly proves
commit/restart behavior. The suite uses synthetic users and never a copied production DB.

### L6 – real-stack integration

CI boots pinned FoodOS and official Supabase containers on an isolated network, applies
all migrations, seeds deterministic synthetic fixtures, waits on health checks, and then
runs through public interfaces. Mocks are used only at external provider boundaries.

Required integration scenarios:

- email confirmation/PKCE, TOTP enroll/challenge, session refresh/revocation;
- create household transaction and RLS visibility;
- scan lookup→normalize→save product and physical batch→reload;
- atomic consumption and inventory/event/log consistency;
- offline request retry with the same idempotency key;
- recall ingest→match→notify→correct/retract and stale-source degradation;
- kill/relaunch/reconnect around commit plus removed-member/stale-client rejection;
- export creation/download expiry and deletion propagation;
- subscription webhook→entitlement→restore/revoke;
- telemetry correlation across web/API/database/job without sensitive payloads.

### L7 – web E2E with Playwright

The P0 PR suite runs Chromium at 390×844 and validates one happy path plus the most
dangerous negative boundary for each changed critical flow. The full suite runs Chromium,
Firefox and WebKit at 360, 390, 430, medium and expanded windows where relevant.

It covers F00–F08, camera allowed/denied/mock stream, manual barcode, network offline,
slow provider, reload/deep link/back navigation, multiple tabs, session expiry, long
content, reduced motion, keyboard, responsive overflow, service worker/update behavior,
download/export and account deletion.

On first failure CI preserves a Playwright trace, screenshot, console/network errors,
DOM snapshot and JUnit result. Video is optional. The trace is attached to the test run
and commit; it is never uploaded to a public artifact store. Sensitive inputs and
responses are masked before capture.

Test retries are diagnostic only: passed first attempt=`PASS`; passed after retry=`FLAKY`;
never passed=`FAIL`. A flaky P0 test blocks release and enters the flake queue with an
owner and deadline. Critical tests cannot be silently skipped or quarantined.

Lighthouse CI and bundle reports run on deterministic public/account/core fixtures.
Camera/scanner/OCR/chart code is asserted absent from unrelated initial route chunks.
Lab data protects pull requests; production Core Web Vitals at p75 remain the commercial
field gate and are never inferred from a single Lighthouse score.

### L8 – native mobile tests

- pure shared domain tests run once in the shared package;
- Expo/React Native unit/integration tests cover navigation state, hooks, offline queue,
  secure session wrapper, permission logic and native bridge adapters;
- Maestro runs F00–F08 on an iOS simulator and Android emulator from real development or
  release-candidate builds;
- targeted XCUITest/instrumentation tests are added when camera, notifications, secure
  storage, background tasks, billing, or OS APIs cannot be proven reliably by Maestro;
- real-device matrix covers at least current/oldest supported iOS, current/oldest
  supported Android, small/large screen, low memory, dark mode, language and denied
  permissions;
- medium/expanded tablet/foldable resize and rotation preserve task state and use the
  intended rail/sidebar/list-detail composition rather than a stretched phone;
- test install, upgrade, app kill/relaunch, background/foreground, offline recovery,
  clock change, timezone change, deep links, notification tap, biometric/device-lock
  behavior, secure token removal on sign-out, and account switch;
- StoreKit and Play Billing sandbox tests cover purchase, pending, cancel, restore,
  expiry, grace period, refund, revoke, duplicate/out-of-order webhook and reinstall.

Release-build performance tests record cold/warm/hot TTID, scan decode-to-usable-result,
frame timing/frozen frames, memory after repeated camera cycles and background
battery/network behavior against `plans/UI_UX_PERFORMANCE_PLAN.md`.

TestFlight and Google internal/closed tracks are part of quality assurance, not merely
distribution. Store crash, hang, ANR, startup, memory, battery and permission metrics feed
the operational release gate.

### L9 – security and privacy verification

Use OWASP ASVS for web/backend, OWASP API Security Top 10 for APIs, and OWASP MASVS for
mobile. Automate what is stable and retain a manual evidence checklist for controls that
need expert review.

Required adversarial coverage:

- broken object/function-level authorization and cross-household IDs;
- AAL downgrade/bypass, session fixation, OTP abuse, account enumeration and recovery;
- recovery-code replay/rotation, helpdesk-only AAL2 attempt, privileged break-glass and
  role/signing-key separation;
- injection, XSS, CSRF where applicable, SSRF, path traversal, unsafe redirects;
- mass assignment, overfetching, excessive responses and unsupported HTTP methods;
- upload MIME/content mismatch, decompression/image bombs and OCR-provider abuse;
- rate-limit bypass, resource exhaustion and expensive product lookups;
- webhook forgery/replay, subscription entitlement fraud and ad SDK tampering;
- offline database/token extraction, rooted/jailbroken risk analysis, TLS and deep links;
- secrets/source maps/debug menus/admin endpoints in production artifacts;
- dependency, container, CI workflow and build-chain compromise.
- recall/provider poisoning, fuzzy false match, malicious barcode/package text and
  source-schema drift;
- OTA signature/runtime/channel override, compromised publisher and migration rollback;
- CEO A0–A3 authorization, reversible containment scope and forbidden automation absence.

Privacy tests inspect actual network traffic in “necessary only” and each consent state.
They fail on any forbidden telemetry/ad/crash field, SDK call before consent, unexpected
vendor/domain, raw image persistence, retention overrun, incomplete export/deletion, or
backup restore that resurrects deleted data. Session replay is disabled for initial
production; enabling it later requires a new DPIA/vendor review and proof that sensitive
screens and inputs cannot be captured.

### L10 – performance and capacity

The route-, asset-, Core Web Vitals and native device budgets in
`plans/UI_UX_PERFORMANCE_PLAN.md` are the binding UI thresholds. This section adds backend
capacity and whole-system behavior.

k6 scenarios use pass/fail thresholds rather than charts alone:

- smoke, normal load, peak, spike, stress, soak and recovery;
- auth/TOTP endpoints within safe rate limits, product lookup/cache, batch save,
  consumption, recall ingest/match, sync flush, Today aggregation, plan generation,
  export job, webhook bursts;
- external provider latency/outage with timeout/circuit-breaker behavior;
- database connection pool, slow queries, locks, index use, storage and queue depth;
- telemetry overhead and ad/analytics SDK impact;
- mobile startup, scan-to-result, frame stalls, memory growth, battery/network use.

Initial engineering targets, validated with product telemetry before becoming promises:

| Signal | Launch gate target |
|---|---:|
| Core API success excluding validated 4xx | ≥99.5% |
| Core API p95 under normal regional load | ≤500 ms excluding external provider time |
| Cached product lookup p95 | ≤750 ms |
| Uncached scan-to-review p95 | ≤3 s with honest loading state |
| Critical mutation p95 | ≤1 s |
| Web LCP p75 on target mobile | ≤2.5 s |
| Web INP p75 on target mobile/desktop | ≤200 ms |
| Web CLS p75 on target mobile/desktop | ≤0.1 |
| Native cold TTID p75 on reference mid-range device | ≤2.5 s |
| Native frozen frames in critical flows | 0 frames >700 ms |
| Crash-free native sessions | ≥99.8% |
| User-perceived ANR/hang | below platform bad-behavior thresholds with internal buffer |
| Background sync battery/network | no store-vital bad behavior |

No load test targets production without a written window, traffic cap, owner, abort
condition and approval. Production data is never used as load-test input.

### L11 – resilience, recovery and data integrity

- kill OFF/recall/OCR/SMTP/push/ad/billing independently and prove degradation;
- introduce latency, timeout, malformed response, rate limit and intermittent recovery;
- interrupt a mutation before/after commit and prove idempotent reconciliation;
- simulate two devices editing the same batch/plan and exercise conflict UX;
- rotate JWT/SMTP/provider secrets and TLS certificates;
- fill disk/queue/connection pool in staging and prove alerts/backpressure;
- restore encrypted backup onto a clean isolated environment and verify RPO/RTO;
- replay deletion tombstones before restored data becomes accessible;
- roll forward and back through expand/contract migrations and old mobile client versions;
- publish wrong-signature/wrong-runtime/crashing OTA in staging and prove rejection,
  automatic pause/fallback and operator rollback;
- run lost-factor and ops break-glass game days without a helpdesk bypass;
- inject stale cash/legal/platform sources and prove C13/C14 fail closed/escalate;
- disable OCR, ads, provider refresh, notifications or planning through kill switches
  without disabling auth, RLS, use-by warnings, export or deletion.

### L12 – production synthetic and post-release validation

Synthetic monitoring uses dedicated tagged accounts/households and clearly synthetic
products. It never touches a real household. Tests cover public health, login handshake,
AAL2 review path without weakening real MFA, protected read/write cleanup, product
provider canary, purchase entitlement canary where stores permit it, export/deletion
job health, and observability ingestion.
Recall source freshness/schema canaries and a synthetic non-real-product match validate
the pipeline without claiming complete coverage. OTA adoption/crash/sync/privacy
guardrails are checked per update ID.

Post-deploy smoke runs against the exact URL/build, checks logs/console/network, verifies
migration revision, then either promotes the canary or automatically stops/rolls back.

## Determinism and fixtures

- inject clock, timezone, UUID, random seed and external clients;
- freeze canonical test instants around midnight, DST, leap day and year boundary;
- maintain minimal licensed OFF fixtures plus malformed/partial variants;
- use fake brands, users, emails, GTINs, images, receipts and health profiles;
- reset databases from migrations and seed, never opaque shared state;
- one test owns its records and can run alone, reordered, parallel and repeatedly;
- snapshot only stable semantic structures; never approve a huge snapshot blindly.

## CI lanes

| Lane | Trigger | Blocking contents | Time budget |
|---|---|---|---:|
| Developer | pre-push/local | impacted static/unit/property/component/DB tests | ≤5 min target |
| PR fast | every PR | L0, impacted L1–L5, Chromium critical smoke, build | ≤12 min target |
| Merge full | protected branch | full L1–L7, integration, 3-browser E2E, evidence | ≤25 min target |
| Nightly | schedule | extended property/mutation, mobile E2E, DAST, load, resilience | variable |
| Release candidate | signed tag | all gates, iOS/Android builds, billing, privacy, restore, SBOM | no time shortcut |
| Post-deploy | each environment | synthetic smoke, telemetry/release linkage, canary gate | ≤10 min target |

Parallelize isolated suites and merge their native JUnit/coverage/trace artifacts. Never
set a required security, privacy, migration, billing, or P0 flow job to
`continue-on-error`.

## Flake, skip and regression policy

- `PASS` means first-attempt success; retries never convert a flaky result to green.
- P0/P1 release tests have zero accepted flakes and zero unexplained skips.
- platform/provider outage is `BLOCKED`, with status evidence; it is not rewritten as
  product success.
- each flake has a fingerprint, owner, reproduction artifact, severity and fix deadline;
- overall noncritical flake rate target is below 0.5% over 30 days;
- fixed bugs receive a regression test at the lowest effective level plus an end-to-end
  test when the user-visible contract was broken.

## Release evidence manifest

CI, never a developer-authored status file, generates a signed manifest containing:

- repository, branch/tag, full commit SHA and dirty-state assertion;
- dependency-lock hash, migration/schema hash and ruleset version;
- web build ID, Docker image digest, SBOM and provenance attestation;
- iOS build number/bundle fingerprint and Android version/AAB digest;
- exact test command, runner/tool versions, environment image digests and test seed;
- pass/fail/flaky/skip/not-run counts and links to JUnit, coverage, mutation, pgTAP,
  Playwright/Maestro, security, privacy, accessibility and performance artifacts;
- deployment target, timestamp, approvers, country pack and store configuration version.

The Release Console shows **NOT PROVEN** if an expected artifact is missing, does not
match the commit/build, is hand-edited, expired, or came from a non-protected workflow.
GitHub artifact attestations/signatures bind build provenance to the release.

## Definition of quality done

A vertical slice is complete only when:

- requirement and risk entries exist with stable IDs;
- contracts and error cases are typed before integration;
- the lowest effective tests plus required integration/E2E tests pass;
- changed critical rules meet coverage and mutation gates;
- RLS/privacy/network assertions pass where the flow touches personal data;
- failure produces a safe user message, correlation ID and observable typed issue;
- accessibility, offline, concurrency and rollback behavior are proven where relevant;
- documentation/runbook and telemetry dashboard are updated;
- CI generated evidence is attached to the exact artifact.

## Primary technical references

- Next.js testing: <https://nextjs.org/docs/app/guides/testing>
- Next.js Playwright guide: <https://nextjs.org/docs/app/guides/testing/playwright>
- Next.js lazy loading: <https://nextjs.org/docs/app/guides/lazy-loading>
- Core Web Vitals and thresholds: <https://web.dev/articles/vitals>
- WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- ARIA Authoring Practices: <https://www.w3.org/WAI/ARIA/apg/>
- React Native performance: <https://reactnative.dev/docs/performance>
- Android vitals: <https://developer.android.com/topic/performance/vitals>
- Playwright traces and CI practices: <https://playwright.dev/docs/trace-viewer>
- Supabase database testing/pgTAP: <https://supabase.com/docs/guides/local-development/testing/overview>
- Expo E2E with Maestro: <https://docs.expo.dev/eas/workflows/examples/e2e-tests/>
- OpenTelemetry: <https://opentelemetry.io/docs/>
- OWASP ASVS: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP MASVS: <https://mas.owasp.org/MASVS/>
- Grafana k6 thresholds: <https://grafana.com/docs/k6/latest/using-k6/thresholds/>
- StrykerJS mutation thresholds: <https://stryker-mutator.io/docs/stryker-js/configuration/>
- fast-check property-based testing: <https://fast-check.dev/docs/introduction/what-is-property-based-testing/>
- GitHub build provenance/attestations: <https://docs.github.com/code-security/supply-chain-security/understanding-your-software-supply-chain/about-supply-chain-security>
