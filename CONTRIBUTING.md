# Contributing to FoodOS

FoodOS handles sensitive household/food-profile data and safety-adjacent date/recall
behavior. Changes are reviewed as product-risk changes, not only code style changes.
Read `AGENTS.md`, then use the scope-first workflow instead of loading every plan.

```bash
git status --short --branch
npm run agent:context -- <scope>
# read only the reported files and implement the cohesive change
npm run verify:changed
```

Use `npm run agent:context -- --list` for supported scopes. `CODEX_PROMPT.md` is only
required for an explicitly requested complete multi-stage build.

## Local setup

Requirements: Node.js 22 and npm.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The UI can run in preview mode without real Supabase credentials. Never commit `.env`,
`.env.local`, service-role keys, signing keys, production exports or user data.

## Branch and issue workflow

1. Start from the current protected base and inspect the worktree.
2. Link a bug/feature/research issue with flow, risk class and acceptance criteria.
3. Use a short branch such as `agent/f02-batch-confirmation` or
   `fix/recall-stale-state`.
4. Implement one cohesive vertical slice. Do not mix unrelated formatting or generated
   lockfile churn.
5. Open a draft pull request early and keep its evidence exact.

Use Conventional-Commit-style intent where practical, for example:

- `feat(scan): persist confirmed batch idempotently`
- `fix(recall): keep stale source out of clear state`
- `test(auth): prove AAL1 cannot read household rows`
- `docs(ux): define adaptive performance gates`

## Engineering rules

- Separate composition/UI, validation, use cases/domain rules and data/provider access.
- Keep functions/modules named around one purpose. Avoid giant components, hidden global
  state, boolean-heavy component APIs and speculative frameworks.
- Validate every external boundary with an explicit schema; preserve source, retrieval
  time, confidence and unknown values.
- Use database transactions/RPCs and idempotency for multi-record confirmed intent.
- Treat RLS/AAL2 and tenant isolation as required security boundaries.
- Add comments for intent/invariant/constraint, not a narration of obvious code.
- Delete dead paths after compatibility/migration ends. Do not keep two unowned truths.
- Do not weaken types, tests, lint, authorization or privacy controls to make CI green.

## UI work

Read `design.md`, `plans/UI_UX_PERFORMANCE_PLAN.md`, the relevant user flow and
`mockups/README.md`.

- Define loading, empty, error, offline, stale, permission, conflict and success states
  before polishing the happy path.
- Reuse semantic tokens and named component variants.
- Test compact/expanded, long German content, keyboard/focus, screen reader, large text
  and reduced motion where relevant.
- Attach before/after screenshots for visual changes. Generated boards are visual
  direction, never exact data/copy/state authority.
- Report bundle and performance effects; heavy scanner/chart code must stay lazy.

## Tests and evidence

Start with the changed surface:

```bash
npm run verify:changed -- --base=<ref>
```

The command reports how its base was chosen. It selects targeted unit/type/lint/build,
DB/RLS, catalog and E2E checks conservatively. Missing Docker, Supabase or browser
services are `BLOCKED`, not green. Run `npm run verify:full` before handing off shared
configuration, routing, dependency or other central/high-risk changes.

Also run the test levels required by `plans/QUALITY_ENGINEERING_PLAN.md` for the changed
risk. Every exported business rule, use case, API/RPC/job/webhook, database policy and
critical flow branch needs meaningful evidence or a reviewed exception with expiry.

Report exact states:

- `PASS`: passed first attempt for the matching artifact;
- `FLAKY`: passed only after retry and is not green C0/C1 evidence;
- `BLOCKED`, `NOT_RUN`: not proven. A skipped command is reported as `SKIPPED` with its
  reason by developer tooling and is not release evidence.

Every fixed defect gets a regression test at the lowest deterministic layer and, where
the defect crossed a boundary, at that boundary.

## Database and environment changes

- Add forward-only Supabase migrations; do not edit a migration already applied to a
  shared environment.
- Design expand/contract compatibility and rollback/data-recovery before destructive
  schema changes.
- Test all relevant anonymous/AAL1/AAL2/owner/member/unrelated/removed/service actors.
- Update `.env.example`, README, Docker/Vercel/self-hosting notes and runbooks in the same
  pull request when configuration changes.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` through a public/client variable.

## Security and privacy

- Follow `SECURITY.md` for vulnerability reporting.
- Do not place real user/product/date/health data in issues, tests, screenshots, traces or
  pull requests. Use deterministic fictional fixtures.
- Logs/analytics/ads may not contain identity, household, GTIN, product name/image, MHD,
  lot, allergens, nutrition, weight/goals or free text.
- New SDKs/providers require data-flow, consent, retention, transfer, license, failure,
  cost and exit review before installation.

## Pull-request approval

A PR is ready for review when:

- scope and non-goals are clear;
- flow/risk/test IDs and migrations are linked;
- tests and screenshots/traces are attached with exact status;
- data/privacy/security and performance impact are stated;
- rollout, feature flag/kill switch and rollback are described where applicable;
- README/plans/runbooks reflect the new truth;
- there are no unresolved secrets or production data in the diff.

Commercial deployment, store submission, legal approval and merge approval remain
separate decisions. A merged plan or prototype does not claim any of them.
