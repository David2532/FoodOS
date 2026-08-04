# FoodOS compliance matrix

Status: **engineering/legal working register for Germany-first launch**. It maps likely
obligations to product controls; it is not legal advice and not a certification. Legal
counsel must validate applicability, exact text, entity/vendor setup, and the release
build. New countries require a new reviewed country section before storefront enablement.

## Germany and EU baseline

| Area/source | FoodOS impact | Required control and evidence | Release status |
|---|---|---|---|
| GDPR Arts. 5, 6, 12–22 | personal data, transparency, rights | legal-basis map, notices, access/export/correction/deletion/restriction/objection process | Open until legal sign-off |
| GDPR Arts. 7 and 9 | allergies, weight/body goals and health-related profiles may be special-category data | optional separate explicit consent, proof/withdrawal, strict purpose separation, no ads | Open until DPIA/legal sign-off |
| GDPR Arts. 25 and 32 | privacy by design and security | minimization, default-private, AAL2, RLS, encryption, least privilege, restore/security tests | Engineering gate |
| GDPR Arts. 28, 30, 35, 44–49 | processors, records, DPIA, transfers | DPAs, ROPA, DPIA, subprocessor list, SCC/adequacy/transfer assessment | Legal/Privacy gate |
| GDPR Arts. 33–34 | data breach | incident plan, detection, risk decision, 72-hour regulator workflow where required | Drill before launch |
| TDDDG §25 | device storage/access such as ad identifiers/SDK storage | strictly necessary storage map; CMP consent before nonessential access | Privacy/SDK gate |
| BDSG | German supplementary privacy law | counsel applicability review, employment/support/admin context if applicable | Legal gate |
| DDG §5 | commercial provider information | persistent, directly reachable German imprint with entity/contact/register/VAT data | Corporate/legal gate |
| BFSG/BFSGV | consumer e-commerce/mobile services accessibility from 28 June 2025, subject to scope/exemptions | applicability review, accessible terms/support/purchase paths, EN 301 549/WCAG 2.2 AA and platform-AT evidence per `UI_UX_PERFORMANCE_PLAN.md` | Accessibility/legal gate |
| EU 1169/2011 Art. 24 | use-by replaces MHD for highly perishable foods and food is unsafe after use-by | separate date kinds, prominent post-use-by warning, no “safe” prediction | Food-law gate |
| EU 1924/2006 | nutrition and health claims | only permitted/substantiated claims; no misleading/medical/toxic language | Copy/content gate |
| EU 2019/770 | digital content/services supplied for payment or personal data | conformity, updates, remedy and termination review; clear consumer information | Consumer-law gate |
| EU 2024/1689 (AI Act) | OCR/AI-generated explanations and future models | inventory AI use cases; deterministic safety rules; transparent AI assistance and human correction; reassess timelines | AI/legal gate |
| BGB §312k | direct web conclusion of qualifying continuing consumer contracts | applicability review and compliant online cancellation path; store-native cancellation remains available for store subscriptions | Consumer-law gate |
| EU MDR 2017/745 + MDCG 2019-11 rev.1 | health/safety/intended-purpose wording can affect software qualification | versioned claims/intended-purpose register; no diagnosis/treatment/safety guarantee; specialist review on every material change | Medical-boundary gate |
| EU 2024/2847 (Cyber Resilience Act) | commercial software/product-with-digital-elements scope and phased obligations may apply | counsel scope/timeline; vulnerability handling, support period, secure updates, SBOM/technical evidence and reporting readiness | Security/legal gate |
| EU 2024/2853 (Product Liability Directive) | software and updates can create product-liability exposure under transposed rules | transposition/applicability review, safety/change evidence, incident preservation, update/support and insurance review | Liability/legal gate |
| EU 2022/2065 (DSA) | ads and any future community/hosting functions may trigger different duties | service-classification review; ad transparency/reporting and notice/action only where applicable; no community launch by assumption | DSA/legal gate |
| StaRUG §1 / InsO §15a | entity-specific crisis monitoring and potential insolvency filing duties | sourced early-warning process, owner/adviser escalation; dashboard never makes or files the legal decision | Corporate/legal gate |
| German/EU trademark and IP | FoodOS name, icons, generated assets, recipes, libraries and data rights | DPMA/EUIPO/domain/store search, counsel clearance, rights/license register and renewal calendar | Brand/IP gate |

## Platform and vendor baseline

| Source | FoodOS impact | Required control |
|---|---|---|
| Apple 3.1.1 | digital feature/subscription unlocks | In-App Purchase, restore, correct subscription disclosures |
| Apple 4.2 | minimum functionality | native product value; no thin website wrapper |
| Apple 5.1.1 | privacy, collection, retention, deletion | store + in-app policy, minimization, consent withdrawal, in-app deletion |
| Apple 5.1.3 | especially sensitive health/fitness data | never use health/profile data for advertising/marketing/data mining |
| Apple ATT/privacy labels | tracking and disclosure | no tracking initially; ATT before any future tracking; labels match behavior |
| Apple accessibility declarations | store claims about VoiceOver, Voice Control, Larger Text, contrast, reduced motion and related support | claim only features manually/automatically tested on the exact release; keep evidence and re-evaluate each update |
| Google Play User Data/Data Safety | disclosure, security, handling | prominent disclosure where needed, accurate form, secure transfer, deletion |
| Google Play account deletion | account-based app | in-app deletion plus functional web request route and data deletion |
| Apple/Google billing | native digital premium | store-native billing, entitlement backend, restore/revocation/cancellation handling |
| Google AdMob EU consent policy | EEA/UK/Swiss ad serving | certified CMP where applicable; consent before SDK purpose processing |
| Google AdMob invalid traffic | publisher account and ad revenue | test ads, safe placement, no encouraged/accidental clicks, source anomaly monitoring and global ad kill switch |
| Open Food Facts licenses/API rules | third-party product data and images | ODbL/DbCL/CC BY-SA attribution, User-Agent/rate limits, provenance, separate data layer |

## Required legal/product artifacts

- German imprint and entity details;
- Art. 13/14 privacy notice with exact purposes, legal bases, recipients, transfers,
  retention, rights, authority, consent withdrawal, and automated-decision information;
- terms/EULA, subscription/renewal/cancellation terms, and consumer information;
- consent records and versioned CMP/vendor configuration;
- records of processing, DPIA, technical/organizational measures, processor contracts,
  subprocessor register, transfer assessments, and breach plan;
- food information/source disclaimer and Open Food Facts attribution/license notice;
- official recall-source coverage/terms, matching limitation, correction/retraction and
  prominent official-action wording;
- versioned intended-purpose/claims register and AI/OCR model register/evaluation;
- trademark/domain/store-name search, asset/content/dependency license register and
  ownership/assignment evidence;
- account/export/deletion pages and internal data-subject-request procedure;
- accessibility statement/support path where applicable;
- country pack, app-store declarations, and signed release record.

## Open Food Facts boundary

Open Food Facts states that its database is under ODbL, individual contents under DbCL,
and product images under CC BY-SA, while completeness/accuracy is not guaranteed. FoodOS
therefore:

- stores OFF-derived catalog/cache records in a clearly identifiable open-data boundary;
- stages each bulk import as a separate public generation with source/schema/retrieval
  provenance, aggregate integrity hash and no household foreign key; no managed bulk
  import has been claimed as of 2026-08-04;
- stores proprietary household, event, profile, rule, ad, and subscription data outside
  that catalog and joins by normalized GTIN/reference at runtime;
- keeps source URL/id, license, retrieval time, language, confidence, and user override;
- gives visible attribution and a correction/report path;
- does not upload private receipt/fridge/package photos to OFF; contribution is a
  separate explicit flow after confirming rights and license consequences;
- obtains specialist ODbL review before publishing bulk catalog data or combined
  databases and documents the resulting share-alike approach.

The precise bulk source, opt-in scheduler, activation, failure handling and recovery
contract is maintained in [`docs/PUBLIC_CATALOG_OPERATIONS.md`](../docs/PUBLIC_CATALOG_OPERATIONS.md).

## Country pack template

For every new storefront, record:

| Field | Required decision |
|---|---|
| Jurisdiction | country/region and actual entity offering service |
| Privacy | controller, local law, consent age, data location, transfers, regulator |
| Ads | consent standard, child rules, prohibited targeting, vendor eligibility |
| Food | date labels, mandatory warnings, nutrition/health claim language |
| Commerce | currency, VAT/sales tax, price display, renewal, cancellation, refunds |
| Accessibility | applicable standard, statement, enforcement/contact |
| Stores | listing, age/rating, privacy labels, deletion URL, billing products |
| Operations | language support, complaint/DSR SLA, incident/legal contacts |
| Approval | named counsel/owner, version/build, date, evidence links |

## Primary legal references

- GDPR: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- TDDDG §25: <https://www.gesetze-im-internet.de/ttdsg/__25.html>
- BDSG: <https://www.gesetze-im-internet.de/bdsg_2018/>
- DDG §5: <https://www.gesetze-im-internet.de/ddg/__5.html>
- BFSG: <https://www.gesetze-im-internet.de/bfsg/>
- BFSGV: <https://www.gesetze-im-internet.de/bfsgv/BJNR092800022.html>
- WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- Apple accessibility evaluation criteria: <https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/>
- EU food information regulation (consolidated): <https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02011R1169-20250401>
- EU nutrition/health claims regulation: <https://eur-lex.europa.eu/eli/reg/2006/1924/oj/eng>
- Digital Content Directive: <https://eur-lex.europa.eu/eli/dir/2019/770/oj/eng>
- EU AI Act: <https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng>
- BGB §312k: <https://www.gesetze-im-internet.de/bgb/__312k.html>
- EU Medical Device Regulation: <https://eur-lex.europa.eu/eli/reg/2017/745/oj/eng>
- MDCG 2019-11 rev.1 software qualification guidance: <https://health.ec.europa.eu/latest-updates/update-mdcg-2019-11-rev1-qualification-and-classification-software-regulation-eu-2017745-and-2025-06-17_en>
- EU Cyber Resilience Act: <https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng>
- EU Product Liability Directive: <https://eur-lex.europa.eu/eli/dir/2024/2853/oj/eng>
- EU Digital Services Act: <https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng>
- StaRUG §1: <https://www.gesetze-im-internet.de/starug/__1.html>
- InsO §15a: <https://www.gesetze-im-internet.de/inso/__15a.html>
- DPMA trademark research: <https://www.dpma.de/marken/markenrecherche/index.html>
- Google AdMob invalid traffic: <https://support.google.com/admob/answer/3342054?hl=en>
- Open Food Facts API and licensing: <https://openfoodfacts.github.io/openfoodfacts-server/api/>
