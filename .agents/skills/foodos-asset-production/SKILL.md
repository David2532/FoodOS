---
name: foodos-asset-production
description: Use when FoodOS needs a logo variant, icon, scanner guide, onboarding/empty-state illustration, social asset, or export from an approved asset brief. Chooses deterministic vector/CSS or concept generation appropriately and requires manifest plus independent QA; do not use for real product photography.
---

# FoodOS asset production

Produce only assets justified by an approved brief.

## Choose the cheapest correct medium

Use this order:

1. no asset;
2. live typography/layout;
3. existing Lucide or FoodOS primitive;
4. deterministic CSS or authored SVG;
5. source-backed real product image;
6. original generated illustration concept.

Image generation is appropriate for original illustrative scenes and visual exploration. It is not the final production method for wordmarks, logos, UI icons, diagrams, charts, barcodes, nutrition graphics, or critical text.

## Brief requirements

Do not start without purpose, target screen/channel, message, dimensions, variants, visual direction, forbidden motifs, accessibility intent, source/licence constraints, performance budget, acceptance criteria, and verifier.

## Production rules

- Generated imagery remains `CONCEPT` until independently reviewed.
- Reconstruct approved logos, icons, and interface graphics as clean deterministic vectors.
- Enforce exact spelling, geometry, viewBox, safe area, minimum size, and requested variants.
- Use lowercase semantic filenames and one unambiguous master.
- Remove hidden raster/vector metadata and excessive SVG precision.
- Provide explicit dimensions and responsive variants for raster files.
- Keep critical/localized copy as live text, not baked into images.
- Never fabricate photographs of real branded products or use unclear web imagery.
- Do not imitate a competitor or identifiable living artist.
- Use dark/light and monochrome variants only when the brief requires them.
- Optimize mobile assets to the budget in `design.md`; reject decorative weight without user value.

## Manifest

Update `docs/brand/ASSET_MANIFEST.md` with:

```text
Asset ID and status:
Purpose and target:
Files, formats, dimensions, and variants:
Source or generation method:
Licence/provenance:
Prompt summary when generated:
Accessibility intent:
Performance size/budget:
Integrated screens:
Creator:
Independent verifier and approver:
```

The producing agent may mark `CONCEPT`, `RECONSTRUCTED`, or `INTEGRATED`; only an independent reviewer may mark `VERIFIED`. Trademark and legal clearance remain separate external decisions.
