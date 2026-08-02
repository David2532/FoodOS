# FoodOS App Store and Play release plan

Status: **submission checklist**. Complete it for every release whose data practices,
SDKs, payments, account flows, or claims change.

## Native application requirement

The mobile app is an Expo/React Native application sharing pure domain logic and design
tokens with the web app. It has native scanning, notifications, secure local session
storage, offline capture/sync, haptics, share sheet, deep links, and account controls.
A WebView wrapper is not a release candidate. Compact, medium and expanded windows use
deliberate platform navigation/panes and preserve task state during resize, fold and
rotation according to `plans/UI_UX_PERFORMANCE_PLAN.md`.

## Store product

- Category: Food & Drink / Lifestyle, not Medical and not Kids.
- Age: 16+ product positioning for initial Germany launch; store rating answers must
  reflect actual content and advertising.
- Digital premium is purchased using Apple In-App Purchase/StoreKit and Google Play
  Billing, with restore, entitlement sync, grace-period, refund/revocation handling.
- Prices, trial, billing period, auto-renewal, cancellation path, and ongoing value are
  visible before purchase. No external digital-purchase steering unless store rules and
  storefront entitlement clearly allow it.

## Required in-app surfaces

- privacy notice, imprint, terms/subscription terms, support;
- privacy choices/CMP entry available after the initial decision;
- account export and in-app account deletion;
- public web deletion-request route linked in Google Play;
- subscription management and restore purchases;
- Open Food Facts source/license attribution and data-correction path;
- food-information limits, source, confidence, and no-medical-advice language;
- recall-source coverage/freshness/match limitation and official-action screen;
- report an inappropriate ad/content and contact support.

## Privacy and advertising declarations

Before submission, capture network traffic from a clean install through account
creation, denial/acceptance of consent, scan, inventory save, premium purchase, export,
and deletion. The App Privacy and Data Safety forms must match observed app, SDK, and
server behavior, not merely the team's intent.

- Initial release has no personalized advertising and no cross-app/site tracking.
- Never grant an ad/analytics SDK access to product, inventory, health/profile, nutrition,
  image/OCR, MHD, or household payloads.
- If any vendor introduces tracking under Apple's definition, App Tracking Transparency
  must occur before tracking and the app must remain usable after denial.
- EEA/UK/Switzerland ad consent uses a certified CMP where required; consent information
  is refreshed on launch and privacy options remain reachable.
- SDK privacy manifests, data safety declarations, vendor list, and consent behavior are
  reviewed with every dependency update.
- test ads are enforced before release; invalid-traffic/source/placement guardrails and a
  global ad kill switch are demonstrated.

## Submission evidence pack

- reviewer account/demo instructions covering mandatory TOTP without a bypass;
- 6.7-inch and required device screenshots from the real release build;
- localized store copy, support URL, privacy URL, marketing URL;
- working account deletion and public deletion-request URL;
- subscription products, restore flow, and terms links;
- privacy/data-safety answers plus vendor/subprocessor list;
- food claims and MHD/use-by wording review;
- official recall-source terms/coverage and exact/possible/stale-state review;
- accessibility report: VoiceOver, TalkBack, dynamic text, contrast, focus, motion;
- Apple accessibility declarations and Android large-screen/accessibility behavior match
  the exact build; 44 pt iOS/48 dp Android targets and accessible auth are proven;
- release-build startup/frame/frozen-frame/memory/battery report by pinned device plus
  current store vitals and broken-device-cohort review;
- test matrix for camera denied, offline sync/conflict, recall outage/correction, OCR
  uncertainty, MFA recovery, OTA rollback, and deletion;
- release notes, signed OTA/runtime compatibility, build provenance, SBOM/dependency
  scan, rollback owner.

## Release gates

| Gate | Evidence | Owner sign-off |
|---|---|---|
| Product | F01–F08 plus native/offline/recall paths pass | Product/Engineering |
| Security | AAL2/RLS/recovery isolation, threat model, signed OTA/supply chain, backup restore | Security/Engineering |
| Privacy | DPIA, legal bases, consent, retention, DSR and breach drills | Privacy/Legal |
| Food claims | MHD/use-by/recall, ingredient language, sources, disclaimers reviewed | Food-law specialist |
| Commerce | SKU, tax, price, cancellation, restore, refunds verified | Finance/Product |
| Stores | privacy forms, reviewer path, metadata and SDK declarations match build | Release manager |
| Accessibility | mobile and web checks, BFSG applicability/review | Accessibility owner |
| UX/performance | representative usability retest; adaptive layout; startup/frame/memory and device-vital budgets | Product/Performance owner |

## Go/no-go tests

Do not submit when any of the following is true:

- private or health-related data appears in ad, analytics, crash, URL, or general logs;
- account creation exists without working in-app deletion;
- a normal barcode appears to provide a fabricated expiry date;
- recall coverage is claimed without approved source terms/freshness or a source outage
  can appear as “not recalled/safe”;
- use-by and MHD are presented as equivalent;
- a personal ingredient result lacks reason/source/uncertainty or makes a medical claim;
- the app requires consent for nonessential processing to use paid/core functionality;
- subscription state cannot restore after reinstall/account change;
- reviewer access relies on disabling real security in production;
- lost-factor recovery grants AAL2 from email/support alone or production OTA is
  unsigned/wrong-runtime/untraceable;
- the native app is only a repackaged website;
- a supported tablet/foldable is a stretched/broken phone UI, critical assistive-
  technology outcome fails, or startup/frame/memory/device-vital stop thresholds fail;
- the enabled storefront lacks a completed country pack.

## Primary store references

- Apple App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Apple privacy and tracking: <https://developer.apple.com/app-store/user-privacy-and-data-use/>
- Apple App Privacy details: <https://developer.apple.com/app-store/app-privacy-details/>
- Apple accessibility nutrition labels: <https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/>
- Google Play User Data policy: <https://support.google.com/googleplay/android-developer/answer/10144311?hl=en>
- Google Play account deletion: <https://support.google.com/googleplay/android-developer/answer/13327111?hl=en>
- Google Play Data Safety: <https://support.google.com/googleplay/android-developer/answer/10787469?hl=en>
- Google Play subscriptions: <https://developer.android.com/google/play/billing/subscriptions>
- Android adaptive app guidance: <https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps?hl=en>
- Android vitals: <https://developer.android.com/topic/performance/vitals>
- Google CMP requirement for EEA/UK/Switzerland: <https://support.google.com/admob/answer/13554116?hl=en>
