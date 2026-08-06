# FoodOS brand asset manifest

Status: **working assets, not final registered marks**.

## Current assets

| Asset | Purpose | Format / viewBox | Status | Intended use |
|---|---|---|---|---|
| `public/assets/brand/foodos-mark.svg` | Product symbol / app-icon source | SVG, 128×128 viewBox | Working vector concept | favicon, PWA/icon source after optical export review |
| `public/assets/brand/foodos-lockup-dark.svg` | Horizontal product lockup on dark surface | SVG, 520×128 viewBox | Working vector concept | landing page, internal deck, social header crop |

## Design source

Both assets are original deterministic SVG constructions created for FoodOS. They use the working Quiet Intelligence + Household Flow direction from `docs/brand/BRAND_SYSTEM.md`. No external image, competitor logo or unlicensed font file is embedded.

The logo text relies on the runtime/system font stack `Geist, Inter, Arial, sans-serif`; production exports should convert the approved wordmark to reviewed vector outlines or use the licensed application font consistently.

## Required production exports

These remain `PLANNED`, not completed:

| Asset | Required output |
|---|---|
| App icon | 1024×1024 master PNG, iOS safe-area review, Android adaptive foreground/background |
| PWA icons | 192×192 and 512×512 PNG plus maskable variants |
| Favicon | 16, 32 and 48 px ICO/PNG plus SVG where supported |
| Light lockup | SVG and PNG on light neutral background |
| Monochrome mark | black and white SVG variants |
| Social preview | 1200×630 PNG/WebP with exact product copy |
| Splash asset | platform-specific centered symbol with safe margins |
| Onboarding hero | original illustration or motion asset showing purchase → fridge → meal flow |
| Capture visual | scanner-session explainer without real branded product imagery |
| Corporate lockup | only after the final company name is legally reviewed and approved |
| Document header | corporate template after naming approval |

## Quality gate

Before any asset becomes `APPROVED`:

1. verify SVG syntax and render it in dark and light browser contexts;
2. inspect at 16, 24, 32, 64, 128 and 1024 px equivalents;
3. verify exact spelling and capitalization;
4. confirm clear space and crop safety;
5. test color contrast and monochrome legibility;
6. confirm no text becomes unreadable in raster exports;
7. verify Apple and Android icon safe areas;
8. document source, generator/tool version and approving person;
9. confirm naming/trademark review status;
10. update this manifest with checksum, dimensions and deployment locations.

## Restrictions

- Working assets must not be represented as a legally cleared trademark.
- Do not use generated images of real branded products.
- Do not add watermarks, stock imagery or copied competitor motifs.
- Do not create dozens of near-duplicate exports before the core mark is approved.
- Corporate assets must not use `Calyra Systems` publicly until David approves the name and the official clearance steps are complete.
