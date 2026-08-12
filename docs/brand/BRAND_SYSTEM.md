# FoodOS brand system

Status: **working design direction for product and corporate assets**. Final legal marks require clearance and human approval.

## Brand strategy

FoodOS should feel like quiet household intelligence: fast enough to disappear during capture, clear enough to trust around food and warm enough to use every day.

Brand attributes:

- modern;
- calm;
- precise;
- trustworthy;
- intelligent without shouting AI;
- healthy without medical aesthetics;
- technical without coldness;
- useful rather than aspirationally perfect.

Avoid leaf/fork/brain/robot mashups, neon gradients, generic glassmorphism, fitness-bro visuals, hospital blue, childish illustration and stock-food clichés.

## Direction exploration

### 1. Precision Food System

A modular grid, clear containers and scan-like framing communicate structure and accurate household state.

Strengths: scalable, app-icon friendly, technical credibility.  
Risk: can become sterile if color and language are too rigid.

### 2. Quiet Intelligence

Soft geometry, confident typography and restrained motion make automation feel present but unobtrusive.

Strengths: premium, calm, internationally usable.  
Risk: can become generic without a distinctive symbol.

### 3. Household Flow

A continuous loop connects purchase, storage, meal and shopping without using literal arrows everywhere.

Strengths: communicates the unique product loop.  
Risk: generic circular marks are crowded and need disciplined construction.

## Selected direction

**Quiet Intelligence with a Household Flow symbol.**

The mark is a rounded continuous container made from four implied states: capture, storage, meal and return. A single cut or scan line creates recognizability without drawing a barcode, leaf or utensil literally.

## Product mark

Working symbol: a rounded square/container with an open path and central food-state node. It must remain legible at 16 px and avoid tiny internal details.

Working wordmark: `FoodOS` with exact capitalization. `Food` and `OS` may receive subtle weight differentiation but must remain one word.

Tagline options:

- **Einkauf rein. Essen klar.**
- **Dein Essen. Einfach verstanden.**
- **Was du hast. Was du essen kannst.**

Default German product line: **Einkauf rein. Essen klar.**

## Corporate mark

Until final naming clearance, corporate assets use the neutral placeholder `Calyra Systems — WORKING NAME`. They must never be shipped as a legally cleared mark.

Corporate expression is quieter and more typographic than FoodOS. The company may use the same geometric system but not the consumer app icon unchanged.

## Color roles

| Token | Role | Working value |
|---|---|---|
| `brand.canvas` | dark primary canvas | `#0B100D` |
| `brand.surface` | elevated dark surface | `#131A16` |
| `brand.text` | primary text | `#F3F7F4` |
| `brand.muted` | secondary text | `#A8B4AC` |
| `brand.signal` | primary FoodOS action | `#B8F34A` |
| `brand.signalStrong` | pressed/high-contrast action | `#97D52D` |
| `brand.warm` | food/warmth support | `#F0B86A` |
| `brand.info` | neutral informational state | `#76B9D8` |
| `brand.warning` | caution | `#E4B84F` |
| `brand.danger` | safety/action required | `#E56D66` |

Colors are roles, not decoration. Safety colors must not rely on hue alone and require text/icon/state labels.

## Typography

Use the existing Geist family unless a later licensed corporate typeface is approved.

- Display: Geist Sans, 600–700, compact tracking only at large sizes.
- Interface: Geist Sans, 400–650.
- Numbers and technical evidence: Geist Mono where alignment improves comprehension.
- Avoid all-caps paragraphs and excessive weight changes.

## Shape and spacing

- Rounded geometry communicates approachability, but avoid bubbly cards.
- Primary radius: 16 px on mobile surfaces; 12 px for compact controls; full pills only for statuses or segmented actions.
- Base spacing unit: 4 px with primary rhythm at 8/12/16/24/32.
- Shadows remain subtle; hierarchy should come from spacing, surface and contrast first.

## Icon and image principles

- Use one consistent outline system, currently Lucide-compatible.
- Custom icons are reserved for scan state, inventory confidence, provenance and the brand mark.
- Product photos must be source-backed or explicitly absent.
- Food imagery should show ordinary usable food and real household contexts, not impossible styled abundance.
- Generated illustrations may support onboarding or empty states but must not depict real branded products or safety facts.

## Motion

- Scan success: brief haptic/audio confirmation and a 120–180 ms visual settle.
- Quantity increment: localized count transition, no full-screen celebration.
- Safety warnings: no decorative motion.
- Respect reduced motion and never make motion the only state signal.

## Voice

FoodOS speaks in calm everyday German:

- direct, not robotic;
- explanatory, not judgmental;
- specific about uncertainty;
- never shame-based;
- no universal healthy/unhealthy claims;
- no AI hype in primary consumer copy.

Examples:

- Good: `3 Produkte erkannt. 1 Angabe kurz prüfen.`
- Good: `Passt zu deinem Protein-Ziel. Enthält aber dein persönliches Ausschlussmerkmal.`
- Bad: `KI-Analyse abgeschlossen: Dieser Artikel ist ungesund.`
- Bad: `Perfekt! Du hast heute versagt/gewonnen.`

## Accessibility

- Meet WCAG 2.2 AA contrast for text and interactive states.
- Preserve 44 pt iOS / 48 dp Android targets.
- Every status needs icon/text in addition to color.
- Logos do not replace accessible product names in controls.
- Embedded text in raster artwork is forbidden for essential information.

## Usage rules

- Do not stretch, rotate or recolor the logo outside approved variants.
- Minimum icon clear space is one quarter of its outer width.
- Minimum digital wordmark height is 20 px; icon minimum is 16 px only after optical review.
- Dark and light assets must be tested on actual app and web surfaces.
- Working-name corporate assets require a visible internal-only status until naming approval.
