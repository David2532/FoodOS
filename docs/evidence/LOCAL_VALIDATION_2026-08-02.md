# Local validation — 2026-08-02

Environment: Windows, local repository branch `agent/foodos-mvp`; project pins Node 22.
The available runner used a newer local Node version, so exact Node-22 CI remains a
separate artifact check.

| Gate | Result | Evidence |
|---|---|---|
| Baseline `npm run verify` | `FLAKY` | Initial build could not download Google fonts; escalated retry passed. The implementation replaced network fonts with local Geist. |
| Final `npm run verify` | `FLAKY` | The first packaging run mistakenly collected the separate Playwright auth spec in Vitest; after excluding `e2e-auth/**`, the repeat passed lint, TypeScript, 26 tests and the Next production build. Per policy the repeated gate remains flaky. |
| Offline-slice `npm run verify` | `PASS` | Clean follow-up run passed lint, TypeScript, 13 files/37 tests and the Next production build. |
| Offline-slice `npm run test:coverage` | `PASS` | 93.66% statements, 88.99% branches, 97.95% functions and 98.31% lines; all configured gates passed. |
| GitHub Actions Node 22 / npm 10 | `PASS` | Locked install plus lint, TypeScript, 26 tests and production build passed in run `30762182243` after pinning the Node-22-compatible ZXing pair and regenerating the lock with npm 10. |
| `npm run test:coverage` | `PASS` | 93.81% statements, 89% branches, 100% functions, 98.71% lines for configured critical modules. |
| Supabase clean reset | `PASS` | Migrations 0001–0007 applied from an empty local Postgres 17 database. |
| Supabase schema lint | `PASS` | No schema errors reported. |
| pgTAP/RLS | `PASS` | 35/35: AAL1 denial, AAL2 onboarding, second-user isolation, inventory replay/atomicity, append-only audit, planning, shopping and recall provenance tables. |
| Playwright Pixel 7 + Desktop Chrome | `FLAKY` | Initial runs exposed a nameless button, dev-overlay interference and transient fade contrast. After fixes, 4/4 passed; per policy the gate remains flaky until an independent clean artifact. |
| Real local Auth/TOTP/onboarding E2E | `PASS` | 1/1: registered an isolated local user, proved AAL1 stayed at MFA, enrolled and verified real TOTP, atomically created household/owner/profile, then loaded the AAL2 app. Local DB was reset afterward. |
| Encrypted offline outbox reconnect E2E | `PASS` | The same real-stack browser flow looked up a product, confirmed a batch while offline, verified one `QUEUED` IndexedDB record exposed no payload/actor/household fields and contained AES-GCM ciphertext with a 12-byte IV, then reconnected and observed the server-accepted batch. |
| AAL2/RLS data export E2E | `PASS` | Unauthenticated access returned 401 with `no-store`; the AAL2 user received a JSON attachment with exactly one isolated household, product and batch. A no-Supabase preview returned typed 503 instead of a generic server error. |
| Automated serious/critical axe findings | `PASS on final run` | Zero serious/critical findings on the final Pixel-7 and Desktop-Chrome runs. |
| Visual screenshots | `REVIEWED_LOCAL` | Fictitious preview screenshots under `docs/evidence/screenshots/`; no authenticated data. |
| Dependency audit | `PASS` | Final `npm audit --audit-level=high`: 0 vulnerabilities. |
| Native/Maestro/store sandbox | `NOT_RUN` | Native expansion is gated by red Stage -1 evidence. |
| Production Supabase/Vercel | `NOT_RUN` | No remote project or production URL was created or claimed. |
| Human usability / brand / legal release | `NOT_RUN / BLOCKED` | See `STAGE_MINUS_ONE_STATUS.md`. |

The local checks do not prove production performance, RUM, recovery, restore, load,
penetration testing, official recalls, legal compliance or commercial readiness.
