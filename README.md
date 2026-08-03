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
npm exec supabase start
npm exec supabase db reset -- --local --no-seed
npm run dev
```

`npm exec supabase status` zeigt die ausschließlich lokalen URL-/Publishable-Key-Werte,
die in `.env.local` gehören. Keine Secret-/Service-Role-Keys in Client-Variablen oder Git
ablegen. Ohne Supabase-Variablen startet die Oberfläche im klar gekennzeichneten
Preview-Modus. Der Barcode-Lookup funktioniert dann serverseitig über Open Food Facts;
private Haushaltsdaten werden nicht simuliert.

## Verifizieren

```bash
npm run verify
npm run test:coverage
npm run test:db
npm run test:e2e
npm audit --audit-level=high
```

Node.js 22 is pinned in `.nvmrc`. GitHub CI runs the same locked install and verification
for pull requests and `main`. `test:db` requires the local Supabase Docker stack;
`test:e2e` builds the app and checks Pixel-7/Desktop-Chrome profiles with Playwright and
axe. A passing local subset is not production, native-device, usability, restore, load,
store-sandbox or legal evidence.

Für den echten lokalen Auth-Flow zuerst die von `npm exec supabase status` ausgegebenen
`API_URL`/`PUBLISHABLE_KEY` als `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nur in der aktuellen Shell setzen und dann
`npm run test:e2e:auth` ausführen. Der Test registriert eine isolierte Identität, schreibt
und verifiziert TOTP und legt den Haushalt an; anschließend die lokale Testdatenbank mit
`npm exec supabase db reset -- --local --no-seed` bereinigen.

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
AAL2-Claim verlangen. Die neueren Forward-Migrationen ergänzen transaktionales
Onboarding, idempotentes Erfassen/Verzehren, explizite Data-API-Rechte, append-only
Inventar-Events sowie persistente Plan-/Einkaufs-RPCs. Die C0-Forward-Migrationen binden
Mutation-IDs an einen Payload-Hash, sperren überschrittene Verbrauchsdaten und exakte
Rückrufe, verlangen eine bewusste MHD-/Risikobestätigung und berechnen Fehlmengen per
geplantem Nutzungstag mit FEFO-Zuordnung. `supabase/tests/` beweist AAL1-Verweigerung,
zweiten Nutzer, Haushaltsisolation, Replay/Payload-Konflikt, Safety-Sperren und atomare
Mengen-/Logwirkung.

## Vercel

1. Repository in Vercel importieren.
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (oder ausschließlich
   den Legacy-Anon-Key), `OPEN_FOOD_FACTS_USER_AGENT` sowie die server-only Recall-
   Variablen aus `.env.example` setzen.
3. Production-Deployment ausführen.

### Apple und Google OAuth 2.0 / OpenID Connect

FoodOS stellt Apple und Google als primäre Ein-Klick-Anmeldung vor die eingeklappte
E-Mail-Alternative. Beide laufen über Supabase Auth mit PKCE. Google fordert nur
`openid email profile`, Apple nur `name email` an. OAuth liefert zunächst AAL1; bevor
private Haushaltsdaten geladen werden, muss weiterhin TOTP AAL2 herstellen. Die
Supabase-Sitzung bleibt danach auf dem Gerät erhalten, bis sie abgemeldet wird oder
abläuft.

1. In Google Cloud einen Web-OAuth-Client anlegen. Als autorisierte Redirect-URI
   ausschließlich die von Supabase angezeigte Provider-Callback-URL
   `https://<project-ref>.supabase.co/auth/v1/callback` eintragen.
2. Client-ID und Client-Secret nur im Supabase-Dashboard unter **Authentication →
   Providers → Google** speichern. Diese Werte gehören weder nach Vercel noch ins Repo.
3. In Supabase unter **Authentication → URL Configuration** die echte Production-Site-
   URL setzen und `https://<production-host>/auth/confirm` als exakte Redirect-URL
   erlauben. Keine Wildcards für Production verwenden.
4. Erst danach in Vercel `NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED=true` setzen. Preview-
   Deployments bleiben ohne eigene exakt freigegebene Callback-URL bei `false`.

Für Apple wird zusätzlich ein Apple-Developer-Konto mit App ID, Services ID und Sign-in-
with-Apple-Key benötigt. Die Werte werden ausschließlich unter **Authentication →
Providers → Apple** hinterlegt; danach kann `NEXT_PUBLIC_OAUTH_APPLE_ENABLED=true`
gesetzt werden. Apples OAuth-Secret muss spätestens alle sechs Monate rotiert werden;
Rotation, Verantwortlicher und Ablaufwarnung sind vor Production festzulegen.

Im lokalen Entwicklungsbetrieb erscheint stattdessen automatisch **FoodOS
ausprobieren**. Dieser Ein-Klick-Weg öffnet ausschließlich die vorhandene Demo mit
fiktiven Daten und liest keine privaten Supabase-Tabellen. In Production ist er
standardmäßig aus und muss mit `NEXT_PUBLIC_DEMO_MODE_ENABLED=true` bewusst aktiviert
werden.

Der Callback akzeptiert nur lokale absolute Pfade als `next`; protokollrelative,
Backslash- und externe Ziele werden auf `/` reduziert. Provider-Fehler werden ohne
ungeprüfte Fehlermeldung oder Token in die Login-Oberfläche zurückgeführt.

Für die aktuellen Nutzerflows wird kein Service-Role-Key benötigt. Künftige Adminjobs
müssen Secrets ausschließlich in der jeweiligen Server-/Deployment-Secret-Verwaltung
halten und dürfen sie nie als `NEXT_PUBLIC_*` setzen.
Der geplante Rückrufjob und seine getrennte Quellenfreigabe sind unter
[`docs/RECALL_INGESTION.md`](docs/RECALL_INGESTION.md) beschrieben.

## Rechtlicher Status

Die Unterlagen bilden eine technische und organisatorische Compliance-Baseline, keine
Rechtsberatung oder weltweite Compliance-Zertifizierung. Vor dem kommerziellen Release
müssen Rechtsberatung, DPIA/Datenschutz-Folgenabschätzung, Verträge, Store-Angaben,
Lebensmittel-Claims, Werbung, Barrierefreiheit und das konkrete Land freigegeben sein.

## Aktueller Reifegrad

Der Web-MVP besitzt Auth-/AAL2-Gates, transaktionales Onboarding, Cache-first-Produktlookup,
EAN/UPC/GS1-Erfassung, manuellen unbekannten Produkt-/MHD-Fallback, chargenbezogenen
Vorrat, atomaren Verzehr, Tageswerte sowie persistente Wochenplan-/Einkaufsflows. Lokale
Unit-/Property-, Coverage-, pgTAP/RLS- und Playwright/axe-Suiten sind vorhanden; der
konkrete Stand steht unter `docs/evidence/`.

Stage -1 ist weiterhin nicht bestanden: Es gibt keine erfundenen Interviews,
Concierge-Beta, Zahlungs-, Marken- oder echte Usability-Evidence. Recall-Ingestion,
verlustfreie Offline-Outbox, Datenschutzrechte/Retention, Ops-/CEO-Ledger, native Apps,
Maestro/Store-Sandbox, Restore/Last/Security-Pentest und Production-RUM/Deployment sind
nicht durch den Web-MVP bewiesen. Das Repository bleibt bis zu Markt-, Marken-,
Sicherheits- und Rechtsfreigabe privat und enthält keine Open-Source-Lizenz.
