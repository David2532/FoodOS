# FoodOS agent documentation

## Source of truth

For agent roles, delegation, capabilities, approvals and capacity governance, use this
precedence:

1. [`AGENTS.md`](../../AGENTS.md) — repository-wide precedence, implementation, safety and
   evidence rules.
2. [`config/agent-company.json`](../../config/agent-company.json) — machine-readable
   company, department, authority, capability and state registry.
3. [`COMPANY_AGENT_OPERATING_MODEL.md`](COMPANY_AGENT_OPERATING_MODEL.md) — company
   hierarchy, departments, assurance, capacity governance and dashboard direction.
4. [`WORKER_EXECUTION_CONTRACT.md`](WORKER_EXECUTION_CONTRACT.md) — required contract for
   short-lived implementation, research and verification workers.
5. [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md) — exact delivery evidence for completed
   work.
6. [`REPOSITORY_HEALTH_2026-08-06.md`](REPOSITORY_HEALTH_2026-08-06.md) — dated repository
   maintenance assessment and prioritized follow-up.

`CODEX_PROMPT.md`, old issue descriptions, chat-derived diagrams and older plans may add
product context but do not redefine the company hierarchy or grant capabilities.

## Product-delivery source of truth

Consumer-product work must preserve both of these documents:

1. [`plans/PRODUCT_NORTH_STAR.md`](../../plans/PRODUCT_NORTH_STAR.md) — the binding user
   promise, near-zero-effort food loop and product priority test.
2. [`plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md`](../../plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md)
   — the modern interaction, automation, delivery-slice and measurement contract.

The product documents define **what outcome and simplicity bar must be achieved**. The
company-agent documents define **who plans, implements, verifies and approves the work**.
Neither replaces the other.

For approved consumer Slices 1–6:

- CPO owns user outcome, simplicity budget and acceptance criteria;
- the Executive Orchestrator decomposes and routes work but does not normally implement or
  approve its own output;
- CTO owns architecture and delivery;
- CDAO owns metric definitions and evidence quality;
- CISO, Privacy/DPO Operations and Food Safety/Claims independently review relevant risk;
- AECO may optimize context, model routing, CI and provider cost around the feature, but
  may not weaken scope, usability, accessibility, safety or evidence gates;
- short-lived workers follow `WORKER_EXECUTION_CONTRACT.md`, use scoped context and produce
  reproducible handoff evidence.

Legacy Chief-of-Staff, master-agent or unrestricted super-agent structures are not valid
for product work.

## Routing rule

For normal repository work, start with `npm run agent:context -- <scope>`. Load the company
operating model only when the task changes agent governance, work routing, approvals,
capacity, company dashboards or cross-department ownership. Do not add the entire company
model to every coding prompt.

For work that materially changes purchase capture, Today, inventory correction, recipes,
nutrition, shopping return flow or assistive AI, the parent work item must explicitly cite
both product-delivery documents above before workers are assigned.

## Validation rule

Run `npm run agent:validate-company` after changing the registry or governance. The command
rejects required-role removal, legacy super-agent identifiers, self-approval, weakened
C0/C1 protection, incomplete assurance and missing forbidden autonomous actions. It also
runs at the start of `npm run verify`.

## Change rule

A change to authority levels, self-approval rules, C0/C1 capacity protection, assurance
independence or forbidden autonomous actions requires security and operations review. A
change to department names or dashboard navigation alone does not grant new capabilities.

A product-plan change that increases capture burden, introduces a universal health score,
weakens the useful free core or moves internal dashboards ahead of the trusted food loop
requires explicit CPO review and must record the user-evidence rationale.
