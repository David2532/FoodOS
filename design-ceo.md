# FoodOS CEO Control Center design system

Version 1.0 · Desktop-first operating cockpit · Internal AAL2 surface

This design applies only to the internal `/ops` product. The consumer app remains bound
to `design.md`. Shared FoodOS colors and type create family resemblance; the information
architecture is denser, desktop-first and optimized for decisions, proof and drill-down.

## Product feeling

The center should feel like a quiet aircraft cockpit: nothing is green without evidence,
no metric hides its source, and urgent items are obvious without turning the entire page
red. It is an operating system for one CEO, not a decorative analytics showcase.

## Layout

- desktop target 1280–1600 px; useful down to 1024 px;
- tablet gets a read-only/limited action layout; phone shows only CEO Today, incidents and
  urgent approvals, never dense finance close work;
- left navigation 232 px, sticky global status header, main canvas max 1600 px;
- 12-column grid, 20–24 px gutters, 24–32 px section spacing;
- each page flows summary→trend→drivers→detail/action queue→sources;
- filters stay in a single compact toolbar and show active scope clearly.

## Navigation

1. Today
2. Revenue
3. Usage
4. Costs & Margin
5. Tax & Payouts
6. Quality & Releases
7. Errors & Incidents
8. Privacy & Compliance
9. Growth & Experiments
10. Support
11. Forecast
12. Sources
13. Risk & Continuity
14. Corporate & Platform Calendar

## Status language

| Status | Meaning | Visual treatment |
|---|---|---|
| Proven/final/reconciled | evidence complete for stated scope | lime plus check and exact label |
| Estimate/pending | useful but not final | blue plus clock/tilde |
| Warning/stale/flaky | decision needs caution | amber plus cause and age |
| Failed/P0/P1 | action required | warm red plus owner/action |
| Not proven/no source/not run | no reliable conclusion | neutral gray hatched/outlined state |

Color never stands alone. “Green” requires a signed source/evidence state, not simply a
positive numeric trend.

## KPI cards

Each card owns one metric and must display:

- precise label and period;
- value/currency/unit and comparison basis;
- source-trust badge (`FINAL`, `ESTIMATE`, `PROVEN`, etc.);
- last complete source time and optional coverage;
- definition tooltip;
- drill-down target;
- warning when comparison/grain/source differs.

Do not combine independent metrics into tiny chips. Do not show large vanity numbers
without denominator, period or source.

## Charts

- line/area for one metric over time with release/incident annotations;
- bars for compatible channel/plan/country comparisons;
- waterfall for gross sales→tax/refunds→fees→net proceeds→cash;
- funnel for account→household→scan→batch→retained/premium activation;
- cohort heatmap only when group-size privacy thresholds are met;
- stacked bars for test states, entitlement states and cost mix;
- tables for reconciliation, deadlines, issues and action queues;
- never use a pie chart for close numeric comparison or dual axes that imply false links.

## CEO Today hierarchy

1. Global status: release proof, incidents, data freshness.
2. Money: final/provisional proceeds, cash, margin, tax state.
3. Business: MRR, conversion, retention, churn/refunds.
4. Quality: core-flow health, errors, tests, accessibility, Web Vitals and native vitals.
5. Actions: severity, euro/user impact, owner, due date and next action.
6. Survival: next 13-week cash trough, highest-velocity risk and nearest material
   corporate/platform deadline with source freshness.

If one C0/P0 condition exists, it becomes the first item and suppresses celebratory
growth treatment until acknowledged.

## Interactions and safety

- finance close, tax mapping, export, incident severity and rollout actions require
  confirmation, reason and recent AAL2;
- destructive/financial actions show exact scope and cannot be hidden in overflow menus;
- drill-down preserves filter/time/source context in the URL without private data;
- raw documents/source maps open only for authorized roles and access is audited;
- no arbitrary SQL console or user impersonation;
- A0/A1 actions are observational/routing; A2 protective actions show exact reversible
  scope and expiry; A3 always requires an authorized human approval;
- insolvency/tax/regulatory filing, legal classification, medical/food-safety decision
  and evidence deletion are never dashboard automations;
- charts/tables provide keyboard navigation, text summaries and exportable evidence.
- performance never appears as one opaque score: show p50/p75/p95, route/flow, release,
  device class, sample coverage and freshness; a failing cohort remains visible;
- usability cards show flow, research round, participant/context coverage, finding
  severity and retest state, never identifiable recordings or synthetic “user” evidence.

## Empty, stale and error states

The dashboard never substitutes zero for missing data.

- no source: show connector and required owner/action;
- stale: show last complete source period and exclude from final status;
- partial: show coverage and which territory/file is absent;
- parser/schema error: quarantine batch, retain prior final close, open C12 issue;
- mismatch: show both source totals and reconciliation difference;
- dashboard query error: keep last known value visibly stale and link safe reference.

## Responsive behavior

At 1024 px, cards form two/three columns, wide tables scroll inside labeled regions, and
the side navigation collapses to icons with accessible labels. Below 768 px, only Today,
urgent actions and incident/release summaries remain; complex close/reconciliation pages
ask for desktop rather than becoming unusable miniature tables.

## Visual QA

Capture 1440×900, 1280×800, 1024×768 and 390×844 for:

- healthy/proven current release;
- P0 incident and failed release;
- provisional daily finance data;
- reconciled monthly close;
- missing/stale connector;
- tax estimate vs adviser-approved/filed/paid;
- C13 current critical risk, accepted risk near expiry and no-source cash forecast;
- C14 domain/certificate/store/policy/legal deadline at 90/30/7/1 days;
- LCP/INP/CLS or native startup/frame/memory regression isolated to a route/device;
- critical usability finding due/blocked/retested and missing accessibility evidence;
- long German labels, large EUR values and negative/refund values;
- keyboard focus, high zoom, reduced motion and role-restricted drill-down.
