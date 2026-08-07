---
name: foodos-ui-implementation
description: Use when implementing an approved FoodOS UI flow or responsive screen in Next.js. Reuses the existing design system, components, domain contracts, and scoped tests; do not use to invent product behavior, redesign the whole app, or import an unreviewed generated project.
---

# FoodOS UI implementation

Implement the smallest complete UI slice that satisfies an approved UX and UI-system brief.

## Before editing

1. Read `AGENTS.md` and inspect `git status --short --branch`.
2. Run `npm run agent:context -- ui` and any second scope required by the behavior.
3. Read the approved brief, `design.md`, the real route, shared primitives, CSS variables, contracts, and directly affected tests.
4. Record likely files and explicit non-scope.
5. Preserve unrelated changes and existing behavior outside the brief.

## Build rules

- Use existing semantic tokens and component patterns before adding a primitive.
- Keep one dominant primary action per screen and keep it visible above safe-area/navigation/keyboard boundaries.
- Implement required idle, loading, success, empty, error, offline, permission, conflict, and uncertainty states.
- Use semantic HTML, visible labels, native controls, complete focus behavior, and accessible status announcements.
- Preserve compact, medium, and expanded task order and state during resize.
- Keep business, authorization, inventory, nutrition, allergen, date, recall, and sync rules outside JSX handlers.
- Validate external data as unknown at the boundary.
- Keep heavy scanner, OCR, charts, and providers lazy.
- Use source-backed product imagery only; use neutral fallbacks when absent.
- Do not add random hex values, a second spacing scale, nested-card clutter, unexplained health scores, or decorative metrics.
- Do not initialize/migrate shadcn, add a dependency, paste v0 output, or change navigation unless the approved work item explicitly authorizes it and the diff is reviewed.

## Visual discipline

- Strong hierarchy beats component count.
- Use few surfaces with clear grouping rather than a dashboard mosaic.
- Prefer typography, spacing, alignment, and state copy before adding illustration.
- Reuse Lucide or authored FoodOS vectors for interface icons.
- Motion confirms state; it never delays scanning or hides information.

## Verification

During implementation run focused tests. Before handoff:

```bash
npm run verify:changed -- --base=<ref>
```

Also run the UI scope's required E2E/browser checks when visual behavior changed. Verify at 360 x 800 and 430 x 932 at minimum, include long German copy and affected error/offline/permission states, and record exact outcomes.

## Handoff

Report files changed, states implemented, tokens/components reused, checks run, evidence
location, known limits, and required approver. Material UI hands off to
`$foodos-ui-quality-review` for independent interaction, accessibility and visual lanes.
The implementer cannot mark its own work verified or close a finding it fixed.
