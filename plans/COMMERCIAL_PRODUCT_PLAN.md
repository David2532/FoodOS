# FoodOS commercial product plan

Status: **launch blueprint, Germany-first**. This document defines product scope and
release gates. It is not a substitute for advice from a qualified lawyer, tax adviser,
food-law specialist, or data-protection officer.

## Product promise

FoodOS helps people know what food they have, which physical package should be used
next, and what to buy for the coming days. It combines barcode and GS1 scanning,
MHD/use-by capture, inventory, personal ingredient relevance, nutrition logging, meal
planning, a derived shopping list and source-backed recall awareness.

Allowed promise:

> Understand your food stock, use it in time, and plan the next shop with source-backed
> product information.

FoodOS must not promise that a food is safe, diagnose a condition, replace medical
advice, or label an ingredient as universally “harmful”. Personal relevance is based on
the user's declared profile, deterministic rules, source, confidence, and version.

## Launch scope

### Market sequence

1. Germany, German language, EUR, 16+ positioning.
2. EEA countries only after a country pack passes the release gate.
3. United Kingdom, Switzerland, United States, and other markets are independent legal,
   tax, food-information, accessibility, consumer-law, privacy, ad, and store reviews.

Publishing a translated store listing is not a market-compliance review. Availability
is controlled by storefront/country allowlists. “Worldwide compliant” must never appear
in product, developer, investor, or marketing copy.

### Platforms

| Surface | Purpose | Launch role |
|---|---|---|
| Native iOS app | Main consumer product | App Store release |
| Native Android app | Main consumer product | Google Play release |
| Web app/PWA | Account, deletion, export, support, lightweight use | Production companion |
| Admin console | Support and content/rule operations | Restricted internal surface |

The native applications must provide native value: camera scanning, secure credential
storage, offline queue, haptics, local notifications, push reminders, and OS sharing.
They must not be a thin WebView around the website.

## Audience and age

- Initial audience: private households and adults/older teenagers managing their own
  purchases; minimum supported age 16 in Germany.
- FoodOS is not a Kids Category product and does not intentionally profile children.
- A later under-16 mode requires a separate age-assurance, parental-consent, advertising,
  content, and deletion design before implementation.

## Core product loops

1. Scan a barcode, GS1 code, or enter a product manually.
2. Review product data and capture the physical package's MHD or use-by date.
3. Save the batch, receive FEFO reminders, consume/correct/dispose it.
4. See daily and weekly nutrition with explicit missing-data states.
5. Build a meal plan from suitable stock and generate only the missing shopping items.
6. Review ingredient relevance with sources, reasons, and uncertainty.
7. Check approved official recall sources and act on exact/possible batch matches.

MHD is attached to a physical inventory batch, never merely to the generic product.
A normal EAN/UPC usually does not contain a date. FoodOS may parse GS1 AIs `15` and
`17`, use OCR with confidence, or ask for manual confirmation. It must never invent a
date from a catalog entry.

## MHD and use-by rules

| Date kind | UI language | Product behavior |
|---|---|---|
| Best before / MHD | Quality date | Reminder, inspect guidance, no safety guarantee |
| Use by / Verbrauchsdatum | Safety date for highly perishable food | Prominent warning; after date do not recommend consumption |
| Unknown | No date captured | Offer camera/manual entry; never assume fresh or expired |

Every captured date stores `date_kind`, `value`, `source`, `captured_at`, `confidence`,
`timezone`, and optional lot/serial. OCR and parsed GS1 values require a confirmation
screen unless deterministic parsing and display are unambiguous.

## Product tiers

### Free

- barcode/GS1/manual capture, MHD/use-by, core inventory, reminders;
- one household, official-source recall warnings and essential shared safety information;
- ingredient source and personal relevance basics;
- daily overview, basic week and shopping list;
- export, correction, consent withdrawal, account deletion, and security controls;
- limited, context-only advertisements outside sensitive flows.

### Premium

- no advertisements;
- family sync and richer household permissions;
- longer history and advanced nutrition/stock analytics;
- advanced meal planning, repeat plans, pantry optimization;
- larger OCR and automation quota;
- convenience integrations that provide ongoing value.

Security, account recovery, 2FA, deletion, export, allergy conflict warnings, use-by
warnings, recall checks, source display, and correction paths must never be paywalled.

Initial pricing is a hypothesis, not a commitment: test approximately EUR 2.99/month
and EUR 24.99/year with clear renewal and cancellation terms. StoreKit and Google Play
Billing are used for digital subscriptions in the corresponding native apps.

## Advertisement policy

If ads are enabled after the validation and ad-safety gates, FoodOS launches them as
contextual/non-personalized advertising only. A user's scans,
barcodes, brands, inventory, consumption, calories, weight, allergies, exclusions,
ingredient assessments, MHD, household composition, and precise location are prohibited
as ad-targeting or lookalike inputs.

Ads are prohibited on:

- sign-in, 2FA, recovery, consent, export, and deletion screens;
- the active scanner and camera-permission flow;
- use-by warnings and MHD actions;
- ingredient/allergen relevance and nutrition/health-profile screens;
- error states and destructive confirmations;
- recall, offline conflict and account/security recovery screens.

No interstitial may interrupt a safety or inventory action. The launch format is at most
one clearly labeled contextual banner/native placement on low-risk discovery surfaces.
There is an in-app reporting path for inappropriate ads. SDK activation is blocked until
the applicable consent/CMP state is known; vendor manifests and network behavior are
audited before each release. Test ads are mandatory outside production; invalid-traffic
and accidental-click/source anomalies can disable all ads without affecting the core.

## Success metrics with privacy guardrails

| Outcome | Metric | Guardrail |
|---|---|---|
| Useful capture | confirmed batches per activated household | no raw barcode/product in analytics |
| Less waste | batches consumed before date vs disposed | household-level, pseudonymous aggregation |
| Planning value | generated list completion | no ingredient or health profile in ad systems |
| Retention | privacy-safe weekly active households | no fingerprinting or cross-app tracking |
| Revenue | premium conversion and net subscription revenue | no dark patterns; cancellation clarity |
| Trusted use | weekly trusted-household core-loop completion | invented-date, recall, sync-loss and privacy zero-target guardrails |

Raw event payloads must be allowlisted. Free-text, product name, image, email, GTIN,
ingredient list, health/profile fields, and dates are excluded from general analytics.

## Commercial operating model

Before taking payments or publishing as a business:

- form/confirm the legal entity, business registration, VAT/tax handling, bank account,
  developer accounts, support address, and German imprint details;
- complete product-name/trademark/domain/store-name and asset/content/dependency rights
  review before irreversible public brand spend;
- name controllers, processors, subprocessors, support access roles, and incident owners;
- execute processor agreements and international-transfer safeguards where needed;
- commission final privacy, food-law, consumer-law, tax, store-copy, and accessibility
  review for the exact release build and vendor list;
- define customer support, refund/escalation, ad-report, data-subject request, and breach
  processes with tested response times.

## Market release gate

A country is enabled only when all fields are signed off and linked to evidence:

- legal entity and store contracts;
- privacy legal bases, data residency/transfers, processor contracts, retention;
- ads/CMP/consent behavior and vendor disclosure;
- subscription, prices, taxes, cancellation, refunds, consumer information;
- food/date/claim wording and local language;
- accessibility requirements and tested assistive technologies;
- age threshold and minors design;
- incident, support, deletion, export, complaint, and regulator contacts;
- official recall-source permission/coverage/freshness and correction/retraction process;
- 13-week liquidity/corporate/platform calendar, owner/deputy and professional advisers;
- App Store/Play declarations matching actual SDK traffic and server processing.

## Non-goals for the first commercial release

- medical diagnosis, treatment, disease risk, or therapeutic claims;
- universal toxicity/harm rankings;
- automated “safe to eat” decisions from an image or MHD alone;
- personalized advertising or data brokerage;
- marketplace, delivery, insurance, employer, or healthcare-provider data sharing;
- unreviewed worldwide distribution.
- autonomous medical/nutrition advice, community/marketplace content or unreviewed AI
  generation;
- ads before repeat-value, consent, placement and invalid-traffic evidence.
