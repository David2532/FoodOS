# FoodOS architecture decision records

Use an ADR for a durable decision that constrains several modules or releases, such as a
platform, data authority, security boundary, sync conflict rule or vendor dependency.
Routine implementation detail belongs in code or the pull request.

## Workflow

1. Copy `0000-template.md` to the next four-digit number and a short kebab-case title.
2. Set status to `proposed`; link the issue/evidence and affected source-of-truth docs.
3. Review product, data, security/privacy, operations and exit costs.
4. Mark `accepted`, `rejected`, `superseded` or `deprecated` with decision date/owners.
5. Update binding plans and tests in the same change. An ADR does not silently override
   safety, legal or user-flow contracts.

## Index

| ADR | Status | Decision |
|---|---|---|
| `0000-template.md` | template | required ADR structure |

Add accepted records to this table. Existing target decisions are currently documented
in the specialist plans; migrate them into ADRs only when implementation reaches the
decision boundary, to avoid duplicate stale truth.
