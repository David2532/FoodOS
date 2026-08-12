# FoodOS repository health assessment

Assessment date: **2026-08-06**  
Assessed branch baseline: `agent/foodos-mvp` at `7d4734cd8abfb14741574df18c964b675dd97683`

## Overall assessment

**Condition: GOOD FOUNDATION / HIGH CHANGE RISK / NOT RELEASE COMPLETE**

The repository is substantially better maintained than a typical early MVP. It has clear
architecture boundaries, pinned dependencies, scoped agent context, forward-only database
history, strong CI, database authorization tests, authenticated E2E coverage, explicit
status language and source-trust rules. The main risk is not neglect; it is the breadth and
age of the long-running MVP branch and the amount of product, security, data and operations
work accumulated in one draft pull request.

## Strong maintenance signals

### Repository instructions

- `AGENTS.md` defines start, scope, architecture, trust, food-safety, data and evidence
  rules.
- `npm run agent:context -- <scope>` restricts context to relevant files.
- `verify:changed` selects checks according to changed risk surface.
- The handoff template requires commit-bound evidence.

### Dependency and build discipline

- Production and development dependencies are pinned to exact versions.
- The lockfile is committed.
- CI uses `npm ci`.
- CI runs a high-severity dependency audit.
- Lint, TypeScript, unit tests, coverage and a production build run together.

### Database and security discipline

- Migrations are forward-only.
- Local Supabase starts from the full migration history in CI.
- pgTAP/RLS tests and database lint run in CI.
- Authenticated Auth/TOTP/household E2E runs against the local Supabase stack.
- Sensitive `/ops` data is separated by AAL2 and explicit roles.
- Finance records preserve source, trust and payment state instead of presenting estimates
  as final facts.

### Product and release discipline

- Preview responsive and accessibility smoke tests are automated.
- Failure evidence is uploaded conditionally.
- The repository distinguishes `PASS`, `FAIL`, `FLAKY`, `BLOCKED` and `NOT_RUN`.
- Food-safety invariants are documented and treated as release rules.

## Current maintenance risks

### 1. Oversized long-running pull request

PR #5 combines account security, catalog ingestion, product flows, database security,
finance operations, deployment work and ongoing feature development. Even with passing
CI, this raises review, rollback, regression and merge-conflict risk.

**Recommendation:** stop adding unrelated company-command-center implementation to PR #5.
Merge or split the MVP work into coherent release units, then build the company agent
control plane in a separate PR.

### 2. Branch-to-production drift

The repository declares Node 22 through `.nvmrc` and `package.json`, while the connected
Vercel project reports Node 24.x. Local, CI and production should intentionally use the
same supported major version.

**Recommendation:** choose one version after compatibility verification and update the
repository and Vercel project together in a dedicated deployment change.

### 3. Expensive browser installation in CI

The latest inspected database/auth job spent most of its runtime installing Chromium and
system dependencies; the actual authenticated E2E run was short.

**Recommendation:** evaluate a version-keyed Playwright browser cache or maintained CI
image. Preserve every existing test and invalidate the cache when the Playwright version
changes.

### 4. Security advisor review backlog

The live Supabase advisor reports:

- leaked-password protection disabled;
- multiple authenticated-callable `SECURITY DEFINER` functions;
- RLS-enabled tables without direct policies;
- several RLS performance findings and unindexed foreign keys.

These findings are review items, not automatic vulnerabilities. Some RPC exposure and
no-policy tables may be intentional fail-closed designs. Each finding needs an explicit
classification: intended and proven, remediation required, accepted temporarily with an
expiry, or false positive with evidence.

**Recommendation:** create a tracked advisor register with owner, rationale, evidence,
severity and retest date. Enable leaked-password protection unless a documented product or
plan constraint prevents it.

### 5. Agent and company operations are documentation-only

The repository has excellent task scopes but no durable records yet for departments,
work items, planner/executor/verifier separation, agent runs, usage, budgets, approvals or
capacity exceptions.

**Recommendation:** implement read-only control-plane views first, then append-only ledgers
and approval tests. Do not begin autonomous production writes before those controls exist.

### 6. Repository visibility

The repository is currently public. The inspected content is intentionally written to
avoid secrets, but a public repository increases the importance of secret scanning,
private evidence handling and review of operational documents.

**Recommendation:** confirm that public visibility is intentional. Keep real receipts,
private exports, credentials, user data and sensitive incident evidence outside Git.

### 7. Release completeness

Passing CI does not mean the commercial product is complete. The PR itself still records
open catalog activation, recall-source licensing, authenticated production visual checks,
native-store, restore/load/usability and other release gates.

**Recommendation:** keep the PR draft and preserve `NOT_RUN`/`BLOCKED` states until exact
evidence exists.

## Priority actions

| Priority | Action | Owner |
|---|---|---|
| P0 | Review Supabase advisor warnings and leaked-password protection | CISO + CTO Data Platform |
| P0 | Keep catalog generation inactive until existing activation gates pass | CPO + CTO + Data Quality |
| P1 | Decide and align Node major across repo, CI and Vercel | CTO Cloud and Developer Platform |
| P1 | Split future work from the oversized MVP PR | COO + CTO |
| P1 | Add company work-item, agent-run, approval and audit ledgers | CTO + COO + CISO |
| P2 | Reduce Playwright installation cost without removing coverage | AECO + Developer Platform |
| P2 | Add sourced GitHub/Vercel/Supabase status panels to `/ops` | CTO + CDAO |
| P2 | Confirm public-repository policy and evidence handling | CISO + CLO |

## Maintenance scorecard

| Area | Assessment |
|---|---|
| Architecture clarity | Strong |
| Dependency discipline | Strong |
| Automated verification | Strong |
| Database authorization testing | Strong |
| Evidence vocabulary | Strong |
| Branch and PR size control | Needs improvement |
| Runtime version consistency | Needs improvement |
| Security-advisor closure | Needs tracked review |
| Agent governance implementation | Not implemented yet |
| Commercial release readiness | Not ready / correctly documented as incomplete |

## Conclusion

FoodOS is **well engineered for its age**, but it is not yet a neatly closed release train.
The correct next maintenance move is smaller PRs, explicit advisor triage, environment
alignment and a read-only company control plane before autonomous agent execution.