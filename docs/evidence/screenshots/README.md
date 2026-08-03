# Browser evidence screenshots

`npm run test:e2e` writes one full-page preview screenshot per configured Playwright
project after the canonical navigation and overflow checks. These screenshots contain
only explicitly fictitious preview data and no authenticated household information.

They are visual review aids, not production RUM, usability-study, native-device or
deployment evidence.

`auth-google-desktop.png` is produced by the local Supabase Auth E2E before any
credentials are entered. It documents the Google OAuth option and contains no user or
household data; it is not evidence that a remote Google provider is configured.
