# Public product catalog operations

Status: **implementation and operating contract, not import evidence** · Last reviewed:
2026-08-04.

FoodOS can maintain a shared, public product catalog in addition to a household's
confirmed-product cache. This document describes the operational path for migration
`0015_public_product_catalog.sql`. It does **not** claim that any managed Supabase
database has been migrated or populated: no managed catalog import has been executed or
counted for this repository state.

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
memory. It accepts only Germany-tagged records with valid GTIN check digits, a name and
allowlisted, bounded fields. It rejects malformed, non-Germany, invalid-GTIN and
impossible-nutrition records. Missing facts remain absent. The normalized projection
retains provenance, source URL/language/revision/retrieval time, normalized content hash
and applicable license fields; raw provider objects are not written.

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
| `OPEN_FOOD_FACTS_USER_AGENT` | Required identifiable value in the form `App/Version (contact@email)` for the bulk request. |
| `CATALOG_SYNC_ENABLED=true` | GitHub repository variable that enables the daily schedule only after source/licence review and managed-environment approval. |

`PUBLIC_CATALOG_DUMP_URL` is **not** read by the current importer. Select an approved
source explicitly with `--source=<https-url-or-local-jsonl[.gz]>`; do not treat an
undocumented environment variable as an activation control.

Before a first managed import, apply migration `0015`, configure the three secret values
in the protected GitHub Environment or another server-only secret store, and complete the
source/licence review. A controlled operator run is then:

```bash
npm run catalog:import
npm run catalog:verify
```

The default command requires at least 25,000 accepted products. The source can be pinned
for a controlled replay with `npm run catalog:import -- --source=<url-or-file>`; do not
lower the production minimum merely to make a sample appear successful. `catalog:verify`
returns exit code 2 when its server-only credentials are missing and exit code 1 when
there is no intact active generation. Neither outcome proves a catalog is populated.

`.github/workflows/public-catalog-sync.yml` permits a manual controlled run. Its daily
03:23 UTC schedule remains disabled until `CATALOG_SYNC_ENABLED=true` is set after the
review. The workflow is not a Vercel request and must run only in the protected
`production` environment with approval rules and secrets in place.

## Generation activation, failure and recovery

Each import creates a `staging` generation, records accepted/rejected/attempted counts
and a SHA-256 of the normalized content, then writes in bounded batches. Activation is
possible only when the persisted count matches the recorded count, the normalized hash is
present and at least 25,000 products were accepted. The service-only activation function
atomically supersedes the prior active generation and marks the complete staging
generation active. Reads join only the active generation.

Credential validation happens before a remote dump download. A fetch, parse, validation,
write, interruption or minimum-count failure marks the staging run `failed`; it must not
silently replace an existing active generation. Record only aggregate counts and safe
failure codes in operational output, never product payloads or GTINs.

The current migration deliberately has no RPC to reactivate a `superseded` generation.
Consequently, do **not** edit import-run states by hand or call a failed staging run a
rollback. Recovery is a new, verified staging import from the approved source followed
by atomic activation; database point-in-time restore follows the normal incident process
and requires an integrity check before any catalog is made active. A true one-command
generation rollback remains `NOT_IMPLEMENTED` and is not release proof.

After every activation, retain the run generation, source/schema/retrieval time, counts,
hash and result of `npm run catalog:verify` in the protected release evidence. Alert on no
active generation, a failed run, an integrity/count/hash mismatch, source/schema drift or
an unexpectedly low accepted ratio. Never substitute zero, an old success or a provider
outage for a current catalog status.

## Managed-data status and release boundary

As of 2026-08-04, the repository contains the migration, normalizer, importer,
verification command and opt-in scheduled workflow, but no managed Supabase project has
received this migration or an imported catalog generation. The imported-product count,
last successful import and production URL are therefore **NOT_RUN**. This document must
be updated with the exact generation, count, source retrieval time, commit and CI run
only after a real managed import and verification.
