# FoodOS Agent Operating Model v2 migration

Status: **binding migration map**.

## Purpose

This map prevents old chat-derived or prompt-derived agent structures from operating in parallel with the current company model.

| Previous concept | V2 treatment | Current authority |
|---|---|---|
| Human owner David | Retained | Founder and final authority for material irreversible, legal, strategic and high-cost actions |
| AI CEO | Retained and bounded | Strategy, priority, budget envelope and cross-department decisions |
| Chief of Staff / super-intelligence above executives | Rejected | No agent sits above AI CEO or Founder |
| Chief of Staff as implementation worker | Rejected | Executive Orchestrator normally plans, routes and consolidates; bounded workers implement |
| Executive Orchestrator | Retained with separation of duties | Reports to AI CEO; cannot approve own material output |
| Standalone GitHub/Supabase/Vercel departments | Replaced | Platform capabilities under CTO Engineering/Data/Cloud teams |
| Generic Compliance Director | Split and strengthened | Independent Trust & Assurance Council plus CISO, CLO/Privacy and Food Safety responsibilities |
| Cost/usage agent with blocking power | Replaced | AECO proposes and protects capacity; cannot remove C0/C1 scope or weaken quality alone |
| Permanent large worker swarm | Rejected | Durable role definitions, short-lived bounded workers invoked only when useful |
| Flat worker-to-founder delivery | Replaced | Worker → lead → C-level → consistency/assurance → CEO → Founder when required |
| Old informal status language | Replaced | Exact PASS/FAIL/FLAKY/BLOCKED/NOT_RUN and work-item lifecycle |
| `CODEX_PROMPT.md` as organisational authority | Replaced | Prompt invokes, but does not redefine, registry and operating model |
| Scope-free complete-repo reading | Rejected | Every normal task starts with `agent:context` and the smallest relevant scope |

## Authoritative v2 sources

1. `AGENTS.md`
2. `config/agent-company.json`
3. `docs/agent/COMPANY_AGENT_OPERATING_MODEL.md`
4. `docs/agent/WORKER_EXECUTION_CONTRACT.md`
5. this migration map

Older diagrams, PR text, issue descriptions and chat exports may remain as history but are non-authoritative unless explicitly migrated into the sources above.

## Enforcement

`npm run agent:validate-company` must reject legacy master/super-agent identifiers, self-approval, weakened C0/C1 protection, incomplete assurance and removal of forbidden autonomous actions. A role-name change alone does not grant capabilities.
