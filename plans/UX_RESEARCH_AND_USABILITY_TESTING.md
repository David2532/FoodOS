# FoodOS UX research and usability-testing plan

Status: **binding evidence plan** · Last reviewed: **2026-08-02**

FoodOS cannot infer usability from a polished mockup, event funnel or founder intuition.
This plan defines how the team learns whether people can complete the trusted food loop,
understand dates and ingredient relevance, recover from failure and still want the
product enough to return or pay.

Research is evidence for product decisions, not marketing content. Interviews, tests,
payments, retention and quotes are never fabricated. Small qualitative rounds reveal
problems; they do not statistically prove market-wide percentages.

## 1. Decisions this research must support

| Decision | Evidence required before commitment |
|---|---|
| Does the problem deserve a product? | observed current behavior, frequency/cost of inventory waste or planning friction, and credible alternatives people already use |
| Is scanning faster than manual tracking? | task observation from permission to confirmed physical batch, including ordinary EAN without an expiry date |
| Do people understand MHD versus use-by? | scenario comprehension and correct next action without moderator help |
| Does ingredient relevance build trust? | users can explain why an item is prioritized, distinguish personal allergen/exclusion from general evidence and notice unknown data |
| Does the weekly loop create repeat value? | concierge/closed-beta evidence that inventory informs meals/shopping and users return without prompting |
| Is mandatory 2FA proportionate and usable? | setup, routine challenge and lost-factor/recovery tests, including password-manager and accessibility users |
| Can offline/sync failure be recovered safely? | observed understanding of local, queued, synced, conflict and rejected states; no abandoned or duplicated intent |
| Can ads coexist with trust? | users identify permitted content as advertising, avoid accidental taps and report no perceived targeting from sensitive food/health data |
| Will anyone pay? | real pricing conversations followed by a real, cancellable test or beta purchase—not only stated enthusiasm |

## 2. Priority user groups

Recruit by behavior and context, not fictional personas:

- people moving into their first independent household;
- people already tracking pantry/freezer contents, meals or calories;
- shared households with conflicting shopping/inventory habits;
- people with a declared allergen, intolerance or dietary exclusion;
- people who regularly discard expired food or misunderstand food-date labels;
- iOS and Android users across low/mid/high device capability;
- people using VoiceOver, TalkBack, larger text, keyboard/switch or reduced-motion
  settings;
- people with low digital confidence, attention/cognitive load constraints or limited
  German literacy where the initial market permits;
- Free and Premium candidates with different willingness-to-pay.

The launch target remains 16+. Under-16 participants are not recruited without a
separately approved research/legal protocol.

Each round records a recruitment matrix. Avoid testing only with employees, friends,
designers or nutrition enthusiasts. The [GOV.UK recruitment guidance](https://www.gov.uk/service-manual/user-research/find-user-research-participants)
suggests a spread of backgrounds and typically 4–8 participants for an interview or
usability-test round; FoodOS normally uses 5–8 per distinct round and runs another round
after meaningful changes.

## 3. Research stages

### R0 – problem discovery

Goal: understand behavior before proposing the solution.

Methods:

- 8–12 semi-structured interviews across solo/shared households;
- contextual observation of how people currently put groceries away, check dates, plan
  a week and shop;
- artifact review with consent: paper lists, generic screenshots or anonymized workflow,
  never copied health/product history without a defined purpose;
- problem-frequency diary for 7–14 days with minimal, participant-controlled entries.

Exit evidence:

- at least three recurring problems are observed rather than merely endorsed;
- current alternatives and switching costs are documented;
- one narrow first value loop is selected;
- a continue, narrow, pivot or stop decision is recorded.

### R1 – concept and information architecture

Goal: find the smallest understandable product model.

Methods:

- low-fidelity task flows for Today, Inventory, Scan, Plan and Shopping;
- open/closed card sort or tree test for destinations and product details;
- comprehension probes for “Charge”, “MHD”, “Verbrauchsdatum”, “Rückruf”, “persönlich
  relevant”, “unbekannt” and sync states;
- compare calm status hierarchy against over-warning and under-warning variants.

Exit evidence:

- people can predict where scan, expiry, plan and shopping tasks live;
- terminology failures are fixed in the model, not explained away by onboarding;
- no concept encourages the belief that a normal EAN contains an expiry date or that
  FoodOS certifies food as safe.

### R2 – interactive prototype

Goal: validate the complete critical flows before expensive platform work.

Run moderated sessions of roughly 30–60 minutes, consistent with the
[GOV.UK usability-testing guidance](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing).
Do not pack every FoodOS feature into one session; use focused task sets.

Required task sets:

1. create an account, enroll TOTP and reach a usable household;
2. scan an ordinary EAN, recognize missing expiry, confirm date/type/lot and add stock;
3. inspect ingredients with a matching allergen and one unknown evidence state;
4. book consumption and explain the changed day/week values;
5. turn a weekly plan into shortages while preserving a manual shopping item;
6. respond to exact, possible and stale recall scenarios;
7. perform an action offline, then resolve a deliberate multi-device conflict;
8. export/delete or recover an account without an unsafe support bypass.

Exit evidence:

- every recurring critical issue has an owner and retest plan;
- the critical path can be completed without moderator rescue by the intended users;
- safety, privacy or destructive-state misunderstanding blocks progression regardless of
  visual polish.

### R3 – concierge beta

Goal: test repeat value before automating the whole platform.

- 10–20 consenting Germany-first households for four to six weeks;
- team may perform clearly disclosed back-office steps, but user-visible results remain
  source-backed and auditable;
- weekly check-in on value, friction, abandoned scans, correction burden and trust;
- test one real pricing proposition and cancellation/refund path;
- no ads until core privacy and value are demonstrated.

Exit evidence:

- the trusted core loop is used repeatedly without researcher prompts;
- correction rate and time-to-confirm are low enough to make scanning a net benefit;
- a meaningful subset accepts a real paid proposition or evidence supports changing it;
- support and data-correction workload has a credible operating cost.

### R4 – closed native beta

Goal: prove platform behavior, not only concept comprehension.

- TestFlight and Play internal/closed tracks;
- pinned low/mid/reference devices, large text and assistive-technology participants;
- real camera, poor network, offline, notifications, purchase/restore and update/rollback;
- collect privacy-safe task timing, vitals and support themes;
- interview churned/abandoned users, not only engaged users.

Exit evidence:

- usability, performance, safety, privacy and support gates pass for the exact build;
- store listing and onboarding accurately describe current capability;
- rollout can be paused and users can recover without data loss.

### R5 – continuous live research

The [GOV.UK live-research guidance](https://www.gov.uk/service-manual/user-research/user-research-in-live)
correctly treats launch as the beginning of changing needs, not the end of research.

- monthly support/error/review theme synthesis;
- at least one focused usability round per material flow redesign;
- quarterly interview mix includes new, retained, churned, accessibility and paying users;
- research the tails behind performance/funnel metrics before asserting causality;
- maintain a public-facing correction/support path and a private research repository.

## 4. Session protocol

### Before the session

1. Define no more than three primary research questions.
2. Write realistic tasks without naming the UI control to click.
3. Prepare deterministic fake products, dates, allergies and recalls; never ask a
   participant to expose real sensitive data merely to test the interface.
4. Pilot once with someone outside the product team.
5. Send a plain-language information sheet covering purpose, recording, incentive,
   withdrawal, retention and contact path.
6. Collect separate, revocable consent for participation and recording.
7. Record accessibility, language, remote/in-person and device accommodations.

### During the session

- state that the product—not the participant—is being tested;
- ask the participant to think aloud, but allow silence during high-cognitive tasks;
- do not teach the model before testing comprehension;
- note behavior and exact point of friction before asking opinions;
- use neutral probes: “What do you expect now?” and “What tells you that?”;
- log moderator assistance as a task failure/assisted completion, not success;
- stop if the prototype creates distress around allergy, weight, safety or deletion;
- never encourage consumption of a real product based on a prototype result.

### After the session

- debrief immediately with observation, impact, confidence and evidence link;
- separate observation (“participant tapped back three times”) from interpretation
  (“navigation label may be unclear”);
- remove unnecessary personal detail from notes;
- allow participants to withdraw within the stated period;
- convert findings into owned decisions or explicitly archived non-actions;
- retest the fixed behavior with new representative participants.

## 5. Task measurement

Qualitative observation is primary; metrics make comparisons and release decisions more
consistent.

| Measure | Definition | Interpretation rule |
|---|---|---|
| unassisted task completion | intended end state reached with no moderator instruction | report numerator/denominator and participant context, not a fake precise population rate |
| assisted completion | end state reached after a hint or recovery instruction | never merge into unassisted success |
| critical error | action could create unsafe date/recall behavior, expose data, lose confirmed intent, charge incorrectly or delete the wrong scope | one credible recurring critical pattern blocks release until fixed/retested |
| time on task | from scenario start to authoritative completion | compare within the same task/device/data condition; do not reward unsafe speed |
| correction burden | manual edits and seconds between local decode and confirmed batch | scanner is valuable only if burden beats manual entry for target users |
| comprehension | participant explains status and next consequence in their own words | a correct click with an incorrect mental model is not success |
| confidence/ease | single post-task rating plus reason | supporting signal only; behavior overrides politeness bias |
| recovery success | user returns to a trustworthy state after permission/offline/provider/conflict failure | retry loops and abandoned intent are failures |
| accessibility friction | extra navigation, clipped/reordered content, unlabeled control or impossible action with assistive tech | treated as a product defect, not a special participant issue |

### Initial decision thresholds

These thresholds are product gates and are deliberately conservative. They are revised
only through a recorded decision, never to make a failed round look green.

- No unresolved critical safety, privacy, billing, deletion or data-loss comprehension
  issue may ship.
- In the final pre-beta round, at least 5 of 6 representative participants must complete
  the core scan-to-batch task unassisted; any common failure triggers another iteration.
- Every participant must correctly distinguish the consequence of a use-by date from an
  MHD after using the flow; copy that requires moderator teaching fails.
- At least 5 of 6 must correctly identify personal allergen relevance, evidence-backed
  note and unknown data without interpreting the view as a universal safety score.
- Accessibility participants must complete the same outcome, with reasonable differences
  in time/input method, not a reduced feature path.
- Beta continuation also requires behavioral evidence: repeated trusted-core-loop use,
  correction/support cost and real willingness-to-pay. Prototype task success alone does
  not authorize full commercial build-out.

Small samples make these thresholds iteration triggers, not claims of statistical
certainty. Closed-beta telemetry and further research must confirm scale behavior.

## 6. Research scenarios and fixtures

Fixtures are versioned, fictional and clearly labelled:

| Fixture | Purpose |
|---|---|
| ordinary EAN with product metadata but no date | prove FoodOS asks for date/type instead of inventing one |
| GS1 code with `(01)`, date and lot | prove deterministic parse and confirmation |
| ambiguous OCR `03/08/26` | prove locale/type/confidence confirmation |
| MHD yesterday | prove quality wording and user judgment without false danger/safety |
| use-by yesterday | prove no consumption recommendation |
| allergen match plus unknown ingredient | prove precedence and uncertainty |
| exact lot recall / GTIN-only possible / stale source | prove distinct action and trust states |
| two devices editing quantity offline | prove visible conflict and preserved intent |
| ad timeout in permitted inventory overview | prove reserved space collapses without CLS or blocked action |

Fixtures contain no real participant account, product history or sensitive profile.

## 7. Findings and decision repository

Each finding record contains:

- stable ID such as `UX-F02-2026R2-004`;
- research question, round and anonymized participant IDs;
- direct observation/evidence location;
- affected flow/screen/state and user group;
- severity: critical, major, moderate, minor;
- frequency within the round without extrapolating to the population;
- proposed change, owner, due date and linked issue/PR;
- decision: fix now, experiment, accept temporarily with expiry, or reject with reason;
- retest result and build/commit.

Record the smallest useful personal data. Raw recordings have a short, declared
retention; redacted findings last only as long as needed for product evidence. Access is
role-limited and deletion/withdrawal propagates to the research repository. The data
processing register must be updated before recruiting real participants.

## 8. Research operations and bias controls

- A researcher/moderator cannot mark their own preferred design successful without the
  captured task evidence.
- Rotate observers and include engineering/support in sessions without letting a room of
  observers intimidate participants.
- Separate discovery questions from sales. An incentive is compensation for time, not a
  purchase discount contingent on praise.
- Include users who abandoned onboarding, denied camera permission, stopped scanning or
  canceled Premium.
- Test German long text and plain-language alternatives; do not interpret slow reading as
  lack of interest.
- Alternate concept order where comparison could create order bias.
- Do not use generative AI to fabricate participants, quotes, sessions or evidence.
  Synthetic critique may help prepare scenarios but is labelled and never satisfies a
  gate.

## 9. UX debt register

An unresolved usability issue is tracked like technical debt:

| Field | Required value |
|---|---|
| ID / flow / state | stable traceability |
| evidence | session, support case, analytics anomaly or accessibility audit |
| affected group | who cannot or struggles to complete the task |
| consequence | task delay, abandonment, misunderstanding, safety/privacy risk |
| workaround | current user recovery, if any |
| owner / target release | accountable decision |
| expiry | mandatory for accepted critical/major debt |
| retest | required evidence to close |

Critical UX debt appears in the CEO action queue and release proof. It cannot be hidden
as a cosmetic backlog item.

## 10. Research release gate

A major flow is ready to ship only when:

- the research question, recruitment matrix, tasks, consent and fixtures are archived;
- findings distinguish observation from interpretation and link to owned decisions;
- no unresolved critical issue remains;
- material changes were retested with new representative users;
- accessibility users reached the same product outcome;
- behavioral/field metrics have privacy-safe definitions and do not replace research;
- the result belongs to the same flow and materially similar UI as the release;
- the product, legal and commercial owner records continue/narrow/pivot/stop.
