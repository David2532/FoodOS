# FoodOS production-beta traceability matrix

Status: **living audit for Draft PR #5** · Baseline commit: `c6e610b2373b8c231514948ef867adcbfb59c9ca`

This matrix separates code, test and external evidence. `CI_VERIFIED` is used only when
the exact artifact was exercised by GitHub Actions; `TESTED` means a named local test
exists and passed; `IMPLEMENTED` means code exists but the full required evidence does
not. `EXTERNALLY_BLOCKED` is reserved for evidence that cannot be created in code.
`NOT_APPLICABLE` is used only where the binding Stage -1 decision explicitly pauses the
expansion. `NOT_IMPLEMENTED` is a temporary audit value for technical gaps: it is kept
despite the requested completion-only enum because silently mapping missing code to an
implemented or external state would be a false success claim. It must be eliminated or
converted to an evidence-backed state before the technical audit can close.

| Requirement / gate | Flow / risk | Status | Implementation evidence | Test / CI evidence and remaining gap |
|---|---|---|---|---|
| Locked install, lint, types, unit tests and production build | Stage 0 | `CI_VERIFIED` | `package.json`, `.nvmrc`, `.github/workflows/ci.yml` | Run 30762233802 passed on Node 22; current local verify passes 28/28 tests and production build on Node 25.2.1. |
| Email auth, SSR session refresh and TOTP AAL2 gate | F01 / C0 | `TESTED` | `src/features/auth/`, `src/lib/supabase/`, `src/proxy.ts`, migration `0002` | `e2e-auth/authenticated-core.spec.ts` passed locally; recovery codes, factor replacement and all-device session revocation remain `NOT_IMPLEMENTED`. |
| Transactional household onboarding | F01 / C1 | `TESTED` | migration `0003`, `src/features/auth/onboarding-screen.tsx` | pgTAP and real local Auth/TOTP E2E passed. |
| AAL1 denial and household isolation | F01 / C0 | `TESTED` | migrations `0001`–`0005` | `supabase/tests/0001_mvp_security_and_transactions.sql` proves AAL1 denial and a second unrelated user; removed-member matrix is not yet covered. |
| Barcode/GS1/manual product capture without invented date | F02 / C0 | `TESTED` | `src/domain/gs1.ts`, `src/components/scan-view.tsx`, product API | Unit/property and preview E2E exist; authenticated scan→batch browser E2E is not yet present. |
| Cache-first Open Food Facts allowlist and provenance | F02 / C1 | `TESTED` | `src/app/api/products/[barcode]/route.ts`, `src/lib/open-food-facts.ts`, `src/lib/product-cache.ts` | Contract/unit tests pass; payload hash, parser version, circuit breaker, retries and stale-while-revalidate are `NOT_IMPLEMENTED`. |
| Manual OCR fallback never fabricates a result | F02 / C0 | `TESTED` | `src/infrastructure/expiry-ocr-adapter.ts` | Unit test passes; no approved OCR model/provider is configured. |
| Past use-by cannot be consumed through UI, API or RPC | F02/F04 / C0 | `TESTED` | migration `0008`, `inventory-view.tsx`, expiry domain | pgTAP proves the RPC block; UI removes the consumption action; authenticated browser E2E remains to add. |
| Past MHD requires warning and deliberate confirmation | F02/F04 / C0 | `TESTED` | migration `0008`, `inventory-view.tsx` | pgTAP proves reject-without/accept-with-confirmation; authenticated browser E2E remains to add. |
| Exact recall blocks affected batch consumption and planning | F07 / C0 | `TESTED` | migrations `0008`/`0009`, repository recall projection, inventory UI | pgTAP proves approved exact GTIN+lot blocks consumption and plan allocation; live ingestion/E2E remains absent. |
| Possible, stale, unavailable and false-positive recall states expose provenance | F07 / C0 | `IMPLEMENTED` | `src/domain/recall.ts`, repository projection, inventory/Today warnings | Unit rules pass; correction chain and authenticated integration/E2E remain absent. |
| Approved official recall ingestion, quarantine and freshness monitoring | F07 / C0 | `NOT_IMPLEMENTED` | Source/event schemas exist in migration `0007` | No live source is claimed; approved terms/production access remain externally reviewable after adapter completion. |
| Personal allergen/intolerance/exclusion profile drives assessment | F03 / C0 | `TESTED` | product API profile load, deterministic domain rule, scan/inventory confirmation, migration `0008` | Unit and pgTAP tests prove priority and confirmation boundary; profile editing and multi-user browser E2E remain absent. |
| Idempotent batch intake and consumption exactly once | F02/F04/F08 / C0 | `TESTED` | payload-hashed mutation receipts in migration `0008` | pgTAP proves same-payload replay and different-payload rejection; a true parallel scheduler test remains to add. |
| Atomic consumption ledger/log/balance | F04 / C0 | `TESTED` | migrations `0003` and `0005`, inventory UI | pgTAP proves one atomic effect and append-only client boundary; parallel scheduling test is missing. |
| Plan entries persist idempotently | F05 / C1 | `TESTED` | migration `0006`, `src/components/plan-view.tsx` | pgTAP proves sequential replay; reused ID with different payload is not rejected. |
| Plan minus usable inventory is deterministic and removes stale shortages | F05 / C1 | `TESTED` | FEFO/date/recall allocation and advisory lock in migration `0009` | pgTAP proves planned-use-date filtering, coverage recalculation, stale auto-item removal and manual intent retention. |
| Manual shopping intent and checked state persist | F05 / C1 | `TESTED` | migration `0006`, Shopping UI | pgTAP proves manual item retention/addition and checked state. |
| Durable IndexedDB outbox, device identity, revisions and conflict UX | F08 / C0 | `NOT_IMPLEMENTED` | Offline page and static service worker only | No outbox/state-machine/multi-device E2E exists. |
| Security headers, CSP, Origin/CSRF, rate limits and SSRF controls | Security / C0 | `IMPLEMENTED` | baseline headers in `next.config.ts`; fixed OFF origins | CSP, route rate limiting, explicit Origin policy and adversarial tests remain missing. |
| Typed/redacted telemetry, correlation IDs, health/readiness and incident runbooks | Ops / C0 | `NOT_IMPLEMENTED` | Error result type and safe static references only | No OTel adapter/collector, health endpoints, redaction tests or incident runbooks. |
| Data export and expiring download | F06 / C1 | `NOT_IMPLEMENTED` | Data register specifies contract | No schema/job/UI/integration test. |
| Account/household deletion, retention jobs and backup tombstones | F06/F08 / C0 | `NOT_IMPLEMENTED` | Data register specifies contract | No schema/job/UI/restore test. |
| Versioned consent, withdrawal, necessary-only defaults and age gate | F00 / C0 | `NOT_IMPLEMENTED` | Legal register specifies separated purposes | No ledger/UI/network test. |
| Separately protected Ops/CEO console with real/no-source states | C01–C14 / C0 | `NOT_IMPLEMENTED` | Binding plans and `design-ceo.md` only | No runtime route, RBAC, immutable audit or connected source. |
| Safe disabled analytics/error/payment/ad provider adapters | F06/Ops / C0 | `NOT_IMPLEMENTED` | Provider boundaries documented only | No runtime adapters; demo money must remain absent. |
| Installable PWA and honest offline fallback | Stage 7 / C2 | `TESTED` | manifest, service worker, `/offline` | Preview Playwright passed after earlier fixes; durable offline mutation support is not claimed. |
| Compact and adaptive web shell, keyboard and axe smoke | UI / C2 | `TESTED` | `src/app/globals.css`, consumer components | Pixel-7/Desktop preview E2E 4/4 passed on last local run; full viewport/AT/performance matrix is not proven. |
| Native Expo iOS/Android product and Maestro/store sandbox | Stage 7/8 | `NOT_APPLICABLE` | None by design | Binding Stage -1 decision pauses native expansion until representative validation evidence. |
| Live subscriptions, advertising and revenue ledger | Stage 8 | `NOT_APPLICABLE` | None by design | Binding Stage -1 decision pauses monetization; no prices, payments or revenue are claimed. |
| Production Supabase/Vercel deployment and real URL smoke | Stage 9 | `NOT_IMPLEMENTED` | Vercel/Docker configuration exists | No remote project, deployment ID or verified URL exists. |
| Reproducible Docker image and self-host hand-off | Stage 9 / C1 | `IMPLEMENTED` | `Dockerfile`, `deploy/self-hosted/` | Docker build, clean-VM migration, backup/restore and TLS exposure evidence are not yet run. |
| Representative interviews and problem evidence | Stage -1 | `EXTERNALLY_BLOCKED` | Recruitment/research protocols in plans | Requires real recruited participants; none are fabricated. |
| Representative usability rounds and critical-flow retest | Stage -1 | `EXTERNALLY_BLOCKED` | Tasks, fixtures and thresholds are specified | Requires real target users including accessibility contexts. |
| Concierge beta, repeat use and willingness-to-pay | Stage -1 | `EXTERNALLY_BLOCKED` | Beta/price-test protocol is specified | Requires a real cohort and real cancellable offer/sandbox transaction. |
| Professional FoodOS name/mark/domain clearance | Stage -1 / legal | `EXTERNALLY_BLOCKED` | Preliminary collision warning documented | Requires counsel/qualified trademark clearance; FoodOS remains a codename. |
| Germany legal/country/store approvals | Stage 10 / legal | `EXTERNALLY_BLOCKED` | Compliance and data registers exist | Requires entity/vendor-specific legal, food, privacy, tax and store sign-off on the exact build. |

## Audit rule

Rows are promoted only with named code and reproducible evidence. A plan, schema stub,
preview card or passing unrelated test cannot promote a row. The final technical audit
must contain no `NOT_IMPLEMENTED`; gated expansion remains `NOT_APPLICABLE` until the
Stage -1 decision changes, and genuinely human/professional evidence remains
`EXTERNALLY_BLOCKED`.
