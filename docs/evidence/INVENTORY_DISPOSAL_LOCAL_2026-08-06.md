# Local evidence: atomic inventory disposal

Date: **2026-08-06**
Branch: `agent/atomic-inventory-disposal`
Base: `c2ef4a7071d2928ecb7c4d55f77944be9e7fc64e`

Status: **PASS locally** for the implemented disposal slice. This document does not
claim a managed Supabase migration, a Production deployment, native assistive-technology
coverage, or a true two-session database overlap.

## Delivered behavior

- A confirmed `Weggeworfen` action decrements exactly one inventory batch through the
  AAL2-only `discard_inventory_batch` RPC.
- The RPC rechecks a live household membership, uses the canonical lifecycle/member/batch
  lock order, rejects invalid, fractional-piece, zero, and overdraw amounts, and never
  creates a food-log entry.
- Payload-bound mutation receipts make an exact retry idempotent and reject mutation-ID
  reuse with a different payload.
- The encrypted IndexedDB outbox supports the disposal operation without exposing its
  private payload. A lost acknowledgement becomes `UNCERTAIN` and is retried only after
  an explicit user reconciliation with the original mutation ID.
- Past-use-by and recall-blocked batches keep consumption disabled while the disposal path
  remains explicit. Partial disposal, queued, rejected, uncertain, reconnect, success,
  focus return, and full-removal states are represented in the UI.
- Outbox state uses hydration-isomorphic initial HTML. Browser-only storage and network
  state are applied after mount, so an authenticated reload no longer causes React error
  `#418`.

## Executed local evidence

| Check | Result |
| --- | --- |
| Focused component/contract/outbox tests | **PASS** — 5 files / 55 tests before final hydration hardening; final targeted review run 3 files / 53 tests |
| `npm.cmd run test` | **PASS** — 72 files / 356 tests |
| `npm.cmd run test:coverage` | **PASS** — 356 tests; statements 91.73%, branches 88.16%, functions 97.93%, lines 96.63% in the configured domain/lib coverage scope |
| `npm.cmd run lint` | **PASS** |
| `npm.cmd run typecheck` | **PASS** |
| local-only `npm.cmd run build` | **PASS** — Production Supabase host hits: 0; Loopback host files: 3 |
| `npm.cmd run test:db` | **PASS** — 12 pgTAP files / 478 assertions |
| `npx.cmd supabase db lint --local --level warning --fail-on error` | **PASS** — no errors; warnings refer to unrelated `product_catalog_import_capacity` and `list_household_invitations` routines |
| `e2e-auth/inventory-disposal.spec.ts` | **PASS** — 2/2 authenticated Chromium tests |
| `npm.cmd run test:e2e:auth` | **PASS** — 7/7 authenticated Chromium tests, including OAuth/PKCE, real email/TOTP onboarding, nutrition, offline cleanup, password recovery, and both disposal paths |
| authenticated reload runtime retest | **PASS** — 3/3 HTTP 200; 0 page errors, 0 console errors, 0 HTTP responses >=400 |
| independent final code review | **PASS** — no functional or security findings |

The first disposal E2E proves offline encrypted queueing, reconnect, deletion of the
durable operation, one discard event, remaining amount `0`, no food log, and persistence
after reload. The second deliberately withholds the first successful RPC response from
the browser, proves the `UNCERTAIN` state, then receives an exact receipt replay with
`idempotent_replay=true`; the database still contains only one discard event.

The authenticated Playwright runner now performs its build under the same local-only
Supabase and OAuth feature environment as its web server. It rejects non-loopback
Supabase URLs before building, so the reproducible suite cannot target Production by
accident.

## Visual and accessibility evidence

Independent browser QA passed at `1440x900`, `430x932`, `390x844`, and `360x800`:

- no horizontal overflow;
- critical targets at least 44 by 44 CSS pixels;
- visible keyboard focus and correct focus movement/return;
- explicit disabled-consumption explanation through visible text and `aria-describedby`;
- offline queue, reconnect, success, and reload behavior;
- zero axe serious/critical findings at all four viewports;
- reduced-motion rendering.

Privacy-safe synthetic screenshots:

- [`inventory-disposal-authenticated-desktop.png`](screenshots/inventory-disposal-authenticated-desktop.png)
- [`inventory-disposal-authenticated-mobile.png`](screenshots/inventory-disposal-authenticated-mobile.png)

The visual run initially detected a deterministic authenticated hydration error. The
browser-dependent Outbox initial state was corrected, protected by `renderToString` to
`hydrateRoot` regression tests, and independently rechecked with three clean Production
runtime reloads.

## Explicitly not proven

- **BLOCKED / NOT_RUN:** a true two-session database overlap. The local-only harness
  passed its container/project/PostgreSQL/RPC guards but stopped before fixture creation
  because its conservative `foodos_concurrency_%` session preflight fired. No test fixture
  or existing data was changed by that attempt.
- **NOT_RUN:** VoiceOver and TalkBack on real devices.
- **NOT_RUN:** managed Supabase migration, Vercel/Production deployment, Production
  browser smoke, and Production telemetry.

No secrets, remote data, Production schema, user household data, or unrelated repository
changes were modified for this evidence.
