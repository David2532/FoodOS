# Public product catalog operations

Status: **implementation and operating contract, not active-catalog evidence** · Last reviewed:
2026-08-05.

FoodOS can maintain a shared, public product catalog in addition to a household's
confirmed-product cache. This document describes the operational path for migration
`0015_public_product_catalog.sql` and
`0016_public_catalog_import_integrity.sql` and the bounded-seal follow-up migrations
`20260805074723_bounded_catalog_import_seal.sql` and
`20260805075456_fix_catalog_seal_guard_generated_columns.sql`, the nutrition projection
`20260805122303_catalog_search_nutrition_summary.sql` and recovery/capacity migration
`20260805141655_catalog_import_recovery.sql`. It does **not** claim
that a managed database has an active or verified catalog generation.

## Data boundary and source order

The catalog is public source data, physically and logically separated from household,
profile, inventory, consent and nutrition-log data. It has no household foreign key.
Direct table access is revoked from `anon` and `authenticated`; only the two
AAL2-protected, security-definer projections may return an active generation. The
server-only importer is the only ordinary writer and uses a service-role credential.

For a product search or barcode lookup, the intended order is:

1. the AAL2 household cache, when the user has already confirmed the product;
2. the active shared catalog generation, when one exists;
3. the explicit, rate-limited Open Food Facts live fallback; and
4. the manual unknown-product flow.

An absent or failed shared generation is not presented as a complete database or
a safety conclusion. The application continues with the visible provider/manual fallback.

## Official source, license and scope

The default bulk source is the Open Food Facts JSONL export:

`https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz`

The importer streams `.jsonl` or `.jsonl.gz`; it never loads the complete dump into
memory, limits each decompressed JSONL line, and times out before a remote response can
stall the run. It accepts only Germany-tagged records with valid GTIN check digits, a
name and allowlisted, bounded fields. It separately records malformed/invalid records,
intentional country filters and duplicate GTIN source rows. Missing facts remain absent.
The normalized projection
retains provenance, source URL/language/revision/retrieval time, normalized content hash
and applicable license fields; raw provider objects are not written. The allowlisted
image reference accepts documented `image_url` / `image_front_url` variants over HTTPS.
The full JSONL dump normally omits those convenience URLs, so the normalizer also derives
the 400/200/100/full URL only from an existing `images.front_<language>` entry, its real
revision and advertised size according to the OFF image path contract. When that evidence
is absent, the product UI shows its neutral no-image state rather than a made-up package
photo.

Open Food Facts asks high-volume consumers to use exports instead of many API requests,
requires an identifiable User-Agent for API use, and documents current v3.6 as the
recommended API generation. Its data is not an accuracy or completeness guarantee.
The database is under ODbL, individual contents under DbCL, and product images under
CC BY-SA; an image URL is not a blanket clearance for every graphical element. Before a
public or combined-database release, obtain the specialist ODbL/share-alike and image
rights review required by `legal/COMPLIANCE_MATRIX.md`.

Authoritative references:

- [Open Food Facts API and bulk-use guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
- [Open Food Facts JSONL-export documentation](https://openfoodfacts.github.io/search-a-licious/users/tutorial/)
- [Open Food Facts licence guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/)

## Configuration and controlled import

Do not put any importer credential in a `NEXT_PUBLIC_*` variable, the repository or a
browser build. The scheduled workflow and local importer need these server-only values:

| Control | Purpose |
|---|---|
| `SUPABASE_URL` | Preferred server-only Supabase URL; the scripts also accept `NEXT_PUBLIC_SUPABASE_URL` only as a URL fallback. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role credential used solely by the importer and verification script. |
| `OPEN_FOOD_FACTS_USER_AGENT` | Required identifiable value in the form `App/Version (contact@email)` or `App/Version (https://project.example)` for bulk and live fallback requests. An invalid or absent value fails closed to the visible manual fallback. |
| `PUBLIC_CATALOG_DUMP_URL` | Optional, reviewed server-side source override. Without it, the importer uses the official full JSONL endpoint above. |
| `PUBLIC_CATALOG_LOCAL_SOURCE_SHA256` | Required only for an explicit local JSONL test/replay source; its lower-case SHA-256 must match the streamed source bytes. Never use it to bypass source review in production. |
| `CATALOG_SYNC_ENABLED=true` | GitHub repository variable that enables the daily schedule only after source/licence review and managed-environment approval. |

Source precedence is `--source=<https-url-or-local-jsonl[.gz]>`, then
`PUBLIC_CATALOG_DUMP_URL`, then the official full JSONL endpoint. Remote overrides are
accepted only over HTTPS from the importer's approved Open Food Facts host allowlist and
must end in `.jsonl` or `.jsonl.gz`; a local JSONL file is a controlled CLI-only option
only when its expected SHA-256 is supplied. The importer rejects a source smaller than
1 GB, so a truncation that happens to contain 25,000 rows cannot activate a generation.
The current scheduled workflow deliberately does not inject `PUBLIC_CATALOG_DUMP_URL`,
so its manual and daily runs use the official default. The variable is an input selector,
not an activation control and must never be exposed to a browser build.

Before a first managed import, apply migrations `0015`, `0016`, both bounded-seal
follow-ups, the nutrition projection and the recovery/capacity migration; configure the
three secret values
in the protected GitHub Environment or another server-only secret store, and complete the
source/licence review. A controlled operator run is then:

```bash
npm run catalog:import
npm run catalog:verify
```

The default command requires at least 25,000 persisted products, a minimum 0.1% acceptance
ratio and at least 100 retained examples each for nutrition, ingredients, allergens and
field provenance. The source can be pinned
for a controlled replay with `npm run catalog:import -- --source=<url-or-file>`; do not
lower the production minimum merely to make a sample appear successful. `catalog:verify`
returns exit code 2 when its server-only credentials are missing and exit code 1 when
there is no intact active generation. Neither outcome proves a catalog is populated.

The importer persists attempted/rejected/filtered/candidate counters at least every 1,000
source rows and checks database capacity before every 250-product write. It stops new
writes at 5.5 GiB and the database rejects product insert/update statements at the hard
6 GiB boundary. SIGINT, SIGTERM, the soft limit and post-ingestion failures leave an
explicit non-active, resumable staging run. Resume only the same source generation with:

```bash
npm run catalog:import -- --resume-run=<exact-run-uuid>
```

A resume with a different source URL, schema or remote revision fails closed. Before
ingestion completes it safely re-reads the unchanged source and idempotently upserts into
the same generation; after the ingestion checkpoint it skips the dump and continues the
bounded seal. It never creates a second generation merely to resume a stopped one.

`.github/workflows/public-catalog-sync.yml` permits a manual controlled run. Its daily
03:23 UTC schedule remains disabled until `CATALOG_SYNC_ENABLED=true` is set after the
review. The workflow is not a Vercel request and must run only in the protected
`production` environment with approval rules and secrets in place.

## Generation activation, failure and recovery

Each new import creates a `staging` generation, records attempted/accepted/rejected/
filtered/candidate/duplicate counts, then writes in bounded batches. After source writes
finish, a service-only database checkpoint reconciles persisted and duplicate counts
before the database
seals at most 1,000 GTIN-ordered rows per service-only transaction. Every seal writes the
canonical per-product hash and an immutable manifest chunk containing its ordered hash and
metadata-evidence counters. Once sealing starts, product facts cannot be inserted, deleted
or changed; only the exact authoritative hash write for the next chunk is allowed. The
generation root is the SHA-256 over ordered immutable chunk hashes, so verification and
activation aggregate a small manifest rather than retrying a multi-million-row update.
Activation is possible only when the manifest is complete, counter identity and metadata
evidence pass, the root matches the run and at least 25,000 products were persisted. The
service-only activation function atomically supersedes the prior active generation and
marks the complete staging generation active. Reads join only the active generation.

Credential validation happens before a remote dump download. An interrupted or
post-checkpoint run remains explicitly staging/resumable; a non-resumable fetch, source
revision, parse, validation or integrity failure is marked `failed`. Neither state can
silently replace an existing active generation. Record only aggregate counts and safe
failure codes in operational output, never product payloads or GTINs.

A stale staging run is not deleted by hand. The service-only retirement RPC requires the
exact run UUID, generation and current attempted/product/chunk/sealed counts, the approved
source/schema, no active state and at least 30 minutes without progress. It first records
the controlled `catalog-import-stale-retired` failed state. A separate service-only purge
RPC repeats exact generation/product/chunk/sealed checks and opens a transaction-local
delete gate only for that failed run. It removes at most 5,000 product rows per call,
persists the original expected counts and can resume the same exact purge until it reports
`is_complete=true`; any mismatch aborts without deleting data. These RPCs have no
household/user/inventory references or client grants.

The current migration deliberately has no RPC to reactivate a `superseded` generation.
Consequently, do **not** edit import-run states by hand or call a failed staging run a
rollback. Recovery is a new, verified staging import from the approved source followed
by atomic activation; database point-in-time restore follows the normal incident process
and requires an integrity check before any catalog is made active. A true one-command
generation rollback remains `NOT_IMPLEMENTED` and is not release proof.

After every activation, retain the run generation, source/schema/revision/retrieval time,
all aggregate counters, database-sealed root and result of `npm run catalog:verify` in the
protected release evidence. The verifier checks exact count/counter identity, the completed
immutable hash manifest, source traceability and aggregate nutrition/ingredients/allergen/
provenance evidence. Alert on no active generation, a failed run, manifest/count/hash
mismatch, source/schema drift or an unexpectedly low accepted ratio.
Never substitute zero, an old success or a provider outage for a current catalog status.

## Managed-data status and release boundary

This document does not assert an active production generation. Read-only inspection on
2026-08-05 found no active generation and one abandoned, partially sealed `staging`
generation from the former importer. It has not been deleted or called successful. Apply
and verify the recovery migration, re-read all exact cleanup preconditions, retire and
purge only that exact inactive generation, then run one bounded/resumable approved import.
Record its generation, aggregate count, source retrieval time, commit and verification
result only after `npm run catalog:verify` passes. Until then, the imported-product count
and last successful import remain **NOT_PROVEN**.
