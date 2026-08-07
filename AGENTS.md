# FoodOS repository instructions

## Agent governance and precedence

For agent roles, departments, delegation, capabilities, capacity classes, approvals and
separation of duties, the authoritative sources are:

1. `config/agent-company.json` — machine-readable governance registry;
2. `docs/agent/COMPANY_AGENT_OPERATING_MODEL.md` — company structure and authority;
3. `docs/agent/WORKER_EXECUTION_CONTRACT.md` — execution rules for short-lived workers.

The project-scoped Codex runtime is the checked-in projection of that model:

- `.codex/config.toml` — concurrency and project tool defaults;
- `.codex/agents/*.toml` — narrow custom subagents;
- `.agents/skills/*/SKILL.md` — progressively loaded repeatable workflows;
- `docs/agent/CODEX_UI_AGENT_ARCHITECTURE.md` — UI/asset dispatch and tool policy;
- `docs/agent/UI_AND_ASSET_AGENT_CONTRACT.md` — separation of duties for design work.

Run `npm run agent:validate-company` whenever the registry, governance, custom agents,
repo skills or agent runtime changes. The validator is part of `npm run verify` and rejects
missing required roles, legacy super-agent identifiers, self-approval, weakened C0/C1
protection, incomplete assurance, invalid UI-agent files, missing skills or forbidden-
action removal.

Older prompts, diagrams, plans, issue text and chat-derived documents are contextual only.
They do not override this governance model. In particular, `CODEX_PROMPT.md` is a
multi-stage product build brief, not an authority or organisation definition. Do not
reintroduce a Chief-of-Staff, master-agent or super-agent above the AI CEO, and do not make
the Executive Orchestrator an implementer or self-approver.

Precedence is:

1. law, explicit human authorization and platform permissions;
2. repository security, privacy, food-safety and evidence invariants in this file and the
   specialist documents selected by the active scope;
3. the company agent governance sources listed above;
4. scope-specific implementation plans and design documents;
5. legacy prompts, mockups and informal diagrams.

Load the company operating model only for governance, cross-department routing, approval,
capacity, agent-operation or Company Command Center work. Normal bounded coding tasks still
start with the selected repository scope to avoid wasting context.

## Start and scope routing

FoodOS is a Germany-first food inventory product handling private household and
safety-adjacent food data. Preserve its calm, fast, one-handed mobile experience.

For every task:

1. Run `git status --short --branch` and preserve unrelated changes.
2. Run `npm run agent:context -- <scope>` (`--list` shows valid scopes).
3. Read only the files printed for that scope, plus directly edited files.
4. Implement the smallest cohesive vertical slice.
5. Run `npm run verify:changed`; broaden checks only when its output or risk requires it.

Do not routinely read every file under `plans/`, `legal/`, `mockups/`,
`docs/decisions/` or `docs/evidence/`. Their specialist rules remain binding when the
selected scope names them. `CODEX_PROMPT.md` is only a start point when the user
explicitly requests the complete multi-stage build; it is not required for normal tasks.

## Commands

- Install locked dependencies: `npm ci`
- Develop: `npm run dev`
- List scopes: `npm run agent:context -- --list`
- Scope context: `npm run agent:context -- <scope>`
- Validate company-agent governance: `npm run agent:validate-company`
- Changed verification: `npm run verify:changed -- --base=<ref>`
- Unit tests: `npm run test:unit`
- Related unit tests: `npm run test:unit:changed -- <files...>`
- Database/pgTAP: `npm run test:db`
- Preview E2E: `npm run test:e2e`
- Authenticated E2E: `npm run test:e2e:auth`
- Full verification: `npm run verify:full`
- Safe migration frame: `npm run migration:new -- <snake_case_name>`

Use `verify:full` before handoff when shared configuration, routing, dependencies,
security-critical boundaries or several scopes changed. A missing Docker, Supabase,
browser or external service is `BLOCKED`, never `PASS`.

## Architecture boundaries

- `src/app`: routing, layouts, route handlers and composition.
- `src/features`: feature-specific UI and orchestration.
- `src/components`: shared consumer UI.
- `src/domain`: deterministic business and safety rules.
- `src/contracts`: validated boundary contracts.
- `src/infrastructure`: providers, repositories and persistence adapters.
- `src/lib`: shared pure helpers and server/client integration utilities.
- `supabase/migrations`: forward-only database history.
- `supabase/tests`: pgTAP, RLS and database boundary proof.
- `scripts`: operational and developer automation.

Keep business rules out of React components and route handlers. Components do not issue
distributed table queries. Validate external input as `unknown` with Zod or an explicit
runtime schema. Keep async idle/loading/success/empty/error/offline/permission states
explicit. Prefer small named modules over speculative framework layers.

## Trust boundaries

- Never commit secrets, tokens, private exports or real user data.
- Never expose service-role or secret keys through `NEXT_PUBLIC_*`.
- Private household data requires authenticated AAL2 at API and RLS boundaries.
- `TO authenticated` alone is not tenant authorization; prove membership/ownership.
- Test anonymous, AAL1, AAL2, second-household and removed-member cases when affected.
- Security-definer functions stay private where possible, pin `search_path`, validate
  caller/role, and revoke default `PUBLIC` execution.
- Lost-factor recovery cannot grant AAL2 from email or helpdesk assertion alone.
- Sensitive data includes identity, household, health/body goals, nutrition, allergens,
  scans, GTIN, product image/name, MHD/use-by, lot and consumption.
- Sensitive values never enter URLs, general logs, analytics, ads, crash payloads or PR
  evidence. Telemetry uses compile-time allowlisted fields.
- Ads are contextual only and absent from auth, consent, scan, expiry, nutrition,
  export, deletion and error flows.

## Food-safety invariants

- Keep MHD (quality) distinct from use-by/Verbrauchsdatum (safety).
- After use-by, never recommend consumption or claim food is safe.
- A normal EAN/UPC does not contain expiry; parse GS1 AIs only when present and otherwise
  require a second scan/OCR or manual confirmation.
- Recall states remain exact, possible, text candidate or unchecked/stale.
- A recall outage or stale source never becomes clear/safe.
- An applicable recall overrides MHD and planning.
- Unknown nutrition, ingredient, expiry, source or confidence remains unknown.
- Product data retains provenance, retrieval time and confidence.
- Personal relevance is not universal harm: distinguish allergens/exclusions,
  evidence-backed concerns, exposure notes, information and unknowns.
- An E-number alone is not evidence of harm; do not make medical claims.

Read `plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md` for recall, expiry or ingredient
safety changes. Those C0 rules override prototype behavior and mockups.

## Data and migrations

- Shared migrations are immutable and forward-only; never rewrite applied history.
- Create new files with `npm run migration:new -- <name>` or the current Supabase CLI.
- Design expand/contract compatibility and recovery before destructive changes.
- Multi-record confirmed intent is transactional and idempotent with payload identity.
- Offline quantity, date, recall, membership, consent, security and deletion conflicts
  never use silent last-write-wins.
- Update migration, grants/RLS, pgTAP, generated contracts, environment documentation
  and runbook together when their contract changes.
- Do not apply migrations or touch Production unless the task explicitly authorizes it.

## UI, accessibility and performance

- Follow `design.md` and the UI scope output for intentional UI changes.
- Preserve the four canonical consumer destinations: Heute, Erfassen, Vorrat and Planen.
- Preserve semantic tokens and compact/medium/expanded behavior.
- Prefer semantic HTML and native controls; custom widgets implement complete keyboard,
  focus, name/role/state and assistive-technology contracts.
- Respect 44 pt iOS and 48 dp Android targets, large text and reduced motion.
- Keep scanner, OCR, chart and other heavy client code lazy.
- Use real source-backed product images; never fabricate branded product photography.
- Mockups, Figma and generated UI are visual inputs, not authority for data, risk, dates,
  navigation or production code.

For a material new or redesigned flow, use the narrow native chain:

```text
ui_explorer
-> ux_flow_designer with $foodos-ui-flow-spec
-> ui_system_architect
-> ui_implementer with $foodos-ui-implementation
-> $foodos-ui-quality-review dispatches required independent lanes:
   interaction_verifier
   accessibility_verifier
   visual_verifier with $foodos-visual-qa
-> findings -> ui_implementer fix -> originating-verifier retest
```

Do not spawn every design or quality agent for a tiny style fix. Do not run implementation
and verification in the same agent. Verifiers may write only assigned privacy-safe
evidence, not reviewed product/test/configuration code. The implementer cannot close its
own finding; the originating verifier retests the new exact commit. Asset work starts with
`asset_art_director`; image generation is concept-only and production files follow
`$foodos-asset-production` plus independent verification. A generated project, screenshot
or image never replaces `design.md`, real components or browser evidence.

## Evidence and delivery

- Status vocabulary is exact: `PASS`, `FAIL`, `FLAKY`, `BLOCKED`, `NOT_RUN`.
- A retry pass is `FLAKY`; a skip, stale artifact or unavailable service is not green.
- Never fabricate tests, users, interviews, revenue, legal approval or deployment URLs.
- Do not claim usability from mockups or automated audits alone.
- Do not claim deployment until the exact URL and critical flow were opened and checked.
- Production, native stores, legal approval and commercial release are separate facts.
- CEO/finance values retain source, period, freshness and trust state. Estimates are not
  booked, reconciled, filed or paid; money uses integer minor units/decimal.
- Country support stays disabled until its signed legal/release pack is approved.
- Native store apps need native value and platform billing; a WebView wrapper is not a
  release implementation.

Stage only files belonging to the task. Use the handoff structure in
`docs/agent/HANDOFF_TEMPLATE.md`. Keep the final report tied to the exact commit and
commands actually run.
