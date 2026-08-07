---
name: foodos-visual-qa
description: Use after a FoodOS UI or asset change to verify real rendered hierarchy, responsive states, overflow, tokens, themes, assets, and visual evidence; for material UI use it as the visual lane inside $foodos-ui-quality-review, not as a substitute for interaction, accessibility, or real-user research.
---

# FoodOS visual QA

Independently verify the exact commit and approved UI brief as the visual lane. Do not edit application code during the review or override peer findings.

## Preparation

- Read `design.md`, the approved brief, and the exact diff.
- Use only synthetic/preview fixtures or explicitly approved data.
- Start the intended development or preview environment.
- Confirm the page loads before evaluating aesthetics.

## Required checks

1. **Rendered runtime:** no blank page, framework error overlay, broken asset, or visibly stuck loading state. Route console/network defects to the interaction lane.
2. **Hierarchy:** the main information and primary action are identifiable within five seconds.
3. **Responsive:** inspect 360 x 800, 390 x 844, and 430 x 932; inspect medium/expanded layouts when affected.
4. **Overflow and safe areas:** no horizontal overflow, clipped German copy, hidden focus, covered primary action, or broken bottom sheet/keyboard behavior.
5. **States:** test every changed loading, empty, error, offline, permission, conflict, long-text, and uncertain-data state.
6. **Visual accessibility:** contrast, visible focus, text reflow, reduced-motion presentation, target visibility, and non-color-only meaning. The accessibility lane owns keyboard semantics and assistive-technology proof for material work.
7. **Food truth:** correct MHD/use-by language, visible source/confidence, exact recall match quality, allergen context, unknown data, and sync state when relevant.
8. **State integrity:** confirm the screenshot represents the requested real state; the interaction lane owns authoritative persistence and recovery proof.
9. **Assets:** crop, intrinsic size, dark/light variant, alt behavior, weight, layout shift, visual noise, and relation to the primary action.
10. **Regression:** affected navigation and adjacent critical flow still work.

## Evidence

Capture representative screenshots and reproduction steps. Store only privacy-safe evidence in the repository. Use deterministic screenshot names containing route/state/viewport and the role-specific evidence directory assigned by the parent.

## Result format

```text
Commit / environment:
Brief and flow:
PASS findings:
FAIL findings with reproduction:
FLAKY findings:
BLOCKED / NOT_RUN checks and reason:
Viewport/state matrix:
Visual accessibility result:
Interaction/accessibility findings routed:
Asset result:
Release recommendation:
```

A build success, one desktop screenshot, or a generated mockup is insufficient. Mark the visual lane PASS only when its requested rendered behavior is reproducible for the exact commit. Do not convert missing interaction, accessibility, or user-research evidence into an overall PASS.
