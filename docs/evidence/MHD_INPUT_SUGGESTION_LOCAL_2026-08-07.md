# Local evidence: reviewable MHD input suggestion

Date: **2026-08-07**
Branch: `agent/product-mhd-estimates`
Base: `62a945bbbeb64222aebb5d783023cafef7cb63ff`

Status: **PASS locally** for the implemented C0 scan/capture slice. This document does
not claim a Production deployment, a managed Supabase schema change, manufacturer shelf
life data, or a real-device VoiceOver/TalkBack test.

## Delivered behavior

- A purchase session starts with today's calendar day in `Europe/Berlin`; the user can
  select an earlier purchase day once for the whole session.
- A source-backed product in the exact refrigerated yogurt category receives a transient
  `+7` calendar-day **FoodOS MHD suggestion** based on that purchase day.
- The proposal is explicitly labelled as not coming from the package. It is never added
  to GS1 facts, the capture signature, FEFO, planning, or the database by estimation alone.
- One tap on `Stimmt mit Packung überein` persists the inspected value for exactly the
  checked package as `manual_confirmed`. The user may edit it first or finish without
  any date.
- When identical scans have been aggregated, FoodOS splits off one checked package and
  leaves the remaining quantity without a date for its own package review. A date check
  never confirms an existing lot or serial number implicitly.
- A use-by date is never inferred. Existing GS1 MHD/use-by facts, manually named products,
  other storage locations, invalid dates, and non-matching categories suppress the rule.
- The selected purchase day stays a date-only input to the suggestion rule. FoodOS does
  not invent an exact `purchased_at` time from that calendar day.
- Quantity controls meet the FoodOS 48 CSS-pixel target. The review actions no longer
  obscure the proposal at short desktop or mobile viewports.
- After confirmation, keyboard and screen-reader focus moves to the visible result and
  the existing polite live region announces what changed and which facts remain open.

This boundary follows the public food-safety distinction: the manufacturer determines
the product MHD from product-specific knowledge and testing; FoodOS therefore provides
only an input aid until the package is checked. See
[BMEL](https://www.bmel.de/DE/themen/ernaehrung/lebensmittelverschwendung/mindesthaltbarkeit-kein-verfallsdatum.html)
and [BZfE](https://www.bzfe.de/kueche-und-alltag/kochen/haltbarkeit-von-lebensmitteln).

## Executed local evidence

| Check | Result |
| --- | --- |
| Focused domain/contract/component tests | **PASS** — 4 files / 52 tests |
| `npm.cmd run verify` | **PASS** — company registry, ESLint, TypeScript, 73 files / 368 tests, Production build |
| `npm.cmd run verify:changed -- --base=agent/atomic-inventory-disposal` with process-local public local-Supabase values | **PASS** — related tests, types, changed-UI lint, build, database/RLS and authenticated E2E |
| `npm.cmd run test:db` | **PASS** — 12 pgTAP files / 478 assertions |
| `playwright test --workers=2` | **PASS** — 16/16 mobile and desktop preview scenarios |
| `npm.cmd run test:e2e:auth` with process-local public local-Supabase values | **PASS** — 7/7 real local OAuth/PKCE, TOTP/AAL2, household, nutrition, offline and disposal flows |
| Independent visual QA | **PASS** — previous HOLD findings fixed and reverified |

Earlier browser attempts are not reported as successes: one run used 16 simultaneous
workers and another shared a changing `.next` directory with a second verifier server.
Those runs produced missing hydration/static chunks. The verifier server was stopped,
the Production bundle rebuilt in isolation, and the preview suite gained an explicit
React-hydration gate before interaction. The final isolated run passed 16/16.

During the final safety rerun, one sandboxed Playwright launch was blocked with `EPERM`
and one changed-gate build was blocked with `EBUSY` while the controlled visual-QA server
held `.next/standalone`. Neither is reported as a product success. Chromium was rerun with
the required local execution permission, the exact QA server process was stopped after
verification, and the subsequent isolated preview and changed-gate runs both passed.

## Visual and accessibility evidence

Independent browser QA reverified the final Production bundle at `360x800`, `390x844`,
`430x932`, and `1280x720`, in light mode plus a dark-mode regression:

- zero horizontal overflow and zero CTA/bottom-navigation overlap;
- quantity buttons at least `48x48` CSS pixels;
- zero axe serious/critical findings before and after confirmation;
- no console errors, page errors, or HTTP responses at or above 400;
- before confirmation: no confirmed checkbox and no use-by field;
- after confirmation: `Bestätigte Packungsangabe`, checked package confirmation, the
  reviewed MHD, focus on the visible result, and still no use-by field;
- aggregated duplicates retain the exact total quantity while only the checked package
  receives the date; unreviewed lot/serial facts remain an explicit blocking checkbox.

Privacy-safe synthetic screenshots:

- [`mhd-proposal-chromium-desktop.png`](screenshots/mhd-proposal-chromium-desktop.png)
- [`mhd-proposal-chromium-mobile.png`](screenshots/mhd-proposal-chromium-mobile.png)

## Explicitly not proven

- **NOT_RUN:** VoiceOver and TalkBack on physical devices.
- **NOT_RUN:** managed Supabase or Vercel Production deployment and Production telemetry.
- **NOT_APPLICABLE:** database migration; the session purchase day is only a date-based
  suggestion input and is not persisted as an invented timestamp.

No secret, Production database, user household, active catalog generation, or unrelated
repository change was modified for this slice.
