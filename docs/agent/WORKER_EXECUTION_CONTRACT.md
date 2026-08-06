# FoodOS worker execution contract

Status: **binding contract for short-lived worker agents**.

A worker exists to complete one bounded, coherent work item. It is not a department head,
product owner or release approver.

## Required worker input

Every worker brief must contain:

- stable work-item ID and title;
- intended user or company outcome;
- C0–C3 capacity class;
- one accountable department and executive;
- repository scope from `npm run agent:context -- <scope>`;
- allowed files and capabilities;
- acceptance criteria;
- required checks and evidence;
- explicit exclusions;
- budget or capacity envelope;
- escalation owner.

A worker must not begin a write task when required scope, target or acceptance criteria are
unknown. It may gather A0 evidence needed to remove that uncertainty.

## Start procedure

1. Read `AGENTS.md`.
2. Inspect `git status --short --branch` and preserve unrelated work.
3. Run `npm run agent:context -- <scope>`.
4. Read only the returned documents and implementation paths plus directly edited files.
5. Confirm the work item can be completed without crossing an unapproved capability or
   department boundary.
6. Create or use an isolated task branch or worktree.

## Execution rules

- Implement the smallest cohesive vertical slice that satisfies the acceptance criteria.
- Keep business and food-safety rules out of UI and transport layers.
- Do not rewrite applied migrations.
- Do not touch production unless the work item explicitly authorizes the exact mutation.
- Do not expose secrets, private household data or sensitive analytics payloads.
- Do not silently reduce scope because context, token or time use is higher than expected.
- Do not use another worker's uncommitted workspace.
- Do not spawn a worker solely to repeat the same investigation.
- Prefer deterministic code, scripts and tests over agent judgment for repeatable checks.

## Parallel work

Parallel workers are permitted only when all of the following are true:

- file ownership does not overlap;
- state mutations do not overlap;
- one worker does not depend on another worker's uncommitted output;
- acceptance criteria can be verified independently;
- the orchestrator has a defined merge order.

When these conditions are not met, use sequential work. More workers are not evidence of
more progress.

## Model and usage routing

Use the least expensive model and context that passes the task's required evaluation.
Routing must consider correctness, risk and rework—not only token price.

Recommended pattern:

- small deterministic lookup or classification: low-cost worker;
- normal bounded implementation: standard coding worker;
- architecture, security boundary or cross-scope conflict: stronger reasoning worker;
- independent verification: separate verifier with no access to the implementer's hidden
  assumptions;
- repeatable repository checks: scripts and CI, not an additional conversational agent.

A cheaper route is rejected when it increases failed checks, rework, unsafe output or
missing evidence.

## Verification

The implementing worker runs `npm run verify:changed -- --base=<ref>` and any additional
checks required by the selected scope. `npm run verify:full` is required when shared
configuration, routing, dependencies, security-critical boundaries or several scopes
change.

Status vocabulary is exact:

- `PASS`: the named command completed successfully for the exact commit;
- `FAIL`: the command completed and failed;
- `FLAKY`: a failure passed only after retry;
- `BLOCKED`: an external prerequisite was unavailable;
- `NOT_RUN`: the check was not executed.

A verifier must be able to reproduce the evidence from the branch and commit. Narrative
confidence is not verification.

## Approval separation

For material work, record distinct identities for:

- planner;
- executor;
- verifier;
- approver.

The same agent may plan and execute a low-risk bounded task, but it may not independently
approve its own material release, security, privacy, food-safety, finance or capacity
exception.

## Capacity exceptions

When expected usage exceeds the envelope:

1. preserve current work and evidence;
2. identify remaining work and expected cost;
3. list safe optimizations already attempted;
4. state quality or delivery impact of each alternative;
5. set `CAPACITY_EXCEPTION_PENDING`;
6. escalate through Orchestrator → CTO/CPO → CFO → AI CEO → David when required.

C0 and C1 scope continues under a soft-limit exception. A real provider hard limit may
produce `BLOCKED`, but the handoff must make continuation deterministic.

## Worker handoff

The handoff uses `docs/agent/HANDOFF_TEMPLATE.md` and additionally records:

- work-item ID and capacity class;
- department and executive owner;
- exact branch and commit;
- changed files;
- tests and evidence;
- known limits and remaining risks;
- verifier and required approver;
- usage or cost when available;
- next deterministic action.

A worker is complete only when code, evidence and handoff agree.