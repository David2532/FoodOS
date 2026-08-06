---
name: foodos-ui-flow-spec
description: Use when designing or materially changing a FoodOS consumer flow before code. Produces a minimal state-complete UX brief from the Product North Star, stable user flows, real code evidence, safety rules, and design.md; do not use for tiny style-only fixes.
---

# FoodOS UI flow specification

Create one implementation-ready interaction brief. Do not write code or make aesthetic mockups.

## Inputs

- work-item ID, user outcome, capacity class, and explicit non-scope;
- evidence map from `ui_explorer` when available;
- `plans/PRODUCT_NORTH_STAR.md`;
- relevant flow in `plans/USER_FLOWS.md`;
- `plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md`;
- `design.md`;
- applicable food-safety, privacy, offline, or auth source returned by `agent:context`.

## Method

1. State the user's real-world job and observable success moment.
2. Preserve the shortest safe path; remove fields the system can infer reliably.
3. Name the one primary action for every step.
4. Describe automatic system work separately from user work.
5. Define all relevant states: idle, loading, success, empty, error, offline, permission denied, conflict, partial data, and uncertainty.
6. Define correction, retry, undo, defer, and safe exit behavior.
7. Specify compact, medium, and expanded composition without changing the task order.
8. Specify keyboard, screen reader, large text, reduced motion, target size, and one-handed behavior.
9. Define measurable acceptance criteria and a strict non-scope.
10. Flag any conflict with safety, privacy, provenance, or canonical product direction.

## FoodOS defaults

- A purchase is one continuous capture session, not a form per known product.
- Duplicate scans increase quantity and immediately return to scanning.
- Low-risk high-confidence facts may be accepted automatically; uncertainty is reviewed once at the end.
- Use-by, allergen, recall, and other safety-critical uncertainty requires explicit confirmation.
- `Was kann ich jetzt essen?` is the main everyday decision after any critical safety action.
- Missing ingredients and unknown data remain explicit.
- Plain German, progressive disclosure, reversible corrections, and no guilt language.

## Required output

```text
Flow ID / work item:
User job:
Success moment:
Entry / exit:
Step table: step | primary action | automatic work | required data
Interaction budget:
State matrix:
Correction and recovery:
Responsive behavior:
Accessibility requirements:
Safety/privacy boundaries:
Acceptance criteria:
Non-scope:
Open decision requiring owner:
```

Reject the brief if it depends on invented data, hides uncertainty, adds avoidable repeated entry, or cannot be tested as a complete flow.
