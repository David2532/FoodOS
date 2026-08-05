# Lokale Evidenz: Tarife und Entitlements

Datum: **2026-08-05**
Geltungsbereich: lokaler FoodOS-Stack auf Branch `agent/foodos-mvp`; keine Payment- oder Production-Freigabe.

## Abgedecktes Verhalten

- Die Produktdefinition enthält die drei Tarife **Free**, **Plus** und **Family** mit den
  festgelegten Monats- und Jahrespreisen sowie dem maximalen Family-Haushalt von fünf
  Mitgliedern.
- Der kostenlose, nicht automatisch verlängernde Plus-Test läuft exakt 14 Tage und
  verlangt keine Karte. Nach Ablauf fällt der wirksame Zustand fail-closed auf Free
  zurück, ohne Daten zu löschen.
- Fehlerhafte Zeitfenster sowie abgelaufene, widerrufene oder nicht verifizierbare
  Store-Zustände erhalten keine bezahlten Rechte.
- Sicherheit, Lebensmittelsicherheit, Datenexport und Kontolöschung bleiben unabhängig
  vom Tarif verfügbar.
- Das Labor verbindet bewusst keinen Zahlungsanbieter. In Vercel Production ist die
  Route nicht verfügbar. Im Vercel Preview verlangt sie eine konfigurierte Supabase-
  Sitzung mit AAL2; die lokale Entwicklungsansicht ist ausdrücklich als `Lokal`
  gekennzeichnet.

## Ausgeführte Nachweise

| Check | Ergebnis |
| --- | --- |
| `npm.cmd exec vitest run src/domain/entitlements.test.ts` | **PASS** — 1 Datei / 6 Tests |
| `npm.cmd run typecheck` | **PASS** |
| `npm.cmd run lint` | **PASS** |
| `npm.cmd run build` | **PASS** — Next.js-Production-Build einschließlich dynamischer Route `/billing-lab` |
| Desktop-Browserprüfung, 1280 × 900 | **PASS** — Zustandswahl, Tarifkarten und Warnhinweise sichtbar; kein Next-Error-Overlay |
| Mobile Browserprüfung, 390 × 844 | **PASS** — gestapelte Karten und Trial-Wechsel funktionieren; kein Seitenfehler |
| axe auf der mobilen Ansicht | **0 Verstöße**, 1 unvollständige Kontrastprüfung — CSS-Gradienten verhinderten die automatische Berechnung bei 37 Knoten; daher kein vollständiger Kontrast-PASS behauptet |

Die visuellen Nachweise liegen unter
`docs/evidence/screenshots/billing-lab-preview-desktop.png` und
`docs/evidence/screenshots/billing-lab-preview-mobile.png`. Die Aufnahmen stammen aus
der lokalen Entwicklungsumgebung und enthalten ausschließlich deterministische
Tarif-Simulationsdaten.

## Nicht als Production-Evidence ausgeben

**NOT_RUN:** echter Apple-, Google-Play- oder Stripe-Kauf, Store-Webhook,
Reconciliation, Refund, Restore Purchases, native App-Store-Prüfung und Production-
Browserprüfung dieses neuen Schnitts. Die Oberfläche behauptet weder einen Kauf noch
eine Abbuchung oder Store-Verbindung.
