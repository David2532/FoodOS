# Ops finance payment reconciliation — 2026-08-05

Status: `PASS` for the schema, authorization boundary, local tests, and managed
Supabase migration. Recording the real supplier receipts remains a separate,
append-only operation; this evidence does not claim that an open invoice was paid.

## Delivered boundary

- Forward migration: `20260805180000_ops_finance_payment_reconciliation.sql`
- Managed Supabase migration: `ops_finance_payment_reconciliation`
- Tables: `ops_finance_payment_evidence`, `ops_finance_payment_events`
- Public mutation: `record_ops_supplier_payment(...)`
- Authorization: same-origin API, authenticated `aal2`, explicit Ops `ceo` role
- Storage excludes IBAN, account/card numbers, statement text, and raw receipts.
- Effective payment state is derived from the newest immutable event. A legacy
  `paid` flag without payment evidence resolves to `UNKNOWN`.

## Local verification

- Targeted Vitest: 3 files / 12 tests — `PASS`
- TypeScript — `PASS`
- Fresh local Supabase reset through migrations `180000` and `190000` — `PASS`
- pgTAP: 6 files / 237 assertions — `PASS`
- Payment pgTAP: 36 assertions — `PASS`
- Full verification: 47 files / 176 tests, lint, types, production build — `PASS`
- Authenticated E2E with both OAuth build flags: 4 / 4 — `PASS`

The payment tests cover AAL1 denial, AAL2 non-CEO denial, direct-table denial,
exact replay, conflicting payment ID, conflicting artifact hash, amount mismatch,
currency mismatch, source trust, append-only reversal, and immutable evidence.

## Managed Supabase verification

Preflight before the migration:

- finance sources / journals / ledger lines: `1 / 1 / 2`
- source-validation events: `0`
- auth users / households / household members: `1 / 1 / 1`
- payment tables: absent

After applying the migration:

- finance sources / journals / ledger lines remained `1 / 1 / 2`
- source-validation events remained `0`
- auth users / households / household members remained `1 / 1 / 1`
- payment evidence / payment events: `0 / 0`
- RLS enabled on both new tables
- anonymous reads denied
- the authenticated role can execute only the guarded reconciliation RPC

The Supabase advisor reported the intended warning that the authenticated role can
invoke the `SECURITY DEFINER` RPC. This is required for the app flow and is guarded
inside the function by AAL2, the explicit CEO role, exact journal/evidence matching,
and immutable replay checks. Newly created indexes are reported as unused immediately
after creation, which is expected while both event tables are empty.

## Honest finance state

The existing Supabase 25 USD journal was not duplicated and remains `OPEN`: the
mailbox contained an invoice obligation but no payment confirmation. No real receipt
was inserted by this migration, and no `PAID` or `BANKED` state is claimed here.
