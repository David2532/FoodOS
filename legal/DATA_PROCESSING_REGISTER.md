# FoodOS data processing and retention register

Status: **proposed production defaults**. The controller, processors, purposes, legal
bases, transfer mechanisms, exact retention periods, and notices require release-specific
legal approval. Retention is enforced by jobs and deletion tests, not only written here.

## Purpose and data register

| Processing purpose | Data | Proposed basis | Default retention | Key restrictions |
|---|---|---|---|---|
| Account and contract | email, user ID, verification, subscription entitlement | contract; legal obligation where applicable | active account; billing/legal records only as required after deletion | no ad use; separate billing records |
| Authentication/security | password verifier held by auth provider, session/factor metadata, security events | contract, legitimate interests, legal/security obligations | active credentials; security logs normally 30 days | AAL2, least privilege, never analytics |
| Household/inventory | membership, product reference, quantity, storage, batch, MHD/use-by, lot | contract | until user deletion; event history proposed 24 months/configurable | tenant RLS; export/correction |
| Nutrition/meal planning | portions, log, goals, recipes, plan, shopping | contract; explicit consent where data reveals health | active account or user deletion; detailed log proposed 24 months/configurable | no ad targeting; missing data explicit |
| Sensitive personal profile | allergies, intolerances, weight/body/health goals, exposure exclusions | separate explicit GDPR Art. 9 consent plus Art. 6 basis after legal review | until profile deletion or consent withdrawal | optional, purpose-isolated, no ads, restricted support access |
| Ingredient relevance | profile-to-ingredient result, reason, source, confidence, ruleset version | contract/consent depending inputs | recomputable cache; delete with profile/account | deterministic; not diagnosis; override/correction |
| Camera/OCR | transient package/date/ingredient image crop, OCR result/confidence | user request/contract; consent where required | on-device by default; uploaded raw crop max 24 hours after successful processing | no training or OFF upload without separate opt-in |
| Notifications | device token, reminder preferences, scheduled item reference | consent/contract depending channel | until disabled/token invalid/account deletion | payload minimizes product/profile detail on lock screen |
| Product catalog/cache | GTIN, labels, nutrition, ingredients, source metadata/image URL | provider license/legitimate interest after review | refresh/provider policy; deletion/correction where applicable | OFF license boundary/provenance |
| Recall source and household match | public official notice/revision; private batch reference, match quality, acknowledgement/action | contract/legitimate interest/safety purpose after review | official evidence per approved source/legal schedule; private match with batch/account | lot-aware; source freshness; no safety guarantee; no ad use |
| Offline synchronization | protected local projection, operation ID/type/base revision, queued intent and safe error | contract/security | on device while authorized plus bounded retry window; purge on logout/removal/deletion | no payload telemetry; OS protection/encryption; tombstones prevent resurrection |
| AI/OCR quality | model/version, non-private evaluation fixtures, field confidence/correction aggregate | legitimate interest/contract after review; separate opt-in for user-content training | versioned release evidence; user crop/result under Camera/OCR rule | no silent training; approved purpose/model registry; no medical/safety decision |
| Privacy choices | notice/CMP version, purposes/vendors, response, timestamp, locale | legal obligation/consent proof | consent lifecycle plus limitation period set by counsel | immutable evidence; withdrawal equally easy |
| Product analytics | allowlisted coarse event, build, pseudonymous installation/account key | consent or legitimate interest after balancing review | proposed 13 months aggregate, raw 30 days | no email/GTIN/product/free text/health; no cross-app tracking |
| Advertising | contextual placement, consent state, coarse non-sensitive context, ad-report event | consent/contract/legitimate interest as separately assessed | vendor-specific and disclosed; minimize | no personal food/health targeting; SDK blocked before decision |
| Support | ticket/contact, user-supplied evidence, access audit | contract/legitimate interest | proposed 24 months after closure unless dispute requires longer | redact sensitive images; no broad production access |
| Backups/recovery | encrypted snapshot of production data | security/contract/legitimate interest | rolling maximum 30 days proposed | isolated, encrypted, restore-tested, deletion ages out |
| CEO/company risk operations | finance/platform/legal/source status, risk/action owner, deadline, audit | legal obligation/legitimate interest/contract as applicable | entity/accounting/security schedules approved by counsel | no private food/health analytics; estimates/stale sources explicit; role-separated |

“Proposed basis” is not an implementation decision. Legal review must determine the
actual Art. 6/Art. 9 basis and notice language for the concrete processing.

## Consent separation

The following decisions are separate, optional, versioned, and never preselected:

- sensitive health/profile processing;
- nonessential product analytics;
- advertising/CMP vendors and purposes;
- marketing email/push;
- cloud upload of an image when on-device processing is insufficient;
- contributing an image/data correction to Open Food Facts;
- using user content to train or improve a model.

Recall checks needed for the core inventory safety function are not bundled with optional
model training, analytics or ads. The notice must explain source coverage and the private
batch matching needed to provide the requested warning.

Refusing or withdrawing advertising, analytics, marketing, contribution, or training
consent does not block paid/core FoodOS functionality. Withdrawing sensitive-profile
consent explains which personalized feature stops, then deletes/irreversibly anonymizes
that profile and recomputable assessments after confirmation.

## Data-subject and account lifecycle

### Export

- available in-app and web after recent AAL2 authentication;
- machine-readable JSON plus human-usable CSV for inventory/log/plan records;
- includes source/provenance, consent history, and meaningful rule explanation;
- generated server-side, encrypted at rest, short-lived signed download, then deleted.

### Deletion

1. Show account, household, subscription, shared-data, contribution, and legal-retention
   consequences before confirmation.
2. Require recent authentication; give an immediate receipt/status reference.
3. Revoke sessions/tokens and stop notifications, analytics mapping, and ad processing.
4. Delete/anonymize active data and instruct processors; retain only legally required
   isolated records with purpose and expiry.
5. Backups age out within the documented maximum (proposed 30 days) and are not restored
   into live use without replaying deletion tombstones.
6. Verify completion and notify the user unless prohibited.

Deleting the final household owner requires transfer or explicit household deletion.
Public Google Play deletion requests map safely to an authenticated/reverified account;
email alone is not sufficient proof of ownership.

## Logging and observability allowlist

Allowed examples: random request ID, coarse endpoint/flow ID, response class, duration,
provider name, application build, pseudonymous tenant key, error code.

Prohibited examples: access/refresh tokens, email, full IP after operational need,
barcode/GTIN, product/brand/ingredient names, exact MHD, free text, image/OCR payload,
allergy/weight/calorie/profile data, household names, notification content.

Crash tools, ad SDKs, analytics, reverse proxies, databases, object storage, queues,
support systems, email/push providers, and backups each require a tested redaction and
retention configuration.

## Required technical evidence

- schema-level classification for every column/object and data owner;
- data-flow diagram from device through every processor/subprocessor;
- automated retention jobs with dry-run, audit, retry, and deletion tests;
- export/deletion integration tests including processors and backup tombstones;
- consent ledger and versioned notice/vendor configurations;
- RLS/AAL2 isolation tests and support/admin access audit;
- quarterly sample showing actual storage matches this register;
- release check that App Privacy/Data Safety/CMP disclosures match network behavior.
- device/offline data inventory, OS-backup behavior, local purge and stale-device/
  tombstone tests;
- recall-source terms/coverage, private-match access and notification-minimization test;
- AI/model/provider registry and proof that production user content is not used for
  training without the separate recorded choice.
