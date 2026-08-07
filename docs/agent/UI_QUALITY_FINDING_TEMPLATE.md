# FoodOS UI quality finding or evidence blocker

Use one record per independently reproducible defect or independently resolvable evidence
blocker. Duplicate only when the symptom or blocked check, environment, evidence and
remediation criterion are materially the same. Preserve old evidence after a fix or unblock.

## Identity

- Finding ID: `UIQA-<work-item>-<role>-<nn>`
- Record type: `DEFECT | EVIDENCE_BLOCKER`
- Work item / flow / requirement IDs: `<IDs>`
- Requirement risk: `C0 | C1 | C2 | C3`
- Finding severity: `critical | major | moderate | minor | not_applicable`
- Evidence status: `PASS | FAIL | FLAKY | BLOCKED | NOT_RUN`
- Workflow state: `OPEN | ROUTED | IN_FIX | READY_FOR_RETEST | VERIFIED | ACCEPTED_WITH_EXPIRY | BLOCKED`
- Category: `<interaction | accessibility | visual | performance | product | safety | privacy | security | data>`
- Detecting verifier: `<independent role/agent>`
- Fix / unblock owner: `<normally ui_implementer, routed specialist, or environment owner>`
- Required retester: `<originating verifier>`

Requirement risk, finding severity and evidence status are separate concepts. A score or
lower-severity finding cannot cancel an unresolved blocker. Use `not_applicable` only for an
`EVIDENCE_BLOCKER` where execution could not begin and no product defect was observed. Never
infer defect severity from missing evidence.

## Artifact and environment

- Repository / branch / full commit: `<exact identity>`
- URL or build ID: `<exact artifact>`
- Clean/dirty state: `<result>`
- Route / flow / component / state: `<scope>`
- Browser and OS: `<versions>`
- Viewport and DPR: `<width x height / DPR>`
- Theme / locale / timezone / clock: `<values>`
- Input and assistive technology: `<values or NOT_RUN reason>`
- Network / cache / provider condition: `<values>`
- Synthetic fixture ID: `<privacy-safe fixture>`

## Reproduction

Preconditions:

1. `<precondition>`

Steps:

1. `<action>`

Expected:

`<observable result from the accepted contract>`

Actual:

`<observed result without hidden diagnosis>`

User consequence:

`<task, access, trust, safety or recovery impact>`

First-attempt result and reproduction rate:

`<status and exact observations; never extrapolate beyond the run>`

## Evidence

- Screenshot/video/trace: `<privacy-safe paths>`
- Console/network/runtime evidence: `<paths or NOT_RUN reason>`
- Accessibility evidence: `<paths, manual result or NOT_RUN reason>`
- Violated source/criterion: `<document, flow, requirement or acceptance criterion>`
- Privacy redaction confirmed: `yes | no`

Do not attach secrets, real household data, sensitive product history or unredacted
participant material.

## Remediation or unblock contract

Acceptance criteria:

- `<observable condition>`

Adjacent regression scope:

- `<route/state/component>`

Routing decision:

- `<ui_implementer | ux_flow_designer/CPO | ui_system_architect | specialist authority | environment owner>`

An implementation suggestion may be included as non-authoritative context. It does not
override the accepted UX or UI-system brief.

## Independent retest

- Fix commit / artifact: `<new exact identity>`
- Exact reproduction first attempt: `PASS | FAIL | FLAKY | BLOCKED | NOT_RUN`
- Adjacent regression: `PASS | FAIL | FLAKY | BLOCKED | NOT_RUN`
- Acceptance criteria result: `<criterion-by-criterion evidence>`
- Previous evidence preserved: `yes | no`
- Closed by originating verifier: `<identity and date>`
- Remaining risk / approved expiry: `<none or named owner, reason and expiry>`

The implementer cannot close its own finding. A changed expected result requires an
approved brief or contract change before retest.
