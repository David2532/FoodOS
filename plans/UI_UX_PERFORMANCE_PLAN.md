# FoodOS UI/UX and performance plan

Status: **binding target specification** · Research reviewed: **2026-08-02**

This plan turns “clean, beautiful and fast” into measurable product and engineering
rules. It applies to the consumer PWA, the planned Expo/React Native apps, and shared
design-system work. The internal CEO/Ops application keeps its separate information
density rules in `design-ceo.md`, but follows the same accessibility, state, evidence and
performance discipline.

The current repository is still a functional web prototype. Budgets and native gates in
this document are release targets, not claims about deployed production performance.

## 1. Research decisions

The product adopts the following current platform guidance without copying a platform
demo literally:

| Source | Current signal | FoodOS decision |
|---|---|---|
| [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) and [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Apple uses Liquid Glass as adaptive material for controls and navigation across its platforms | use system/native chrome and materials on Apple platforms; keep dense food content on legible semantic surfaces; never place critical date, recall or ingredient text on uncontrolled translucency |
| [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility) and [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Dynamic Type, reduced motion and a general 44 × 44 pt hit region remain core expectations | test the complete critical path with VoiceOver, maximum useful Dynamic Type sizes and Reduce Motion; all iOS hit regions are at least 44 × 44 pt |
| [Material 3](https://m3.material.io/) and [Material 3 Expressive](https://m3.material.io/blog/building-with-m3-expressive) | expressive color, motion, type and shape are combined with adaptive components | use expression to clarify priority and state, not to decorate every card; use Android-native navigation, motion and controls where they improve familiarity |
| [Android adaptive app guidance](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps?hl=en) | layout decisions follow the current app window and can change navigation or pane count | compact, medium and expanded windows receive deliberate layouts; tablets/foldables do not show a merely stretched phone |
| [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps) | Android recommends at least 48 × 48 dp touch targets and meaningful semantics | Android interactive targets are at least 48 × 48 dp; custom controls receive role, name, state and action semantics |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | new AA criteria cover obscured focus, dragging alternatives, 24 CSS px minimum targets and accessible authentication | web target is WCAG 2.2 AA; FoodOS deliberately exceeds the 24 CSS px target minimum for primary touch controls and preserves password-manager/paste support in auth and 2FA |
| [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) | custom widgets must implement the semantics and keyboard behavior promised by their role | prefer native HTML; use an APG pattern only when a native element cannot satisfy the need; a role without the complete interaction contract is a defect |
| [Core Web Vitals](https://web.dev/articles/vitals) | good field thresholds are LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 at the 75th percentile, split by mobile and desktop | these three field thresholds are commercial web release gates; averages cannot hide slow cohorts |
| [Next.js image optimization](https://nextjs.org/docs/app/getting-started/images), [font optimization](https://nextjs.org/docs/app/getting-started/fonts) and [lazy loading](https://nextjs.org/docs/app/guides/lazy-loading) | responsive images, self-hosted/optimized fonts and deferred client code reduce load cost and layout shift | define image dimensions, use `next/image`, use `next/font`, keep server-rendered UI as the default and lazy-load camera/scanner, charts and other heavy client-only features |
| [React Native performance](https://reactnative.dev/docs/performance) | a 60 Hz device gives roughly 16.67 ms per frame and JS/UI work can independently cause dropped frames | performance is tested in release builds on representative low/mid devices; scanning, OCR, parsing and large-list work cannot block interaction/animation frames |
| [Android vitals](https://developer.android.com/topic/performance/vitals) | user-perceived crashes, ANRs, rendering, startup, battery and permission behavior affect quality and Play visibility | CEO/Ops ingests Android vitals by release and device model; regressions block or pause rollout instead of being averaged away |
| [GOV.UK moderated usability testing](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) | research begins with explicit questions, user groups and prototype areas; sessions are normally 30–60 minutes | every major flow gets task-based usability evidence before commercial rollout; details live in `UX_RESEARCH_AND_USABILITY_TESTING.md` |

The current Design Tokens Community Group format is watched for interoperability, but
the [2026 preview draft explicitly says not to implement it as authoritative](https://www.designtokens.org/tr/drafts/format/).
FoodOS therefore owns a small versioned token schema and adds an adapter only against a
stable published format.

## 2. Product experience contract

FoodOS must feel faster than the underlying network and calmer than the data complexity.
The experience contract is:

1. The screen answers one user question and has one dominant action.
2. Cached or local truth appears immediately with freshness and sync state; the app does
   not erase useful content behind a global spinner.
3. Unknown, stale and low-confidence data stay visible as such.
4. A confirmed action produces a durable local or server result, not merely a green
   animation.
5. Error recovery preserves input and explains the next action at the point of failure.
6. Critical safety, privacy and financial meaning is never encoded by color, animation or
   icon alone.
7. Platform conventions are respected where they improve predictability, while FoodOS
   color, type hierarchy, content semantics and tone remain coherent.

“Clean” does not mean empty. It means a clear hierarchy, stable alignment, few competing
actions, honest state and no decorative information debt.

## 3. Platform and adaptive strategy

Layout decisions use the available window, safe areas, font scale, input method and
content length, never a guessed device name.

| Window class | Consumer navigation | Content model | Required proof |
|---|---|---|---|
| Compact `< 600 px` | bottom navigation with central scan action | one primary pane; sheets for short decisions | 320/360/390/430 px, portrait and landscape, keyboard open |
| Medium `600–839 px` | platform-appropriate navigation rail or compact sidebar | one generous pane or list plus supporting pane when it preserves context | tablet/foldable resize, pointer, keyboard, 200% web zoom |
| Expanded `≥ 840 px` | navigation rail/sidebar; no stretched bottom bar | list-detail for inventory/product and plan/detail where useful; bounded line lengths | desktop browser, iPad/Android tablet, split-window transitions |

The companion web app is not turned into an unrelated analytics dashboard. Expanded
layouts may expose a second relevant pane, but preserve the five consumer destinations
and the same task order. The CEO/Ops interface is a separate authenticated product.

### Apple surfaces

- Use native tab/sidebar, navigation, sheet, menu, search, date and permission patterns
  through the selected React Native/Expo primitives.
- Liquid Glass belongs primarily to app chrome and interactive layers. Critical content
  must retain readable contrast under light/dark, increased contrast, reduced
  transparency and different wallpaper/background conditions.
- Use SF Symbols or FoodOS-authored vectors with accessible labels; do not rasterize
  system controls into cross-platform imitations.
- Support Dynamic Type through semantic text roles and reflow. Do not clamp a critical
  warning, button label or date status to a single line to save a layout.

### Android surfaces

- Use Material 3/Android navigation and system controls, including predictable back and
  permission behavior.
- Expressive shapes, motion and color may emphasize the scan action, completion or a
  selected state, but warning hierarchy remains semantic and calm.
- Use current window size classes and preserve the task when folding, rotating or
  resizing. A layout change must not reset a scan result, date confirmation or form.
- Support touch, keyboard, mouse/trackpad and accessibility services on large screens.

### Web/PWA surfaces

- Server Components and semantic HTML are the default; add a Client Component only for
  actual browser state, camera, drag/drop, animation or interaction needs.
- Every route remains usable with keyboard and browser zoom; camera flows always include
  manual barcode entry and accessible file/manual alternatives where possible.
- Sticky top/bottom UI may not obscure focused controls, errors, consent choices or the
  final action when the virtual keyboard is open.

## 4. Design-system architecture

The design system has four layers:

1. **Primitive tokens:** raw color, spacing, radius, type and motion values.
2. **Semantic tokens:** `surface/default`, `text/muted`, `status/recall`,
   `action/primary`, `focus/ring`, `motion/standard`.
3. **Component tokens:** button height, field border, navigation background, card gap.
4. **Recipes/components:** named variants with accessibility and state behavior.

Rules:

- Components consume semantic/component tokens, not random hex or pixel values.
- Dark and light/high-contrast themes remap semantic tokens; they do not fork component
  markup.
- Status tokens include foreground, background, border, icon and wording. “Red” alone is
  never a status contract.
- Platform overrides are narrow: hit target, font mapping, system material, safe area,
  haptic and native transition. Business meaning is shared.
- Token changes include visual regression evidence across affected components and states.
- Component APIs use named variants and slots. Avoid boolean combinations such as
  `warning`, `urgent`, `compact`, `danger`, `special` that create undefined states.

### Minimum shared component catalogue

| Component | Required variants/states |
|---|---|
| App shell/navigation | compact/rail/sidebar; safe area; offline; AAL1 blocked |
| Button/icon button | primary/secondary/quiet/destructive; loading; disabled with reason; focus; pressed |
| Field/date/unit input | default/focus/error/read-only; hint; retained invalid value; keyboard/input mode |
| Product row/card | image/fallback; long name; quantity; date; recall; sync; unknown source |
| Status banner | info/warning/critical/success; source/freshness; action; live-region policy |
| Bottom sheet/dialog | initial focus; escape/back; focus return; destructive confirmation; keyboard avoidance |
| Toast/inline result | polite/urgent announcement; undo when safe; no critical detail only in transient UI |
| Skeleton/progress | stable geometry; named task progress; reduced-motion behavior |
| Ad slot | explicit “Anzeige”; reserved geometry; no personalized context; collapsed cleanly on failure |

## 5. State-first screen contract

Each networked or device-dependent screen defines relevant states before implementation:

| State | UI obligation | Forbidden shortcut |
|---|---|---|
| Initial/idle | show the next useful action and prerequisites | empty white/dark shell with no explanation |
| Loading | preserve stable shell/cached content; show local progress | route-wide spinner for a local subtask |
| Empty | explain why and provide the primary creation/scan action | treating empty as an error |
| Success | name what was persisted and where; offer the next action | success animation before durable confirmation |
| Recoverable error | retain input, state cause in plain language, offer retry/fallback | “Something went wrong” without recovery |
| Offline | show local truth, freshness and which actions queue or require network | pretending stale remote data is current |
| Stale/unknown | label source, retrieved time and consequence | converting missing values to zero or green |
| Permission denied | explain system recovery plus a functional alternative | permission request loop |
| Conflict/rejected | compare relevant values and consequence; keep durable intent | silent last-write-wins or endless retry |
| Destructive | identify object and consequence; require deliberate confirmation | ambiguous “OK” or irreversible swipe-only action |

State behavior is shared between design, domain state machine, tests, telemetry and
support copy. If those disagree, the slice is not done.

## 6. Interaction, forms and motion

- Visible response begins on the same frame as an interaction where possible. Network
  completion is represented separately from pressed/loading feedback.
- Optimistic updates are allowed only when reversible or backed by the durable outbox.
  Use-by/recall status, deletion, membership, consent, billing and security changes are
  never presented as final before authoritative confirmation.
- Use one clear error summary on longer web forms and an inline message beside each
  field. Preserve both valid and invalid user input, following the principle in the
  [GOV.UK error-message guidance](https://design-system.service.gov.uk/components/error-message/).
- Dates use explicit day/month/year or a locale-correct native picker plus a visible
  absolute date. MHD and use-by type are separate choices; relative wording supplements
  rather than replaces the date.
- Drag, swipe, long press and camera are accelerators. Every action has a visible,
  keyboard/screen-reader-operable alternative.
- Motion communicates hierarchy or continuity. Standard movement remains short and
  interruptible; no essential information appears only during animation.
- Respect Reduce Motion on every platform. Replace large transforms, parallax and
  continuous scanner decoration with a fade or static state while preserving feedback.
- Haptics are sparse and platform-native: scan acquired, confirmed success or critical
  failure only. They never replace visual/spoken feedback.

## 7. Accessibility release contract

### Web

- WCAG 2.2 AA is the minimum conformance target for the tested scope.
- Use native HTML first; custom widgets follow the matching APG semantics and keyboard
  model and are tested with real assistive technology.
- Primary touch controls target at least 44 × 44 CSS px even though WCAG 2.2 criterion
  2.5.8 permits 24 × 24 CSS px with exceptions. Dense desktop-only secondary controls
  may use the normative minimum only with sufficient spacing and documented rationale.
- Focus is visible, ordered and not completely hidden by sticky UI. Opening/closing a
  dialog or sheet moves and returns focus predictably.
- Auth/2FA permits paste, password managers and platform autofill. Do not introduce a
  memory puzzle, forced transcription or CAPTCHA without an accessible alternative.
- At 200% zoom, core flows reflow without horizontal page scrolling; data tables may use
  a labelled local scroll region when unavoidable.

### Native

- iOS targets are at least 44 × 44 pt; Android targets at least 48 × 48 dp.
- VoiceOver and TalkBack receive a concise name, role, value/state and action result.
- Test switch/keyboard navigation, Voice Control where applicable, bold/larger text,
  increased contrast, dark mode and Reduce Motion.
- Critical product status is announced once at the right priority. Do not turn changing
  calorie progress or scanner frames into a noisy live feed.
- Accessibility nutrition/data declarations in the stores reflect tested behavior for
  the exact released binary, not design intent.

### Content

- German labels are plain, specific and verb-led. Avoid guilt, fear and medical certainty.
- Ingredient ordering is described as personal relevance, not universal harmfulness.
- Recall and use-by copy gives the official source, match quality and next safe action
  without promising safety.
- Icons, colors, position and motion never carry unique meaning without text or an
  equivalent accessible name.

## 8. Web performance budgets

Core Web Vitals are evaluated with real-user monitoring at p75 for mobile and desktop.
Lab tests protect pre-production; they do not replace field evidence.

### External release gates

| Metric | Good threshold | Gate |
|---|---:|---|
| LCP | `≤ 2.5 s` | p75 mobile and desktop for each critical route family |
| INP | `≤ 200 ms` | p75 mobile and desktop; inspect tails and interaction type |
| CLS | `≤ 0.1` | p75; includes late ad, image, font and sync-status shifts |

### Initial engineering budgets

These are FoodOS starting budgets, not universal standards. Establish a measured
baseline in Stage 0Q, tighten them when evidence supports it, and require an owner,
rationale and expiry for every exception.

| Asset/work | Initial budget | Implementation rule |
|---|---:|---|
| initial client JS: auth/public route | `≤ 170 KB gzip` | server-render by default; no scanner/chart code |
| initial client JS: authenticated core route | `≤ 220 KB gzip` | route-specific code split; shared shell stays small |
| scanner/camera/OCR JS | separate lazy chunk | load on intent/idle near Scan, never in Today/Inventory startup path |
| route JSON/RSC payload | `≤ 80 KB gzip` for typical first view | paginate/project fields; no raw provider object |
| ordinary illustrative image | `≤ 150 KB` | responsive AVIF/WebP, explicit dimensions |
| LCP image on consumer route | `≤ 200 KB` at target viewport | preloaded only when actually the LCP candidate |
| fonts | one primary variable family plus fallback | subset and load through `next/font`; no blocking external font request |
| long main-thread task | none above `50 ms` in standard lab flow | split parsing/render work; record attribution |

Additional rules:

- Reserve dimensions for images, skeletons and permitted ad inventory to prevent CLS.
- Do not preload everything. Preload only the route-critical font/image/data proven by a
  trace.
- Cache product-provider responses with provenance and freshness; never cache a false
  “clear” recall state beyond source validity.
- Virtualize inventory/shopping lists when device traces show DOM/render cost, while
  retaining screen-reader usability and search/filter access.
- Send Core Web Vitals using a privacy allowlist: route template, release, device/network
  class and metric are allowed; identity, GTIN, product, date, nutrition and household
  fields are forbidden.

## 9. Native performance and device-quality budgets

All performance measurements use production/release builds. Developer mode numbers are
diagnostic only.

| Area | Initial FoodOS target | Hard stop/diagnostic |
|---|---|---|
| cold TTID | p75 `≤ 2.5 s` on the reference mid-range device | Android vitals marks `≥ 5 s` cold startup excessive; do not use that boundary as the product target |
| warm TTID | p75 `≤ 1.0 s` | investigate before Android's `≥ 2 s` excessive boundary |
| hot TTID | p75 `≤ 0.7 s` | investigate before Android's `≥ 1.5 s` excessive boundary |
| interactive animation/scroll | meet the device refresh budget for at least 99% of measured frames in critical flows | any frame `> 700 ms` is a release-blocking frozen-frame defect |
| scan-result interaction | feedback visible immediately; result UI usable within `≤ 300 ms` after local decode p75 | product lookup may continue with explicit state |
| memory | baseline p50/p90 by flow and device; no sustained growth after 20 scan/detail cycles | leak, OOM/LMK or retained camera buffer blocks rollout |
| battery/network | camera and background sync active only for declared task; bounded retry/backoff | wake-lock, retry storm or background transfer without user value blocks release |

Reference devices and OS versions are pinned per release. The matrix includes the oldest
supported iPhone, one current iPhone, a low/mid Android with 4 GB-class memory, a current
Pixel/Samsung, one tablet/foldable profile and poor network/offline conditions.

Implementation rules:

- Keep the camera preview and gesture/animation work off overloaded JS paths.
- Parse barcodes deterministically and move OCR/image processing off the interaction
  thread; bound image resolution before processing or upload.
- Release camera, image and subscription resources on blur/background/unmount.
- Avoid large anonymous object graphs and raw provider payloads in app state.
- Paginate and incrementally render inventory. Memoization follows measured render cost,
  not superstition.
- Track crash, ANR, startup, frozen/slow frames, memory and permission denial by app
  version/device; a green average cannot hide a broken device cohort.

## 10. Measurement architecture

### Development and CI

- component tests prove state, keyboard and accessibility behavior;
- Storybook or an equivalent deterministic component harness is introduced before the
  shared design-system package is extracted;
- Playwright captures screenshots for the defined viewport/state matrix;
- axe or equivalent automation catches mechanical web accessibility defects, followed by
  manual keyboard and screen-reader checks;
- Lighthouse CI runs representative public/authenticated fixtures with budgets;
- Next bundle output is stored and diffed; a budget regression cannot disappear in logs;
- native release builds run startup/frame/memory scenarios with a pinned test fixture;
- visual snapshots are reviewed for intended change, not blindly updated.

### Production

- collect Core Web Vitals and native vitals with release and route/flow identifiers;
- sample enough for diagnosis while respecting consent and the forbidden-field policy;
- measure task milestones such as `scan_started`, `local_code_decoded`,
  `product_result_rendered`, `batch_confirmed` as coarse timing events only;
- keep business/product timings free of product identity, code, dates, diet and health;
- CEO/Ops shows p50/p75/p95, sample coverage, source freshness and affected releases;
- alert on sustained regression and use staged rollout/kill switches rather than waiting
  for store reviews to accumulate.

## 11. UI quality workflow

For every vertical slice:

1. Link the issue to a flow ID, risk class and user problem.
2. Write the state table, data contract, accessibility names and failure recovery before
   polishing pixels.
3. Build with existing tokens/primitives. Add a new variant only when its semantic role
   is distinct.
4. Prove domain/persistence behavior, then connect UI feedback to the authoritative state.
5. Run automated tests and capture compact/expanded, light/dark where supported, long
   German text, empty/error/offline and max-text states.
6. Perform keyboard plus VoiceOver/TalkBack smoke checks for critical flow changes.
7. Record bundle/vital impact, privacy/network diff and screenshots in the PR.
8. Run a usability round for a new or materially changed critical flow before release.

No PR may be approved on a mockup screenshot alone.

## 12. Named performance and UX tests

| Test ID | Assertion | Risk |
|---|---|---|
| `Q-UX-PRIMARY-ACTION-E2E-001` | each critical screen exposes one unambiguous primary action and preserves it above safe area/keyboard | C2 |
| `Q-A11Y-FOCUS-WEB-001` | sticky chrome never fully obscures keyboard focus or the associated error | C2 |
| `Q-A11Y-AUTH-WEB-002` | password/TOTP paste, manager/autofill and non-cognitive recovery path work | C1 |
| `Q-A11Y-TARGET-MOBILE-003` | all critical iOS/Android controls meet 44 pt/48 dp target rules | C2 |
| `Q-A11Y-SCREENREADER-MOBILE-004` | F01–F08 expose correct name/role/state/order and action result | C1 |
| `Q-PERF-CWV-RUM-001` | LCP/INP/CLS meet good thresholds at p75 for critical web route families | C2 |
| `Q-PERF-BUNDLE-CI-002` | initial route and lazy scanner chunks remain within approved budgets | C2 |
| `Q-PERF-NATIVE-START-003` | reference-device TTID meets FoodOS targets for the release build | C2 |
| `Q-PERF-NATIVE-FRAME-004` | critical scroll/scan/plan flows meet frame target with zero frozen frames | C1 |
| `Q-PERF-AD-CLS-WEB-005` | permitted ad success/failure/timeout never pushes core content beyond CLS budget | C2 |
| `Q-UX-OFFLINE-STATE-E2E-006` | cached/local/pending/conflict/rejected states remain distinct and actionable | C1 |

These IDs are added to `TEST_TRACEABILITY_MATRIX.md` and the machine-readable registry
when implemented.

## 13. Release gate

UI/UX/performance is releasable only when:

- the critical flows pass task-based usability review with no unresolved critical issue;
- WCAG 2.2 AA web evidence and native assistive-technology evidence match the release;
- compact, medium and expanded layouts preserve task state and do not overflow;
- Core Web Vitals meet the external gates with sufficient field coverage, or a limited
  beta remains explicitly labelled unproven while gathering data;
- web bundle and native startup/frame/memory budgets pass on the pinned device matrix;
- ads, analytics and telemetry add no forbidden data and no critical-flow interruption;
- every exception has an owner, impact, compensating control and expiry;
- screenshots, traces, bundle report, accessibility results and usability findings are
  bound to the same commit/artifact as the release decision.
