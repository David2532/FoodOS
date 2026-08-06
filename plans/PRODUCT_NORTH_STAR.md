# FoodOS product north star

Status: **binding product direction**. This document defines the core user value and the
simplicity bar that product, design, architecture and agent decisions must preserve.

## One-sentence promise

FoodOS turns a real grocery purchase into an accurate, useful digital fridge with as close
to zero work as possible, then answers the household's daily food questions: **What can I
eat now, what should I cook, what is expiring, what do I need to buy, and how does it fit
my calories, nutrients, allergens and personal goals?**

FoodOS is not primarily a database, food encyclopedia, calorie logger, recipe catalog or
CEO dashboard. Those are supporting systems. The consumer product wins only when the
complete household food loop feels easier than remembering, typing or using several apps.

## Core loop

```text
One purchase-capture session
-> FoodOS recognizes all products and likely quantities
-> user confirms only uncertainty or safety-critical data
-> digital fridge is updated
-> Today immediately shows useful actions
-> user chooses a meal or logs what was eaten with one confirmation
-> stock, calories, nutrients and shopping needs update automatically
```

Every major feature must shorten, improve or safely support this loop.

## The required consumer outcomes

A normal household must be able to:

1. capture an entire shopping trip in one continuous session instead of opening and
   finishing a separate form for every product;
2. see what is in fridge, freezer and pantry without maintaining a spreadsheet;
3. ask "What can I eat now?" and receive practical recipe or meal suggestions based on
   available food, time, preferences, dates and missing ingredients;
4. see calories, protein, carbohydrates, fat, fibre and relevant micronutrients for a
   product, meal, day and planned week when source data supports them;
5. understand allergens, personal exclusions and ingredient relevance without false
   medical or universal-health claims;
6. identify products that should be used soon, are affected by a recall, are missing
   important data or need confirmation;
7. generate a shopping list from actual shortages and optionally turn checked purchases
   directly into inventory;
8. correct mistakes quickly without losing trust in the system.

## Capture must feel nearly automatic

The preferred entry point is **Einkauf erfassen**, not "Produktformular ausfüllen".
The session remains open until the user finishes the whole purchase.

FoodOS should support a layered recognition pipeline:

- rapid continuous barcode scanning with duplicate/quantity detection;
- receipt import or camera capture to propose the purchased product set;
- multi-item camera recognition as an assistive proposal, never an unreviewed source of
  safety-critical facts;
- reusable household purchase memory, favourite stores and usual pack quantities;
- optional retailer, loyalty, delivery or e-receipt integrations when legally and
  technically available;
- voice or quick-tap correction for quantity, storage location and unknown items;
- OCR/GS1 for lot/date data when available;
- a single review queue for unresolved fields instead of interrupting every scan.

The app may prefill and infer low-risk convenience data. It must require explicit
confirmation for uncertain use-by dates, ambiguous allergens, recall identifiers and
other safety-critical values.

## Interaction budget

These are product targets, not claims of current implementation:

- known normal barcode: audible/haptic confirmation and ready for next item in under one
  second on a supported device and warm cache;
- repeated identical item: quantity increments without reopening details;
- normal 15-item purchase: one capture session, no more than one final review screen and
  manual interaction only for unresolved items;
- adding a recognized item must not require typing a product name, calories, ingredients
  or standard package data;
- after capture, the primary next actions are "Fertig", "Noch etwas scannen" and
  "Unklare Angaben prüfen";
- returning users land on useful food decisions, not administration.

A flow that is technically complete but repeatedly asks for avoidable fields fails this
product direction.

## Today is the decision surface

The consumer home screen should prioritize:

1. **Was kann ich jetzt essen?**
2. **Bald verbrauchen**
3. **Tagesziel und Nährstoffe**
4. **Schnell erfassen**
5. **Einkauf fehlt / Einkaufsliste**

Operational, account and catalog details must not dominate the everyday home screen.

## Recipe and meal intelligence

Recipe suggestions are constrained by reality, not generic inspiration. Ranking considers:

- ingredients and usable quantities currently available;
- use-by, MHD, recall and freshness constraints;
- time, equipment, meal size and cooking effort;
- allergies, exclusions, diet and household preferences;
- calorie and macro targets where the user enabled them;
- items that should be consumed soon;
- number and importance of missing ingredients;
- previous acceptance, rejection and household habits.

The user can choose a recipe, adjust servings and immediately see available ingredients,
shortages, calories and nutrients. Starting or completing a recipe can propose the exact
inventory consumption; it must not silently subtract uncertain quantities.

FoodOS may use AI to rank, explain or adapt recipes, but deterministic systems retain
inventory arithmetic, allergen/exclusion enforcement, date rules, recall rules and
nutrition totals.

## Product and health understanding

FoodOS must show source-backed facts first and interpretation second.

Allowed useful layers include:

- calories and nutrient composition with portion basis and missing-data states;
- NOVA or similar classifications only when sourced and explained;
- personal allergen/exclusion conflicts;
- evidence-backed ingredient notes with source, confidence and uncertainty;
- comparison against the user's stated goals or alternatives;
- an optional explainable product fit summary.

FoodOS must not label a product simply "healthy" or "unhealthy" as universal truth. A
summary such as "passt eher zu deinem Protein-Ziel, enthält aber dein persönliches
Ausschlussmerkmal" is more useful and honest than a mysterious score.

Any product score must expose its components, source coverage and uncertainty. Missing
nutrition or ingredient data can never become a positive score by default.

## Affordability and trust

The core loop remains genuinely useful for free:

- capture shopping and maintain inventory;
- basic expiry and recall handling;
- allergens and personal exclusions;
- basic recipe suggestions from available ingredients;
- essential calorie and nutrition visibility;
- shopping shortages;
- export, deletion, security and privacy rights.

Premium may provide ongoing convenience such as advanced planning, deeper analytics,
household automation, richer recipe adaptation, integrations and extended history. It
must not hold safety, privacy, core inventory correctness or basic daily usefulness
hostage.

Advertising, when present, is contextual only and absent from scan, allergy, recall,
expiry, nutrition detail, account/security and error flows.

## Product priority test

Before approving a roadmap item, answer:

1. Does it reduce capture work or improve capture trust?
2. Does it help answer what to eat, cook, use soon or buy?
3. Does it improve useful calorie, nutrient, allergen or ingredient understanding?
4. Does it make the core loop cheaper, faster or easier?
5. Does it protect correctness, privacy, safety or recovery for that loop?

If all answers are no, it is not a core product priority.

Internal company dashboards, agent structures, infrastructure polish and broad commercial
features may be necessary, but they must not displace the trusted food loop or consume the
majority of product effort before capture burden and repeat household use are proven.

## Required validation metrics

Do not claim product-market fit from implementation or automated tests. Measure with real
users:

- median time and taps for a 10- and 20-item purchase;
- percentage of recognized items requiring manual correction;
- percentage of purchase sessions completed without abandonment;
- inventory accuracy after 7 and 30 days;
- weekly use of "Was kann ich essen?" and accepted recipe suggestions;
- repeat capture rate per household;
- percentage of meals logged through inventory/recipe actions rather than manual entry;
- correction burden and support contacts;
- free-to-paid willingness without weakening the free core;
- trust failures involving dates, allergens, recalls, quantities or nutrition.

The product should be narrowed, redesigned or paused when capture remains burdensome or
households do not repeatedly use the resulting food decisions.

## Delivery order

1. continuous multi-item purchase capture and final uncertainty review;
2. accurate digital fridge with fast correction;
3. "What can I eat now?" using real inventory and date constraints;
4. recipe selection, serving adjustment and shortage calculation;
5. calories, macros, nutrients and personal ingredient relevance across product/meal/day;
6. shopping-list-to-inventory return loop;
7. receipt, retailer and assistive vision/AI integrations;
8. advanced automation, analytics and monetization.

The first six items define the consumer product. Later systems must strengthen them rather
than turn FoodOS into a collection of disconnected features.
