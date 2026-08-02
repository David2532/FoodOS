# FoodOS red-team gap audit and optimization decisions

Status: **binding prioritization record, reviewed 2 August 2026**. This audit challenges
the existing plan from the perspectives of a user, food-safety reviewer, attacker, app
store reviewer, privacy regulator, support operator, finance owner and cash-constrained
founder. It does not claim that every business failure can be prevented.

## Executive decision

The existing FoodOS plan is unusually strong on batch-based inventory, AAL2/RLS,
privacy-safe observability, testing and finance-source truth. The remaining risk is not a
missing feature list; it is building too much before proving repeat use and leaving a few
high-consequence boundaries implicit.

The optimized order is:

1. prove that real households repeatedly accept the capture effort and would pay;
2. make scan, date, recall and inventory data trustworthy under failure and concurrency;
3. prove account recovery, security, deletion, restore and operational response;
4. ship native value and only then enable subscriptions and carefully bounded ads;
5. expand countries, automation and AI only behind measured gates.

The current repository is still a prototype with three unit tests, not the commercial
system described by these plans. A document, mockup or green `npm run verify` does not
prove an unimplemented release requirement.

## Keep, change, add, defer

| Decision | Area | Reason |
|---|---|---|
| **KEEP** | physical batch model and MHD/use-by distinction | correct unit for dates, lots, quantities, recall matching and FEFO |
| **KEEP** | mandatory AAL2 plus DB-enforced tenant isolation | prevents UI-only authorization from becoming the security boundary |
| **KEEP** | unknown/provenance/confidence states | avoids turning missing product data into false certainty |
| **KEEP** | risk-based test layers and signed release evidence | meaningful proof is stronger than a raw coverage percentage |
| **KEEP** | exact finance ledger and source trust states | prevents estimate, proceeds, payout and booked revenue from being mixed |
| **CHANGE** | “read all metadata” | ingest only schema-validated, purpose-bound fields with provenance, licensing and retention; never retain arbitrary payloads |
| **CHANGE** | mandatory TOTP | keep AAL2, but add a reviewed lost-factor recovery ceremony, one-time recovery material and protected operations break-glass path |
| **CHANGE** | self-host-first expectation | use managed EU infrastructure for the early launch if it reduces operational risk; continuously prove the Docker exit path |
| **CHANGE** | ads as an early revenue assumption | Premium is primary; ads stay off until retention, consent, placement safety and invalid-traffic controls are proven |
| **ADD** | product validation and kill/reshape gates | prevents spending a year on a workflow users find too tedious |
| **ADD** | official recall ingestion and lot-aware matching | MHD alone cannot detect a recalled but in-date product |
| **ADD** | explicit offline synchronization protocol | “offline queue” is not sufficient to prevent duplicates, lost edits or stale-device corruption |
| **ADD** | threat, AI/OCR and OTA governance | protects scanner inputs, model changes, update signing and admin capabilities |
| **ADD** | trademark, content-license and naming clearance | avoids rebrand, takedown or infringement after launch investment |
| **ADD** | company-continuity automation in the CEO Center | connects liquidity, legal dates, platform health, trust and owner actions |
| **ADD** | measurable adaptive UI/UX and performance contract | prevents a beautiful phone mockup from becoming a slow, inaccessible, stretched or state-losing product |
| **ADD** | continuous representative usability evidence | prevents internal taste, funnels or AI-generated mockups from being mistaken for comprehension and value |
| **DEFER** | generative recipe automation and autonomous nutrition advice | high error/claim surface before the deterministic core is trusted |
| **DEFER** | international storefronts | each country multiplies food, consumer, tax, ads, privacy and support obligations |
| **DEFER** | personalized ads or sensitive targeting | inconsistent with the product's trust position and high-risk data boundary |
| **DEFER** | automatic ELSTER/OSS/legal filing | a reviewed evidence/export workflow is safer until entity-specific mappings are proven |

## New P0 gaps

| ID | Gap | Required proof before commercial release |
|---|---|---|
| G01 | repeated user value not proven | observed beta cohort completes the core loop repeatedly; thresholds and decisions recorded in `COMPETITIVE_RESEARCH_AND_VALIDATION.md` |
| G02 | recall risk absent | official-source adapter, freshness state, lot/GTIN match tiers, correction/retraction and C0 tests |
| G03 | sync semantics implicit | outbox/idempotency/revision/tombstone protocol plus multi-device, stale-client and deletion tests |
| G04 | lost MFA/admin recovery underspecified | no helpdesk-only bypass; reviewed recovery, notification, delay/risk checks and audit |
| G05 | OCR/AI quality not governed | versioned evaluation set, calibrated confidence, per-field confirmation and rollback |
| G06 | OTA/supply-chain release risk | signed update, runtime compatibility, staged rollout, two-person production approval and rollback drill |
| G07 | company survival signals incomplete | sourced 13-week cash, legal/platform deadlines, risk owners, escalation and evidence in CEO Center |
| G08 | brand/IP clearance absent | DPMA/EUIPO/domain/store-name search, counsel review, asset/content/dependency rights register |
| G09 | intended-purpose boundary implicit | approved claims register; no diagnosis, treatment, food-safety guarantee or unreviewed medical purpose |
| G10 | support and key-person continuity | support runbooks, access escrow/break-glass, credential inventory, deputy and restore-from-zero drill |
| G11 | UI/accessibility/performance quality implicit | semantic component/state system, compact/medium/expanded layouts, WCAG/platform AT proof, CWV and native release-build budgets |
| G12 | usability evidence too easy to overclaim | representative task rounds, critical-issue retest, concierge/native beta behavior and explicit continue/narrow/pivot/stop decision |

## Preliminary brand finding: FoodOS is only a working title

A public-web discovery search found existing uses of “FoodOS” for restaurant operating/
ordering software and a paid “Food OS” meal-planning, recipe, grocery and pantry product.
This is not a trademark clearance and does not prove infringement, but the collision is
close enough that public brand investment would be reckless before a professional search.

- Keep the repository codename temporarily; do not commission final logo/store assets,
  buy a large campaign or promise the name externally.
- Search identical and similar word/figurative marks in DPMAregister, EUIPO and relevant
  international registers for the counsel-selected Nice classes and territories.
- Check company names, domains, app stores, social handles and common-law/use evidence;
  automated exact-name search is insufficient for similarity.
- Generate and score alternative names for distinctiveness, pronunciation, search,
  domain/store availability and expansion, then have counsel clear the finalist.
- Record decision/evidence and monitor opposition/renewal after filing.

Discovery sources: <https://foodos.food/>, <https://foodos.xyz/>,
<https://foodos.biteboxhq.co/> and the DPMA research guidance at
<https://www.dpma.de/marken/markenrecherche/index.html>.

## Failure scenarios the plan must survive

- A user scans 25 products and the last save fails: confirmed prior items remain durable,
  the failed item remains resumable and no duplicate appears on retry.
- Two household devices consume the same last batch offline: the server accepts only a
  valid transition and returns an understandable conflict instead of negative stock.
- A normal EAN maps to a product but has no date: FoodOS never estimates a concrete MHD
  as observed fact.
- A product is recalled while still before MHD: the recall state overrides planning and
  displays the official action, including uncertainty when the lot is unknown.
- OCR reads `08.09` as `09.08`: the field is highlighted for confirmation and the model
  version can be rolled back if its error rate regresses.
- A production OTA update crashes on launch or expects a newer schema: compatibility
  gates stop it or the client returns to the last known-good bundle.
- The founder loses the TOTP device: recovery restores the real owner without creating a
  social-engineering backdoor or exposing household data at AAL1.
- App Store, Play, AdMob, OCR or Open Food Facts suspends/degrades access: a kill switch,
  fallback and cash/provider concentration warning preserve the core service.
- A privacy incident starts a regulatory clock: evidence is preserved, the deadline is
  visible, but no dashboard bot makes the legal notification decision.
- Cash falls below the approved downside scenario: the CEO view fails closed on stale
  bank/payables data and escalates to the human insolvency/legal process.
- A permitted ad arrives late on a slow phone: reserved geometry prevents layout shift,
  the primary action stays visible and no sensitive product/health context reaches it.
- A user rotates or unfolds a device during MHD confirmation: the layout adapts without
  resetting the scan, date, focus or durable pending intent.
- A visually polished flow repeatedly causes people to confuse MHD with use-by: research
  blocks release until the model/copy is changed and retested; funnel completion is not
  accepted as correct comprehension.

## Release order changes

### Gate V0 – problem and willingness-to-pay

Run interviews, prototype usability and a concierge/closed beta before a full native and
finance build. Record who experienced the problem, current workaround, capture burden,
repeat use, willingness to pay and the decision to continue, narrow, pivot or stop.

### Gate T0 – trusted data loop

Scan→confirm→persist→recall check→inventory→consume must work transactionally with
provenance, no invented data and an explicit offline state. This precedes planning polish.

### Gate R0 – recoverable operation

Prove MFA recovery, backup/restore, deletion tombstones, provider outage, signed update
rollback, secret rotation and incident ownership on production-like infrastructure.

### Gate M0 – controlled monetization

Enable Premium after value/retention evidence. Enable ads separately only when placement,
consent, invalid traffic, revenue concentration and disablement controls pass. A revenue
experiment may never weaken food, privacy, security or account-rights behavior.

## Assumptions requiring an owner decision

- legal entity, merchant/seller position and tax adviser;
- managed Supabase/Vercel versus self-hosted production operator;
- 16+ Germany launch and whether household invites may include younger users;
- supported product languages and barcode regions;
- recall provider permissions, SLA and production terms;
- whether health-related profiles are necessary for launch at all;
- Premium price hypothesis, ad launch/no-launch decision and support coverage;
- final product name after trademark clearance.

## Audit completion criteria

This audit is incorporated only when the new specialist plans are linked from the master
plan, user flows, implementation stages, tests, legal register, CEO Center and repository
instructions. Every new P0 has an owner, executable evidence, a safe degraded state and a
release stop condition. “Monitored” without a response owner and runbook is not a control.
