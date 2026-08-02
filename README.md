# FoodOS (Arbeitstitel)

FoodOS verbindet Vorrat, MHD/Charge, Barcode-Metadaten, persönliche
Inhaltsstoffrelevanz, Produktrückrufe, Ernährung, Wochenplanung und Einkauf. Das vorhandene Next.js-
Produkt ist Web-App, API-Ausgangspunkt und funktionaler Prototyp für eine kommerzielle
native iOS-/Android-App.

Die geplante Erstveröffentlichung ist Deutschland/EU-first, ab 16 Jahren, mit
obligatorischem TOTP-2FA für private Haushaltsdaten. Monetarisiert wird primär über ein
optionales Premium-Abo; die kostenlose Version darf nur kontextuelle, nicht
personalisierte Werbung außerhalb sensibler Flows zeigen.

## Stack

- Next.js 16 + TypeScript
- Supabase Postgres/Auth/Storage mit Row Level Security
- Open Food Facts mit lokalem Cache
- ZXing Browser für EAN/UPC/GS1-Scans
- Vitest für deterministische Fachlogik
- Next.js Standalone-Output für Vercel oder Docker

Zielarchitektur: Expo/React Native für die Store-Apps, Next.js für Web/Konto/Support und
gemeinsame reine Domain-Pakete. Eine reine WebView-Hülle ist kein Release-Kandidat.

## Lokal starten

```bash
cp .env.example .env.local
npm install
npm run dev
```

Ohne Supabase-Variablen startet die Oberfläche im Preview-Modus. Der Barcode-Lookup funktioniert serverseitig über Open Food Facts.

## Verifizieren

```bash
npm run verify
```

Node.js 22 is pinned in `.nvmrc`. GitHub CI runs the same locked install and verification
for pull requests and `main`. The larger web/native/security/release suite described in
the plans is not implemented merely because this baseline passes.

## Mit Codex weiterarbeiten

Codex or another implementation agent should read, in order:

1. [`AGENTS.md`](AGENTS.md) for non-negotiable repository rules;
2. [`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md) for current versus planned state,
   document precedence and the vertical-slice workflow;
3. [`plans/MASTER_PLAN.md`](plans/MASTER_PLAN.md) and the current validation/delivery gate;
4. the exact user flow, specialist plan and quality/test contracts for the selected slice.

[`CODEX_PROMPT.md`](CODEX_PROMPT.md) is the comprehensive build brief. It does not turn
unimplemented stages into a safe one-commit task or authorize fabricated users, metrics,
approvals, deployments or legal conclusions.

## Produkt-, Design- und Umsetzungsunterlagen

- [`plans/MASTER_PLAN.md`](plans/MASTER_PLAN.md): ultimativer Gesamtplan und kritischer Release-Pfad
- [`plans/GAP_AUDIT_AND_OPTIMIZATION.md`](plans/GAP_AUDIT_AND_OPTIMIZATION.md): Red-Team-Lücken, Keep/Change/Add/Defer und neue P0-Gates
- [`plans/COMPETITIVE_RESEARCH_AND_VALIDATION.md`](plans/COMPETITIVE_RESEARCH_AND_VALIDATION.md): ähnliche Apps, Nutzerprobleme, Validierung und Pivot-/Stop-Regeln
- [`design.md`](design.md): verbindliches Designsystem und UI-Abnahmekriterien
- [`plans/UI_UX_PERFORMANCE_PLAN.md`](plans/UI_UX_PERFORMANCE_PLAN.md): aktuelle Apple-/Android-/Web-Regeln, adaptives UI, Accessibility und messbare Performance-Budgets
- [`plans/UX_RESEARCH_AND_USABILITY_TESTING.md`](plans/UX_RESEARCH_AND_USABILITY_TESTING.md): Research-Runden, Aufgaben, Teilnehmer, Messung und Stop-/Retest-Gates
- [`mockups/README.md`](mockups/README.md): visuelle North-Star-Mockups und Screen-Katalog
- [`plans/USER_FLOWS.md`](plans/USER_FLOWS.md): verbindliche End-to-End-Nutzerflüsse
- [`plans/ARCHITECTURE_PLAN.md`](plans/ARCHITECTURE_PLAN.md): Zielarchitektur und Modulgrenzen
- [`plans/IMPLEMENTATION_PLAN.md`](plans/IMPLEMENTATION_PLAN.md): priorisierte Umsetzung mit Exit-Gates
- [`plans/COMMERCIAL_PRODUCT_PLAN.md`](plans/COMMERCIAL_PRODUCT_PLAN.md): Markt, Produkt, Premium und Werbegrenzen
- [`plans/AUTH_AND_SELF_HOSTING.md`](plans/AUTH_AND_SELF_HOSTING.md): verpflichtendes AAL2/TOTP und portables Docker-Ziel
- [`plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md`](plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md): amtliche Rückrufe, Match-Qualität und Food-Safety-Daten
- [`plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md`](plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md): verlustfreie Offline-Outbox, Konflikte und Tombstones
- [`plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md`](plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md): Threat Model, MFA-Recovery, OCR/AI und signierte OTA-Updates
- [`plans/APP_STORE_RELEASE_PLAN.md`](plans/APP_STORE_RELEASE_PLAN.md): Apple-/Google-Submission und Go/No-Go
- [`legal/COMPLIANCE_MATRIX.md`](legal/COMPLIANCE_MATRIX.md): Deutschland-/EU-Anforderungen und Länder-Release-Gate
- [`legal/DATA_PROCESSING_REGISTER.md`](legal/DATA_PROCESSING_REGISTER.md): Datenzwecke, Einwilligungen, Aufbewahrung und Löschung
- [`plans/QUALITY_ENGINEERING_PLAN.md`](plans/QUALITY_ENGINEERING_PLAN.md): vollständige Teststrategie, CI-Gates und Release-Evidence
- [`plans/TEST_TRACEABILITY_MATRIX.md`](plans/TEST_TRACEABILITY_MATRIX.md): Flow-, Risiko-, Backend- und RLS-Testabdeckung
- [`plans/OBSERVABILITY_AND_ERROR_CONSOLE.md`](plans/OBSERVABILITY_AND_ERROR_CONSOLE.md): Fehlerkonsole, Telemetrie, SLOs und Incidents
- [`plans/CEO_CONTROL_CENTER.md`](plans/CEO_CONTROL_CENTER.md): CEO-Zentrale für Umsatz, Abos, Nutzung, Kosten, Steuer, Qualität und Aktionen
- [`plans/CEO_RISK_AUTOMATION.md`](plans/CEO_RISK_AUTOMATION.md): Liquidität, Unternehmensrisiken, Fristen und sichere Automatisierung
- [`design-ceo.md`](design-ceo.md): Desktop-Designsystem der internen CEO-/Ops-Zentrale
- [`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md): Codex-Lesereihenfolge, Ist-/Zielstand und Dokument-Priorität
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md): Evidence-basierte Go/Limited-Beta/No-Go-Vorlage
- [`CONTRIBUTING.md`](CONTRIBUTING.md): Branch-, Clean-Code-, Test- und PR-Workflow
- [`SECURITY.md`](SECURITY.md): privater Schwachstellen-Meldeweg und Security-Baseline

## Datenbank

Die Migrationen unter `supabase/migrations/` enthalten das Haushaltsmodell, Produkt- und
Metadatenfelder, chargenbezogene MHD-Daten, Inhaltsstoffbewertungen, Vorrat, Food-Log,
Rezepte, Wochenplan, Einkauf und RLS-Policies. Private Tabellen müssen zusätzlich einen
AAL2-Claim verlangen.

## Vercel

1. Repository in Vercel importieren.
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (oder den Legacy-
   Anon-Key) und `OPEN_FOOD_FACTS_USER_AGENT` setzen.
3. Production-Deployment ausführen.

`SUPABASE_SERVICE_ROLE_KEY` ist nur für spätere serverseitige Adminjobs vorgesehen und darf nie als `NEXT_PUBLIC_*` gesetzt werden.

## Rechtlicher Status

Die Unterlagen bilden eine technische und organisatorische Compliance-Baseline, keine
Rechtsberatung oder weltweite Compliance-Zertifizierung. Vor dem kommerziellen Release
müssen Rechtsberatung, DPIA/Datenschutz-Folgenabschätzung, Verträge, Store-Angaben,
Lebensmittel-Claims, Werbung, Barrierefreiheit und das konkrete Land freigegeben sein.

## Aktueller Reifegrad

Die neuen Unterlagen sind Ziel- und Release-Spezifikationen, keine Behauptung, dass diese
Funktionen bereits implementiert sind. Der aktuelle Prototyp hat Auth-/AAL2-Grundlagen,
UI und drei Unit-Tests. Recall-Pipeline, native Offline-Synchronisation, Playwright/
Maestro/pgTAP-Gesamtsuite, signierte OTA-Governance und die echte CEO-Zentrale müssen in
den dokumentierten Stufen noch gebaut, mit Live-Quellen verbunden und bewiesen werden.
Die UI-/Performance-Zielwerte sind ebenso Release-Gates: Aktuell existieren noch keine
Produktions-RUM-Daten, native Release-Build-Messungen oder abgeschlossenen echten
Usability-Runden. Das Repository sollte bis zur Marken-, Sicherheits- und Rechtsfreigabe
privat bleiben und enthält derzeit keine Open-Source-Lizenz.
