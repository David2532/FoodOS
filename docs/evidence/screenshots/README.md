# Browser evidence screenshots

`npm run test:e2e` writes one full-page preview screenshot per configured Playwright
project after the canonical navigation and overflow checks. These screenshots contain
only explicitly fictitious preview data and no authenticated household information.

They are visual review aids, not production RUM, usability-study, native-device or
deployment evidence.

`catalog-chromium-mobile.png` and `catalog-chromium-desktop.png` are written by the
deterministic provider-shaped Preview E2E after submitting “Haferflocken”. They contain
only the explicit test fixture and no authenticated household/profile data. They prove
the client contract, responsive layout and accessibility smoke without sending a test
query to Open Food Facts; they are not live-provider or product-data evidence.

`live-open-food-facts-ruehls-mobile.png` and
`live-open-food-facts-product-detail-mobile.png` were captured manually on 2026-08-05
from the local 390 x 844 Preview flow after a real Open Food Facts query for
`Rühls Bestes Whey`. They contain public catalog data only and show the responsive
result cards, available source images, nutrition summary, provider provenance and the
manual MHD/lot handoff. They are local live-provider evidence, not Production uptime,
production RUM or authenticated persistence evidence.

`auth-google-desktop.png` is produced by the local Supabase Auth E2E before any
credentials are entered. The legacy filename now documents the Apple and Google
one-click options and contains no user or household data; it is not evidence that either
remote provider is configured.

`billing-lab-preview-desktop.png` and `billing-lab-preview-mobile.png` were captured
manually on 2026-08-05 from the local development-only entitlement laboratory. They
contain deterministic Free, Plus, Family and 14-day-trial simulations only. They are
not evidence of a live payment, store integration, Vercel Preview access control or
Production availability.

`inventory-disposal-authenticated-desktop.png` and
`inventory-disposal-authenticated-mobile.png` were captured on 2026-08-06 from the
strictly local Auth/TOTP flow with a synthetic household, product and expired use-by
batch. They document the disabled-consumption explanation, explicit disposal action,
responsive layout and encrypted offline queue state. They contain no real account,
household or product data and are not Production, native-device or usability-study
evidence. Exact checks and limitations are recorded in
[`INVENTORY_DISPOSAL_LOCAL_2026-08-06.md`](../INVENTORY_DISPOSAL_LOCAL_2026-08-06.md).
