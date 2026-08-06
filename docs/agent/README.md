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

## Routing rule

For normal repository work, start with `npm run agent:context -- <scope>`. Load the company
operating model only when the task changes agent governance, work routing, approvals,
capacity, company dashboards or cross-department ownership. Do not add the entire company
model to every coding prompt.

## Validation rule

Run `npm run agent:validate-company` after changing the registry or governance. The command
rejects required-role removal, legacy super-agent identifiers, self-approval, weakened
C0/C1 protection, incomplete assurance and missing forbidden autonomous actions. It also
runs at the start of `npm run verify`.

## Change rule

A change to authority levels, self-approval rules, C0/C1 capacity protection, assurance
independence or forbidden autonomous actions requires security and operations review. A
change to department names or dashboard navigation alone does not grant new capabilities.
