# FoodOS security, AI/OCR and update governance

Status: **binding threat-model and change-control baseline**. Security controls are chosen
from assets, abuse cases and impact, then verified. A vendor badge or a single scanner
does not make FoodOS secure.

## Protected assets and trust boundaries

Highest-impact assets are authentication factors and sessions, household isolation,
health-related profiles, inventory/consumption, OCR images, deletion evidence, signing
keys, production/CEO roles, store/billing credentials, finance records, backups and the
ability to publish app/OTA updates.

Trust boundaries exist at camera/deep-link input, local database, browser/native client,
API, Supabase Auth/Postgres/Storage, provider adapters, queues/webhooks, CI/build systems,
stores/OTA service, observability and the separate CEO/Ops app. Every external value is
untrusted even when it came from a barcode, model, store or internal admin screen.

## Threat and abuse register

| Threat | Primary controls | Detection/response |
|---|---|---|
| cross-household read/write | forced RLS, AAL2, membership checks, non-enumerating APIs | zero-tolerance canary/test; revoke/contain and privacy incident path |
| credential stuffing/account enumeration | generic responses, breached-password/provider controls, rate limits, email protections | per-route anomaly without raw identity; session revoke and user notice |
| lost TOTP/social-engineered recovery | pre-enrolled one-time recovery material, recent first-factor proof, delay/risk checks, security notice, no support-only bypass | recovery events and factor/session review queue |
| CEO/admin takeover | separate identity plane, phishing-resistant factor where supported, least privilege, short sessions, two-person high-risk approval | impossible-travel/risk signal, role-change audit and break-glass revocation |
| malicious barcode/QR/deep link | format/length allowlist, checksum/GS1 parser, never open arbitrary scanned URLs | parser rejection metric and fuzz corpus |
| image/decompression/OCR attack | MIME magic verification, pixel/size/page limits, sandboxed decoder, timeout/cost quota | provider isolation and upload kill switch |
| provider/API poisoning or schema drift | Zod validation, provenance, signed/TLS source, schema fixtures, quarantine | rejected-record/freshness alert; safe manual fallback |
| SSRF/injection/mass assignment | fixed provider origins, egress allowlist, parameterized queries, explicit DTOs | WAF/app signals plus security tests |
| webhook replay/forgery | provider signature, timestamp/replay window, idempotent event ledger | duplicate/signature alert and dead-letter review |
| offline device extraction/replay | OS secure credentials, protected local projection, session/device revoke, operation idempotency | stale/removed-device rejection and purge |
| dependency/build compromise | lockfile, minimal permissions, secret/code scan, SBOM, provenance/attestation, protected branch/environment | block release, rotate secrets, rebuild from trusted commit |
| malicious/incorrect OTA | end-to-end signing, runtime fingerprint, two-person publish, staged cohort, automatic stop and rollback | adoption/crash/privacy guardrail by update ID |
| ad/billing fraud | test ads, placement rules, server receipt verification, rate/fraud controls | invalid traffic, refund and entitlement mismatch alerts |
| cost exhaustion/DDoS | authenticated quotas, cache, request/body limits, budgets, circuit breakers | cost/traffic anomaly; degrade noncritical providers |
| insider/support misuse | just-in-time role, no arbitrary SQL/impersonation, reason/evidence, immutable audit | access review, export anomaly and immediate role revoke |
| backup/domain/signing-key loss | encrypted multi-location backup, restore drills, renewal calendar, key escrow/rotation | expiry/restore-failure action queue and continuity runbook |

Threats are reviewed at every new provider, sensitive field, country, admin role, model,
native capability, billing flow or data-sharing purpose. STRIDE/abuse-case workshops record
asset, actor, entry point, precondition, impact, control, residual risk and owner.

## MFA recovery and break-glass

Mandatory MFA without a secure recovery design either locks out real users or creates a
hidden support bypass. FoodOS therefore requires:

- one-time recovery codes or equivalent material generated only after AAL2 enrollment,
  stored hashed/encrypted as appropriate and shown once for offline safekeeping;
- recovery-code rotation invalidates the prior set and notifies all active sessions;
- a lost-factor ceremony that proves the first factor, applies risk/rate/delay controls,
  revokes other factors/sessions as selected and sends an out-of-band notice;
- no employee may read a TOTP secret, recovery code, session or private household data;
- support can start a documented recovery case but cannot single-handedly grant AAL2;
- production/CEO break-glass credentials are separately protected, tested quarterly,
  unavailable to the consumer app and every use creates an incident-style audit;
- passkeys/phishing-resistant factors are evaluated after the chosen auth stack supports
  the required recovery, native and RLS/AAL semantics; they are not claimed today.

## Sensitive-data cryptography

TLS and provider disk encryption are necessary but do not contain every insider,
snapshot or application compromise. After the threat model, health-related profile fields
use a purpose-isolated store or application-level envelope encryption with a managed key
service, per-environment keys, versioned ciphertext and rotation/re-encryption jobs.
Search/index requirements are minimized rather than solved by copying plaintext. Keys,
backups and signing secrets have named custodians, recovery evidence and a tested revoke/
rotation path. A custom cryptographic primitive is forbidden.

## AI/OCR governance

### Allowed launch use

OCR may propose package text/date/lot fields. Deterministic rules may normalize and flag
ambiguity. A model must not set ingredient risk, declare food safe, diagnose, prescribe a
diet, or silently invent missing product facts. Generative wording is deferred until its
purpose, evidence and review are separately approved.

### Model registry

Each enabled model/provider/version records owner, intended purpose and forbidden uses;
training/data provenance and license; input/output schema; hosting/region/subprocessors;
retention/training setting; evaluation dataset and metrics; release date/approver;
rollout cohort; cost/latency limits; known limitations; and rollback/kill-switch state.

### Evaluation

The versioned, rights-cleared evaluation set includes German/other approved label
languages, MHD/use-by wording, DD.MM.YYYY and ambiguous formats, glare/curve/damage, small
print, multiple dates, lot/date adjacency, handwritten stickers, device/OS/camera range
and adversarial non-date strings.

Report per-field precision/recall, exact normalized match, date-type confusion, false
accept rate, abstention, calibration, latency and cost. Results are segmented where a
device/language/lighting condition can materially change performance. The most important
launch constraint is zero automatic acceptance: every proposed date/lot is visibly
confirmed. A regression in false high-confidence output stops rollout even if average
accuracy rises.

### Data and prompt safety

- on-device processing is default where product quality permits;
- cloud upload is explicit and narrowly cropped; raw image retention follows the data
  register and is never used for provider/model training without a separate opt-in and
  rights review;
- package text, URLs, images and retrieved product content are untrusted data, never
  executable instructions for a future LLM/tool;
- an LLM receives only the minimum allowlisted fields and has no direct DB/admin action;
- user correction feeds evaluation only under the approved purpose; production data is
  not silently promoted into a training set.

### Medical/intended-purpose boundary

A versioned claims register contains every store, website, onboarding and in-app health/
safety statement. Product/legal/food review is required when copy or behavior could move
from organization/general information toward diagnosis, prevention, monitoring,
prediction, prognosis or treatment. The official EU MDCG software qualification guidance
is reassessed before every such change. Marketing cannot outrun the approved intended
purpose.

## OTA and release governance

- production OTA bundles use end-to-end code signing and protected signing material;
- channels map immutably to environments; production publication requires approved CI
  evidence and two distinct authorized people for high-risk changes;
- runtime version/fingerprint proves native-module and schema compatibility;
- canary→staged percentage→full rollout uses crash, startup, privacy canary, C0 flow and
  sync-integrity guardrails with automatic pause;
- automatic crash fallback and an operator rollback are tested; embedded known-good code
  remains available;
- `disableAntiBrickingMeasures` and runtime update-URL override are forbidden in
  production;
- migrations use backward-compatible expand/contract behavior and cannot be “rolled
  back” by shipping old JavaScript against a destructive schema;
- OTA may not bypass store review, subscription disclosure, consent, permissions or the
  signed country/legal gate. Material native/legal changes use a store build.

## Security verification and cadence

- ASVS/API/MASVS control mapping and code/config evidence;
- SAST, dependency/container/secret/license scan on change; SBOM and provenance per
  release; patch SLA based on exploitability and exposure;
- DAST/API abuse, parser/property/fuzz and mobile storage/network tests;
- annual independent penetration test before meaningful scale and after high-risk
  architecture change; continuous smaller internal adversarial tests;
- quarterly access/key/recovery/continuity review and restore/OTA game day;
- vulnerability intake, coordinated disclosure contact, severity SLA and preserved
  evidence; evaluate Cyber Resilience Act scope/timeline with counsel.

## C0 release tests

- AAL1, unrelated household, removed member and support role cannot infer a private row;
- recovery does not grant AAL2 from email/helpdesk assertion alone;
- barcode/QR/image fuzz and decompression bombs stay bounded;
- malicious provider/model payload cannot reach storage without validation;
- high-confidence OCR regression pauses rollout and manual capture still works;
- compromised/revoked OTA signature, wrong runtime and destructive migration are rejected;
- rollback restores launch and reads previously written compatible local data;
- CI artifact identity, SBOM, migrations, update ID and store binary reconcile;
- forbidden privacy canaries never reach model, logs, analytics, ads or crash vendors;
- production/admin role changes and break-glass use require and retain correct evidence.

## Primary references

- OWASP ASVS: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP MASVS: <https://mas.owasp.org/MASVS/>
- EU MDCG 2019-11 rev.1 software qualification guidance:
  <https://health.ec.europa.eu/latest-updates/update-mdcg-2019-11-rev1-qualification-and-classification-software-regulation-eu-2017745-and-2025-06-17_en>
- EU Cyber Resilience Act: <https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng>
- EU Product Liability Directive 2024/2853:
  <https://eur-lex.europa.eu/eli/dir/2024/2853/oj/eng>
- Expo update deployment/compatibility: <https://docs.expo.dev/eas-update/deployment/>
- Expo rollback/runtime debugging: <https://docs.expo.dev/eas-update/debug/>
- Expo update override security cautions: <https://docs.expo.dev/eas-update/override/>
