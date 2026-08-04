# Lokale Evidenz: Konto, Darstellung und Passwortsicherheit

Datum: **2026-08-04**
Geltungsbereich: lokaler FoodOS-Stack auf Branch `agent/foodos-mvp`; keine Production-Freigabe.

## Abgedecktes Verhalten

- Die Kontoansicht bleibt außerhalb der fünf Hauptbereiche und bietet **System**, **Hell**
  und **Dunkel** als per Gerät gespeicherte Darstellung.
- E-Mail-Anmeldung enthält einen enumerationssicheren Recovery-Einstieg. Der Reset-Screen
  akzeptiert ausschließlich einen von Supabase verifizierten Recovery-JWT (`amr.method =
  recovery` plus `session_id`), nicht aber eine normale AAL1- oder OAuth-Sitzung und kein
  manipuliertes `next`.
- Das Passwort wird im Recovery-Fall nur über die claim-geschützte Same-Origin-Serverroute
  aktualisiert. Vollständiger Abschluss setzt bestätigten globalen Widerruf, lokale
  Sitzungsentfernung und den Offline-Datenstatus `cleared` voraus.
- Ein blockiertes IndexedDB-Löschen bleibt `cleanup-pending`; der ursprüngliche
  Löschauftrag lebt weiter und kann nach Schließen eines anderen Tabs erfolgreich werden.
  Die UI zeigt weder eine leere Warteschlange noch eine abgeschlossene Abmeldung, solange
  die Entfernung nicht bestätigt ist.

## Ausgeführte lokale Nachweise

| Check | Ergebnis |
| --- | --- |
| `npm.cmd run verify` | **PASS** — ESLint, TypeScript, 30 Vitest-Dateien / 106 Tests und Next-Production-Build |
| `npm.cmd run test:coverage` | **PASS** — 30 Dateien / 106 Tests; Statements 93,07 %, Branches 89,96 %, Functions 98,38 %, Lines 97,07 % |
| `npm.cmd audit --audit-level=high` | **PASS** — 0 Vulnerabilities |
| `npm.cmd run test:db` | **PASS** — 2 pgTAP-/RLS-Dateien / 112 Tests gegen lokalen Supabase-Stack |
| `npm.cmd exec supabase db lint --local --level warning --fail-on error` | **PASS** — keine lokalen Schemafehler |
| `npm.cmd run test:e2e` | **PASS** — 14 Chromium-Tests für Preview, Responsive-Layout, Theme-Persistenz und axe-Smoke |
| `npm.cmd run test:e2e:auth` | **PASS** — 4 echte lokale Chromium-Tests: TOTP/Haushalt, Passwortwechsel, Mehrtab-Offline-Cleanup und Mailpit-/PKCE-Recovery |
| gezielter Recovery-Lauf | **PASS** — AAL1-/API-Abweisung, lokale Mailpit-Nachricht, echter PKCE-Callback, claim-geschützter Reset, altes Passwort abgewiesen, neues Passwort führt zur MFA |

Die aktualisierten lokalen UI-Screenshots liegen unter
`docs/evidence/screenshots/preview-chromium-desktop.png`,
`docs/evidence/screenshots/preview-chromium-mobile.png`,
`docs/evidence/screenshots/account-settings-authenticated-desktop.png` und
`docs/evidence/screenshots/account-security-authenticated-desktop.png`.

## Nicht als Production-Evidence ausgeben

**NOT PROVEN:** Managed-Supabase- und Vercel-Production-Konfiguration, echte Production-URL,
Maildomain-/SPF-/DKIM-/DMARC-Nachweis sowie Production-Deployment- und Browser-Evidence.
Diese Werte und URLs wurden nicht erfunden und nicht in das Repository geschrieben. Die
kleinste notwendige externe Aktion ist, dem Repository eine berechtigte Managed-Supabase- und
Vercel-Verbindung beziehungsweise die zugehörigen Production-Projekte bereitzustellen; danach
sind Auth-Redirect, Migrationen und der Production-Browser-Check auf dem exakten Commit
auszuführen und als neue Evidence festzuhalten.
