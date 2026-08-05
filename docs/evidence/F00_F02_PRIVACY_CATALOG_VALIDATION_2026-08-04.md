# F00/F02 local validation — 2026-08-04

Status: **ARCHIVED / STALE local snapshot.** The 17-file/52-test, migration-`0014`
figures below predate the staged public-catalog and integrity migrations (`0015`/`0016`).
They must not be used as evidence for the current branch or Draft PR #5.

Scope: the exact `agent/foodos-mvp` branch workspace before publication after the
versioned privacy ledger and federated food-catalog slices. This is local engineering evidence, not a
production, legal, native-device or real-user-usability claim.

## Implemented behavior

- Germany/16+ entry gate with current notice acknowledgement and six independent,
  unselected optional purposes;
- append-only AAL2 privacy-choice events, exact idempotent replay, conflict rejection,
  withdrawal and account-export history;
- explicit-submit product-name/brand search using the official Search-a-licious API;
- strict response allowlist, no raw provider persistence and clear Open Food Facts source;
- AAL2 household-cache full-text search over products already confirmed by that user;
- Pixel-7 single-column and desktop two-column catalog UI with loading, empty, provider-
  unavailable, image-fallback and pagination states;
- selected catalog result reuses the existing full product, ingredients, nutrition,
  MHD/charge and inventory-intake flow.

## Reproducible results

| Check | Result |
|---|---|
| ESLint | `PASS`, zero warnings |
| TypeScript | `PASS` |
| Vitest | `PASS`, 17 files / 52 tests |
| V8 coverage gates | `PASS`, 93.69% statements / 89.59% branches / 98.11% functions / 97.92% lines |
| production build | `PASS`, `/api/products/search` included |
| `npm audit --audit-level=high` | `PASS`, 0 vulnerabilities |
| fresh local database reset through migrations `0001`–`0014` | `PASS` |
| Supabase DB lint | `PASS`, no schema errors |
| pgTAP/RLS | `PASS`, 80/80 |
| preview Playwright, Pixel 7 + Desktop Chrome | `PASS`, 10/10 |
| real local Supabase Auth/TOTP/AAL2 Playwright | `PASS`, 2/2 |
| serious/critical axe findings on Today and populated catalog | `PASS`, zero detected |
| horizontal document overflow at both preview viewports | `PASS`, at most 1 px |

The live browser test submitted `Haferflocken` to Open Food Facts and observed 416
current provider matches during this run. That number is transient and is not used as a
fixture or product promise. The selected real product then loaded its detailed provider
record and reached the existing pack-confirmation flow.

## Failed iterations retained as facts

- The first catalog Playwright run was `FAILED` 2/10 because the new assertion asked for
  a non-exact “Haferflocken” heading while twelve result headings matched. The trace and
  screenshots showed the live result/detail flow; the test was changed to wait on
  `.product-hero h2`. Focused rerun passed 2/2 and the subsequent full run passed 10/10.
- The first post-copy-change Auth run was `FAILED` 1/2 because one demo assertion still
  expected the replaced `Hey David` heading. After changing that assertion to
  `Heute in FoodOS`, the full Auth suite passed 2/2.
- During the final sandboxed run, Chromium launch was denied with `spawn EPERM` and the
  Supabase CLI could not write its user-level telemetry file. The retained traces show
  an infrastructure/process-start failure, not an application assertion. Running the
  same exact browser cases serially with browser permission passed 10/10; running the
  same pgTAP file with the required CLI file permission passed 80/80.
- A direct Auth Playwright invocation was also invalid because the public Supabase values
  were supplied only at server start, after Next.js had already built the client bundle.
  Rebuilding through `npm run test:e2e:auth` with the process-local public values passed
  the complete unchanged Auth/TOTP/AAL2 suite 2/2. No value was printed or persisted.

The first two items are test-source corrections between runs; the last two are retained
runner/setup failures. None is reported as a fabricated first-pass success.

## Deliberately unproven

- moderated usability with representative target users: `NOT_RUN`;
- VoiceOver, TalkBack and real mobile hardware: `NOT_RUN`;
- production RUM, distributed provider quota behavior and load tests: `NOT_RUN`;
- final privacy notice/terms, DPIA and counsel approval: `BLOCKED` on professional review;
- remote Supabase/Vercel deployment and production OAuth providers: `NOT_RUN`.
