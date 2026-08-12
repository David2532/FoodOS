# FoodOS zero-friction product experience plan

Status: **binding delivery plan for the consumer experience**.

This plan translates `plans/PRODUCT_NORTH_STAR.md` into an implementable product,
interaction, data and agent-delivery sequence. It does not weaken food-safety, privacy,
security, source-provenance or evidence requirements.

## Product thesis

FoodOS succeeds only when maintaining the digital fridge feels easier than remembering
what is at home. The app is not a collection of scanner, calorie, recipe and shopping
screens. It is one continuous household food loop:

```text
Capture the purchase with almost no effort
-> understand the real fridge, freezer and pantry
-> answer "What can I eat now?"
-> cook or consume with one confirmation
-> update inventory and nutrition automatically
-> derive the next shopping need
```

Every consumer feature must reduce effort, increase trust or improve one of those daily
decisions.

## Experience principles

### 1. Ask only when uncertainty matters

FoodOS recognizes, proposes and remembers low-risk convenience data. The user is asked
only for unresolved values or safety-critical confirmation. Known product facts are never
retyped.

### 2. Continue first, review later

A scan session never becomes a sequence of product forms. Each successful recognition
returns immediately to the camera. Unresolved products and fields enter one final review
queue.

### 3. One-handed and glanceable

Primary actions remain reachable by thumb, use large targets, preserve camera context and
communicate success through haptics, sound and a compact visual receipt. Dense detail is
progressively disclosed.

### 4. Decisions before administration

The home surface prioritizes food decisions. Settings, sources, history and corrections
remain available but do not dominate the everyday flow.

### 5. Explain confidence and health meaning

FoodOS distinguishes facts, inferences and unknowns. It explains why something fits a
personal goal and never hides uncertainty behind a universal health score.

### 6. Free core, paid convenience

The free product must complete the trusted food loop. Premium can remove repetitive work,
add integrations and deepen planning, but cannot paywall safety, allergens, basic
nutrition, inventory correctness or basic recipe usefulness.

## Primary navigation

The consumer app should converge on four primary destinations:

1. **Heute** — what to eat, use soon and nutritional progress;
2. **Erfassen** — one purchase, receipt, quick correction or single item;
3. **Vorrat** — fridge, freezer and pantry with search and correction;
4. **Planen** — recipes, meal plan and shopping shortages.

Profile, household, privacy, account, sources and support live behind the secondary menu.
The internal `/ops` command center is never part of consumer navigation.

## Flow A — Capture one complete purchase

### Entry

The main action is `Einkauf erfassen`. Secondary methods are `Bon importieren`, `Einzelnes
Produkt` and later `Online-Einkauf verbinden`.

### Continuous scanner

The camera opens directly with:

- a large stable scan region;
- torch and manual-code fallback;
- current item count and session total;
- compact recent-item strip;
- persistent `Fertig` action;
- no modal after a normal successful scan.

Known item behavior:

```text
barcode recognized
-> short haptic/sound
-> item chip appears with name, image and quantity
-> duplicate scan increments quantity
-> scanner remains active
```

Unknown or uncertain item behavior:

```text
recognition incomplete
-> preserve scan in unresolved queue
-> show non-blocking amber feedback
-> continue scanning
```

Safety-critical ambiguity such as a possible use-by date may request confirmation, but it
must be designed as a fast field-level action rather than a full product form.

### Receipt and purchase-set proposal

A receipt or e-receipt may propose products and quantities before scanning. The user can
then confirm the set by scanning only unmatched or ambiguous products. Receipt text is a
proposal, not authoritative product identity or safety data.

### Final review

The final review contains only exceptions:

- unresolved identity;
- ambiguous quantity or pack size;
- optional storage location;
- missing or uncertain date/lot when relevant;
- duplicate conflict;
- data-source disagreement.

The screen supports `Alle sicheren übernehmen`, field-level correction, voice input and
`Später prüfen` for non-safety-critical convenience data. Safety-critical unresolved
values retain an explicit limited/unknown state.

### Completion

One confirmation writes the full purchase atomically or through an idempotent resumable
batch contract. The success surface shows:

- products added;
- unresolved items retained;
- products to use soon;
- immediate recipe opportunities;
- one action: `Was kann ich damit essen?`.

## Flow B — What can I eat now?

This is the highest-value daily surface.

### Inputs

Ranking uses:

- currently usable inventory and quantities;
- expiry/use-by and recall constraints;
- time available;
- cooking effort and equipment;
- meal type and household size;
- allergies, exclusions and preferences;
- calorie and macro targets when enabled;
- items that should be consumed soon;
- missing ingredients and substitution confidence;
- previous accepted and rejected suggestions.

### Output groups

The first screen provides a small number of useful choices, not an endless feed:

- `Jetzt sofort` — almost no preparation;
- `In 15–30 Minuten`;
- `Bald verbrauchen`;
- `Passt zu deinem Tagesziel`;
- `Dir fehlt nur 1 Zutat`.

Each card explains the match in one line, for example:

> 18 Minuten · alles vorhanden · verbraucht den offenen Lachs · 42 g Protein

### Recipe detail

The detail view shows:

- available, missing and substitutable ingredients;
- servings and portion controls;
- calories, macros and relevant nutrients per serving;
- allergen and exclusion state;
- products used soon;
- source and uncertainty for generated or adapted content;
- `Kochen starten`.

### Cooking mode

Cooking mode is step-focused, screen-awake and one-handed. Completing the recipe creates a
reviewable inventory-consumption proposal. Deterministic arithmetic calculates amounts;
AI may adapt instructions but cannot override allergens, recalls, dates or inventory.

## Flow C — Understand product, meal and day

Health information uses three layers:

1. **Facts** — source-backed calories, nutrients, ingredients, allergens and portion;
2. **Personal relevance** — conflicts and fit against stated preferences or goals;
3. **Explanation** — concise, non-medical summary with uncertainty.

A product-fit summary is component-based, not a mysterious single verdict. Example:

```text
Good fit for protein target
+ 24 g protein per serving
- high salt for your selected preference
! contains your saved exclusion
? fibre value missing from source
```

Comparisons must use equivalent portions and expose source coverage. Unknown data remains
unknown.

## Flow D — Inventory that corrects itself easily

The inventory is organized by fridge, freezer and pantry, but search works globally.
Corrections are optimized for speed:

- swipe/tap quantity adjustment;
- `verbraucht`, `weggeworfen`, `umgelagert` and `falsch erkannt` quick actions;
- recently used products first;
- undo for safe reversible actions;
- visible sync and conflict state;
- no hidden negative inventory.

FoodOS should learn recurring products, pack sizes and locations from confirmed behavior.
Learning creates suggestions, never silent safety-critical facts.

## Flow E — Shopping closes the loop

The shopping list combines:

- shortages from chosen recipes or plan;
- manual household items;
- optional predicted refills;
- items intentionally excluded from prediction.

At the store, checked items form a proposed purchase session. The user can scan to confirm,
import a receipt or accept trusted matches. Shopping completion should therefore reduce,
not duplicate, later inventory work.

## Automation ladder

Automation is introduced in proof-backed stages:

### Level 0 — Fast manual capture

Continuous barcode scanner, duplicate quantity, final exception review and quick
correction.

### Level 1 — Household memory

Remember confirmed pack sizes, preferred storage, regular purchases and recipe choices.

### Level 2 — Receipt-assisted capture

Receipt/e-receipt proposes the purchase set; scans resolve ambiguity.

### Level 3 — Vision-assisted capture

Multi-product camera proposals and package recognition reduce scans. Results remain
confidence-scored and reviewable.

### Level 4 — Retailer integrations

Opt-in retailer, delivery, loyalty or e-receipt sources can create a purchase proposal.
No integration bypasses provenance, household confirmation or correction.

### Level 5 — Optional dedicated capture device

A countertop or fridge-adjacent scanner is considered only after the phone flow proves
repeat value. It must use the same capture-session API and cannot become a prerequisite.

## Modern UI contract

- calm food-tech visual language, not enterprise dashboard or gamified fitness UI;
- edge-to-edge camera with minimal chrome;
- product imagery only from real identified sources;
- large typography for the next decision and restrained secondary metadata;
- bottom sheets for quick review, full screens only for complex correction;
- haptic/audio feedback has accessible visual equivalents;
- motion communicates continuity and respects reduced-motion preferences;
- skeletons preserve layout; failures preserve captured work;
- compact, medium and expanded layouts keep the same task state;
- no carousel or card wall where a ranked short list is more useful.

## Data and AI boundaries

Deterministic systems own:

- inventory balances and consumption;
- unit conversion and nutrition totals;
- date and recall enforcement;
- allergen/exclusion rules;
- source provenance and confidence;
- idempotency, transactions and conflict handling.

AI may:

- rank and explain meal options;
- adapt recipes within validated constraints;
- propose receipt/product matches;
- suggest substitutions;
- summarize nutrient and personal-fit information;
- learn non-sensitive convenience preferences from confirmed behavior.

AI output is validated before persistence. Low-confidence or safety-adjacent output is
shown as a proposal and never silently accepted.

## Success metrics and hard experience gates

The first product release is not accepted merely because features exist.

### Capture gates

- median 10-item purchase completion time;
- median 20-item purchase completion time;
- manual actions per recognized item;
- recognition and correction rate;
- session abandonment rate;
- percentage completed with only one final review;
- inventory accuracy after 7 and 30 days.

### Decision gates

- weekly use of `Was kann ich essen?`;
- accepted suggestion rate;
- time from opening Today to choosing food;
- percentage of selected recipes fully or nearly supported by inventory;
- percentage of meals logged through recipe/inventory actions;
- correction rate after proposed consumption.

### Trust gates

- zero accepted false-clear states for recalls, use-by, allergens and missing data;
- uncertainty comprehension in usability tests;
- no universal medical or health claims;
- source and portion understanding for nutrition.

Provisional product targets must be established through usability and beta evidence, not
invented in planning documents.

## Delivery slices

### Slice 1 — Continuous purchase capture

- session state machine;
- rapid barcode loop;
- duplicate quantity;
- unresolved queue;
- final review;
- atomic/idempotent commit;
- mobile E2E for 10- and 20-item fixtures.

### Slice 2 — Digital fridge and correction

- storage areas;
- rapid corrections and undo;
- inventory confidence and sync state;
- repeat-purchase memory proposals.

### Slice 3 — What can I eat now?

- deterministic eligibility filter;
- ranked short-list contract;
- date, recall, allergen and inventory constraints;
- explanation fields;
- Today integration.

### Slice 4 — Recipe-to-consumption loop

- serving adjustment;
- shortages and substitutions;
- cooking mode;
- reviewable consumption proposal;
- nutrition and inventory update.

### Slice 5 — Nutrition and personal fit

- product/meal/day views;
- nutrient coverage and unknown states;
- explainable fit components;
- comparable portion logic.

### Slice 6 — Shopping return loop

- plan/manual/predicted source preservation;
- checked-purchase proposal;
- capture-session handoff;
- quantity reconciliation.

### Slice 7 — Receipt and assistive AI

- receipt ingestion boundary;
- confidence-scored matching;
- correction and learning;
- privacy and retention controls;
- evaluation set and provider fallback.

## Agent-company execution contract

All delivery follows the current company-agent governance. Legacy master-agent or
Chief-of-Staff structures are not valid.

### Product ownership

- CPO owns user outcome, simplicity budget and acceptance criteria.
- Executive Orchestrator decomposes approved slices and routes work; it does not normally
  implement or approve its own work.
- CTO owns architecture, platform and technical delivery.
- CDAO owns measurement definitions and evidence quality.
- CISO, Privacy/DPO Operations and Food Safety/Claims independently review applicable
  boundaries.
- AECO optimizes context, models, CI and provider cost around the approved feature; it may
  not weaken the feature or its safety and usability gates.

### Required worker pattern

Each slice becomes a parent work item with bounded workers, for example:

```text
CPO acceptance owner
-> Orchestrator dependency plan
-> Product/UX research worker
-> Domain and contract worker
-> Data/Supabase worker
-> Mobile/web interaction worker
-> Test and evidence worker
-> independent verifier
-> named approver
```

Workers use `npm run agent:context -- <scope>`, isolated task branches/worktrees and the
rules in `docs/agent/WORKER_EXECUTION_CONTRACT.md`.

### Separation of duties

The same material change cannot be planned, implemented, verified and approved by one
agent. Usability claims require actual user evidence. AI confidence is never release
evidence.

### Capacity rule

Slices 1–6 are C1 core-product work once approved. Soft Codex, CI or provider budgets may
trigger `CAPACITY_EXCEPTION_PENDING`, model routing or sequencing, but AECO may not remove
the interaction, safety, accessibility or evidence requirements.

## Roadmap priority rule

Until capture burden and repeat use are proven, the majority of consumer-product effort
must remain on Slices 1–6. Company dashboards, broad marketing automation, speculative
hardware and advanced monetization may proceed only when they do not displace the trusted
food loop.
