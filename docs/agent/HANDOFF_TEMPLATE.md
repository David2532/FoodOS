# Agent handoff

- Work item: `<stable ID and title>`
- Capacity / risk class: `<C0 | C1 | C2 | C3>`
- Accountable department / executive: `<owner>`
- Planner / executor / verifier / approver: `<distinct identities where required>`
- Branch: `<branch>`
- Base: `<ref and commit>`
- Commit: `<sha>`
- Scope: `<agent:context scope>`
- Artifact / deployment: `<exact ID or NOT_RUN/BLOCKED>`

## Changed

- `<actual changed area>`

## Verification

| Check | Status | Exact result or reason |
|---|---|---|
| `<command>` | `PASS/FAIL/FLAKY/BLOCKED/NOT_RUN` | `<result>` |

## UI quality findings (when applicable)

- Charter / finding records: [`UI_QUALITY_FINDING_TEMPLATE.md`](UI_QUALITY_FINDING_TEMPLATE.md)
- Required lanes: `<interaction | accessibility | visual | conditional specialist>`
- Open blockers: `<IDs or none>`
- Retest owner and exact next artifact: `<identity / commit or NOT_RUN>`

## Remaining

- Next step: `<smallest concrete next action>`
- External blocker: `<none or one exact dependency and minimal user action>`
- Recovery / rollback: `<bounded action or not applicable>`
- Known risk / accepted expiry: `<none or owner, reason and expiry>`

Do not reuse this handoff as evidence for another commit, environment or artifact.
