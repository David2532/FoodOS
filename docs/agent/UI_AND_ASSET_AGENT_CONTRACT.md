# FoodOS UI and asset agent contract

Status: **binding contract for UI, brand and asset-production work**.

These agents support the Product, Marketing and Engineering departments. They are not allowed to replace user research, product acceptance criteria, accessibility review or technical verification with aesthetic opinion.

## Agent roles

### Product Experience Director Agent

Owner: CPO. Defines the user journey, information hierarchy, simplicity budget, primary action and success criteria before visual production starts.

May approve: low-risk interaction direction inside an approved product slice.

May not approve alone: safety warnings, privacy flows, final release or its own implementation.

### UX Flow Agent

Produces task flows, states, edge cases, correction paths, one-handed behavior and compact/medium/expanded layouts. It must minimize steps and preserve the Product North Star.

Deliverables:

- flow map;
- state matrix;
- interaction budget;
- accessibility needs;
- prototype acceptance criteria.

### UI System Agent

Transforms approved flows into reusable screens and component specifications using `design.md`, semantic tokens and existing primitives. It does not invent a parallel design system for one feature.

Deliverables:

- component map;
- token usage;
- responsive behavior;
- empty/loading/error/offline/permission states;
- implementation notes for frontend workers.

### Brand Direction Agent

Owner: CMO with CPO review. Defines visual territory, brand voice, logo direction, image language and campaign consistency. It may create concept alternatives but does not declare trademark or legal clearance.

### Asset Art Director Agent

Creates an asset brief before generation. It decides whether the need is best served by an existing UI primitive, deterministic SVG/CSS, original illustration, product-source image or generated concept.

Every brief includes:

- purpose and screen;
- audience and message;
- visual direction;
- required formats and dimensions;
- light/dark variants;
- accessibility and alt-text intent;
- forbidden motifs;
- source/licence requirements;
- performance budget;
- acceptance criteria.

### Image Generation Agent

Generates original concept imagery only from an approved asset brief. It must not fabricate photographs of real branded products, embed critical text in inaccessible raster images, copy competitor artwork or claim an unclear source as licensed.

Generated output is always `CONCEPT` until reviewed and, where needed, technically reconstructed.

### Vector Reconstruction Agent

Converts an approved concept into clean, deterministic, scalable production geometry. Wordmarks, icons, logos and UI symbols must be rebuilt as valid vectors rather than cropped from generated raster images.

Responsibilities:

- exact spelling;
- path and alignment cleanup;
- safe area and minimum size;
- monochrome/light/dark variants;
- export naming;
- SVG validation;
- visual comparison with the approved direction.

### Asset Production Agent

Produces required raster and vector exports, compression, responsive variants, favicons, PWA icons, social previews and documented file paths. It updates `docs/brand/ASSET_MANIFEST.md` and never leaves ambiguous duplicate assets.

### Accessibility Visual QA Agent

Checks contrast, focus visibility, target size, text scaling, reduced motion, non-color-only meaning, readable warning hierarchy and correct decorative/informative alt behavior.

### Visual QA and Integration Agent

Independently verifies assets in real target screens and sizes. It rejects distortion, unreadable text, visual clutter, layout shift, excessive weight, inconsistent styling and assets that weaken the primary action.

## Required pipeline

```text
Product outcome
-> UX Flow Agent
-> UI System Agent
-> approved asset need
-> Asset Art Director brief
-> deterministic production OR Image Generation concept
-> Vector Reconstruction / Asset Production
-> Accessibility Visual QA
-> Visual QA in real screen
-> CPO/CMO approval as applicable
-> frontend integration
-> independent release verification
```

Not every UI task needs every role. Reuse existing components and icons when they satisfy the brief. Create a new asset only when it improves comprehension, trust, brand recognition or task success.

## Separation of duties

- The Image Generation Agent cannot approve its own output.
- The frontend implementer cannot be the sole visual verifier for a material screen.
- Brand approval does not replace accessibility or product approval.
- Product approval does not grant legal trademark clearance.
- AECO may optimize image size, generation cost and reuse, but may not force low-quality assets or remove necessary states.

## Status vocabulary

- `BRIEF`: requirement approved, no asset yet.
- `CONCEPT`: visual direction generated or sketched, not production-ready.
- `RECONSTRUCTED`: technically clean vector/raster master exists.
- `INTEGRATED`: used in the intended screen.
- `VERIFIED`: accessibility, visual and technical checks passed for the exact commit.
- `REJECTED`: does not meet the brief.
- `BLOCKED`: required source, approval or tool unavailable.

## Asset evidence

Every final handoff records:

- asset brief ID;
- creating agent/worker;
- source or generation method;
- exact files and dimensions;
- licence/provenance status;
- target screens;
- visual QA evidence;
- accessibility result;
- performance size;
- verifier and approver;
- whether the asset is concept, working or final.
