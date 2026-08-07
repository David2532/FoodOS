---
name: foodos-ui-quality-review
description: Use after a material FoodOS UI implementation is ready for independent visual, interaction, and accessibility review, structured fix routing, and exact-commit retesting; do not use it to silently fix reviewed code or claim real-user usability evidence.
---

# FoodOS UI quality review

Run a reproducible test-to-fix-to-retest loop for one exact FoodOS UI artifact. Keep the implementer, specialist verifiers, and final approver distinct.

## Establish the review contract

Require these inputs before dispatch:

- work-item ID, capacity/risk class, flow ID, user outcome, and accepted brief;
- repository, branch, full commit, clean/dirty state, build or deployment URL, and environment;
- changed files, affected routes, components, states, viewports, themes, and input methods;
- privacy-safe synthetic fixture and any required authentication or provider setup;
- acceptance criteria, highest-risk negative path, adjacent regression scope, and approvers.

If a required environment or fixture is unavailable, retain `BLOCKED` or `NOT_RUN`. Never substitute an old screenshot, different commit, mockup, or narrative confidence.

## Select independent lanes

For material UI work, dispatch the required specialists without exposing the implementer's hidden assumptions:

- `interaction_verifier`: task outcome, state transitions, persistence/reload, recovery, console/network, and expert flow conformance;
- `accessibility_verifier`: automation plus keyboard, focus, semantics, zoom/text, motion, target size, and real assistive-technology evidence where available;
- `visual_verifier` with `$foodos-visual-qa`: hierarchy, responsive/adaptive composition, overflow, tokens, themes, assets, and visual regression.

Use only the relevant lanes for a tiny bounded defect. Add existing performance, security, privacy, food-safety, or data-quality specialists when the changed boundary requires them. Keep within `.codex/config.toml` concurrency and share one exact server/artifact; do not start competing dev servers or write to one shared report path.

## Build the charter

Create a matrix from `design.md`, the accepted flow, and the changed risk:

1. exact happy path and most dangerous negative path;
2. `idle`, `loading`, `success`, `empty`, `error`, `offline`, `permission_denied`, `conflict`, `uncertain`, and `partial` where applicable;
3. 390 x 844 compact and one expanded browser at PR minimum;
4. 360 x 800, 430 x 932, breakpoint transitions, landscape, browser families, themes, 200% zoom, long German copy, reduced motion, and keyboard/safe-area cases when affected or at the full gate;
5. authoritative result after action, reload, correction, retry, and adjacent critical regression;
6. expected evidence paths unique to each specialist.

Browser emulation is web evidence, not native iOS/Android proof. AI expert review is `SYNTHETIC_EXPERT_REVIEW`, not a participant study or usability rate.

## Record evidence and findings

Each lane reports every required check separately as `PASS`, `FAIL`, `FLAKY`, `BLOCKED`, or `NOT_RUN`. A retry-only success remains `FLAKY`. Stale or skipped required evidence is `NOT_RUN` with its reason.

Resolve `docs/agent/UI_QUALITY_FINDING_TEMPLATE.md` from the current repository root and use it for each defect or independently resolvable evidence blocker. If the reviewed checkout does not contain the template, report contract-version skew instead of inventing fields. Keep requirement risk, finding severity, and evidence status separate. An environment or fixture gap is an `EVIDENCE_BLOCKER` with severity `not_applicable` until execution observes a product defect:

- `critical`: safety, privacy, security, billing, deletion, authorization, data loss, false food truth, or complete exclusion from a critical outcome;
- `major`: primary task blocked or wrong, missing required recovery, blank/crashing route, hidden primary action/focus, serious accessibility barrier, or critical request failure;
- `moderate`: the task completes with material friction, misleading hierarchy/state, or a secondary accessibility/system violation;
- `minor`: polish issue without meaningful task, trust, or access impact.

Any unresolved `critical` or `major` finding makes the affected gate `FAIL`. A score may aid diagnosis but cannot average away a blocker or missing lane.

## Route without prescribing unapproved design

The Executive Orchestrator deduplicates only identical symptoms while preserving every evidence link, then routes:

- component, layout, and bounded interaction defects to `ui_implementer`;
- flow, copy, hierarchy, or extra-work conflicts to `ux_flow_designer` or CPO before implementation;
- shared token/primitive defects to `ui_system_architect` and then the implementer;
- accessibility defects to the implementer and accessibility owner;
- performance, food-safety, privacy, security, or data-truth defects to their named specialist authority.

Give the implementer expected behavior, user consequence, violated criterion, and observable acceptance criteria. An implementation suggestion is optional and never overrides the accepted flow or architecture.

## Retest independently

After a fix:

1. require a new full commit and artifact identity linked to the finding;
2. have the originating verifier repeat the exact reproduction on first attempt with the same fixture and environment;
3. run the named adjacent regression scope;
4. preserve prior evidence rather than overwriting it or blindly updating snapshots;
5. close only when every acceptance criterion is `PASS` for the new artifact;
6. rerun the complete lane matrix after global token, shell, navigation, or shared-state changes.

The implementer cannot close its own finding. The Orchestrator cannot approve its synthesized result. CPO and applicable assurance/release owners make the final decision. Material usability or comprehension claims still require the real participant process in `plans/UX_RESEARCH_AND_USABILITY_TESTING.md`.
