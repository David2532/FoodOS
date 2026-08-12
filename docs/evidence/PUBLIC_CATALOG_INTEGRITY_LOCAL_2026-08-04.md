# Public catalog integrity — current local evidence (2026-08-04)

Status: **LOCAL_CURRENT before publication.** This evidence applies to the working-tree
artifact immediately before its catalog-integrity commit. It is not a GitHub CI result,
managed Supabase import, production deployment, legal approval or live-provider claim.

Runtime: Node `v22.23.1`, npm `10.9.8`.

## Executed checks

| Check | Exact result |
|---|---|
| `npm ci` | `PASS` — 490 packages installed from the lockfile; 0 audit vulnerabilities reported by npm. |
| `npm run verify` | `PASS` — ESLint, TypeScript, Vitest **20 files / 68 tests**, and optimized Next.js build. |
| `npm run test:coverage` | `PASS` — 94.11% statements, 90.04% branches, 98.11% functions, 97.92% lines; all configured thresholds passed. |
| `npm audit --audit-level=high` | `PASS` — 0 vulnerabilities. |
| fresh `supabase db reset --local` | `PASS` — migrations `0001` through `0016` applied to 127.0.0.1 only. |
| `npm run test:db` | `PASS` — **2 files / 112 pgTAP-RLS tests**; includes AAL1 denial, direct raw-table denial, service-role-only integrity inspection, atomic activation, counter checks and tampered-hash rejection. |
| `supabase db lint --local --level warning --fail-on error` | `PASS` — no schema errors. |
| `npm run test:e2e` | `PASS` — **12/12** Pixel 7/Desktop Chromium tests, deterministic provider-shaped catalog response, manual-provider-outage path, overflow and axe serious/critical smoke. |
| `npm run test:e2e:auth` | `PASS` — **2/2** local Auth/TOTP/household/privacy/outbox/export tests against 127.0.0.1 Supabase. |
| `npm run catalog:verify` | `BLOCKED` (exit 2) — no managed `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; the command performed no import. |
| Visual review | `PASS (local screenshot review)` — compact catalog, expanded catalog and OAuth entry screenshots inspected; no horizontal-overflow failure was observed, consistent with the Playwright assertions. |

## Integrity contract covered locally

- OFF JSONL normalization has a strict field allowlist, Germany filter, GTIN check digit,
  bounded nutrition ranges, constrained Nutri-Score/NOVA values, bounded lines and no
  invented unknown fields.
- The importer writes a staging generation in 250-row batches. It records rejected,
  filtered and duplicate rows separately, seals each persisted row server-side, and only
  activates when the database recomputed GTIN-ordered hash, count identity and metadata
  evidence are intact.
- Direct catalog tables remain inaccessible to `anon`/`authenticated`; the read
  projections require AAL2 and the importer/seal/inspect/activate functions are
  service-role-only.
- A missing or invalid Open Food Facts contact identity now fails closed instead of
  emitting an invented `User-Agent`; the UI exposes the existing manual fallback.

## Explicitly not proven

No managed Supabase project was migrated, no official dump was downloaded, and no real
products were imported. There is therefore no managed generation number, record count,
source retrieval time or production URL to report. A real import remains blocked until a
managed EU Supabase environment has its server-only credentials and a genuine monitored
Open Food Facts contact identity configured in the protected production workflow after
licence/source review.
