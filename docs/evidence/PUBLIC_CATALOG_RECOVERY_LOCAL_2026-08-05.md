# Public catalog recovery local evidence — 2026-08-05

Status: **PASS locally; managed cleanup/import/activation NOT_RUN at this checkpoint.**

This evidence covers the recovery, capacity, resumability and OFF JSONL image-mapping
slice on branch `agent/foodos-mvp`. It is not evidence of an active Production catalog.

## Verified behavior

- OFF's official JSONL export was inspected as an aggregate-only 1,000-row stream: 744
  records exposed per-100g nutriments, 405 had an `images` object, 120 selected front
  entries used the documented 400-size metadata, and direct `image_url` convenience
  fields were absent. No product value, GTIN or raw record was printed or retained.
- The normalizer now derives an image only from a real selected front key, revision and
  advertised size; missing evidence remains a no-image state.
- The importer persists progress and candidate counters, validates the source revision,
  resumes the same generation with `--resume-run`, and skips ingestion after the database
  checkpoint.
- Capacity is checked before each 250-product write, with a 5.5 GiB soft stop and a
  database-enforced 6 GiB statement boundary.
- Stale retirement and purge are service-role-only, exact-count operations. The purge
  stores its original expected counts, removes at most 5,000 products per transaction and
  resumes only the same failed generation.
- Client roles cannot invoke recovery functions or read raw catalog tables. Direct
  service-role deletion still cannot bypass the sealed-product guard.
- Auth user data remains unchanged by the tested catalog cleanup.

## Commands and exact results

| Check | Result |
|---|---|
| fresh `supabase db reset --local --no-seed` | **PASS** — all migrations through `20260805141655_catalog_import_recovery.sql` applied |
| `npm run test:db` | **PASS** — 5 pgTAP files / 165 assertions; includes a 5,001-product two-call purge |
| `npm run verify` | **PASS** — ESLint, TypeScript, 44 Vitest files / 158 tests, Production build |
| `npm run test:e2e:auth` with process-local Supabase public values and OAuth build flags | **PASS** — 4/4 Chromium flows (OAuth PKCE, TOTP/AAL2 onboarding, password recovery, multi-tab offline cleanup) |
| `npm run catalog:verify` | **BLOCKED** — correctly requires a verified active managed generation and server-only environment |

## Retained failed/setup iterations

- The first recovery pgTAP run stopped after 6/20 assertions because the fixture tried to
  insert `auth.users` as `service_role`. The fixture was moved to the database-owner setup;
  Production grants were not broadened.
- The second recovery pgTAP run stopped after 18/20 because the service-role fixture tried
  to read `auth.users`. The assertion was moved to database-owner context; Production
  grants were not broadened.
- The first Auth rerun was `BLOCKED` before browser execution because local Supabase
  public values were absent from the process. A subsequent run reached Chromium but was
  3/4 because the Apple flag was set only for the server after the client build. Supplying
  both OAuth flags before the unchanged build/test command passed 4/4. No key was printed
  or persisted.

## Managed release boundary

At this checkpoint no managed run has been retired, purged, imported or activated. The
next safe step is: deploy the two unapplied forward-only catalog migrations, re-read the
exact inactive run and household counts, execute only the exact retirement/purge RPCs,
confirm spend-cap/capacity state, then run one bounded/resumable import. Activation and
`catalog:verify` must pass before any active-catalog claim.
