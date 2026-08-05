# Lokale Evidenz: Ops-Finanzquellen und Journalintegrität

Datum: **2026-08-05**

## Abgedecktes Verhalten

- Lieferantenquellen, Journale, Ledger-Zeilen und nachträgliche Quellenvalidierungen
  bleiben append-only.
- `SOURCE FINAL` verlangt ein autoritatives Artefakt mit gültigem SHA-256 und eine
  Parser-Version. Fehlende Werte werden bereits durch den Tabellen-Constraint und
  nochmals an der Journalgrenze fail-closed abgewiesen.
- Historische `invoice_metadata`-Journale mit zu starkem Vertrauenslabel werden nicht
  überschrieben, sondern durch ein unveränderliches Validierungsereignis effektiv auf
  `ESTIMATE` korrigiert.
- Deferred Constraints verweigern Journale ohne vollständige Gegenbuchung sowie
  Ledger-Beträge oder Währungen, die nicht zum Journal passen.
- Lesen verlangt CEO-Rolle plus AAL2. Authentifizierte Clients können weder Finance-
  Datensätze noch Validierungsereignisse fälschen.

## Ausgeführte Nachweise

| Check | Ergebnis |
| --- | --- |
| frischer lokaler Supabase-Reset | **PASS** — alle Migrationen einschließlich `20260805165055_ops_finance_source_validation.sql` aus leerem Schema angewandt |
| `npm.cmd run test:db` nach finalem Reset | **PASS** — 5 pgTAP-Dateien / 183 Assertions |
| lokaler Supabase DB-Lint | **PASS_WITH_WARNING** — keine Fehler; bestehende Catalog-Warnung zu `product_catalog_import_capacity` (`STABLE`/`VOLATILE`) |
| `npm.cmd run verify` | **PASS** — ESLint, TypeScript, 45 Vitest-Dateien / 166 Tests und Next.js-Production-Build |

Der erste pgTAP-Nachlauf vor dem Reset war **FAIL** (2/38 im Finance-Test), weil die
lokale Datenbank noch die vorherige Fassung derselben uncommitteten Migration enthielt.
Der neue Negativtest reproduzierte dadurch die SQL-Null-Lücke. Nach expliziten
`IS NOT NULL`-Constraints und einem frischen Aufbau bestand die unveränderte finale
Suite mit 38/38 Finance-Assertions. Nach der separaten Foreign-Key-Indexmigration
bestand der Finance-Test mit 39/39 Assertions.

## Managed-Supabase-Nachweis

- `ops_finance_source_validation` wurde als Managed-Migration `20260805171206`
  erfolgreich angewandt.
- `index_ops_finance_validation_recorder` wurde danach als Managed-Migration
  `20260805171530` erfolgreich angewandt.
- Die Validierungstabelle hat RLS; `authenticated` darf lesen, aber nicht einfügen.
  Der Recorder-Foreign-Key ist indexiert. Der anschließende Advisor meldete für die
  neue Tabelle keinen Security-Befund und keinen fehlenden Foreign-Key-Index. Der
  neue Index ist unmittelbar nach Erstellung erwartungsgemäß noch als unbenutzt
  (`INFO`) sichtbar.
- Vor und nach den Migrationen blieben die kontrollierten Zähler unverändert:
  1 Finance-Quelle, 1 Journal, 2 Ledger-Zeilen, 1 Auth-Nutzer, 1 Haushalt,
  1 Haushaltsmitglied, 0 aktive Katalogläufe und 0 Katalogprodukte.
- Es gibt 0 effektiv als `SOURCE FINAL` gewertete Journale ohne autoritative
  Validierung.

## Nicht als Production-Evidence ausgeben

**NOT_RUN:** Production-AAL2-Browserprüfung sowie Erfassung oder Zahlung einer neuen
realen Rechnung in diesem Schnitt. Ohne autoritativen Beleg wird kein Aufwand als
`SOURCE FINAL` und keine offene Rechnung als bezahlt ausgegeben.
