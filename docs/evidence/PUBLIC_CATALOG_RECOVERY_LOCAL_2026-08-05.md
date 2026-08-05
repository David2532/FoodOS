# Public catalog recovery evidence — 2026-08-05

Status: **PASS for recovery and managed cleanup; new import, activation and managed search verification NOT_RUN at this checkpoint.**

This evidence covers the recovery, capacity, resumability, Open Food Facts image mapping
and controlled Production cleanup slice on branch `agent/foodos-mvp`. It is not evidence
of an active Production catalog.

## Verified behavior

- OFF's official JSONL export was inspected as an aggregate-only 1,000-row stream: 744
  records exposed per-100g nutriments, 405 had an `images` object, 120 selected front
  entries used the documented 400-size metadata, and direct `image_url` convenience
  fields were absent. No product value, GTIN or raw record was printed or retained.
- The normalizer derives an image only from a real selected front key, revision and
  advertised size; missing evidence remains a no-image state.
- The importer persists progress and candidate counters, validates the source revision,
  resumes the same generation with `--resume-run`, and skips ingestion after the database
  checkpoint.
- Capacity is checked before each 250-product write, with a 5.5 GiB soft stop and a
  database-enforced 6 GiB statement boundary.
- Stale retirement and purge are service-role-only, exact-count operations. The purge
  stores immutable expected counts, removes at most 5,000 products per transaction,
  advances only by committed row counts and performs a final no-row drift check.
- The one-time fast guard path is pinned to the explicitly authorized failed Production
  run. Other failed runs retain the original status-checked recovery path.
- Client roles cannot invoke recovery functions or read raw catalog tables. Direct
  service-role deletion still cannot bypass the sealed-product guard without the
  transaction-local gate opened by the validated purge RPC.

## Local and CI results

| Check | Result |
|---|---|
| fresh `supabase db reset` | **PASS** — all migrations through `20260805154012_catalog_purge_progress_counters.sql` applied |
| `npm run test:db` | **PASS** — 5 pgTAP files / 168 assertions; includes a 5,001-product two-call purge and committed progress checks |
| `npm run verify` | **PASS** — ESLint, TypeScript, 44 Vitest files / 159 tests, Production build |
| GitHub checks for `9564d0c` | **PASS** — fresh migrations/pgTAP/RLS/authenticated E2E, lint/types/unit/build, responsive/axe smoke |
| Vercel preview for `9564d0c` | **PASS** — deployment completed |
| `npm run catalog:verify` | **BLOCKED** — correctly requires a verified active managed generation and server-only environment |

## Managed cleanup result

The user explicitly authorized irreversible batched deletion of generation 1, import run
`17261753-ba94-49b1-92e0-59c42f8a5f24`, with original expected counts of 398,915
products, 176 chunks and 176,000 sealed products. User, household, inventory and active
catalog data were explicitly out of scope.

- Managed migrations applied: `20260805144108 catalog_search_nutrition_summary`,
  `20260805144121 catalog_import_recovery`, `20260805153457
  optimize_exact_catalog_purge_guard` and the managed application of
  `catalog_purge_progress_counters`.
- The stale run was retired to `failed/catalog-import-stale-retired`, then transitioned by
  the exact purge RPC to `failed/catalog-import-purge-in-progress`.
- The cleanup removed only the approved 398,915 products and 176 chunks, in transactions
  bounded to at most 5,000 product rows. The final transaction removed 3,915 products,
  returned `remaining=0` and `complete=true`, and then removed the empty run row.
- Final Production verification: target runs 0, target products 0, target chunks 0,
  active generations 0 and active purge backends 0.
- Protected-data controls were unchanged from preflight: auth users 1, households 1,
  household members 1, private products 0 and inventory batches 0.
- `pg_database_size` reported 931,564,691 bytes after cleanup. Deleted PostgreSQL pages
  are reusable; this number is not represented as immediate physical or billing shrinkage.

## Retained failed/setup iterations

- Initial recovery pgTAP fixtures exposed two setup-context errors; both were corrected
  without broadening Production grants.
- The first generic purge-guard optimization was rejected before Production because its
  early path was not restricted to the authorized run. The deployed variant is pinned to
  the exact run and preserves the generic status-checked fallback.
- One pre-optimization connector response could not be parsed; the subsequent read-only
  count proved that transaction had not committed.
- A later exact-path batch reached the connector's HTTP 504 limit because the RPC still
  performed two full target counts. No backend remained and the unchanged count proved a
  full rollback. Persisted, tested progress counters removed those repeated scans.
- The first progress-test run stopped before recovery execution because two pgTAP
  `has_column` assertions were incorrectly combined as booleans. Splitting them produced
  the final 168-assertion pass.

## Remaining release boundary

No new managed import has been started and no catalog is active. Before an active-catalog
claim, confirm the spend cap and database capacity, run exactly one bounded/resumable
import, activate only after integrity checks, run `catalog:verify`, and verify real search,
nutrition and image presentation in the authenticated application.
