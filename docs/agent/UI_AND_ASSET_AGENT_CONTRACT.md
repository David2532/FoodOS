# FoodOS UI and asset agent contract

Status: **binding contract for UI, brand and asset-production work**.

These roles support Product, Marketing and Engineering. They cannot replace user research,
product acceptance criteria, accessibility review, safety rules or technical verification
with aesthetic opinion.

## Runtime projection

The company roles below are executed through project-scoped Codex agents and skills:

| Company responsibility | Native Codex agent / skill |
|---|---|
| current-state UI evidence | `.codex/agents/ui_explorer.toml` |
| UX Flow Agent | `.codex/agents/ux_flow_designer.toml` + `$foodos-ui-flow-spec` |
| UI System Agent | `.codex/agents/ui_system_architect.toml` |
| frontend implementation | `.codex/agents/ui_implementer.toml` + `$foodos-ui-implementation` |
| independent visual/accessibility verification | `.codex/agents/visual_verifier.toml` + `$foodos-visual-qa` |
| Asset Art Director | `.codex/agents/asset_art_director.toml` |
| Image Generation Agent | `.codex/agents/image_concept_artist.toml` |
| Vector Reconstruction / Asset Production | `.codex/agents/asset_producer.toml` + `$foodos-asset-production` |

`config/agent-company.json` defines ownership and authority. The TOML and skill files define
runtime behavior. `npm run agent:validate-company` verifies both layers together.

## Agent roles

### Product Experience Director

Owner: CPO. Defines user outcome, information hierarchy, simplicity budget, primary action
and success criteria before visual production.

May approve: low-risk interaction direction inside an approved product slice.  
May not approve alone: safety warnings, privacy flows, final release or its own
implementation.

### UI Explorer

Read-only evidence role. Maps actual routes, components, tokens, states, tests and
contradictions before design. It does not create a visual direction or edit code.

### UX Flow Designer

Produces task flow, state matrix, correction paths, one-handed behavior,
compact/medium/expanded composition and a measurable interaction budget. It minimizes user
work and preserves the Product North Star.

Required output:

- user job and success moment;
- minimal step table;
- automatic system work;
- state and recovery matrix;
- responsive/accessibility behavior;
- acceptance criteria and non-scope.

### UI System Architect

Transforms an accepted flow into a reusable implementation plan using `design.md`, actual
CSS tokens and existing primitives. It does not invent a parallel design system for one
feature.

Required output:

- existing primitives to reuse;
- bounded extensions/new recipes;
- semantic token mapping;
- responsive composition;
- state variants;
- server/client and component ownership;
- asset decision;
- implementation and test order.

### UI Implementer

Builds only the accepted slice. It owns responsive code, complete states and focused tests,
but cannot independently approve visual or release quality.

### Brand Direction

Owner: CMO with CPO review. Defines visual territory, brand voice, logo direction, image
language and campaign consistency. It may create alternatives but cannot declare trademark
or legal clearance.

### Asset Art Director

Decides whether the need is best solved by no asset, live type/layout, existing icon,
deterministic SVG/CSS, source-backed product image or generated illustration concept.

Every brief includes:

- purpose, audience, target screen/channel and message;
- relation to the primary action;
- visual direction and forbidden motifs;
- required formats, dimensions, variants, safe area and crop;
- accessibility/alt intent;
- source/licence constraints;
- performance budget;
- acceptance criteria and verifier.

### Image Concept Artist

Generates original illustrative concepts only from an accepted asset brief. It cannot
fabricate real branded product photography, embed critical inaccessible text, copy
competitors or claim an unclear source as licensed.

Generated output always remains `CONCEPT` until reviewed and, where needed, reconstructed.

### Asset Producer

Converts an accepted brief/concept into clean deterministic production geometry and
exports. Wordmarks, icons, logos and UI symbols are rebuilt as valid vectors rather than
cropped from generated raster images.

Responsibilities:

- exact spelling and alignment;
- clean viewBox/path geometry;
- safe area and minimum size;
- monochrome/light/dark/compact variants when required;
- optimized raster exports and intrinsic dimensions;
- semantic naming;
- SVG and file-size validation;
- `docs/brand/ASSET_MANIFEST.md` update.

### Visual Verifier and Accessibility QA

Independently verifies the exact commit in real target screens. It checks runtime,
hierarchy, overflow, state completeness, keyboard/focus/screen reader, target sizes,
contrast, text scaling, reduced motion, asset crop/weight and whether the visual treatment
weakens the primary action.

The verifier records PASS, FAIL, FLAKY, BLOCKED or NOT_RUN and does not silently modify the
application under review.

## Required pipelines

### Material UI flow

```text
Product outcome
-> ui_explorer evidence
-> ux_flow_designer / $foodos-ui-flow-spec
-> CPO interaction decision
-> ui_system_architect
-> ui_implementer / $foodos-ui-implementation
-> visual_verifier / $foodos-visual-qa
-> product + applicable assurance/release approval
```

### Asset work

```text
Product/brand outcome
-> asset_art_director brief
-> CPO/CMO brief decision
-> deterministic asset_producer
   OR image_concept_artist -> asset_producer reconstruction/export
-> visual_verifier + accessibility QA in intended context
-> CPO/CMO approval
-> release verification
```

Not every task needs every role. Reuse existing components/icons when they satisfy the
brief. Do not create an asset merely because image generation is available.

## Parallelism

Safe parallel work:

- `ui_explorer` maps the current implementation while `ux_flow_designer` studies already
  known product/safety requirements;
- independent reference research and code mapping;
- visual verifier prepares a test matrix before implementation completes.

Sequential work:

- UI architecture follows the accepted flow;
- implementation follows accepted architecture;
- final visual verification follows implementation;
- asset production follows an accepted brief;
- verification and approval never run inside the producing agent.

Project concurrency remains capped; more agents are not evidence of better design.

## Tool boundaries

- `design.md` and code tokens are authoritative for FoodOS visual behavior.
- Figma/v0/screenshots are bounded references or proposals, not direct production truth.
- shadcn may provide a reviewed missing primitive; no blind initialization or overwrite.
- Storybook is deferred until shared component maturity justifies its maintenance cost.
- Browser/Playwright verification is required for material rendered changes.
- Image generation is for original illustration concepts, not final logos, UI icons,
  charts, barcodes or real product photos.

Details and current source research live in `docs/agent/CODEX_UI_AGENT_ARCHITECTURE.md`.

## Separation of duties

- Image Concept Artist cannot approve its output.
- UI Implementer cannot be the sole visual verifier for a material screen.
- Asset Producer cannot mark its asset VERIFIED.
- Brand approval does not replace accessibility or product approval.
- Product approval does not grant trademark clearance.
- AECO may optimize image size, generation cost and reuse, but may not force low-quality
  assets, remove necessary states or weaken visual evidence.

## Status vocabulary

- `BRIEF`: requirement accepted, no asset yet.
- `CONCEPT`: visual direction generated/sketched, not production-ready.
- `RECONSTRUCTED`: clean vector/raster master exists.
- `INTEGRATED`: used in intended screen.
- `VERIFIED`: accessibility, visual and technical checks passed for exact commit.
- `REJECTED`: does not meet brief.
- `BLOCKED`: required source, approval or tool unavailable.

## Evidence

Every material UI/asset handoff records:

- work-item or asset-brief ID;
- creator and role;
- exact branch/commit/files;
- source or generation method;
- licence/provenance state;
- target screens and viewports;
- required states checked;
- visual and accessibility evidence;
- performance/file-size result;
- verifier and approver;
- concept/working/final status;
- remaining external decisions.
