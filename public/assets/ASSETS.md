# FoodOS asset manifest

Document every shipped visual asset that is not a third-party product image returned at
runtime. Keep this file synchronized when adding, replacing, or deleting assets.

| File | Purpose | Type/source | Generated or authored | Alt-text behavior | Notes |
|---|---|---|---|---|---|
| `../icon.svg` | Current app/manifest mark | Authored SVG | Existing repository asset | App name supplied by surrounding UI/manifest | Replace only as a complete icon set |
| `mockups/foodos-core-flows.webp` | North-star board for Today, scan result and inventory | Built-in image generation, 2026-08-02 | Generated and iteratively edited; then WebP optimized | Informative description in `mockups/README.md` | Visual direction only; generic packages; 1672×941; 117 KB |
| `mockups/foodos-planning-flows.webp` | North-star board for ingredient assessment, week plan and shopping | Built-in image generation, 2026-08-02 | Generated; then WebP optimized | Informative description in `mockups/README.md` | Visual direction only; 1672×941; 133 KB |

## Rules for new assets

- Record the exact path, screen, source/tool, creation date, and relevant generation
  prompt or authorship note.
- Do not place credentials, private source URLs, or personal data in this manifest.
- Product images obtained dynamically from Open Food Facts remain attributed through
  product metadata and do not need one row per product here.
- Generated assets must be reviewed inside the actual 360 px and 430 px FoodOS screens,
  optimized for the web, and checked for accidental text, watermark-like marks, visual
  artifacts, and misleading product details.

The complete prompts and the authority limitations for the two generated boards are
documented in `mockups/PROMPTS.md`.
