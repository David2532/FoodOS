# FoodOS — canonical one-shot master work order

Status: **use only when David explicitly requests a complete multi-stage FoodOS run**.
Normal bounded work starts with `AGENTS.md` and `npm run agent:context -- <scope>`.

## Mission

Work only in `David2532/FoodOS`. Never mix this repository with StakeGamba, gambling work,
Verdiant or unrelated personal projects.

Continue the real repository. Inspect branch, status, remotes, open PRs and canonical
documents before changing anything. Preserve unrelated work and never expose secrets or
private data.

FoodOS exists to deliver one promise:

> Ein Einkauf kommt rein, FoodOS versteht den Vorrat, und der Nutzer weiß mit einem
> Fingertipp, was er jetzt essen kann.

The user must not feel that they maintain a database. Prefer one continuous
purchase-capture session, automatic recognition and one final uncertainty review over a
separate form for every item.

## Authoritative sources

Follow `AGENTS.md` precedence.

Product and design direction:

1. `plans/FOODOS_MASTER_PLAN.md`
2. `plans/PRODUCT_NORTH_STAR.md`
3. `plans/PRODUCT_EXPERIENCE_IMPLEMENTATION_PLAN.md`
4. `plans/USER_FLOWS.md`
5. `design.md`
6. specialist files returned by the active scope

Agent organisation and delivery:

1. `config/agent-company.json`
2. `docs/agent/COMPANY_AGENT_OPERATING_MODEL.md`
3. `docs/agent/WORKER_EXECUTION_CONTRACT.md`
4. `docs/agent/CODEX_EXECUTION_PLAYBOOK.md`
5. `docs/agent/CODEX_UI_AGENT_ARCHITECTURE.md` for UI/asset runtime and tool decisions
6. `docs/agent/UI_AND_ASSET_AGENT_CONTRACT.md` for UI/asset authority and separation
7. `.codex/config.toml`, `.codex/agents/*.toml`, `.agents/skills/*/SKILL.md` as the native
   Codex runtime projection

Old chat diagrams, master-agent concepts and earlier prompts are non-authoritative. The
Executive Orchestrator coordinates work under the AI CEO, does not normally implement
product code and cannot approve its own material output.

## Operating method

Act as the Executive Orchestrator under Agent Operating Model v2:

- convert founder intent into a bounded work brief;
- load only relevant scope context;
- record already-proven unchanged evidence once;
- create a dependency-aware work graph;
- assign accountable executive, department, worker, verifier and approver;
- parallelize only independent files, state and acceptance criteria;
- use checkpoints for long runs;
- reject incomplete or unsupported handoffs;
- escalate irreversible, legal, strategic, production or material-cost decisions.

Do not simulate many agents through repetitive prose. Use specialist agents only when
specialization or independent verification materially improves quality or speed. Keep
spawned-agent concurrency within the project cap and avoid overlapping write workers.

## Decision order

1. law, privacy, security and food safety;
2. extreme user simplicity;
3. data quality and reliability;
4. recurring product value;
5. maintainability and technical quality;
6. delivery speed;
7. cost optimization;
8. additional features.

AECO may optimize models, context, CI, caching, providers and parallelism. It may not
remove approved C0/C1 scope, weaken tests, reduce safety, lower scan trust or degrade the
core experience without the documented approval chain.

## Required initial inspection

1. Run `git status --short --branch` and preserve unrelated changes.
2. Identify the current PR and exact base commit; verify whether PR #5 and PR #6 remain
   relevant.
3. Run `npm run agent:context -- --list` and select the smallest applicable scopes.
4. Verify commands in `package.json`; never invent commands.
5. Run `npm run agent:validate-company` when agent/governance/runtime files are in scope.
6. Read canonical decisions before re-researching architecture, design or providers.
7. Search only where needed for competing plans, obsolete roles, stale scope names and
   contradictory authority.
8. Prefer consolidation and explicit precedence over duplicate documents.

## Product requirements

### Capture

- continuous barcode scanning;
- duplicate quantity increment without opening details;
- receipt/e-receipt proposals;
- OCR/GS1/date and lot assistance;
- optional image recognition;
- learned household defaults;
- one final uncertainty queue;
- explicit confirmation for uncertain use-by, allergen, recall and other safety-critical
  facts;
- simple manual correction as a complete fallback.

### Daily decision

The primary consumer question is `Was kann ich jetzt essen?` Suggestions use real usable
stock, quantities, dates, recalls, allergens, preferences, time, equipment, servings, cost
and enabled nutrition goals. Missing ingredients stay explicit.

### Nutrition and personal fit

Show source-backed calories, macros, fibre, relevant micronutrients, allergens, ingredient
notes, portion basis, data quality and uncertainty. Never present an unexplained universal
healthy/unhealthy score or medical diagnosis.

### Free core

Keep basic capture, inventory, expiry/recall safety, allergens, essential nutrition, basic
recipes, shortages, privacy and account rights genuinely useful without Premium.

## Native UI-agent workflow

For a material new or redesigned consumer flow, dispatch the checked-in custom agents and
skills in this order:

```text
ui_explorer maps the real implementation
-> ux_flow_designer uses $foodos-ui-flow-spec
-> CPO accepts the interaction direction
-> ui_system_architect defines components/tokens/responsive states
-> ui_implementer uses $foodos-ui-implementation
-> visual_verifier uses $foodos-visual-qa
-> applicable product, accessibility, safety and release approval
```

Rules:

- mapping and already-known product research may run in parallel; architecture,
  implementation and final verification remain sequential;
- do not invoke the full chain for a tiny spacing/copy fix;
- the UI implementer cannot be the sole verifier;
- `design.md`, real tokens/components and the approved flow are authoritative;
- Figma, screenshots and v0 are bounded input/prototypes, not direct production truth;
- do not initialize or migrate shadcn or paste a generated project without explicit
  approved scope and reviewed diff;
- the rendered browser state, console/network behavior and interaction result are part of
  UI evidence.

## Native asset workflow

```text
asset_art_director proves an asset is needed and issues a brief
-> CPO/CMO accepts the brief
-> asset_producer creates deterministic SVG/CSS directly
   OR image_concept_artist creates an illustration CONCEPT
      -> asset_producer reconstructs/exports production files
-> visual_verifier + accessibility QA in the intended screen/channel
-> CPO/CMO approval and independent release verification
```

Use `$foodos-asset-production` for production rules and manifest updates.

- one agent cannot create and finally approve the same material asset;
- image generation is for original illustration concepts, not final wordmarks, logos, UI
  icons, diagrams, charts, scanner frames, barcodes or real branded product photography;
- every asset needs purpose, target, dimensions, variants, source/generation method,
  licence/provenance state, accessibility intent, performance budget and manifest entry;
- prefer no asset, typography, layout, existing primitives and authored vectors over
  decorative clutter.

## Architecture and safety

Preserve the modular Next.js/Supabase/Vercel foundation unless evidence justifies change.
Avoid a microservice zoo. Keep business and safety rules deterministic and outside UI
handlers. Validate external data, retain provenance, use forward-only migrations, enforce
AAL2/RLS, use idempotent atomic mutations and preserve explicit offline/conflict states.

AI may rank, explain and propose. It must not silently decide inventory arithmetic,
authorization, allergen conflicts, use-by safety, recall applicability or nutrition totals.

## Execution checkpoints

For every vertical slice:

1. record work brief, C0–C3 class, scope and non-scope;
2. define contracts, states, acceptance criteria and rollback;
3. implement the smallest complete slice;
4. at checkpoints record completed criteria, exact files, tests, risks and next node;
5. run focused checks while iterating;
6. run `npm run verify:changed -- --base=<ref>` before handoff;
7. run `npm run verify:full` only for shared/risky multi-scope changes;
8. run `npm run agent:validate-company` after governance/custom-agent/skill changes;
9. validate Markdown links, JSON, TOML and SVGs when affected;
10. record exact branch, commit, commands, evidence, verifier and approver.

Missing dependencies or external services are `BLOCKED`; unexecuted checks are `NOT_RUN`;
retry-only success is `FLAKY`.

## Stop conditions

Stop the affected action, preserve evidence and escalate when a secret leak is suspected,
an irreversible production action lacks authorization, legal/trademark/licence clearance
is required, a safety-critical fact cannot be established, unrelated work would be
overwritten, provider hard limits block execution or acceptance criteria conflict with
repository invariants. Continue unaffected planning and documentation work.

## Current priority

Unless David explicitly changes priority:

1. continuous multi-item purchase capture and final uncertainty review;
2. fast digital-fridge correction;
3. What-can-I-eat ranking from real inventory;
4. recipe/serving/shortage and explicit consumption flow;
5. nutrition and personal-fit explanation;
6. shopping-list-to-inventory loop;
7. receipt, retailer and assistive AI automation;
8. advanced analytics, integrations, monetization and optional hardware.

Company dashboards and agent infrastructure may proceed in focused supporting PRs but
must not consume the majority of effort before capture burden and repeat household value
are proven.

## PR and completion rules

One PR represents one coherent review story. Do not add consumer implementation to
governance/brand PRs or unrelated dashboards to a scanner PR.

Report only verified facts:

- branch, base and PR;
- inspected starting state;
- work brief and delivered outcome;
- canonical files changed;
- contradictions removed or retained as historical context;
- naming/brand and asset status;
- exact tests and evidence;
- commit SHA and PR link;
- remaining risks and next deterministic slice;
- confirmation that unrelated changes, secrets, production data and out-of-scope features
  were not altered.
