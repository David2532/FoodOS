# FoodOS repository map

Status: **scope-first orientation** · Last updated: **2026-08-05**

This is a short human overview, not a generated file index. Start with `AGENTS.md`, then
run `npm run agent:context -- <scope>`. The command identifies the smallest relevant
code, test and documentation surface. `CODEX_PROMPT.md` applies only to an explicitly
requested complete multi-stage build.

## Status vocabulary

| Status | Meaning |
|---|---|
| `IMPLEMENTED` | Code exists; this alone is not test or deployment proof. |
| `LOCALLY_PROVEN` | Relevant deterministic/local checks passed for the named artifact. |
| `PRODUCTION_PROVEN` | The exact managed environment or URL was checked. |
| `BLOCKED` | A named safety, source, access or release gate prevents completion. |
| `NOT_RUN` | The required check has not been executed for the named artifact. |
| `PLANNED` | Design/plan exists but implementation is not claimed. |

## Current truth

| Area | Status | Exact boundary |
|---|---|---|
| Next.js consumer app and adaptive preview UI | `LOCALLY_PROVEN` | Vitest and Playwright/axe suites exist; compact and desktop preview flows are covered. |
| Email, Google OAuth/PKCE, SSR sessions and TOTP/AAL2 gate | `PRODUCTION_PROVEN` | Production reaches Google with the correct Supabase callback; AAL2/RLS has local/CI DB proof. Authenticated Production `/ops` visual QA remains `NOT_RUN`. |
| Household, inventory, nutrition, planning and shopping persistence | `LOCALLY_PROVEN` | Forward migrations, transaction/RPC behavior and tenant/AAL tests exist. |
| Public catalog import pipeline | `IMPLEMENTED` | Allowlist normalization, staging, chunk sealing and verification code exist. |
| Active public catalog generation | `BLOCKED` | Staging generation 1 contains persisted products but inconsistent counters, incomplete nutrition/image coverage and no safe activation proof. It remains inactive. |
| Product search and Open Food Facts fallback | `LOCALLY_PROVEN` | Cache/catalog/provider paths and deterministic tests exist; protected API rejects unauthenticated access. |
| Recall ingestion code | `IMPLEMENTED` | Job, source registry and matching rules exist. |
| Live official recall ingestion | `BLOCKED` | The official source remains unapproved and license review is incomplete; outage/stale state stays non-clear. |
| `/ops` application | `IMPLEMENTED` | Protected route, feature UI, API and repository boundaries exist. |
| Ops finance ledger | `PRODUCTION_PROVEN` | Forward migrations are applied with AAL2+CEO enforcement, RLS, immutable source identity and balanced integer-minor-unit journals. |
| Vercel Production | `PRODUCTION_PROVEN` | `https://foodos-flame.vercel.app` returned HTTP 200 for the deployed branch artifact and had no observed runtime error in the checked window. |
| Preview, Auth E2E, pgTAP/RLS and CI | `LOCALLY_PROVEN` | Existing suites cover preview navigation, real local Auth/AAL2 and database boundaries; Draft-PR #5 CI passed for the recorded commit. |
| Durable offline private read projection/conflicts/tombstones | `PLANNED` | Encrypted allowlisted mutation outbox exists; the complete F08 contract is not claimed. |
| Native iOS/Android and store billing | `PLANNED` | No store release or sandbox purchase/restore proof. |
| OCR/model governance and signed OTA | `PLANNED` | Manual expiry fallback exists; governed production model/OTA systems are not claimed. |
| Restore, load, penetration, native-device and Production RUM gates | `NOT_RUN` | Plans are not evidence for an exact release artifact. |
| Legal/country/commercial release approval | `BLOCKED` | External legal, privacy, food-claims, accessibility and country-pack approvals remain separate release gates. |

Do not upgrade one status from another by inference. In particular, implemented import
code and persisted staging rows do not prove an active catalog; a protected Production
route does not prove an authenticated visual flow.

## Scope-first workflow

```bash
git status --short --branch
npm run agent:context -- <scope>
# read only the files printed for that scope
npm run verify:changed
npm run verify:full # only for central/risky handoff conditions
```

Supported scopes:

`auth`, `account`, `inventory`, `catalog`, `scan`, `planning`, `shopping`, `nutrition`,
`privacy`, `recalls`, `offline`, `billing`, `ops`, `database`, `ui`, `deployment`.

The schema-validated source of this routing is `scripts/agent/scopes.mjs`. Do not create
a second exhaustive repository index or a committed “current test status” file.

## Architecture boundaries

- `src/app`: App Router, layouts, APIs and composition.
- `src/features`: feature UI/orchestration.
- `src/components`: shared consumer UI.
- `src/domain`: deterministic rules.
- `src/contracts`: validated data contracts.
- `src/infrastructure`: providers, repositories and persistence.
- `src/lib`: shared helpers/integration utilities.
- `supabase/migrations` and `supabase/tests`: forward schema and database proof.
- `scripts`: import, verification and developer automation.

Business rules do not live in React components. Private access is enforced at the API
and RLS boundaries, not by hidden UI alone.

## Precedence

When documents disagree, resolve deliberately:

1. Applicable law and approved legal/security/food-safety decision.
2. C0 safety, privacy, authorization, billing and data-integrity invariants.
3. Canonical flow and authoritative domain/data contract.
4. Specialist plan selected by `agent:context`.
5. `design.md` and UI/performance rules for UI scope.
6. Illustrative mockup or existing prototype behavior.

Generated mockups never override data, dates, navigation, authorization or safety.

## Completion and handoff

A changed slice needs exact persistence/authorization behavior, explicit failure states,
tests at the affected risk boundary, current documentation and a rollback or disable
strategy when appropriate. Report only `PASS`, `FAIL`, `FLAKY`, `BLOCKED` or `NOT_RUN`.
Use `docs/agent/HANDOFF_TEMPLATE.md`; never reuse evidence across commits or artifacts.
