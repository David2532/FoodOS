# FoodOS Codex execution playbook

Status: **binding execution method for Codex-led repository work**.

This playbook turns the FoodOS master plan and Agent Operating Model v2 into an efficient, reviewable delivery workflow. It does not override product, safety, privacy or approval rules.

## 1. Begin with a bounded work brief

Before implementation, record:

```text
Work item:
User/company outcome:
Why now:
Capacity class: C0 | C1 | C2 | C3
Accountable executive and department:
Repository scope(s):
Likely files:
Explicit non-scope:
Acceptance criteria:
Required checks:
Risk/assurance reviewers:
External blockers:
Rollback/recovery:
```

Do not start from “improve everything” or “make production ready” without bounded acceptance criteria.

## 2. Establish the baseline once

At work-item start:

1. inspect branch, status, PR and exact base commit;
2. run `npm run agent:context -- <scope>` for the smallest relevant scope set;
3. read canonical decisions already made;
4. record known green evidence and open blockers;
5. do not repeatedly rediscover unchanged architecture, provider setup or prior decisions.

Maintain a short evidence ledger in the work handoff:

```text
Already proven and unchanged:
Must be reverified because changed:
External status that remains BLOCKED/NOT_RUN:
```

## 3. Build a dependency-aware work graph

The Executive Orchestrator splits the work into the smallest independently reviewable vertical slices. Each node names:

- owner;
- inputs;
- outputs;
- dependencies;
- files/state it may mutate;
- verifier;
- merge order.

Parallel workers are allowed only when file ownership, state mutations and acceptance criteria do not overlap. Otherwise work sequentially.

## 4. Use specialist agents deliberately

Use a specialist only when it adds distinct expertise or independent verification. Examples:

- UX Flow Agent before a material interaction redesign;
- UI System Agent for reusable component and token decisions;
- Asset Art Director and Image Generation Agent only after an approved asset brief;
- Vector Reconstruction and Visual QA before generated concepts become production assets;
- database/security workers for RLS or migration boundaries;
- separate verifier for material security, privacy, food-safety or release claims.

Do not create multiple agents to restate the same plan.

## 5. Checkpoints for long runs

At each meaningful checkpoint, record:

1. completed acceptance criteria;
2. exact changed files;
3. tests run and status;
4. unresolved risk;
5. next node in the work graph;
6. whether scope or budget changed.

Replan when a dependency, source contract or risk assumption proves wrong. Do not silently broaden scope.

## 6. Stop and escalation conditions

Stop the affected action, preserve evidence and escalate when:

- a secret or private-data exposure is suspected;
- a destructive or irreversible production action was not explicitly authorized;
- legal, trademark or licence clearance is required;
- a safety-critical value cannot be established honestly;
- a worker would need to overwrite unrelated changes;
- provider hard limits prevent execution;
- acceptance criteria conflict with repository invariants.

Continue unaffected plan work instead of abandoning the entire run.

## 7. UI and asset workflow

Material UI or brand work follows `docs/agent/UI_AND_ASSET_AGENT_CONTRACT.md`.

Minimum chain:

```text
CPO outcome and simplicity budget
-> UX Flow specification
-> UI System specification
-> approved asset brief when needed
-> deterministic production or generated concept
-> technical reconstruction/export
-> accessibility and visual QA in the real screen
-> integration and independent verification
```

A generated image is not a final logo or UI asset by itself. Avoid unnecessary assets when typography, layout, an existing icon or CSS communicates the state better.

## 8. Verification strategy

Use the diff and risk to select checks:

- run focused tests while iterating;
- run `npm run verify:changed -- --base=<ref>` before handoff;
- run `npm run verify:full` when shared configuration, dependencies, routing, security boundaries or several scopes changed;
- run governance validation after agent/config changes;
- validate JSON, Markdown links and SVG syntax for documentation/asset changes;
- inspect assets at intended mobile sizes and light/dark contexts.

Never report an unavailable service or unexecuted test as green.

## 9. PR discipline

- One PR should represent one coherent review story.
- Do not add consumer implementation to governance/brand PRs.
- Do not add unrelated operations dashboards to a scanner PR.
- Keep the exact base and dependency PR explicit.
- Update the PR body when the actual diff materially changes.

## 10. Completion handoff

A complete handoff includes:

- work-item ID and capacity class;
- branch, base, commit and PR;
- delivered user/company outcome;
- files changed;
- exact commands and outcomes;
- visual/asset status when applicable;
- source and provenance status;
- known limits and external blockers;
- verifier and approver;
- next deterministic work item;
- confirmation that unrelated work, secrets and production data were not changed.
