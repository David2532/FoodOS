# FoodOS Codex UI-agent architecture

Status: **binding runtime architecture for Codex-led UI and asset work**.  
Research date: **2026-08-06**.

## Decision

FoodOS uses three complementary layers instead of one giant design prompt:

1. **`design.md`** — durable FoodOS design contract: hierarchy, navigation, tokens, component recipes, states, accessibility, asset direction and acceptance gates.
2. **Project custom agents in `.codex/agents/`** — narrow roles with different read/write boundaries for exploration, UX, system design, implementation, assets and independent verification.
3. **Repo skills in `.agents/skills/`** — reusable procedures that Codex loads only when their description matches or the user invokes them explicitly.

A role listed only in a company diagram or JSON registry is not enough to make Codex behave as that specialist. The native runtime files make the intended roles discoverable and enforceable in local Codex sessions.

## Why this structure

OpenAI's Codex documentation recommends project-scoped custom agents under `.codex/agents/`. Each agent requires a name, description and developer instructions, and the strongest definitions are narrow and opinionated with a tool/sandbox surface that matches the job. Subagents are useful for independent exploration, verification and implementation work, but they consume additional tokens and should not be spawned as an always-on swarm.

OpenAI's skill system uses progressive disclosure: Codex initially sees only each skill's name, description and path, then loads the full `SKILL.md` only when selected. Repo-scoped skills live under `.agents/skills`. This makes a small set of focused UI procedures more efficient than adding the full design manual to every prompt.

Official references:

- https://developers.openai.com/codex/subagents/
- https://developers.openai.com/codex/skills/
- https://github.com/openai/skills/tree/main/skills/.curated/frontend-skill

## Native FoodOS agents

| Agent | Write access | Primary job | Must not do |
|---|---|---|---|
| `ui_explorer` | read-only | map real code, tokens, states, tests and contradictions | design or edit |
| `ux_flow_designer` | read-only | produce minimal state-complete interaction brief | write code or styling |
| `ui_system_architect` | read-only | map components, tokens, responsive composition and boundaries | create a second design system |
| `ui_implementer` | workspace write | implement the smallest approved complete slice | approve its own work or broaden scope |
| `visual_verifier` | evidence write only by contract | reproduce UI, screenshots, accessibility and runtime result | silently fix reviewed code |
| `asset_art_director` | read-only | decide whether an asset is needed and issue a brief | generate or approve assets |
| `image_concept_artist` | workspace write | produce original illustrative concepts from an approved brief | create final logos/icons or product photos |
| `asset_producer` | workspace write | reconstruct/export clean production vectors and update manifest | self-verify or claim legal clearance |

Project concurrency is capped at four spawned threads. This is enough for independent mapping, UX, documentation research or verification while limiting conflicting writes and unnecessary usage.

## Repo skills

| Skill | Trigger | Output |
|---|---|---|
| `$foodos-ui-flow-spec` | material new/redesigned user flow | implementation-ready UX brief |
| `$foodos-ui-implementation` | approved FoodOS UI slice | bounded responsive code and tests |
| `$foodos-visual-qa` | UI/asset implementation complete | reproducible browser/a11y/visual evidence |
| `$foodos-asset-production` | approved logo/icon/illustration/export need | asset files, variants and manifest update |

Skills are procedural and narrow. They do not duplicate the full product plan or `design.md`.

## Standard dispatch patterns

### New or materially changed consumer flow

```text
ui_explorer
-> ux_flow_designer using $foodos-ui-flow-spec
-> CPO accepts the flow direction
-> ui_system_architect
-> ui_implementer using $foodos-ui-implementation
-> visual_verifier using $foodos-visual-qa
-> CPO + relevant assurance/release approval
```

Mapping and UX may run in parallel only when neither depends on the other's output. UI architecture follows the accepted flow. Implementation and visual verification remain sequential and independent.

### Small visual defect with unchanged behavior

```text
ui_explorer or existing reproduction
-> ui_implementer
-> visual_verifier
```

Do not invoke every design agent for a two-line spacing fix.

### New illustration or brand asset

```text
asset_art_director
-> CPO/CMO accepts brief
-> image_concept_artist when illustration exploration is justified
   OR asset_producer directly for deterministic SVG/CSS
-> asset_producer reconstructs/exports
-> visual_verifier + accessibility review in intended context
-> CPO/CMO approval
```

A generated image is never a final logo or UI icon by itself.

## `design.md` contract

`design.md` is not a long role prompt and not a screenshot gallery. It should remain the canonical design decision file for the repository and contain:

- product feeling and hierarchy;
- canonical information architecture;
- semantic token roles and code source of truth;
- component recipes rather than one-off screens;
- state and safety presentation;
- compact/medium/expanded behavior;
- asset medium decision rules;
- accessibility and performance budgets;
- forbidden patterns;
- screenshot/state matrix and UI Definition of Done.

External examples may inform a bounded decision, but they do not override FoodOS product, safety or token rules.

## Tool policy

### Figma

Figma is useful when an approved native design exists. Prefer structured Figma context, variables and component mappings through Figma MCP/Code Connect over a screenshot alone. FoodOS does not require Figma to begin: the code, tokens, `design.md`, flows and browser evidence remain sufficient and authoritative.

References:

- https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Dev-Mode-MCP-Server
- https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect

### v0

v0 can rapidly explore a component or visual concept and can import Figma/screenshots. Its output is a proposal, not an authority. Do not paste a full generated project over FoodOS. Pull only reviewed ideas or bounded source after reconciling them with existing tokens, dependencies, domain contracts, accessibility and performance.

Reference: https://v0.dev/docs

### shadcn/ui

shadcn is source-owned rather than a black-box component package and can be useful for a reviewed missing primitive or later FoodOS registry. Do not blindly run `init`, `add --all`, overwrite existing components or migrate the primitive base. Use `view`, `docs`, `--dry-run` and `--diff` first. FoodOS should first reuse its existing primitives; a private registry becomes useful only when the component set stabilizes.

Reference: https://ui.shadcn.com/docs

### Storybook

Storybook becomes valuable when FoodOS has a stable shared component set and needs isolated state stories, interaction tests, accessibility checks and visual regression across many consumers. It is not required before the first capture-flow slice. Avoid adding it only to create another maintenance surface.

References:

- https://storybook.js.org/docs/writing-stories
- https://storybook.js.org/docs/writing-tests/visual-testing

### Browser and Playwright

The rendered product is the visual source of truth. Every material UI change needs real browser verification, runtime/console checks, responsive screenshots and interaction evidence. Use Playwright screenshot comparison only in a stable controlled environment; platform/font/rendering differences can otherwise create noisy diffs.

References:

- https://playwright.dev/docs/test-snapshots
- https://playwright.dev/docs/screenshots

### Image generation

Use image generation for original illustrative concepts and visual exploration when a brief proves an image helps. Prefer SVG/CSS for interface graphics, logos, icons, diagrams, scanner frames and charts. Never fabricate a real branded product photograph.

## Quality loop

A good design agent does not merely output prettier JSX. The complete loop is:

```text
product outcome
-> current-state evidence
-> interaction hypothesis
-> component/token system
-> bounded implementation
-> browser and accessibility evidence
-> user validation for material behavior
-> reusable decision captured in code/design.md
```

Visual quality is measured by task clarity, consistency, state completeness, accessibility, performance and repeatable user success—not by gradients, card count or generated imagery.

## Example parent prompt

```text
Use ui_explorer to map the current purchase-capture flow and its reusable components. In parallel, have ux_flow_designer prepare a minimal flow brief using $foodos-ui-flow-spec. Reconcile their findings, then have ui_system_architect define the component/token plan. Only after the flow is accepted, use ui_implementer for the bounded slice. Finish with visual_verifier using $foodos-visual-qa. Do not create an asset unless asset_art_director first proves it is needed.
```
