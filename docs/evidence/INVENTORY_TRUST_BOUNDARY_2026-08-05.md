# Inventory intake trust boundary — 2026-08-05

Status: `PASS` locally and on the managed Supabase schema boundary. A full
authenticated Production browser roundtrip is tracked separately and is not claimed
by this document.

## Delivered boundary

- TypeScript accepts only GTIN-8, GTIN-12, GTIN-13, and GTIN-14 with a valid
  Mod-10 check digit.
- The barcode API rejects an invalid GTIN before authentication, cache access, or
  provider access.
- Forward migration: `20260805190000_harden_inventory_batch_trust_boundary.sql`
- Managed migration: `harden_inventory_batch_trust_boundary`
- Direct authenticated calls to `add_inventory_batch` are validated in PostgreSQL,
  independently of the web contract.
- The private validators enforce allowlisted keys, source values, URL, provenance,
  JSON, nutrition, confidence, amount, price, and date bounds.
- The validator schema and helper functions are not executable by anonymous or
  authenticated clients.

## Local verification

- Focused Unit/API: 2 files / 12 tests — `PASS`
- TypeScript and targeted ESLint — `PASS`
- Fresh local Supabase reset through migration `190000` — `PASS`
- pgTAP: 6 files / 241 assertions — `PASS`
- Full verification: 47 Vitest files / 177 tests, lint, types, production build — `PASS`
- `git diff --check` — `PASS`

The database tests include 21 direct authenticated-AAL2 boundary cases and a
positive exact app-shaped product/batch payload with nullable batch optionals.

## Managed Supabase verification

Immediately before and after applying the migration, these invariants stayed exact:

- auth users / households / household members: `1 / 1 / 1`
- private products / inventory batches / inventory events / mutation receipts:
  `0 / 0 / 0 / 0`

After migration:

- schema `inventory_private` exists;
- authenticated schema `USAGE`: denied;
- authenticated direct product/batch validator `EXECUTE`: denied;
- authenticated guarded `add_inventory_batch` `EXECUTE`: retained for the intended
  AAL2 household flow.

The Supabase security advisor reports the intentional warning that authenticated
users can call the `SECURITY DEFINER` inventory RPC. The function itself checks
authentication, AAL2, household membership, mutation replay integrity, and the full
server-side payload boundary before entering the atomic legacy transaction. No new
performance advisor finding references this migration.
