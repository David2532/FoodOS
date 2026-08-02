## Outcome

<!-- What user/operational outcome changes? Keep implementation detail secondary. -->

## Scope

- Flow / requirement IDs:
- Risk class: C0 / C1 / C2 / C3
- Included:
- Explicitly not included:

## Evidence and implementation

- User/research evidence or hypothesis:
- Domain/data/API/UI changes:
- Migration and compatibility impact:
- Authorization/RLS impact:

## UI and accessibility

<!-- Delete only when genuinely not applicable and explain why. -->

- States covered: loading / empty / error / offline / stale / permission / conflict / success
- Viewports/devices:
- Keyboard/focus/screen-reader/large-text/reduced-motion checks:
- Screenshots or visual diff:
- Bundle/vitals impact:

## Security, privacy and providers

- Data classes and telemetry/network changes:
- New SDK/provider/permission/secret: none / details
- Threat, retention, consent, transfer and failure/exit review:
- Confirm no real user, product/date/health data or credentials in this PR: [ ]

## Tests

| Command/test ID | Environment/artifact | Result (`PASS`, `FAIL`, `FLAKY`, `SKIP`, `BLOCKED`, `NOT_RUN`, `STALE`) |
|---|---|---|
| `npm run verify` |  |  |

<!-- A retry pass is FLAKY. Link traces/screenshots/reports for the exact commit. -->

## Rollout and recovery

- Feature flag/cohort:
- Stop signals and owner:
- Rollback/data recovery:
- Documentation/runbook changes:

## Reviewer checklist

- [ ] The authoritative user/data outcome is clear and no unknown is fabricated.
- [ ] Safety, privacy, tenant, billing and offline invariants remain intact.
- [ ] Tests assert behavior at the correct boundaries and evidence matches this artifact.
- [ ] UI uses the design system and covers relevant failure/accessibility/performance states.
- [ ] Setup, migration, source-of-truth docs and maturity claims match reality.
