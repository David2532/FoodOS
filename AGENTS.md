# FoodOS repository instructions

## Product

FoodOS is a Germany-first commercial food inventory product with a Next.js web app and
planned native iOS/Android apps. It covers batch expiry, barcode metadata, personal
ingredient relevance, nutrition, meal planning, and shopping. Keep it calm, fast, and
usable one-handed. Do not call personal relevance a universal harm/safety assessment.

## Commands

- Install: `npm install`
- Develop: `npm run dev`
- Full verification: `npm run verify`
- Individual checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

Run `npm run verify` before handing work back. If a check cannot run, state the exact
reason and do not claim success.

## Engineering constraints

- Preserve working code and unrelated user changes. Inspect `git status` before edits.
- Work in complete vertical slices: understand the user flow, define states and data
  contracts, implement domain logic and persistence, connect the UI, test, then perform
  visual QA before starting the next slice.
- Keep routing/composition, feature UI, domain logic, validation, and data access
  separated. React components must not become the home of database queries or nutrition,
  inventory, GS1, expiry, and risk business rules.
- Prefer small, named modules and reusable primitives over giant page components,
  duplicated JSX, boolean-heavy props, and speculative abstractions. Refactor when a
  second real use case proves the abstraction.
- Represent every async feature explicitly with idle/loading/success/empty/error/offline
  states. Critical multi-step flows must be resumable or fail without partial writes.
- Use strict TypeScript and validate external input with Zod.
- Keep secrets server-side. Never expose a Supabase service-role key or another secret
  through `NEXT_PUBLIC_*` variables.
- Treat Supabase Row Level Security as a required security boundary. Every household
  table must be isolated by membership, require authenticated AAL2, and be covered by
  AAL1/AAL2 and two-household tests or reproducible checks.
- Keep external product data provenance, retrieval time, and confidence. Unknown data
  must stay unknown; never invent nutrition, expiry, ingredients, or risk evidence.
- A normal EAN/UPC barcode usually does not contain an expiry date. Parse GS1 AIs when
  present; otherwise ask for a second package scan/OCR or manual confirmation.
- Treat `plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md` as C0. Recall matching is
  exact/possible/text-candidate/unchecked, source freshness is visible, and an outage can
  never become a clear/safe result. An applicable recall overrides MHD/planning.
- Implement native offline behavior only through the versioned projection/outbox,
  idempotency, revisions, entity-specific conflicts and tombstones in
  `plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md`. Never use silent last-write-wins for
  quantity, date, recall, membership, consent, security or deletion.
- Ingredient ratings must distinguish personal allergens/exclusions, evidence-backed
  concerns, exposure-dependent notes, informational notes, and unknowns. An E-number
  alone is not evidence of harm. Avoid medical claims.
- Prefer small vertical slices with tests over disconnected scaffolding.
- Treat `plans/QUALITY_ENGINEERING_PLAN.md` as binding. Every exported business rule,
  use case, API/RPC/job/webhook, database function/policy, and critical flow branch needs
  meaningful automated coverage or a reviewed expiring exemption. Coverage percentage
  never replaces assertions, mutation tests, integration or E2E evidence.
- Test status is exact: a first-attempt pass is `PASS`; a retry pass is `FLAKY`; missing
  evidence is `NOT_RUN`/`NOT_PROVEN`. Never turn flakes, skips, blocked vendors or stale
  reports into green release evidence.
- Every failure crosses a typed error boundary with flow/correlation/release identifiers.
  Do not log raw objects. Telemetry uses compile-time allowlisted fields and the forbidden
  data rules from `plans/OBSERVABILITY_AND_ERROR_CONSOLE.md`.
- Lost-factor recovery cannot grant AAL2 from email or helpdesk assertion alone. Follow
  the recovery/break-glass and key rules in `plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md`.
- AI/OCR model versions require an approved registry/evaluation/canary/manual fallback.
  Production OTA requires signing, runtime fingerprint, staged guardrails, two-person
  high-risk publish and rollback; runtime services never hold update-publish credentials.
- CEO/finance metrics follow `plans/CEO_CONTROL_CENTER.md`: every card has one versioned
  definition, authoritative source, period/grain, freshness, trust state and reconciliation
  status. Never label estimates as final/booked/filed/paid, use analytics events as
  accounting truth, use floating point for money, or mix sandbox/test and production.
- CEO risk actions follow `plans/CEO_RISK_AUTOMATION.md`: missing/stale survival sources
  are not green; A2 actions are scoped/reversible; legal/tax/insolvency filings,
  medical/food-safety decisions and evidence deletion are never autonomous actions.
- Maintain accessible loading, empty, error, offline, and permission-denied states.
- Treat `plans/UI_UX_PERFORMANCE_PLAN.md` as binding. Use semantic tokens and native
  platform conventions, design compact/medium/expanded layouts deliberately, keep
  scanner/chart/client code lazy, and enforce route/device budgets. Web commercial gates
  are LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at p75; native startup/frame/memory evidence
  must come from release builds on the pinned device matrix.
- Prefer semantic HTML/native controls. Any custom ARIA/native widget must implement its
  full name/role/state, keyboard/focus and assistive-technology contract. Respect 44 pt
  Apple and 48 dp Android targets, large text, reduced motion and focus-not-obscured.
- Do not claim a flow is intuitive or validated from a mockup, automated audit, internal
  dogfooding or funnel alone. Follow `plans/UX_RESEARCH_AND_USABILITY_TESTING.md`, record
  actual observation separately from interpretation and never fabricate participants,
  quotes, task success, willingness-to-pay or research evidence.
- Do not claim a deployment URL until it has been opened and its critical flow verified.
- Treat allergy, intolerance, weight/body goals, nutrition/health profiles, scans, and
  consumption as sensitive. Never send them, GTINs, MHD, product names, or images to ad,
  analytics, crash, URL, or general-log payloads.
- Ads are contextual/non-personalized only and never appear in auth, consent, scanning,
  use-by/MHD, ingredient relevance, nutrition profile, export, deletion, or error flows.
- Keep MHD (quality) and use-by/Verbrauchsdatum (safety for highly perishable food)
  distinct. After use-by, do not recommend consumption; never promise food is safe.
- Native store apps must provide native value and use Apple/Google billing for digital
  premium. A WebView wrapper is not an acceptable implementation shortcut.
- Do not assert worldwide legal compliance. A country stays disabled until its signed
  country pack and the release gates in `legal/` and `plans/APP_STORE_RELEASE_PLAN.md`
  are complete.
- Do not spend into full native/AI/ads/international scope before the current validation
  gate in `plans/COMPETITIVE_RESEARCH_AND_VALIDATION.md` has an evidence-backed
  continue/narrow/pivot/stop decision. Do not fabricate beta or live CEO metrics.

## Assets

- Create any missing original FoodOS UI assets yourself using the available image or
  vector-generation tools. Use generated raster art for brand/empty/onboarding visuals,
  Lucide or authored SVG for interface icons, and real source-backed product images for
  products. Never fabricate a branded product photograph.
- Do not ship placeholders, stock watermarks, copied third-party artwork, base64 blobs in
  components, or inconsistent emoji as final UI assets.
- Keep a coherent visual direction from `design.md`. Crop intentionally, export modern
  web formats and responsive sizes, compress assets, include dimensions and useful alt
  text, and document generation/source notes when relevant.
- Precise diagrams, status icons, charts, barcodes, and data visualizations must be built
  deterministically with SVG/CSS/components, not image generation.

## Source of truth

- Fast orientation and document precedence: `docs/REPOSITORY_MAP.md`
- Product overview and setup: `README.md`
- Product UI and interaction rules: `design.md`
- Adaptive UI, accessibility and performance: `plans/UI_UX_PERFORMANCE_PLAN.md`
- UX research and usability evidence: `plans/UX_RESEARCH_AND_USABILITY_TESTING.md`
- Visual direction and screen catalogue: `mockups/README.md`
- User flows and acceptance paths: `plans/USER_FLOWS.md`
- Architecture boundaries: `plans/ARCHITECTURE_PLAN.md`
- Delivery order and milestone gates: `plans/IMPLEMENTATION_PLAN.md`
- Master critical path: `plans/MASTER_PLAN.md`
- Red-team decisions: `plans/GAP_AUDIT_AND_OPTIMIZATION.md`
- Competitor research and validation: `plans/COMPETITIVE_RESEARCH_AND_VALIDATION.md`
- Food safety and recalls: `plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md`
- Offline synchronization: `plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md`
- Security, AI/OCR and OTA: `plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md`
- Test and release evidence: `plans/QUALITY_ENGINEERING_PLAN.md`
- Required flow/risk coverage: `plans/TEST_TRACEABILITY_MATRIX.md`
- Error console and incidents: `plans/OBSERVABILITY_AND_ERROR_CONSOLE.md`
- CEO, finance, tax and metric truth: `plans/CEO_CONTROL_CENTER.md`
- CEO risk and continuity automation: `plans/CEO_RISK_AUTOMATION.md`
- Internal desktop UI: `design-ceo.md`
- Commercial scope and monetization: `plans/COMMERCIAL_PRODUCT_PLAN.md`
- Authentication and Docker target: `plans/AUTH_AND_SELF_HOSTING.md`
- Store release gates: `plans/APP_STORE_RELEASE_PLAN.md`
- Compliance working register: `legal/COMPLIANCE_MATRIX.md`
- Data processing/retention: `legal/DATA_PROCESSING_REGISTER.md`
- Database schema: `supabase/migrations/`
- Environment contract: `.env.example`
- Product and nutrition calculations: `src/lib/`
- Release decision checklist: `docs/RELEASE_CHECKLIST.md`
- Durable technical decisions: `docs/decisions/`

When schema or setup changes, update the migration, `.env.example`, and `README.md` in
the same change. UI changes must remain consistent with `design.md`; update that file
only when intentionally changing the design system.

Use the issue and draft-PR templates under `.github/`. Do not merge a plan, mockup or
green baseline CI run as proof that production deployment, native stores, complete tests,
legal approval or live business metrics exist.
