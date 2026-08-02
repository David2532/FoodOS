# FoodOS release checklist

Status: **release decision template**

Copy this checklist into the release issue. A checked box requires a linked artifact,
source or approval for the exact commit/build. `NOT_RUN`, `BLOCKED`, `FLAKY` and stale
evidence do not count as passed.

## Identity and artifact

- [ ] Release owner, date, semantic version and target countries/stores are named.
- [ ] Git commit, dependency lock hash, database migration head and artifact digest match.
- [ ] Build is reproducible from the protected commit with approved runner/image.
- [ ] Environment is production, with test/sandbox data technically excluded.
- [ ] Feature flags, staged cohorts, kill switches and rollback owner are documented.

## Product and research

- [ ] Current validation gate has a real continue/narrow/pivot/stop decision.
- [ ] Critical flows F00–F08 match the released UI and API behavior.
- [ ] Material flow changes have current representative usability evidence.
- [ ] No unresolved critical UX, use-by, recall, privacy, billing or data-loss issue exists.
- [ ] Store/marketing claims describe only implemented and proven behavior.

## Security, privacy and data

- [ ] Threat model and abuse cases cover changed boundaries.
- [ ] AAL1/AAL2 and two-household RLS actor matrix passes.
- [ ] Secrets, service-role key and signing keys are absent from clients, repository and logs.
- [ ] Consent, privacy center, export, correction and deletion work in app and web as required.
- [ ] Network/telemetry/ad diff contains no forbidden product, date, household or health data.
- [ ] Retention, processor propagation, backup tombstone and restore-after-deletion pass.
- [ ] Security/dependency findings are triaged; accepted risk has owner and expiry.

## Food and domain correctness

- [ ] Ordinary EAN does not fabricate date/lot; GS1/OCR/manual confirmation works.
- [ ] MHD and use-by behavior/copy remain distinct in all locales/states.
- [ ] Unknown nutrition/ingredient/source data remains unknown, not zero/safe.
- [ ] Exact/possible/stale recall behavior and official source links pass.
- [ ] Inventory, consumption and shopping ledgers reconcile under retry/concurrency/offline.

## UI, accessibility and performance

- [ ] Compact, medium and expanded layouts pass the required device/viewport matrix.
- [ ] Loading, empty, error, offline, stale, conflict, permission and destructive states pass.
- [ ] WCAG 2.2 AA scope plus keyboard/focus/screen-reader evidence is attached.
- [ ] VoiceOver/TalkBack, large text, contrast and Reduce Motion smoke tests pass.
- [ ] LCP/INP/CLS, route bundle and native startup/frame/memory budgets pass or limited-beta
      evidence status is explicitly unproven and cannot be called commercial-ready.
- [ ] Visual diffs and assets are intentional, licensed/generated appropriately and optimized.

## Quality and operations

- [ ] `npm run verify` passes on the protected commit.
- [ ] Required unit/property/mutation/component/API/DB/integration/E2E/mobile tests pass.
- [ ] C0/C1 tests contain no flakes, skips, retries, stale artifact or blocked dependency.
- [ ] Migration expand/contract, rollback and restore drill pass.
- [ ] Error console, source maps, traces, alerts, runbooks and on-call/support owner are ready.
- [ ] Production synthetic tests pass without creating or exposing sensitive user data.
- [ ] Capacity, provider quota, retry/backoff, cost ceiling and outage fallback are reviewed.

## Commerce, stores and legal

- [ ] StoreKit/Play Billing sandbox purchase, pending, restore, refund/revoke and reconcile pass.
- [ ] Ads are contextual, clearly labelled, outside forbidden flows and removable by kill switch.
- [ ] App Privacy, Data Safety, ATT/CMP and accessibility declarations match observed behavior.
- [ ] Germany/EU country pack, DPIA/ROPA/TOMs/processors, food copy and consumer terms are signed.
- [ ] Brand/name/trademark/domain and asset/dependency rights are cleared for this release.
- [ ] Tax/accounting handling and customer support/refund process have accountable owners.

## Deployment proof

- [ ] Supabase migration is applied and verified in the intended EU production project.
- [ ] Vercel/web production URL is opened and critical authenticated flow is tested.
- [ ] iOS/Android binaries are installed from the actual release track and smoke-tested.
- [ ] Docker/self-hosted image, TLS, backup/restore and secret rotation remain reproducible.
- [ ] Post-release monitoring window, stop thresholds and rollback decision maker are named.

## Decision

- [ ] **GO** — every release-blocking gate is `PASS` with evidence.
- [ ] **LIMITED BETA** — gaps are explicitly non-commercial, scoped and owned; user claims match.
- [ ] **NO-GO** — at least one blocking gate lacks valid evidence.

Decision owner: _TBD_

Decision time: _TBD_

Evidence manifest: _TBD_

Rollback owner/channel: _TBD_
