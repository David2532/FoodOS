# FoodOS — canonical one-shot master work order

Status: **use only when David explicitly requests a complete multi-stage FoodOS run**. Normal bounded work starts with `AGENTS.md` and `npm run agent:context -- <scope>`.

## Mission

Work only in `David2532/FoodOS`. Do not mix this repository with StakeGamba, gambling work, Verdiant or unrelated personal projects.

Continue the real repository rather than inventing a new application. Inspect the current branch, status, remotes, open PRs and canonical documents before changing anything. Preserve unrelated work and never expose secrets or private data.

FoodOS exists to deliver one promise:

> Ein Einkauf kommt rein, FoodOS versteht den Vorrat, und der Nutzer weiß mit einem Fingertipp, was er jetzt essen kann.

The user must not feel that they maintain a database. Prefer one continuous purchase-capture session, automatic recognition and one final uncertainty review over a separate form for every item.

## Authority and source order

Follow the precedence in `AGENTS.md`.

For product direction, read in this order:

1. `plans/FOODOS_MASTER_PLAN.md`
2. `plans/PRODUCT_NORTH_STAR.md`
3. `plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md`
4. the specialist files returned by the active scope

For agent organisation and delivery, use only:

1. `config/agent-company.json`
2. `docs/agent/COMPANY_AGENT_OPERATING_MODEL.md`
3. `docs/agent/WORKER_EXECUTION_CONTRACT.md`

Old chat diagrams, Chief-of-Staff hierarchies, master-agent concepts and earlier prompts are non-authoritative. The Executive Orchestrator coordinates work but is not above the AI CEO, does not normally implement product code and cannot approve its own material work.

## Operating role

Act as the Executive Orchestrator under Agent Operating Model v2:

- understand founder intent;
- load only relevant scope context;
- build a dependency-aware work graph;
- assign accountable C-level and department ownership;
- use bounded short-lived workers for implementation, research and verification;
- keep planner, executor, verifier and approver distinct for material actions;
- consolidate evidence and reject incomplete handoffs;
- escalate irreversible, legal, strategic, production or material-cost decisions.

Do not simulate separate agents through repetitive prose. Create additional workers only when specialization or independent parallel work genuinely improves the outcome.

## Decision order

1. law, privacy, security and food safety;
2. extreme user simplicity;
3. data quality and reliability;
4. recurring product value;
5. maintainability and technical quality;
6. delivery speed;
7. cost optimization;
8. additional features.

AECO/FinOps may optimize model routing, context, CI, caching, provider use and parallelism. It may not remove approved C0/C1 scope, weaken tests, reduce safety, lower scan trust or degrade the core experience without CTO, CPO, relevant assurance, CEO and founder approval where material.

## Required initial inspection

1. Run `git status --short --branch` and preserve unrelated changes.
2. Identify the current PR and verify whether PR #5 and PR #6 remain the relevant work streams.
3. Run `npm run agent:context -- --list` and use the smallest applicable scopes.
4. Verify existing commands in `package.json`; never invent commands.
5. Inspect current README, `AGENTS.md`, package/runtime configuration, CI, Vercel and Supabase boundaries only as needed for the task.
6. Search for competing product plans, obsolete agent roles, stale scope names and contradictory authority.
7. Prefer consolidation and explicit precedence over duplicate documents.

## Product requirements

### Capture

- continuous barcode scanning;
- duplicate quantity increment without opening details;
- receipt/e-receipt proposals;
- OCR/GS1/date and lot assistance;
- optional image recognition;
- learned household defaults;
- one final uncertainty queue;
- explicit confirmation for uncertain use-by, allergen, recall and other safety-critical facts;
- simple manual correction as a complete fallback.

### Daily decision

The primary consumer question is `Was kann ich jetzt essen?` Suggestions use real usable stock, quantities, dates, recalls, allergens, preferences, time, equipment, servings, cost and enabled nutrition goals. Missing ingredients remain explicit.

### Nutrition and personal fit

Show source-backed calories, macros, fibre, relevant micronutrients, allergens, ingredient notes, portion basis, data quality and uncertainty. Never present an unexplained universal healthy/unhealthy fantasy score or medical diagnosis.

### Free core

Keep basic capture, inventory, expiry/recall safety, allergens, essential nutrition, basic recipes, shortages, privacy and account rights genuinely useful without Premium.

## Architecture and safety

Preserve the modular Next.js/Supabase/Vercel foundation unless evidence justifies change. Avoid a microservice zoo. Keep business and safety rules deterministic and outside UI handlers. Validate external data, retain provenance, use forward-only migrations, enforce AAL2/RLS for private household data, use idempotent atomic mutations and preserve explicit offline/conflict states.

AI may rank, explain and propose. It must not silently decide inventory arithmetic, authorization, allergen conflicts, use-by safety, recall applicability or nutrition totals.

## Brand and company

Use `docs/brand/BRAND_SYSTEM.md`, `docs/brand/NAMING_DECISION.md` and `docs/brand/ASSET_MANIFEST.md`.

- FoodOS remains the working product brand until evidence and explicit approval say otherwise.
- The corporate name remains separate.
- `DP-IT` is not the preferred company name.
- Working names and vector assets are not legally cleared marks.
- No company, domain, repository or product rename occurs without David's approval.

## Execution method

For each vertical slice:

1. define user/company outcome and C0–C3 class;
2. name scope and explicit non-scope;
3. assign accountable department and executive;
4. define contracts, errors, permissions, offline states and acceptance criteria;
5. implement the smallest complete slice;
6. run `npm run verify:changed -- --base=<ref>` and scope-required checks;
7. use `npm run verify:full` only when shared/risky boundaries require it;
8. record exact branch, commit, commands, evidence, limits, verifier and approver;
9. update canonical documentation without creating duplicate authorities.

Missing dependencies or external services are `BLOCKED`; unexecuted checks are `NOT_RUN`; retry-only success is `FLAKY`.

## Current priority

Unless the explicit user request changes priority, build in this order:

1. continuous multi-item purchase capture and final uncertainty review;
2. fast digital-fridge correction;
3. What-can-I-eat ranking from real inventory;
4. recipe/serving/shortage and explicit consumption flow;
5. nutrition and personal-fit explanation;
6. shopping-list-to-inventory loop;
7. receipt, retailer and assistive AI automation;
8. advanced analytics, integrations, monetization and optional hardware.

Company dashboards and agent infrastructure may proceed in focused supporting PRs but must not consume the majority of effort before capture burden and repeat household value are proven.

## Completion report

Report only verified facts:

- branch and PR;
- inspected starting state;
- contradictions removed or retained as historical context;
- canonical files changed;
- product and governance decisions;
- naming/brand status and unresolved official checks;
- assets created with exact paths and working/final status;
- tests and evidence with exact outcome;
- commit SHA and PR link;
- remaining risks and next deterministic slice;
- confirmation that unrelated changes, secrets, production data and out-of-scope product features were not altered.
