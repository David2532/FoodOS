# FoodOS canonical master plan

Status: **binding master index and delivery priority**.  
Version: **2026-08-06 / Agent Operating Model v2**.

## 1. Product definition

FoodOS is the household operating system for food. A purchase enters once, FoodOS turns it into a trustworthy digital fridge, and the household can immediately decide what to eat, what to cook, what is expiring, what is missing and how the choice fits calories, nutrients, allergens and personal goals.

FoodOS differs from calorie trackers, recipe catalogs and inventory lists because one shared food state powers all three jobs. The user must not maintain a database. The system performs recognition, matching, quantity suggestions, provenance tracking, recipe ranking and derived shopping work; the user confirms only uncertainty and safety-critical facts.

The binding product promise is:

> Ein Einkauf kommt rein, FoodOS versteht den Vorrat, und der Nutzer weiß mit einem Fingertipp, was er jetzt essen kann.

The detailed simplicity contract lives in `plans/PRODUCT_NORTH_STAR.md`. The interaction and implementation sequence lives in `plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md`.

## 2. Canonical source map

| Concern | Canonical source |
|---|---|
| Product promise and simplicity bar | `plans/PRODUCT_NORTH_STAR.md` |
| Ordered consumer implementation | `plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md` |
| Stable user-flow IDs and safety behavior | `plans/USER_FLOWS.md` |
| Architecture | `plans/ARCHITECTURE_PLAN.md` |
| Food safety, recalls and data quality | `plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md` |
| Offline and conflict semantics | `plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md` |
| Commercial boundaries | `plans/COMMERCIAL_PRODUCT_PLAN.md` |
| Quality and release evidence | `plans/QUALITY_ENGINEERING_PLAN.md`, `plans/TEST_TRACEABILITY_MATRIX.md` |
| Agent organisation and authority | `config/agent-company.json`, `docs/agent/COMPANY_AGENT_OPERATING_MODEL.md` |
| Worker execution | `docs/agent/WORKER_EXECUTION_CONTRACT.md` |
| Brand and naming | `docs/brand/BRAND_SYSTEM.md`, `docs/brand/NAMING_DECISION.md` |
| Assets | `docs/brand/ASSET_MANIFEST.md` |
| Founder dashboard | `plans/CEO_CONTROL_CENTER.md`, `design-ceo.md` |
| Risk and company automation | `plans/CEO_RISK_AUTOMATION.md` |

Older master-like documents remain specialist evidence or historical context. They do not override this source map.

## 3. Non-negotiable product principles

1. **Capture first, forms last.** A normal purchase is one continuous session with a final uncertainty queue.
2. **What can I eat now? is the primary decision.** The home screen serves food decisions, not administration.
3. **Facts first, interpretation second.** Nutrition, ingredient and product-fit explanations expose source, portion basis, coverage and uncertainty.
4. **Safety remains deterministic.** AI may suggest or rank; it never overrides allergen, use-by, recall, quantity, provenance or authorization rules.
5. **The free core is genuinely useful.** Inventory, basic capture, safety, basic recipes and essential nutrition are not crippled.
6. **One primary action per screen.** Complexity is progressively disclosed and corrections are always reversible.
7. **No feature outranks recurring household use.** Internal dashboards and agent infrastructure support the consumer loop; they do not displace it.

## 4. Core journeys

Each journey must define goal, minimal steps, automatic work, error recovery, offline behavior, security boundary and a measurable acceptance criterion.

| ID | Journey | Primary acceptance target |
|---|---|---|
| J01 | First open, consent, sign-in, TOTP and household | Returning session reaches Today without onboarding flash; AAL1 cannot read household data |
| J02 | Goals, allergens and optional sensitive profile | Core remains usable when optional processing is refused |
| J03 | First complete purchase | 15 known items complete in one session with one final review surface |
| J04 | Receipt-assisted capture | Receipt proposes products; uncertain matches remain visibly unconfirmed |
| J05 | Continuous barcode capture | Duplicate scans increment quantity and scanner is immediately ready again |
| J06 | Resolve uncertainty | Only unresolved or safety-critical fields are shown; user can defer noncritical fields |
| J07 | Digital fridge | Fridge, freezer and pantry are understandable without exact gram maintenance everywhere |
| J08 | What can I eat now? | Suggestions use real usable stock, time, preferences, safety and missing ingredients |
| J09 | Recipe, servings and cook mode | Serving changes update shortages and nutrition before confirmation |
| J10 | Complete cooking and leftovers | Proposed stock reduction is explicit, atomic and editable; leftovers can be stored quickly |
| J11 | Product and personal fit | Facts, positives, cautions, personal conflicts, source and uncertainty are visible |
| J12 | Expiry, allergen or recall intervention | Safety state overrides planning and never becomes falsely green during source failure |
| J13 | Weekly plan and shopping | Shortages derive from plan minus usable inventory while preserving manual intent |
| J14 | Shopping back into inventory | Checked purchases enter a new capture session rather than requiring re-entry |
| J15 | Export and deletion | Recent AAL2, visible progress and proven processor propagation |

Detailed state machines stay in `plans/USER_FLOWS.md`; new journey IDs should map to stable F-flow tests rather than replace them casually.

## 5. Recognition and provenance architecture

The recognition pipeline is layered and confidence-aware:

```text
session evidence
-> barcode / GS1 / receipt OCR / image proposal / digital receipt
-> canonical product candidate matching
-> package and quantity proposal
-> source reconciliation
-> confidence and conflict classification
-> instant accept for high-confidence low-risk data
-> final uncertainty queue
-> explicit confirmation for safety-critical facts
-> append-only correction and provenance history
```

Every material fact records:

- canonical product and package identity;
- source type: official/manufacturer, retailer, open dataset, AI-derived, user-confirmed or estimate;
- source identifier, retrieval time, licence and transformation version;
- confidence and freshness;
- confirmation actor and time where applicable;
- supersession or correction chain.

AI-derived data is never silently promoted to manufacturer truth. Later corrections do not erase prior provenance.

## 6. Product catalog and inventory model

The catalog must support GTIN aliases, brands, manufacturers, variants, package sizes, ingredients, allergens, nutrition, portions, storage guidance, source/licence, confidence and correction history. Recall applicability and physical household batches remain separate from public product facts.

Inventory represents useful household truth rather than false precision:

- product/package;
- batch/lot when available;
- quantity, unit and confidence;
- sealed/open state;
- fridge/freezer/pantry location;
- purchase/opened/MHD/use-by dates;
- reserved and proposed consumption;
- household ownership;
- correction and event history.

Exact grams are required only when the operation or safety rule needs them. Piece, package, fraction and approximate remainder are legitimate states when clearly represented.

## 7. Recipe and meal intelligence

Recipe ranking uses usable stock, quantity confidence, expiry priority, recalls, allergens, preferences, time, equipment, serving count, cost, nutrition targets and missing ingredients. The first groups are:

1. fully cookable now;
2. cookable with safe substitutions;
3. nearly cookable with a short missing list;
4. inspiration outside the current stock.

Every recommendation explains why it appears. Deterministic code calculates ingredient compatibility, shortages, nutrition totals and inventory mutations. AI may adapt wording, rank eligible candidates and suggest substitutions inside hard constraints.

## 8. Information architecture

Consumer navigation should remain at four primary destinations:

- **Heute** — What can I eat now, use soon, key safety notices, compact nutrition state.
- **Erfassen** — continuous purchase scan, receipt import and correction queue.
- **Vorrat** — fridge/freezer/pantry with quick correction.
- **Planen** — recipes, week and shopping.

Account, privacy, integrations and detailed analytics live under profile/more. The scanner opens as a focused task surface rather than another dashboard tab full of controls.

## 9. Delivery roadmap

### Phase 0 — Trustworthy foundation

User value: a secure household and honest product truth.  
Includes: canonical identity, provenance, RLS/AAL2, correction history, safety rules, catalog validation and basic mobile performance.  
Excludes: autonomous vision claims, retailer integrations and hardware.  
Done when sources remain distinguishable, private data is isolated, normal EAN never fabricates a date and failures stay visible.

### Phase 1 — Scan-first useful MVP

User value: capture a purchase, see the real fridge and receive useful meal suggestions.  
Includes: continuous scan, duplicate quantity, final review queue, fast correction, What-can-I-eat, basic recipes, essential nutrition, allergens and shortages.  
Done when representative users complete 10- and 20-item sessions with tolerable time/correction burden and return to use the resulting food state.

### Phase 2 — Assisted automation

User value: less manual work.  
Includes: receipt OCR, e-receipts, learned package/location defaults, better quantity proposals and explicit recipe-consumption suggestions.  
Done when automation lowers correction burden without increasing provenance, quantity or safety failures.

### Phase 3 — Personal food operating system

User value: coordinated household meals, goals, budget and planning.  
Includes: advanced week planning, household preferences, deeper nutrition analysis, optional integrations and explainable personalization.  
Done when retention and paid willingness improve without weakening free core usefulness.

### Phase 4 — Optional hardware and ambient capture

User value: near-zero-friction entry for proven high-value households.  
Includes: FoodOS Dock or kitchen camera experiments and smart-kitchen integrations.  
Done only after smartphone capture has proven recurring value, privacy acceptability and supportable economics.

## 10. Agent Operating Model v2 delivery contract

All cross-scope work uses the current company registry and operating model. The Executive Orchestrator is a manager, not a super-agent above the CEO and not a self-approver.

Standard delivery chain:

```text
Founder intent
-> AI CEO priority and operating envelope
-> Executive Orchestrator work graph
-> accountable C-level and department lead
-> bounded worker(s)
-> independent verifier / assurance where required
-> Chief-of-Staff consistency check
-> CEO decision
-> David approval for material irreversible, legal, strategic or high-cost actions
```

CPO owns simplicity and consumer outcome. CTO owns architecture and implementation quality. CDAO owns data/provenance/measurement. CISO and Legal/Privacy can stop unsafe or unlawful release. Food Safety owns date, allergen, recall and nutrition communication boundaries. AECO optimizes context, models, CI and provider cost but may not remove scope, weaken tests or degrade the core loop without the documented approval chain.

## 11. Current priority order

1. Keep PR #5 release evidence honest and stop adding unrelated breadth.
2. Merge the Agent Operating Model v2 and canonical planning documents through PR #6.
3. Build the first consumer slice in a new focused PR: continuous multi-item capture plus final uncertainty review.
4. Follow with quick inventory correction and What-can-I-eat ranking using actual stock.
5. Add receipt assistance only after the barcode session and correction queue are measured.
6. Build read-only Company Command Center panels without delaying the consumer slices.

## 12. Definition of done for plan changes

A planning change is complete only when canonical ownership is clear, links resolve, contradictions are removed or marked historical, agent governance validation passes, applicable Markdown/JSON/SVG checks pass, the exact diff is reviewed and the handoff names remaining external decisions. Documentation never claims product usability, legal clearance, trademark availability or production readiness without corresponding evidence.
