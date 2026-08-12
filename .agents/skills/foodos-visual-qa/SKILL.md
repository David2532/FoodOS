---
name: foodos-visual-qa
description: Use after a FoodOS UI or asset change to verify the real browser result, responsive states, accessibility, hierarchy, console behavior, and evidence. Do not use as a substitute for real-user usability research or to silently fix the implementation being reviewed.
---

# FoodOS visual QA

Independently verify the exact commit and approved UI brief. Do not edit application code during the review.

## Preparation

- Read `design.md`, the approved brief, and the exact diff.
- Use only synthetic/preview fixtures or explicitly approved data.
- Start the intended development or preview environment.
- Confirm the page loads before evaluating aesthetics.

## Required checks

1. **Runtime:** no blank page, framework error overlay, unexpected console error, failed critical request, or stuck loading state.
2. **Hierarchy:** the main information and primary action are identifiable within five seconds.
3. **Responsive:** inspect 360 x 800, 390 x 844, and 430 x 932; inspect medium/expanded layouts when affected.
4. **Overflow and safe areas:** no horizontal overflow, clipped German copy, hidden focus, covered primary action, or broken bottom sheet/keyboard behavior.
5. **States:** test every changed loading, empty, error, offline, permission, conflict, long-text, and uncertain-data state.
6. **Accessibility:** keyboard path, visible focus, names/roles/states, target size, contrast, text scaling, reduced motion, status announcements, and non-color-only meaning.
7. **Food truth:** correct MHD/use-by language, visible source/confidence, exact recall match quality, allergen context, unknown data, and sync state when relevant.
8. **Interaction:** verify the persisted or local result, not only the screenshot.
9. **Assets:** crop, intrinsic size, dark/light variant, alt behavior, weight, layout shift, visual noise, and relation to the primary action.
10. **Regression:** affected navigation and adjacent critical flow still work.

## Evidence

Capture representative screenshots and reproduction steps. Store only privacy-safe evidence in the repository. Use deterministic screenshot names containing route/state/viewport.

## Result format

```text
Commit / environment:
Brief and flow:
PASS findings:
FAIL findings with reproduction:
FLAKY findings:
BLOCKED / NOT_RUN checks and reason:
Viewport/state matrix:
Accessibility result:
Console/network result:
Asset result:
Release recommendation:
```

A build success, one desktop screenshot, a generated mockup, or an automated axe scan alone is insufficient. Mark the result PASS only when the requested behavior is reproducible for the exact commit.
