# Browser evidence screenshots

`npm run test:e2e` writes one full-page preview screenshot per configured Playwright
project after the canonical navigation and overflow checks. These screenshots contain
only explicitly fictitious preview data and no authenticated household information.

They are visual review aids, not production RUM, usability-study, native-device or
deployment evidence.

`auth-google-desktop.png` is produced by the local Supabase Auth E2E before any
credentials are entered. The legacy filename now documents the Apple and Google
one-click options and contains no user or household data; it is not evidence that either
remote provider is configured.
