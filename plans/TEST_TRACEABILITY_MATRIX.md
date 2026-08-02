# FoodOS test traceability matrix

Status: **minimum release coverage map**. This file defines required evidence families;
the implementation will move individual cases into machine-readable requirement/test
registries while preserving these stable IDs.

## Risk classes

| Class | Meaning | Test/release rule |
|---|---|---|
| C0 | privacy/security breach, wrong use-by/recall behavior, confirmed-intent data loss/corruption, unauthorized charge/update/admin action | two test levels minimum; no skip/flake; manual release sign-off |
| C1 | critical flow unavailable, lost user intent, entitlement/deletion/export failure | unit/contract plus integration/E2E; no known release defect |
| C2 | degraded noncritical behavior, accessibility/performance regression | automated gate and owned remediation |
| C3 | cosmetic/low-impact defect | visual/component coverage as appropriate |

## User-flow matrix

| Flow | Required test families | Critical negative cases | Evidence gate |
|---|---|---|---|
| F00 eligibility/privacy | consent reducer unit; CMP/ad contract; web+mobile E2E; network privacy test | necessary-only still usable; no SDK before choice; withdrawal; version update; under-age path | zero forbidden requests/fields; consent version proof |
| F01 auth/2FA/household | auth adapter contract; pgTAP AAL/RLS; real-stack integration; web+mobile E2E; rate/security | wrong password, unverified email, TOTP clock skew/replay, AAL1 blocked, removed member, recovery/factor change | AAL1 cannot access any private table; two-tenant matrix green |
| F02 scan/batch | parser examples+properties+mutation; provider contracts; persistence integration; camera web/mobile E2E | invalid check digit, EAN without date, GS1 ambiguity, low OCR confidence, OFF timeout, duplicate retry, post-use-by date | no invented data; one physical batch per confirmed intent |
| F03 ingredient relevance | normalization/rule unit+property+mutation; DB version/cache; component/a11y; E2E | allergen precedence, unknown data, missing profile, data/source change, injection in ingredient text | stable order, reason/source/confidence; no medical claim |
| F04 consume/inventory | calculation unit/property+mutation; RPC/locking pgTAP; concurrency integration; E2E | insufficient stock, same idempotency key, concurrent devices, commit-timeout retry, incompatible unit | ledger/log/balance reconcile exactly once; never negative |
| F05 plan/shopping | aggregation unit/property+mutation; DB integration; component; web/mobile E2E | incompatible units, expired/use-by stock, concurrent edit, manual item regeneration, rounding | shortages correct; manual intent preserved; no unsafe suggestion |
| F06 subscription/export/delete | billing/webhook contracts; entitlement integration; store sandbox E2E; export/delete privacy and restore drills | pending/cancel/refund/revoke, duplicate/out-of-order event, reinstall restore, last household owner, deletion backup resurrection | no wrongful charge/access; export complete; deletion propagated |
| F07 recall | source/parser contract; match unit/property/mutation; DB/job integration; web/mobile E2E | exact lot, GTIN-only possible, fuzzy candidate, correction/retraction, stale/outage, duplicate/late event | affected batch excluded; stale never clear; unrelated household gets no detail |
| F08 offline sync | state-machine/model/property; API/idempotency/DB integration; multi-device native E2E | kill before/during/after commit, reordered duplicate packets, stale revision/client, removed member, tombstone restore | one accepted effect; no lost confirmed intent, resurrection or negative stock |

## UI, accessibility and performance matrix

The exact thresholds and device/route budgets live in
`plans/UI_UX_PERFORMANCE_PLAN.md`.

| Surface | Required evidence | Critical negatives | Gate |
|---|---|---|---|
| shared components/states | component role/name/state/action tests; deterministic visual diff; light/dark/high-contrast where supported | long German text, unknown/stale, retained validation input, screen-reader announcement spam, color-only meaning | semantic token/component contract; intentional snapshots |
| responsive/adaptive | Playwright viewport matrix; native tablet/foldable resize/rotation | overflow, stretched phone, lost form/scan state, focus/primary action hidden by keyboard/sticky UI | compact/medium/expanded outcome preserved |
| auth/accessibility | keyboard plus VoiceOver/TalkBack; paste/manager/autofill; target-size audit | obscured focus, cognitive transcription requirement, unlabeled factor control, 44 pt/48 dp miss | same F01 outcome with assistive technology |
| web startup/interactions | Lighthouse CI, bundle diff and RUM by route/release/device class | scanner/chart code on unrelated route, late ad/image shift, slow device cohort hidden by mean | LCP/INP/CLS p75 and route budgets pass |
| native quality | release-build TTID, frame/frozen-frame, memory cycle, battery/network and store vitals | camera buffer leak, JS-thread stall, retry/wake-lock storm, broken device cohort | pinned device targets pass; zero critical frozen frame |
| usability | task observation/retest following UX research plan | moderator-taught MHD/use-by, universal-safety interpretation, unrecoverable offline/permission state | no unresolved critical finding; decision evidence linked |

## Backend/API matrix

Every row expands to valid, validation, authentication, authorization, idempotency,
rate/timeout, dependency failure, privacy/logging and observability cases.

| Surface | Minimum proof |
|---|---|
| Product lookup API | Zod contract, cache hit/miss/stale, OFF malformed/timeout/429/404, safe source attribution |
| Product/batch mutation | AAL2+membership, transaction rollback, idempotency, provenance, quantity/date validation |
| Consumption RPC | lock/concurrency, exact ledger reconciliation, duplicate key, insufficient stock |
| Planning/shopping | deterministic revision, unit compatibility, usable-stock filter, manual-item retention |
| Profile/relevance | explicit consent status, field visibility, ruleset invalidation, source/confidence |
| Consent API | version/purpose/vendor ledger, withdrawal, no bundled decisions, audit integrity |
| Export job | recent AAL2, complete schema, signed URL expiry, job retry, artifact deletion |
| Deletion job | reauth, membership ownership decision, processor propagation, tombstone and backup aging |
| Billing webhook | signature/replay, order independence, SKU mapping, refund/revoke, dead-letter recovery |
| Notifications | preference/consent, timezone/DST, minimal lock-screen text, invalid token cleanup |
| Recall ingestion/matching | source terms/schema, immutable revisions, exact/possible/fuzzy rules, freshness, correction/retraction, idempotent alerts |
| Sync operation API | AAL2/membership recheck, base revision, same-key hash, canonical change set, tombstone, client-version policy |
| OCR/model registry | approved model/purpose/version, evaluation result, field confidence, provider retention, canary/rollback/kill switch |
| OTA/release API | protected signer/role, runtime fingerprint, staged cohort, evidence binding, pause/rollback, no runtime publish credential |
| Admin/Ops API | separate admin role+AAL2, aggregation only, audit log, no arbitrary SQL/user browsing |
| CEO risk actions | authoritative source/freshness, owner/escalation/expiry, A0–A3 role, scoped reversible A2, forbidden-action absence |

## Database/RLS actor matrix

Run every applicable CRUD/RPC operation as:

| Actor | Expected access |
|---|---|
| Anonymous | public/legal/health endpoints only; no private table |
| Authenticated AAL1 | MFA/recovery/limited account boundary only |
| AAL2 household owner | own household operations within owner permissions |
| AAL2 household member | own household operations within member permissions |
| AAL2 unrelated user | zero row existence/content leakage |
| Removed member | access revoked immediately after claims/policy refresh |
| Support operator | aggregated/minimized diagnostics only; explicit audited elevation if approved |
| Narrow service job | only named tables/actions needed by that job |
| Service-role negative control | never present in browser/mobile build, logs or ordinary request path |

Test row counts, error shape and timing where feasible so denial does not leak whether a
foreign object exists.

## Cross-cutting edge-case inventory

### Time and locale

- Europe/Berlin DST gaps/overlaps, UTC server, device timezone change;
- midnight race, leap day, month/year boundary, clock skew and invalid locale;
- MHD date-only semantics versus timestamps; notification rescheduling;
- German decimal comma, metric units and translated long labels.

### Identity and shared state

- session refresh/revoke on two devices; password/factor change;
- lost TOTP, recovery-code replay/rotation, helpdesk social engineering and ops break-glass;
- invite accept/expire/replay, owner transfer, last-owner deletion;
- concurrent inventory edits, offline queue ordering and conflict resolution;
- old mobile client against expanded/contracted API/schema.

### Product and food data

- valid/invalid/short/long barcode, leading zero, GTIN alias/collision;
- provider product deleted/renamed or data/language/source license changed;
- missing nutrition, `0` versus unknown, per-100g versus portion, liquid/solid units;
- ingredients with HTML/control/Unicode confusables and very long text;
- no image, wrong image type/size, animated or malicious file;
- MHD versus use-by, past/future implausible date, OCR transposition and lot ambiguity.
- exact/possible/fuzzy recall, all-lot notice, correction/retraction, jurisdiction and stale source;
- OCR model/language/device regression and malicious package text/image payload.

### Commerce and ads

- Store account differs from FoodOS account; family/device change;
- pending payment, grace, billing retry, refund, chargeback, revoke, webhook lag;
- premium expires while offline; entitlement cache tampering;
- CMP vendor/purpose change, consent expiry, ATT denial and ad provider outage;
- inappropriate/adult/misleading ad report and global ad kill switch;
- test-ad enforcement, accidental-click placement and invalid-traffic/source spike;
- prove no sensitive context is used for placement or targeting.

### Data lifecycle and operations

- partial export/deletion job, retry and poison item;
- legal-retention exception isolated from active product use;
- backup made before deletion and restored afterward;
- observability backend unavailable/full/slow without breaking product mutations;
- release with missing source map, wrong migration or mismatched build evidence;
- TLS/secret/certificate rotation, disk/queue/connection exhaustion.
- 13-week cash source missing/stale, corporate/platform deadline timezone/escalation;
- OTA wrong signature/runtime, partial asset download, crash fallback and schema rollback;
- accepted risk expiry, owner/deputy absence and forbidden CEO automation attempt.

## Minimum named C0 tests

| Test ID | Assertion |
|---|---|
| `Q-AUTH-AAL1-DB-001` | AAL1 cannot select any private FoodOS table |
| `Q-AUTH-TENANT-DB-002` | unrelated AAL2 user cannot infer/read/write another household |
| `Q-DATE-USEBY-UNIT-001` | post-use-by batch is never classified as consumable |
| `Q-DATE-EAN-E2E-002` | ordinary EAN never fabricates an MHD/use-by value |
| `Q-INV-IDEMPOTENCY-INT-001` | retry after ambiguous response changes stock/log/ledger once |
| `Q-INV-CONCURRENCY-INT-002` | simultaneous consumption never creates negative stock |
| `Q-ING-UNKNOWN-UNIT-001` | missing ingredient evidence never becomes green/safe |
| `Q-PRIV-AD-NET-001` | ad endpoint receives no product/GTIN/date/health/household field |
| `Q-PRIV-CONSENT-NET-002` | necessary-only state initializes no nonessential SDK/vendor |
| `Q-PRIV-DELETE-RESTORE-003` | restored backup cannot reactivate deleted account data |
| `Q-BILL-WEBHOOK-INT-001` | duplicate/out-of-order store events cannot grant/revoke incorrectly |
| `Q-BILL-RESTORE-MOBILE-002` | legitimate purchase restores after reinstall without data loss |
| `Q-OPS-REDACTION-UNIT-001` | telemetry allowlist rejects every forbidden field class |
| `Q-RELEASE-PROVENANCE-CI-001` | release manifest/artifact digest matches protected commit/build |
| `Q-RECALL-EXACT-INT-001` | exact GTIN+lot notice excludes the affected batch even before MHD |
| `Q-RECALL-STALE-E2E-002` | stale/unavailable recall source cannot render a clear/no-recall state |
| `Q-SYNC-COMMIT-MOBILE-001` | kill/retry around commit preserves one accepted effect and local intent |
| `Q-SYNC-TOMBSTONE-INT-002` | restored backup and stale device cannot resurrect deleted data |
| `Q-AUTH-RECOVERY-E2E-003` | email/helpdesk assertion alone cannot obtain AAL2; recovery rotates/revokes/notifies |
| `Q-OCR-MODEL-CANARY-001` | false-high-confidence date/type regression pauses model rollout |
| `Q-OTA-SIGNATURE-MOBILE-001` | unsigned or wrong-runtime production update is rejected |
| `Q-CEO-FORBIDDEN-AUTO-001` | no role/API can autonomously file legal/tax/insolvency action or mark food safe |
| `Q-CEO-STALE-CASH-002` | incomplete/stale bank-payables inputs cannot render liquidity green/final |

## Minimum named UX and performance tests

| Test ID | Assertion | Risk |
|---|---|---|
| `Q-UX-PRIMARY-ACTION-E2E-001` | critical screens expose one unambiguous primary action above safe area and keyboard | C2 |
| `Q-A11Y-FOCUS-WEB-001` | sticky chrome never fully obscures keyboard focus or its error | C2 |
| `Q-A11Y-AUTH-WEB-002` | password/TOTP paste, manager/autofill and non-cognitive recovery work | C1 |
| `Q-A11Y-TARGET-MOBILE-003` | critical iOS/Android controls meet 44 pt/48 dp target rules | C2 |
| `Q-A11Y-SCREENREADER-MOBILE-004` | F01–F08 expose correct name/role/state/order and result | C1 |
| `Q-PERF-CWV-RUM-001` | LCP/INP/CLS meet good p75 thresholds for critical web route families | C2 |
| `Q-PERF-BUNDLE-CI-002` | initial routes and lazy scanner chunk remain inside approved budgets | C2 |
| `Q-PERF-NATIVE-START-003` | reference-device TTID meets release-build targets | C2 |
| `Q-PERF-NATIVE-FRAME-004` | critical scroll/scan/plan flows meet frame target with zero frozen frames | C1 |
| `Q-PERF-AD-CLS-WEB-005` | permitted ad success/failure/timeout stays inside CLS budget | C2 |
| `Q-UX-OFFLINE-STATE-E2E-006` | local/pending/synced/conflict/rejected states remain distinct and actionable | C1 |

## Evidence states

| State | Meaning |
|---|---|
| `PASS` | first-attempt success on required environment and matching artifact |
| `FAIL` | assertion or quality threshold failed |
| `FLAKY` | succeeded only after retry; blocks C0/C1 release |
| `SKIP` | intentionally not executed with owner/rationale/expiry; not green evidence |
| `BLOCKED` | environment/vendor prevented execution; release remains unproven |
| `NOT_RUN` | expected evidence missing |
| `STALE` | evidence belongs to different commit, schema, ruleset, SDK or artifact |

Only `PASS` satisfies a release gate.
