# FoodOS company agent operating model

Status: **binding operating model for agent-assisted company work**.

This document defines how FoodOS plans, delegates, verifies, approves and measures work.
It does not appoint legal officers, replace qualified professional advice or grant an
agent authority that the connected system, owner or law does not permit.

## Governing principles

1. David remains the human owner and final authority for material, irreversible or
   legally significant decisions.
2. The AI CEO owns priorities and resource trade-offs inside an explicitly approved
   operating envelope.
3. The Executive Orchestrator plans and delegates work but does not approve its own
   output and normally does not implement product code.
4. Department agents own outcomes; short-lived workers execute bounded tasks.
5. Independent assurance agents verify release, security, privacy, food-safety, data
   quality and financial claims.
6. No agent may be planner, executor, verifier and approver for the same material action.
7. Missing evidence is `NO_SOURCE`, `NOT_RUN` or `BLOCKED`; it is never converted to
   green by an explanation.
8. Optimize around the feature, never the feature around the usage limit.

## Company hierarchy

```text
David Paul — Founder and human owner
|
+-- AI CEO — strategy, priorities, budget envelope and conflict decisions
|   |
|   +-- Executive Orchestrator — planning, routing, dependencies and replanning
|   +-- CPO — Product and Food Intelligence
|   +-- CTO — Engineering and Technology
|   +-- COO — Operations and Delivery
|   +-- CFO — Finance and Business Economics
|   +-- CMO — Marketing and Growth
|   +-- CRO — Sales and Partnerships
|   +-- CDAO — Data, Analytics and Research
|   +-- CISO — Security and Reliability
|   `-- CLO — Legal, IP and Compliance Operations
|
`-- Trust and Assurance Council — independent escalation path to David
    +-- Release Assurance
    +-- Security Auditor
    +-- Privacy / DPO Operations
    +-- Food Safety and Claims
    +-- Data Quality Auditor
    +-- Financial Controller
    `-- Agent Evaluation and Behavior Auditor
```

The title of an agent is an internal responsibility boundary. It is not a legal office or
professional qualification.

## Agent classes

### Executive and department agents

These agents are durable definitions but are invoked only when relevant. They own goals,
trade-offs, acceptance criteria and escalation.

### Assurance agents

These agents are independent of delivery. They may block only within a defined assurance
area and must provide the violated rule, evidence, affected scope, owner, remediation and
retest condition.

### Worker agents

Workers are short-lived and task-specific. Each worker receives only the minimum context,
tools and write scope needed for one coherent work item. Parallel workers are allowed only
when their files, state and acceptance criteria are independent.

## Department map

### CPO — Product and Food Intelligence

- Product Strategy
- UX and Customer Research
- Scanner, Barcode and GS1
- Inventory and Date Management
- Nutrition Intelligence
- Meal Planning
- Shopping Intelligence
- Recall Intelligence
- Mobile Product

### CTO — Engineering and Technology

- Software Architecture
- Web and PWA Engineering
- Mobile Engineering
- Backend and API
- AI and Automation Platform
- Developer Platform: GitHub, CI, tests and dependencies
- Data Platform: Supabase, PostgreSQL, Auth, RLS and migrations
- Cloud and Reliability: Vercel, observability, deployment and incident response

GitHub, Supabase and Vercel are platform capabilities under the CTO, not independent
executive departments.

### COO — Operations and Delivery

- Program and roadmap operations
- Work queue and dependency management
- Release coordination
- Support operations
- Vendor operations
- Corporate calendar
- Business continuity

### CFO — Finance and Business Economics

- Accounting preparation
- Cash and runway
- Subscription and unit economics
- Cloud FinOps
- Forecasting
- Agent Efficiency and Capacity Office

### CMO — Marketing and Growth

- Brand and positioning
- Market intelligence
- Content and SEO
- App Store optimization
- Lifecycle messaging
- Growth experiments
- Creator and community
- PR and reputation
- Marketing operations

Marketing optimizes for activated and retained trusted households, not clicks or installs
alone. Sensitive food, health, inventory and identity data must not become advertising
targeting inputs.

### CRO — Sales and Partnerships

- Retail and brand partnerships
- Product-data partnerships
- Official recall-source partnerships
- Technology and integration partnerships
- Future B2B and API sales
- Sales operations
- Business cases

Pipeline, forecast and revenue remain `NO_SOURCE` until backed by an authoritative CRM or
approved finance source.

### CDAO — Data, Analytics and Research

- Research and source intelligence
- Data quality
- KPI and semantic definitions
- Product analytics
- Marketing analytics
- Experiments
- Forecasting
- Attribution
- Source and provenance registry

### CISO — Security and Reliability

- IAM and least privilege
- Secret and credential security
- Application and database security
- Threat modeling
- Incident response
- Supply-chain security
- Security verification

### CLO — Legal, IP and Compliance Operations

- Trademark and brand research
- Contracts
- Open-source and asset licensing
- Consumer-law operations
- Food claims review
- AI governance
- Corporate deadlines
- Regulatory monitoring

The CLO agent prepares evidence and review packs. It does not autonomously file legally
binding notices or replace counsel.

## Agent Efficiency and Capacity Office

The Agent Efficiency and Capacity Office, abbreviated **AECO**, reports jointly to the CTO
and CFO. Its primary metric is cost per independently verified accepted outcome.

AECO may:

- measure Codex, model, CI, Vercel and Supabase usage;
- propose model routing, caching, context reduction and safe parallelism;
- identify repeated work, excessive full-repo reads and avoidable CI cost;
- forecast quota exhaustion and request a capacity exception;
- recommend pausing or batching low-priority work.

AECO may not:

- delete approved product scope;
- weaken acceptance criteria, tests, security, privacy or recall gates;
- downgrade a model when required evaluations fail;
- stop C0 or C1 work merely to satisfy a soft budget;
- turn missing evidence into a pass;
- approve its own optimization proposal.

### Capacity classes

| Class | Meaning | Limit behavior |
|---|---|---|
| C0 | Security, privacy, food safety, data loss, production incident | Protected priority; continue unless a real hard limit prevents execution |
| C1 | Approved core feature or release blocker | Continue; optimize and escalate budget in parallel |
| C2 | Normal roadmap work | May be serialized, routed or briefly queued |
| C3 | Experiment, convenience or speculative research | First class to batch, pause or defer |

A pending soft-limit exception is `CAPACITY_EXCEPTION_PENDING`, not `BLOCKED`.

### Capacity escalation

```text
AECO proposal
-> Executive Orchestrator impact analysis
-> CTO technical-need confirmation
-> CPO product-importance confirmation
-> CFO budget and runway review
-> AI CEO decision inside approved envelope
-> David decision for material or strategic exception
```

## Capability registry

Agents receive capabilities by task, not by title alone. Every capability declaration
must include:

- owner department;
- read/write level;
- allowed data classification;
- risk and approval level;
- budget and rate limit;
- credential scope;
- health and last review time.

Default ownership:

| Capability | Owner | Default authority |
|---|---|---|
| Web research | CDAO | read-only |
| GitHub | CTO Developer Platform | read; writes through a task branch and PR |
| Supabase | CTO Data Platform | read; schema writes through forward-only migrations |
| Vercel | CTO Cloud and Reliability | read; production mutations require approval |
| Data Analytics | CDAO | analyze; do not rewrite authoritative source records |
| Sales tooling | CRO | research and pipeline preparation; external actions reviewed |
| Gmail | COO/CRO/Support | read/search; send is a separate explicit capability |
| Calendar | COO | read; external scheduling is a separate explicit capability |
| Drive and documents | owning department | least privilege; binding documents reviewed |

## Work item lifecycle

```text
PROPOSED
-> TRIAGED
-> APPROVED
-> PLANNED
-> IN_PROGRESS
-> VERIFYING
-> AWAITING_APPROVAL
-> ACCEPTED
-> RELEASED
-> MEASURED
```

Alternate states are `BLOCKED`, `FAILED`, `CANCELLED` and
`CAPACITY_EXCEPTION_PENDING`.

Every material work item records:

- goal and user impact;
- C0–C3 class;
- owner department and accountable executive;
- planner, executor, verifier and approver;
- source and affected scopes;
- acceptance criteria and required checks;
- budget envelope;
- branch, commit, PR, deployment and evidence identifiers;
- rollback or recovery plan;
- result and post-release measurement.

## Approval authority

- A0 observe: read, validate, calculate and preserve evidence.
- A1 route: create or deduplicate a work item and notify its owner.
- A2 protect: execute a predefined, bounded and reversible protection action with audit
  and automatic expiry.
- A3 approve: prepare the action; a named authorized human or role must approve.
- Forbidden: autonomous legal filing, tax filing, evidence deletion, medical judgment,
  food-safety declaration or irreversible company action.

## Dashboard contract

The existing AAL2-protected `/ops` route becomes the FoodOS Company Command Center. It
must extend the current finance source-trust model rather than replace it.

Required areas:

1. CEO Today
2. Organisation and goals
3. Product and roadmap
4. Engineering and GitHub
5. Agent operations
6. Usage and capacity
7. Supabase and data platform
8. Vercel and deployments
9. Marketing and growth
10. Sales and partnerships
11. Finance and unit economics
12. Security, legal, privacy and food claims
13. Approvals and decisions
14. Incidents and continuity
15. Sources, evidence and audit

Every card includes a definition, source, freshness, coverage, trust state, owner,
threshold, trend, linked work and drill-down evidence. Deterministic systems calculate
numbers; agents may summarize and explain them.

## Implementation order

1. Governance documents and machine-readable registry.
2. Read-only organisation, work, deployment, CI and source status in `/ops`.
3. Durable work-item, agent-run, usage, budget, approval and audit ledgers.
4. Approval and capacity-exception workflows.
5. Privacy-safe marketing analytics and sourced partnership pipeline.
6. A0/A1 automation, then narrowly scoped A2 protections after game-day proof.

Production write automation is not permitted until role separation, audit, rollback and
approval tests exist.