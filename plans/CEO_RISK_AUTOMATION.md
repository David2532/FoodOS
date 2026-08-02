# FoodOS CEO risk, continuity and automation center

Status: **binding extension to `CEO_CONTROL_CENTER.md`**. The goal is early detection,
clear ownership and fast containment of threats to users and the company. It cannot
guarantee survival, predict every crisis, replace professional advice or automate a
director's legal judgment.

German company law makes crisis monitoring a management concern: §1 StaRUG requires
directors of covered limited-liability entities to continuously monitor developments
that may threaten continued existence and take appropriate countermeasures. Exact entity,
insolvency and reporting duties remain a lawyer/tax adviser's determination.

## Dashboard brief

Audience: David/CEO first; later finance, security/privacy, operations, release and legal
roles with least privilege. Primary question:

> What could materially harm users or prevent FoodOS from operating over the next day,
> 13 weeks or 12 months, how trustworthy is the signal, and what decision is due now?

Add two areas to the existing information architecture:

| ID | Area | Decision |
|---|---|---|
| C13 | Risk & continuity | contain now, reduce exposure, accept temporarily, transfer/insure or stop? |
| C14 | Corporate & platform calendar | which legal, tax, store, domain, certificate, contract or policy action is due and proven? |

C13 is summary-first: critical exposure and cash/status first, trend and drivers second,
then the owner action queue and evidence. A giant decorative heatmap is not the default;
low-confidence numbers must not look precise.

## Automation authority levels

| Level | System may do | Examples |
|---|---|---|
| A0 observe | ingest, validate, calculate, preserve evidence | bank/report freshness, dependency scan, review trend |
| A1 notify | create/deduplicate/route an action with deadline | tax source late, certificate expiring, support breach |
| A2 protect | execute a predefined reversible safety action | pause staged rollout, disable OCR/ads/provider, rate-limit abuse |
| A3 approve | prepare action; named human must approve | rotate major key, customer communication, close/reopen books |
| FORBIDDEN | no autonomous final act | file insolvency/tax/regulatory notice, dismiss a legal duty, delete evidence, label food safe, make medical decision |

Every A2 action has scope, maximum duration, audit, rollback and an owner paged. Security,
user rights and official recall warnings cannot be disabled by a business kill switch.

## Primary survival KPI model

The default view uses three decision KPIs, not dozens of equal cards:

| KPI | Definition/source | Drivers | Guardrails |
|---|---|---|---|
| 13-week liquidity coverage | sourced opening cash + dated expected inflows – payroll/tax/contract/payable commitments, by week and scenario | burn, payout delay, committed vs discretionary cost, concentration | bank/AP/contract coverage and freshness; never infer solvency from ARR |
| trusted core loop | eligible active households completing confirmed scan/inventory plus use/plan/shop action | capture time/completion, sync recovery, provider fallback, D7/W4 return | invented-date, recall miss, data-loss, cross-tenant and sensitive-payload zero targets |
| paid value retention | entitled production cohorts retaining both payment and core-value use | activation, renewal, voluntary/involuntary churn, support/refund | wrongful entitlement, complaint, gross margin and support burden |

Targets are provisional until beta baselines exist. Legal/food/security zero-tolerance
signals stay absolute; commercial targets require source, cohort, confidence and review
date. No anomaly model may claim causality.

## Company-survival control register

| Risk | Leading signal and source | Automated response | Required human decision |
|---|---|---|---|
| liquidity/insolvency | weekly cash trough, overdue liabilities, payout delay, downside runway; bank+ledger+contracts | A1 daily forecast variance; lock stale source from green | CEO+adviser review; legal insolvency process if indicated |
| no product-market fit | activation/weekly trusted use/retention fall with high capture burden | A1 cohort/segment diagnosis and experiment stop | narrow, pivot, price/change or stop investment |
| unsafe date/recall result | invented date, confirmed recall suggested, feed stale | A2 stop recommendation/provider/rollout | food/legal incident and corrected release |
| privacy/security breach | cross-tenant/privacy canary, secret leak, suspicious admin use | A2 contain sessions/key/rollout where predefined; start breach clock | privacy/security counsel decides notification/communication |
| data loss/corruption | reconciliation mismatch, restore failure, tombstone resurrection | A2 stop writes/rollout when safer; preserve evidence | recovery strategy and user/regulator communication |
| app store enforcement | policy notice, declaration drift, rejection count, certificate/account state | A1 page owner, freeze conflicting submission, snapshot evidence | remediate/appeal; channel-continuity decision |
| AdMob invalid traffic | abnormal CTR/source mix, invalid adjustment, policy warning | A2 disable affected placement/traffic source | investigate/appeal; keep ads off until cleared |
| billing/refund fraud | signature/replay failure, refund/chargeback/entitlement mismatch | A2 quarantine event/SKU/provider path | finance/support remediation and disclosure |
| tax/accounting failure | missing final report/document, unreconciled close, adviser/file/payment deadline | A1 escalating checklist; block final/paid label | adviser-approved filing/payment; no bot filing |
| provider concentration/outage | share of core requests/revenue/cost, SLA/freshness, exit-test age | A2 circuit breaker/fallback; A1 concentration limit | migrate, dual-source, accept or transfer risk |
| runaway cloud/AI cost | unit cost, quota, forecast and anomalous caller | A2 provider quota/feature degradation within policy | budget/price/architecture decision |
| dependency/OTA compromise | critical CVE/exploit, failed signature/provenance, crash guardrail | A2 block/pause/rollback | patch, rotate, incident declaration |
| AI/OCR quality drift | field/date-type false accept, calibration, correction, cost by model | A2 stop model cohort and fall back manual/on-device | approve retrain/version or remain disabled |
| trademark/IP/license | opposition/notice, renewal, unknown asset/dependency/source license | A1 block asset/release and preserve notice | counsel clearance, replace, license or rename |
| medical/claim drift | unapproved store/copy/model claim or intended-purpose change | A1 block content/release | legal/food/medical-regulatory review |
| support/reputation | severe case age, rating/review topic, refund/ad/recall complaint | A1 severity route and status draft | response, refund, fix, public communication |
| key-person/access loss | single custodian, stale access review, untested break-glass/restore | A1 continuity task; no hidden credential copy | appoint deputy, rotate/test/document |
| corporate deadline | entity-specific register, insurance, annual account, contract, domain/cert date | A1 90/30/14/7/1-day escalation based on materiality | responsible professional completes with evidence |
| auth email/DNS failure | verification/reset delivery, bounce/complaint, SPF/DKIM/DMARC, registrar/DNS/SMTP status | A1 deliverability/security incident; A2 pause abusive sends/fail to approved provider where safe | rotate/fix provider or domain; user communication and account-access plan |
| regulatory/policy change | official-source diff and applicability review due | A1 legal backlog item; affected country/feature stays gated | counsel/owner signs interpretation and build |
| fraud/insider misuse | unusual role/export/close/flag/signing-key activity | A2 revoke/hold where predefined | security/HR/legal investigation |

## Risk record and scoring without false precision

Each risk stores stable ID, category, scenario, affected asset, source evidence, owner and
deputy; impact dimensions (user safety, legal, cash, availability, reputation); likelihood
band, velocity, detectability, control coverage, residual-risk band and confidence;
trigger, response level, runbook, due/review date, acceptance approver/expiry and linked
incidents/tests.

Red/amber/green comes from explicit rules. It cannot be a bare probability×impact score.
`UNKNOWN`/`STALE` is not green. Hysteresis and minimum duration reduce noisy flapping,
while zero-tolerance events alert immediately. A risk may be accepted only by a named
authorized person until a fixed expiry; acceptance never waives law or user rights.

## CEO action queue contract

Every action shows:

- what changed, why it matters and which source/period is complete;
- severity, confidence, affected users/euros/operations and time-to-harm;
- owner, deputy, due time, escalation path and linked runbook;
- recommended A0–A3 response and whether automation already acted;
- evidence/test/incident/release IDs and audit history;
- one primary action plus snooze/accept/close permissions and required evidence.

Deduplication groups the same underlying incident; it never hides independent failures.
An alert can close only when the recovery condition and evidence are met, not when someone
clicks “done”. Overdue and ownerless items escalate. Paging routes never contain private
food/health/user payload.

## Automated cadences

### Continuous/near real time

- production C0 flows, security/privacy canaries, release/OTA guardrails;
- recall feed freshness and match pipeline;
- billing/webhook integrity, ad invalid-traffic warning and cost abuse;
- backup/job/provider failure, credential or certificate critical expiry;
- DNS/registrar/domain lock and auth-email bounce/complaint/SPF/DKIM/DMARC health.

### Daily

- 13-week cash forecast ingestion/freshness and next cash trough;
- store/ad/provider/payout source freshness and reconciliation exceptions;
- severe support/refund/review themes and unresolved P0/P1 incidents;
- dependency/container/secret results and expiring operational assets.

### Weekly business/risk review

- three survival KPIs, cohorts, unit economics and risk movements;
- top five actions, accepted risks nearing expiry and missing owners;
- provider/channel concentration and exit-plan test age;
- experiment decisions and product-validation evidence.

### Monthly/quarterly

- finance close/adviser workflow, access/vendor/license/policy review;
- restore, break-glass, key rotation/escrow and incident tabletop evidence;
- country/claim/AI model/privacy register delta;
- board/shareholder/insurer report where entity and contracts require it.

## Data/source gates

Every risk metric declares authoritative source, grain, period/timezone/currency,
freshness, expected coverage, transform/version, owner and reconciliation. Missing bank,
payables, store report, policy feed or test evidence produces `NO SOURCE`/`STALE`, never a
zero or reassuring card. Estimates, scenarios and professional approvals remain separate.

There is no real risk dashboard yet because live bank, accounting, store, support,
security and legal-calendar sources are not connected. Until they are, the UI is a
schema/mockup and must not show sample data as current company truth.

## Tests and game days

- threshold boundary, hysteresis, deduplication, escalation and timezone/deadline tests;
- missing/stale/partial/duplicated source cannot produce green;
- role matrix for CEO/finance/security/privacy/support/legal and two-person approvals;
- inject cash shock, store termination notice, recall feed outage, data breach clock,
  invalid traffic, critical CVE, restore failure and key-person loss;
- prove A2 containment scope/rollback and that forbidden autonomous actions cannot run;
- dashboards reconcile with source/semantic definitions and exclude test/sandbox data;
- quarterly game-day outcome creates owned corrective work and a retest date.

## Primary references

- German crisis monitoring, §1 StaRUG: <https://www.gesetze-im-internet.de/starug/__1.html>
- German insolvency filing duty, §15a InsO:
  <https://www.gesetze-im-internet.de/inso/__15a.html>
- GDPR: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- Google Play enforcement process:
  <https://support.google.com/googleplay/android-developer/answer/9899234?hl=en>
- Apple App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Google AdMob invalid traffic: <https://support.google.com/admob/answer/3342054?hl=en>
- Preventing invalid AdMob activity: <https://support.google.com/admob/answer/3342099?hl=en>
