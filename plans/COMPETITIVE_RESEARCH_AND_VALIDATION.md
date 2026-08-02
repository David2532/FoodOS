# FoodOS competitive research and validation plan

Status: **qualitative discovery brief, researched 2 August 2026**. Public product pages,
store listings and individual reviews reveal failure patterns, not market-share truth or
a statistically representative sample. FoodOS must validate these findings with its own
German target users before treating them as facts.

The operational protocol, recruitment matrix, consent/retention, task fixtures,
measurement and retest gates are binding in
`plans/UX_RESEARCH_AND_USABILITY_TESTING.md`. This file decides market/position scope;
the specialist research plan decides how usability evidence is collected.

“FoodOS” is a repository codename, not a cleared public brand. Existing restaurant
software and a paid pantry/meal-planning template already use the same or spaced name;
see `GAP_AUDIT_AND_OPTIMIZATION.md`. Name clearance/selection is part of Stage -1.

## What similar products teach us

| Product/evidence | Useful pattern | Reported or visible risk | FoodOS decision |
|---|---|---|---|
| Fridgely | clean expiry-first UI, spaces and household sync | product page says the app estimates an expiry date from barcode/product | never display an estimated batch date as observed; default to second scan/manual confirmation |
| NoWaste | inventory, scan/photo/receipt, planning and sharing in one product | App Store reviews report wrong dates, clunky entry, wrong destinations and loss of a multi-item scan after a crash | transactional incremental saves, resume state, explicit destination and zero fabricated dates |
| KitchenPal | quick capture, pantry→shopping loop and responsive support | reviews mention random list routing, inability to edit quantity in shopping mode and occasional bugs | preserve the user's current context, allow in-flow correction and build support feedback into triage |
| Best Before | simple date-tracking proposition | a Play review reports account creation failure and a camera-photo interaction presented as scanning | core can be tried safely; permissions and scanner behavior must match the words used |
| FridgeBuddy | local/iCloud option, household sharing and configurable reminders | release history repeatedly mentions sharing/sync, camera-permission, widget and lag fixes | sync, permissions and upgrades are permanent quality programs, not one-off features |
| privacy/offline-first pantry apps | no-account mode reduces trust and onboarding barriers | local-only data can disappear on uninstall and may not support mixed iOS/Android households | offer a privacy-minimized trial/demo, then explain the account/sync tradeoff honestly |

Sources:

- Fridgely product page: <https://fridgelyapp.com/>
- NoWaste product page and App Store reviews: <https://www.nowasteapp.com/> and
  <https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004?platform=iphone&see-all=reviews>
- KitchenPal product page and App Store reviews: <https://kitchenpalapp.com/en/> and
  <https://apps.apple.com/us/app/kitchenpal-shared-grocery-list/id1084982489>
- Best Before Play listing: <https://play.google.com/store/apps/details?id=com.peytu.bestbefore>
- FridgeBuddy App Store listing/release history:
  <https://apps.apple.com/us/app/pantry-fridge-fridgebuddy/id1500190823>

## Recurring user problems to design out

1. **Capture costs more time than the food is worth.** Optimize scan→confirm→next, bulk
   unpacking, recent defaults, voice/manual fallback and correction without restarting.
2. **A barcode is mistaken for a batch date.** A GTIN identifies a trade item; GS1 AIs
   can additionally encode lot/date, but ordinary retail EANs usually do not. Never fill
   the gap with an unlabeled guess.
3. **One crash destroys tedious work.** Persist each confirmed batch atomically and show
   which items are durable, pending, conflicted or failed.
4. **The system becomes stale when people consume without logging.** Provide one-tap
   consume/dispose, household activity, periodic reconciliation and “inventory may be
   stale” rather than pretending precision.
5. **Shared lists surprise users.** Destination, owner and household changes stay visible;
   no random list/location choice and no last-write-wins for quantities.
6. **Notifications become noise.** Let users choose lead times and quiet hours, group
   reminders, record delivery state and prioritize recall/use-by over MHD suggestions.
7. **Feature abundance hides the daily job.** Today exposes only use-first, plan/shop and
   scan actions; advanced nutrition, provenance and CEO detail stay progressively deeper.
8. **Privacy is unclear.** Explain why an account, photo, health profile or cloud OCR is
   requested at the moment of use; refusal keeps the safe core functional.
9. **Support response determines recovery.** A safe reference, status page, in-app report,
   export and correction path are part of the product, not post-launch admin.
10. **Paywalls arrive before trust.** Do not place security, recall, use-by, export,
    deletion or basic inventory integrity behind Premium.
11. **A polished phone screen can still be slow or broken elsewhere.** Treat startup,
    scanner cost, large lists, text scaling, tablets/foldables and assistive technology as
    product behavior with budgets, not post-launch polish.
12. **Completion does not prove comprehension.** Ask users to explain date, ingredient,
    recall, offline and deletion consequences; a fast wrong mental model blocks release.

## Defensible FoodOS position

FoodOS should not compete by promising the largest feature list. Its launch position is:

> The fastest trustworthy way for a German household to turn a real package into a
> confirmed batch, know what to use first, avoid unsafe assumptions, and buy only what is
> missing — with visible source quality and private-by-default operation.

The differentiators are trusted batch dates, official recall awareness, personal but
non-medical ingredient relevance, resilient multi-device inventory, and the connected
nutrition→plan→shopping loop. “AI” is not a differentiator unless measured accuracy and
lower capture effort are proven.

## Stage -1 validation before full build

### V1 – problem interviews

- Recruit 15–20 people across living alone, couples/shared flats and families; include
  users who already track food and users who stopped.
- Observe their current unpacking, stock check and shopping flow. Ask for the last real
  incident, waste/cost and workaround before presenting FoodOS.
- Record segment, frequency, consequence, current tool, privacy concern and willingness
  to change behavior. Do not record health details in discovery analytics.

Gate: at least one narrow segment has a recurring, consequential problem and an existing
workaround. Otherwise narrow or stop before building the native platform.

### V2 – prototype usability

- Run at least two iterative rounds totaling 8–12 target users with the current mockups
  plus an interactive scan/date/consume/shop prototype; include assistive-technology and
  low/mid-device contexts. Use fictional fixtures where real products would expose
  unnecessary sensitive data or create a safety misunderstanding.
- Measure time and errors from camera open to confirmed batch, date-type comprehension,
  correction success, trust in unknown states and whether the next action is obvious.
- Include an unknown barcode, EAN without date, bad OCR, camera denial, duplicate scan,
  possible recall and offline conflict.

Gate: no participant should need to believe that an ordinary barcode contains an exact
MHD; all P0 comprehension failures are redesigned and retested.

### V3 – concierge beta

- 20–30 households for four weeks using a production-like Germany-only build;
- founder observes opt-in sessions/interviews, not private inventories;
- weekly reconciliation asks whether the digital inventory is usable, incomplete or
  abandoned and why;
- test a real price offer/refundable preorder or store sandbox purchase without dark
  patterns; stated enthusiasm alone is not willingness to pay.

### V4 – closed beta and scale decision

Expand only after retention, correctness, support effort, variable cost and privacy-safe
instrumentation are stable. The decision journal records continue/narrow/pivot/stop and
what evidence would reverse it.

## KPI framework

Targets are hypotheses until V1–V3 provide a baseline; the CEO Center must label them
`PROVISIONAL`, not industry benchmarks.

| Role | Metric | Definition | Guardrail |
|---|---|---|---|
| primary value | weekly trusted-household rate | eligible households that confirm stock and complete at least one use/plan/shop action in the week ÷ eligible activated households | exclude test/support; no product-level analytics |
| primary business | paid value retention | paying cohorts still entitled and completing a core-value action after the selected period | refund, complaint and wrongful-entitlement rates |
| driver | time to confirmed batch | camera/manual start to durable batch confirmation; median and p90 by known/unknown/OCR path | zero invented-date events and save-loss incidents |
| driver | capture completion | batch confirmed ÷ scan/manual starts, by failure reason | do not improve by silently defaulting fields |
| driver | inventory trust | households marking inventory usable/current at reconciliation ÷ respondents | response coverage and sync-conflict rate shown |
| guardrail | support burden | human support minutes and open cases per 100 active households | severity and backlog age, not only volume |
| guardrail | variable service cost | provider, infrastructure and support cost per active/paid household | source freshness and allocated-cost coverage |

Initial decision bands are set only after two complete beta cohorts. Until then the hard
release thresholds are correctness/security constraints: zero invented date, zero known
cross-tenant access, zero unexplained data loss, zero sensitive ad/telemetry payload and
all C0 evidence proven.

## Experiment discipline

- one primary hypothesis and metric per experiment;
- predeclare segment, exposure, duration/minimum sample rationale and guardrails;
- do not experiment on warnings, privacy rights, MFA, deletion or food-safety wording;
- store experiment assignment separately from sensitive profiles;
- stop automatically for C0/C1 guardrail breach, but require a human to claim success;
- keep negative results and decisions so the team does not rerun failed ideas silently.

## Roadmap consequence

If capture burden or repeat use fails, do not compensate by adding recipes, social
features or more AI. First simplify scope: expiry/recall-only, shopping-only, or a single
high-need segment. Internationalization, community recipes, broad health features and ad
optimization remain excluded until the trusted-household loop and unit economics survive
two reviewed cohorts.
