# FoodOS agent documentation

Use these documents together:

1. [`AGENTS.md`](../../AGENTS.md) — repository-wide implementation, safety and evidence
   rules.
2. [`COMPANY_AGENT_OPERATING_MODEL.md`](COMPANY_AGENT_OPERATING_MODEL.md) — company
   hierarchy, departments, assurance, capabilities, capacity governance and dashboard
   direction.
3. [`WORKER_EXECUTION_CONTRACT.md`](WORKER_EXECUTION_CONTRACT.md) — required contract for
   short-lived implementation, research and verification workers.
4. [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md) — exact delivery evidence for completed
   work.
5. [`REPOSITORY_HEALTH_2026-08-06.md`](REPOSITORY_HEALTH_2026-08-06.md) — dated repository
   maintenance assessment and prioritized follow-up.
6. [`config/agent-company.json`](../../config/agent-company.json) — machine-readable
   company, department, authority, capability and state registry.

## Routing rule

For normal repository work, start with `npm run agent:context -- <scope>`. Load the company
operating model only when the task changes agent governance, work routing, approvals,
capacity, company dashboards or cross-department ownership. Do not add the entire company
model to every coding prompt.

## Change rule

A change to authority levels, self-approval rules, C0/C1 capacity protection, assurance
independence or forbidden autonomous actions requires security and operations review. A
change to department names or dashboard navigation alone does not grant new capabilities.