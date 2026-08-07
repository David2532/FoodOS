# FoodOS agent documentation

## Source of truth

For agent roles, delegation, capabilities, approvals and capacity governance, use this precedence:

1. [`AGENTS.md`](../../AGENTS.md) — repository-wide precedence, implementation, safety and evidence rules.
2. [`config/agent-company.json`](../../config/agent-company.json) — machine-readable company, department, authority, capability and state registry.
3. [`COMPANY_AGENT_OPERATING_MODEL.md`](COMPANY_AGENT_OPERATING_MODEL.md) — company hierarchy, departments, assurance, capacity governance and dashboard direction.
4. [`WORKER_EXECUTION_CONTRACT.md`](WORKER_EXECUTION_CONTRACT.md) — required contract for short-lived implementation, research and verification workers.
5. [`CODEX_EXECUTION_PLAYBOOK.md`](CODEX_EXECUTION_PLAYBOOK.md) — bounded work briefs, evidence reuse, work graphs, checkpoints, escalation and PR discipline.
6. [`CODEX_UI_AGENT_ARCHITECTURE.md`](CODEX_UI_AGENT_ARCHITECTURE.md) — researched UI-agent runtime, dispatch and tool policy.
7. [`UI_AND_ASSET_AGENT_CONTRACT.md`](UI_AND_ASSET_AGENT_CONTRACT.md) — UI, brand, image generation, vector reconstruction, asset production and independent visual QA roles.
8. [`V1_TO_V2_MIGRATION.md`](V1_TO_V2_MIGRATION.md) — explicit mapping from earlier agent concepts to Agent Operating Model v2.
9. [`UI_QUALITY_FINDING_TEMPLATE.md`](UI_QUALITY_FINDING_TEMPLATE.md) — reproducible UI defect, routing and independent retest record.
10. [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md) — exact delivery evidence for completed work.
11. [`REPOSITORY_HEALTH_2026-08-06.md`](REPOSITORY_HEALTH_2026-08-06.md) — dated repository maintenance assessment and prioritized follow-up.

`CODEX_PROMPT.md`, old issue descriptions, chat-derived diagrams and older plans may add product context but do not redefine the company hierarchy or grant capabilities.

## Native Codex runtime

The repository contains an executable project-scoped projection of the operating model:

- [`.codex/config.toml`](../../.codex/config.toml) — subagent concurrency and project tool defaults;
- [`.codex/agents/`](../../.codex/agents) — narrow custom agents for UI exploration, UX flow, UI architecture, implementation, verification and asset work;
- [`.agents/skills/`](../../.agents/skills) — progressively loaded FoodOS UI/asset workflows.

Run `npm run agent:validate-company` after changing any registry, TOML agent, repo skill or binding agent contract. The validator checks schema v2, role protection, required UI/asset capabilities, native agent files, skill frontmatter and the four-thread concurrency cap.

## Product-delivery source of truth

Consumer-product work must preserve these documents in order:

1. [`plans/FOODOS_MASTER_PLAN.md`](../../plans/FOODOS_MASTER_PLAN.md) — canonical master index, source map, roadmap and current priority.
2. [`plans/PRODUCT_NORTH_STAR.md`](../../plans/PRODUCT_NORTH_STAR.md) — binding user promise, near-zero-effort food loop and product priority test.
3. [`plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md`](../../plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md) — modern interaction, automation, delivery-slice and measurement contract.
4. [`plans/USER_FLOWS.md`](../../plans/USER_FLOWS.md) — stable flow IDs and exact behavioral/safety rules.
5. [`design.md`](../../design.md) — canonical four-destination information architecture, UI recipes, visual rules and acceptance gates.

The product documents define **what outcome and simplicity bar must be achieved**. The company-agent documents define **who plans, implements, verifies and approves the work**. Neither replaces the other.

For approved consumer Slices 1–6:

- CPO owns user outcome, simplicity budget and acceptance criteria;
- the Executive Orchestrator decomposes and routes work but does not normally implement or approve its own output;
- CTO owns architecture and delivery;
- CDAO owns metric definitions and evidence quality;
- CISO, Privacy/DPO Operations and Food Safety/Claims independently review relevant risk;
- AECO may optimize context, model routing, CI and provider cost around the feature, but may not weaken scope, usability, accessibility, safety or evidence gates;
- short-lived workers follow `WORKER_EXECUTION_CONTRACT.md`, use scoped context and produce reproducible handoff evidence;
- UI and asset work uses the dedicated role chain rather than one agent generating and approving its own visuals.

Legacy Chief-of-Staff, master-agent or unrestricted super-agent structures are not valid for product work.

## UI dispatch

For a material new or redesigned consumer flow:

```text
ui_explorer
-> ux_flow_designer with $foodos-ui-flow-spec
-> ui_system_architect
-> ui_implementer with $foodos-ui-implementation
-> $foodos-ui-quality-review:
   interaction_verifier
   accessibility_verifier
   visual_verifier with $foodos-visual-qa
-> findings -> ui_implementer -> originating-verifier retest
```

Asset work begins with `asset_art_director`; illustrative generation uses `image_concept_artist` only from an approved brief; production export uses `asset_producer` with `$foodos-asset-production`. The creator cannot be the final verifier.

Do not invoke the whole chain for a tiny spacing or copy correction. Use only affected
quality lanes, one shared exact artifact and distinct evidence paths. Verifiers do not
silently edit reviewed code, and expert review never becomes fabricated user research.

## Routing rule

For normal repository work, start with `npm run agent:context -- <scope>`. Load the company operating model only when the task changes agent governance, work routing, approvals, capacity, company dashboards or cross-department ownership. Do not add the entire company model to every coding prompt.

For work that materially changes purchase capture, Today, inventory correction, recipes, nutrition, shopping return flow or assistive AI, the parent work item must explicitly cite the master plan, Product North Star, experience implementation plan and `design.md` before workers are assigned.

For material UI, logo, illustration, onboarding, campaign, App Store or generated-image work, the parent work item must cite `UI_AND_ASSET_AGENT_CONTRACT.md`, include an asset brief when a new asset is actually needed and name a verifier separate from the creator.

## Validation rule

Run `npm run agent:validate-company` after changing the registry, custom agents, repo skills or governance. The command rejects required-role removal, legacy super-agent identifiers, self-approval, weakened C0/C1 protection, incomplete assurance, malformed UI-agent definitions, missing skills and missing forbidden autonomous actions. It also runs at the start of `npm run verify`.

## Change rule

A change to authority levels, self-approval rules, C0/C1 capacity protection, assurance independence or forbidden autonomous actions requires security and operations review. A change to department names or dashboard navigation alone does not grant new capabilities.

A product-plan change that increases capture burden, reintroduces five primary consumer destinations, introduces a universal health score, weakens the useful free core or moves internal dashboards ahead of the trusted food loop requires explicit CPO review and must record the user-evidence rationale.
