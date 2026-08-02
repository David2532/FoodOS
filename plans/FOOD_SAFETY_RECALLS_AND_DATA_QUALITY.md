# FoodOS food-safety, recall and data-quality plan

Status: **C0 safety contract**. FoodOS is an inventory and planning assistant, not a food
authority, laboratory or medical device. It must faithfully surface source-backed facts
and uncertainty; it must never declare a product safe.

## Safety hierarchy

1. An applicable official recall/use instruction overrides MHD, meal planning and normal
   use-first suggestions.
2. A confirmed use-by date in the past excludes the batch from consumption suggestions.
3. An MHD is a quality date, not a FoodOS safety guarantee.
4. Unknown date, lot, ingredient or recall coverage remains unknown.
5. User observation and official advice can lead to disposal even before a date.

The German official surface is `lebensmittelwarnung.de`, where the federal states and BVL
publish public warnings. EU RASFF provides public summaries and links to consumer recall
notices. Open Food Facts, OCR, manufacturer pages and user submissions are useful data
sources but never silently replace an applicable authority notice.

## Recall source contract

Every source adapter records:

- official publisher and jurisdiction;
- immutable source ID, canonical URL, published/updated/withdrawn timestamps;
- source retrieval time, parser/schema version, response hash and license/usage basis;
- product/brand, GTIN where present, lot/batch, date range, pack size and region/store;
- hazard category and the official consumer action without stronger reinterpretation;
- source language, correction/retraction relationship and raw-evidence retention class;
- coverage/freshness status and last successful complete poll.

Do not make the undocumented or community-documented warning endpoint a production
dependency until the competent publisher confirms terms, stability, authentication,
rate limits and permitted reuse. The `bundesAPI` description is discovery evidence, not
an SLA. Use an approved official feed/export/contract or an operationally reviewed
adapter with a visible coverage limitation.

## Matching model

| Match | Required evidence | UI and product behavior |
|---|---|---|
| `EXACT` | normalized GTIN plus matching lot/batch or other source-required qualifier | prominent recall warning; exclude from plan/consume; show official action |
| `POSSIBLE` | GTIN matches but lot is missing/ambiguous, or source says all lots | prominent “possibly affected”; ask user to compare package; do not clear automatically |
| `TEXT_CANDIDATE` | brand/name/size fuzzy match without reliable identifier | non-blocking review candidate; never state recalled based on text similarity alone |
| `NOT_MATCHED` | checked against current available records with no match | say “no match in currently available sources”, never “safe/not recalled” |
| `UNCHECKED` | source stale/unavailable, jurisdiction unsupported or item lacks usable data | show incomplete check and official link/manual guidance |

Match rules are deterministic and versioned. Fuzzy text can create a human-review
candidate only. A retracted/corrected notice creates a new state; it does not erase the
prior alert or user acknowledgement from the audit trail.

## Batch behavior

- Capture lot/batch whenever visible because GTIN alone may not identify affected stock.
- Re-evaluate active batches when a warning is added, corrected or expanded.
- Recall state is separate from expiry state and has higher presentation priority.
- Acknowledging an alert hides repetition only after recording the user's selected
  action; it does not relabel an affected batch as safe.
- Affected/possible batches are removed from meal suggestions and shopping inventory
  subtraction until resolved.
- Household members receive a privacy-safe notification such as “Wichtiger Produktrückruf
  in deinem Vorrat”; product/health detail stays behind authenticated AAL2.
- No advertisement appears on recall screens or notifications.

## Freshness and outage behavior

Provider cadence is configured from the approved source capability. FoodOS may target a
15-minute internal ingestion window for urgent feeds only after an official SLA/usage
basis exists; until then it displays measured cadence rather than promising real-time.

The recall service publishes:

- latest complete source time and next expected poll;
- lag, failure count, schema drift and rejected-record count;
- jurisdiction/product coverage;
- last successful end-to-end match/re-notification run.

If a source is stale or unavailable, FoodOS keeps prior warnings, blocks a green “checked”
state, shows the limitation and links to the official portal. A provider outage cannot
be converted into zero warnings.

## Product and OCR quality controls

- Product metadata and physical batch observations are separate records.
- Ordinary GTIN lookup may provide catalog facts but not the package's actual date/lot.
- GS1 AIs `10`, `15` and `17` are parsed when actually encoded; all parsed fields remain
  confirm-before-save.
- OCR stores per-field bounding region, raw candidate only for approved short retention,
  normalized candidate, confidence, parser/model version and user correction.
- Date-type (`MHD` versus `use-by`) cannot be inferred solely from digits when the label
  wording/context is not confidently present.
- Unsafe/impossible dates, transpositions and locale ambiguity force manual review.

## Correction and dispute flow

Users can report wrong catalog data, wrong match or stale warning using a safe reference.
Support can view source evidence and match reasoning, not unrelated household/profile
data. A correction may update the shared catalog/rule, while the user's confirmed batch
value remains auditable. Safety complaints receive a severity owner and official
escalation path; FoodOS does not mediate with an authority as the user without explicit
authorization.

## C0 tests

- ordinary EAN cannot create an exact date or lot;
- exact GTIN+lot recall excludes the batch and sends one idempotent alert;
- GTIN-only ambiguity renders `POSSIBLE`, never `EXACT` or safe;
- fuzzy product name cannot create a blocking recall by itself;
- notice correction/retraction re-evaluates state without deleting history;
- stale/failed source cannot produce a “no recall” success state;
- recall overrides an in-date MHD and any meal/shopping suggestion;
- late/out-of-order ingestion and duplicate source records remain idempotent;
- two households see only their own matched-batch alerts;
- notification/telemetry contains no GTIN, product, lot, date or health profile;
- backup restore and offline reconnect do not resend acknowledged alerts incorrectly;
- parser/schema drift rejects records visibly and triggers the CEO risk queue.

## Owner and release gate

The food-safety owner signs source coverage, wording, matching rules, false-positive/
false-negative evaluation and the exact release. Legal/food specialist review is required
before claiming recall monitoring in store copy. Launch is blocked if FoodOS cannot state
what regions/sources were checked, cannot degrade honestly, or recommends a confirmed
affected/use-by-invalid batch.

## Primary references

- BVL/official German warning portal: <https://www.bvl.bund.de/DE/Aufgaben/07_Lebensmittelwarnungen/LMwarnungen_node.html>
- EU RASFF and consumers' portal: <https://food.ec.europa.eu/food-safety/rasff_en>
- GS1 Application Identifiers: <https://ref.gs1.org/ai/>
- GS1 2D retail guidance, including GTIN/date/lot examples:
  <https://ref.gs1.org/guidelines/2d-in-retail/1.0.0/>
- EU food-information regulation: <https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02011R1169-20250401>
