# FoodOS – One-Shot Codex-Auftrag

Arbeite als verantwortlicher Senior Full-Stack- und Product-Engineer direkt in diesem
Repository. Entwickle FoodOS zu einem kommerziell veröffentlichbaren Produkt mit
Next.js-Weboberfläche, nativen iOS-/Android-Apps und portabler Supabase-Datenbank weiter.
Vercel/Managed Supabase dürfen die erste Betriebsform sein; der dokumentierte Docker-
Pfad bleibt funktionsfähig. Das ist ein Fortsetzungsauftrag: Ersetze nicht pauschal die
bestehende, bereits funktionierende UI.

## Ziel

Ein Nutzer kann sich anmelden, einen Haushalt anlegen, Lebensmittel per Barcode
erfassen, Produktdaten und Inhaltsstoffe prüfen, MHD und Charge ergänzen, seinen Vorrat
und Verzehr verwalten sowie daraus Wochenplanung und Einkaufsliste ableiten. Alle Daten
müssen dauerhaft und haushaltsbezogen in Supabase gespeichert werden. Die App ist eine
deutsche, mobile-first Anwendung und funktioniert besonders gut bei 360–430 px Breite.
Mittlere und erweiterte Fenster erhalten gezielte adaptive Navigation/Panes statt einer
gestreckten Telefonansicht; ein Resize verliert keinen Flowzustand.
Private Daten sind erst nach verpflichtendem TOTP-AAL2 zugänglich. Der Sicherheitskern
bleibt kostenlos; Premium liefert laufenden Komfort, Werbung ist ausschließlich
kontextuell und nie mit Lebensmittel-, Gesundheits- oder Profildaten personalisiert.

## Vorgehen

1. Lies vollständig `AGENTS.md`, `README.md`, `docs/REPOSITORY_MAP.md`, `design.md`,
   `design-ceo.md`, `mockups/README.md` sowie alle Dokumente unter `plans/`, `legal/`
   und `docs/decisions/`. Inspiziere anschließend mindestens `package.json`,
   `.env.example`, `vercel.json`, `src/`, `public/` und
   `supabase/migrations/`. Falls der Ordner bereits ein Git-Repository ist, prüfe auch
   `git status`, damit keine fremden Änderungen verloren gehen. Falls nicht, arbeite
   normal weiter und initialisiere Git erst im Rahmen der vereinbarten Veröffentlichung.
2. Führe vor der Änderung `npm install` und `npm run verify` als Baseline aus. Wenn die
   Baseline fehlschlägt, dokumentiere den bereits vorhandenen Fehler und behebe ihn,
   sofern er zum Auftrag gehört.
3. Erstelle einen kurzen, priorisierten Implementierungsplan und arbeite ihn danach
   selbstständig in funktionierenden vertikalen Schnitten ab. Stelle nur dann eine
   Rückfrage, wenn Zugangsdaten, eine irreversible Entscheidung oder eine echte
   externe Berechtigung fehlen. Triff für normale Produktdetails vernünftige Annahmen.
4. Prüfe nach jeder größeren Etappe Typen und Tests. Beende den Auftrag erst nach dem
   vollständigen Verifikations- und Deployment-Check.

## Verbindlicher Clean-Code-Workflow

Arbeite nicht screenweise mit Mockups, sondern flowweise als vollständige vertikale
Schnitte. Für jeden Flow – beispielsweise Anmeldung, Produkt erfassen oder Verzehr
buchen – gilt diese Reihenfolge:

1. **Flow verstehen:** Einstieg, Nutzerziel, Happy Path, Abbruch, Berechtigungen,
   Offline-Fall und Fehlerzustände kurz notieren.
2. **Verträge definieren:** Domänentypen, Zod-Schemas, Datenbankoperationen,
   Transaktionsgrenzen und erwartete UI-Zustände festlegen.
3. **Fachlogik bauen:** Berechnungen und Regeln als kleine deterministische Funktionen
   bzw. Use Cases implementieren und zuerst mit Unit-Tests absichern.
4. **Persistenz anbinden:** Supabase-Zugriff kapseln; UI-Komponenten greifen nicht direkt
   verteilt auf Tabellen zu. RLS, Validierung, Idempotenz und atomare Änderungen prüfen.
5. **UI integrieren:** Bestehende Design-Primitives verwenden, klare Zustände abbilden
   und nur notwendige Client Components einsetzen. Server-/Client-Grenzen bewusst
   halten, unnötige Requests und Re-Renders vermeiden.
6. **Flow testen:** Erfülle `plans/QUALITY_ENGINEERING_PLAN.md` und
   `plans/TEST_TRACEABILITY_MATRIX.md`: sinnvolle Unit-, Property-/Mutation-, Komponenten-,
   API-, DB/RLS-, Integrations- und Web/Mobile-E2E-Evidence für Happy Path, Grenzen,
   Fehler, Offline, Parallelität, Privacy und Recovery. Eine Wiederholung macht einen
   fehlgeschlagenen Test `FLAKY`, nicht grün.
7. **Visuell und performant prüfen:** Screenshots und Interaktionen gegen `design.md`
   sowie `plans/UI_UX_PERFORMANCE_PLAN.md` prüfen; kompakt/mittel/erweitert, Überläufe,
   Fokus, Tastatur, lange Texte, Loading/Fehler, Bundle/Core Web Vitals beziehungsweise
   Native-Startup/Frames korrigieren. Neue kritische Flows nach
   `plans/UX_RESEARCH_AND_USABILITY_TESTING.md` mit echten Nutzern testen; keine Evidence
   oder Teilnehmer erfinden.
8. **Aufräumen:** Tote Mocks, Duplikate, Debug-Ausgaben, unbenutzte Exporte und
   Übergangscode entfernen; Dokumentation aktualisieren; vollständige Checks ausführen.

Architekturregeln:

- Trenne Routing/Komposition, Feature-Komponenten, wiederverwendbare UI-Primitives,
  Domänenlogik, Validierung und Infrastruktur klar voneinander. Entwickle die bestehende
  Struktur inkrementell weiter, statt sie ohne Not komplett neu zu schreiben.
- Keine God Components, keine God Services und keine Fachlogik in JSX/Event-Handlern.
  Komponenten sollen einen klaren Zweck haben; wiederkehrende Zustands- oder
  Darstellungsmuster werden sinnvoll extrahiert.
- Kein blindes „Clean Architecture“-Boilerplate. Eine Abstraktion braucht einen realen
  aktuellen Nutzen. Verständlichkeit und Änderbarkeit sind wichtiger als Schichtenzahl.
- Verwende präzise Domänennamen wie `InventoryBatch`, `ExpiryStatus`,
  `IngredientAssessment` und `ConsumptionEntry`, keine generischen `data`, `item2` oder
  `handleStuff`-Bezeichner.
- Vermeide `any`, nicht-null Assertions und unkontrollierte Type Casts. Externe Daten
  bleiben `unknown`, bis sie validiert sind.
- Mutationen liefern typisierte Ergebnisse und fachlich verständliche Fehler. Kritische
  Bestandsänderungen sind atomar und wiederholte Requests erzeugen keine Doppelbuchung.
- Neue Abhängigkeiten nur bei klarem Nutzen; bevorzuge Browser-, Next.js- und bereits
  vorhandene Projektfunktionen.
- Hinterlasse jeden bearbeiteten Bereich sauberer als zuvor, ohne unabhängige
  Nutzeränderungen anzufassen.

## Eigenständig hochwertige UI-Assets erstellen

Erstelle alle für ein hochwertiges Ergebnis fehlenden FoodOS-Assets selbst mit den in
deiner Umgebung verfügbaren Bild-/Vektorwerkzeugen. Warte dafür nicht auf den Nutzer und
verwende keine endgültigen Platzhalter.

- Entwickle zuerst aus `design.md` eine kurze, konsistente Asset Direction: dunkle
  natürliche Food-Tech-Ästhetik, ruhige Formen, limettengrüne Akzente, keine Gaming-
  Optik und keine generischen KI-Stockbilder.
- Generiere bei echtem Bedarf originale Brand-, Onboarding-, Empty-State- und
  Permission-Illustrationen. Erzeuge passende Varianten für Dark UI und die benötigten
  Seitenverhältnisse, statt ein Bild überall zu stretchen.
- Nutze Lucide oder selbst erstellte, zugängliche SVGs für UI-Icons. Präzise Icons,
  Diagramme, Makro-Ringe, Scannerrahmen, Statuszeichen und Barcodes werden
  deterministisch als SVG/CSS/Komponenten erstellt, nicht als KI-Rasterbild.
- Produktfotos müssen aus der ausgewiesenen Produktdatenquelle stammen oder als „kein
  Bild vorhanden“ erscheinen. Erfinde niemals das Foto eines realen Markenprodukts.
- Speichere statische Assets strukturiert unter `public/`, mit verständlichen Dateinamen.
  Exportiere bevorzugt AVIF/WebP plus sinnvollen Fallback, korrekte Abmessungen,
  Kompression und responsive Varianten. Verwende Next.js `Image`, wenn geeignet, um
  Layout Shift und unnötig große Downloads zu vermeiden.
- Liefere Alt-Texte nach Informationswert: informativ beschreiben oder bei rein
  dekorativen Assets bewusst leer lassen. Text darf nicht unzugänglich in Bildern
  eingebrannt werden.
- Dokumentiere Prompt/Quelle und Verwendungszweck eigener generierter Assets knapp in
  `public/assets/ASSETS.md`. Keine Wasserzeichen, unklaren Lizenzen, kopierten
  Wettbewerber-Assets oder Base64-Bilder direkt in Komponenten.
- Prüfe jedes Asset im echten mobilen Screen. Entferne Assets, die nur dekorativen Lärm
  erzeugen, die App verlangsamen oder die Datenhierarchie schwächen.

## Bestehenden Stand respektieren

Das Repository enthält bereits Next.js 16, React 19, TypeScript, Tailwind, Supabase,
ZXing, Zod, Vitest, eine dunkle grüne Mobile-UI, einen Open-Food-Facts-Lookup und eine
erste umfangreiche Supabase-Migration. Der Barcode `3017624010701` wurde lokal bereits
erfolgreich gegen Open Food Facts aufgelöst. Nutze diese Basis, reduziere Duplikate und
entferne keine funktionierenden Features ohne begründeten Ersatz.

## P0 – reales Konto und persistente Kerndaten

- Implementiere Supabase Auth mit einer einfachen, sicheren E-Mail-Anmeldung und
  stabiler Session-Verwaltung für Next.js. Nutze die aktuelle offizielle Supabase-
  Empfehlung für Server- und Browser-Clients.
- TOTP-2FA ist verpflichtend: AAL1 darf nur Verifizierung, MFA, Recovery und eng
  begrenzte Kontofunktionen sehen; RLS verweigert alle privaten Tabellen ohne AAL2.
- Baue ein kurzes Onboarding: Profil, Haushaltsname, optionale Körper- und Ernährungs-
  ziele. Beim ersten Start muss transaktional ein Haushalt samt Mitgliedschaft entstehen.
- Verbinde Dashboard, Vorrat, Scan, Verzehr, Wochenplan und Einkaufsliste mit Supabase.
  Entferne harte Mock-Abhängigkeiten; ein klar gekennzeichneter Preview-Modus ohne
  Supabase darf für lokale Ansicht erhalten bleiben.
- Implementiere verständliche Loading-, Empty-, Error-, Offline- und Auth-Zustände.
- Stelle über Row Level Security sicher, dass Nutzer ausschließlich Haushalte sehen und
  verändern können, denen sie angehören. Kein Service-Role-Key im Client.

## P0 – Barcode, Metadaten, MHD und Charge

- Behalte Kamerascan und manuelle Barcode-Eingabe. Unterstütze EAN/UPC sowie GS1 Data
  Matrix bzw. GS1-128 soweit die Browserbibliothek es zuverlässig ermöglicht.
- Suche zuerst im lokalen Produktcache, danach bei Open Food Facts. Speichere möglichst
  alle schema-validierten, zweckgebundenen Metadaten der freigegebenen Allowlist
  normalisiert: GTIN, Name, Marke, Menge, Kategorien,
  Bilder, Labels, Länder, Nutri-Score/NOVA falls vorhanden, Nährwerte, Portion,
  Zutatenrohtext, strukturierte Zutaten, Allergene, Zusatzstoffe, Spurenhinweise,
  Datenquelle, Abrufzeit, Sprache und Konfidenz. Externe Daten bleiben editierbar und
  erhalten Provenienz. Speichere keine unbekannten Rohfelder nur weil der Provider sie
  liefert; prüfe Lizenz, Zweck, Retention und Löschung.
- Parse GS1 Application Identifiers, insbesondere `01` GTIN, `10` Charge, `15` MHD,
  `17` Verbrauchsdatum und `21` Seriennummer. Zeige die erkannten Felder vor dem
  Speichern zur Bestätigung.
- Ein normaler EAN enthält meist kein MHD. Starte deshalb nach der Produkterkennung
  optional einen zweiten Verpackungsscan für MHD/Charge. Implementiere dafür eine
  saubere OCR-Adapter-Schnittstelle mit Bildzuschnitt, plausibler Datumserkennung,
  Konfidenz und manueller Korrektur. Wenn kein OCR-Dienst konfiguriert ist, muss der
  manuelle Fallback vollständig funktionieren; simuliere keinen OCR-Erfolg.
- Speichere Vorrat chargenbezogen mit Kaufdatum, Öffnungsdatum, MHD/Verbrauchsdatum,
  Lagerort, Menge, Einheit, Kosten und optionalem Belegbild.

## P0 – Rückrufe und amtliche Food-Safety-Daten

Halte den C0-Food-Safety-Vertrag aus
`plans/FOOD_SAFETY_RECALLS_AND_DATA_QUALITY.md` ein: Ingestiere nur freigegebene amtliche
Rückrufquellen mit unveränderlicher Provenienz/Aktualität. Unterscheide exakten
GTIN+Chargen-Treffer, mögliche GTIN-Betroffenheit, reinen Textkandidaten und ungeprüfte/
veraltete Quelle. Ein Rückruf überstimmt MHD und Planung; ein Feed-Ausfall darf niemals
als „nicht zurückgerufen“ oder „sicher“ erscheinen. Baue F07 samt Korrektur/Rücknahme,
idempotenter Warnung, werbefreier UI und C0-Tests.

## P0 – verständliche Inhaltsstoffbewertung

- Sortiere gefundene Inhaltsstoffe nach einer nachvollziehbaren Priorität:
  1. Rot: persönliche Allergene oder explizit ausgeschlossene Stoffe.
  2. Orange: belastbare, kontextabhängige Hinweise, bei denen Dosis oder Exposition
     relevant sind.
  3. Gelb: sachliche Information ohne konkreten persönlichen Alarm.
  4. Grün: kein bekannter persönlicher Konflikt in den verfügbaren Daten.
  5. Grau: unbekannt, unvollständig oder nicht sicher klassifizierbar.
- Berücksichtige Nutzerprofil, Allergenkennzeichnung, Zutatenreihenfolge, Datenqualität,
  Dosis/Exposition und seriöse Evidenz. Markiere E-Nummern nicht automatisch als
  schädlich. Trenne Datenfakt von Vorsichtshinweis und persönlicher Präferenz.
- Zeige je Eintrag Kurzbegründung, Quelle bzw. Evidenzklasse, Unsicherheit und
  Aktualisierungsdatum. Formuliere keine Diagnose und keinen individuellen medizinischen
  Rat. Ergänze einen klaren Hinweis für echte Allergien.
- Baue die Bewertungslogik deterministisch und testbar. KI darf später Erläuterungen
  formulieren, aber niemals ohne nachvollziehbare Regeln die Risikostufe festlegen.

## P1 – Vorrat, Ernährung, Wochenplan und Einkauf

- Dashboard: heutige und wöchentliche Kalorien, Protein, Kohlenhydrate und Fett,
  verbleibendes Ziel, MHD-Warnungen und schnell ausführbare Aktionen.
- Verzehr buchen: Produkt/Charge und Portion wählen; Nährwerte aus der gewählten Menge
  berechnen und den Vorrat in derselben Transaktion reduzieren. Änderungen müssen über
  ein Inventar-Event nachvollziehbar sein.
- Ziele konfigurierbar machen. Gute Defaultwerte für den bestehenden Nutzerkontext:
  etwa 79 kg, Ziel 75 kg, Büroalltag, Training ungefähr zweimal pro Woche und
  140–160 g Protein pro Tag. Das sind editierbare Planungswerte, keine medizinische
  Vorgabe.
- Zeige Tages- und Wochenbudget. Übertrag nicht genutzter Kalorien höchstens begrenzt
  (Default 10 % des Tagesziels) und niemals als riesigen „Bonus“ darstellen.
- Wochenplan: Gerichte/Rezepte auf Tage und Mahlzeiten verteilen, Portionen skalieren,
  aggregierte Nährwerte anzeigen und vorhandenen Vorrat berücksichtigen.
- Einkaufsliste: Fehlmengen aus Wochenplan minus nutzbarem Vorrat erzeugen, ähnliche
  Einheiten sinnvoll zusammenführen, manuelle Positionen zulassen und Abhaken in
  Echtzeit speichern.
- MHD-Logik: „zuerst verbrauchen“, Warnstufen, abgelaufene Chargen, Verderb/Entsorgung
  und Vorschläge, die vorhandene Lebensmittel bevorzugen.

## Qualität, Datenschutz und Betrieb

- Führe zuerst Stage -1 aus `plans/COMPETITIVE_RESEARCH_AND_VALIDATION.md` aus: echte
  Problem-/Usability-/Concierge-Beta-Evidence, Preis-Hypothese, Marken-/Rechteprüfung und
  eine dokumentierte Continue/Narrow/Pivot/Stop-Entscheidung. Erfinde keine Interviews,
  Retention, Zahlungen oder Live-Dashboarddaten.
- Implementiere F08 nach `plans/OFFLINE_SYNC_AND_DATA_INTEGRITY.md`: dauerhafte lokale
  Projektion/Outbox, Idempotency-ID und Payload-Hash, Base-Revision, fachliche
  Konfliktregeln, Tombstones und Client-/Payload-Upgrader. Silent last-write-wins ist für
  Menge, Datum, Recall, Mitgliedschaft, Consent, Security und Löschung verboten.
- Halte `plans/SECURITY_AI_AND_UPDATE_GOVERNANCE.md` ein. Lost-Factor-Recovery darf nicht
  nur per E-Mail/Support AAL2 vergeben. OCR/AI benötigt Model Registry, versioniertes
  Eval-Set, per-field Bestätigung, Canary/Kill-Switch und manuellen Fallback. Production-
  OTA ist signiert, runtime-/fingerprint-kompatibel, stufenweise, zweifach freigegeben
  und rollbackfähig; keine Anti-Bricking-Deaktivierung oder Runtime-Publish-Secrets.

- Halte alle externen Antworten per Zod-Validierung und robuste Fehlerbehandlung unter
  Kontrolle. Baue Timeouts, Caching und vernünftiges Rate-Limiting für öffentliche APIs.
- Behandle `legal/COMPLIANCE_MATRIX.md` und `legal/DATA_PROCESSING_REGISTER.md` als
  technische Release-Gates. Implementiere getrennte Einwilligungen, Datenexport,
  Kontolöschung in App und Web, Retention-Jobs, Consent-Belege und DPIA-Evidence. Behaupte
  keine weltweite Rechtskonformität; schalte nur freigegebene Länder frei.
- Allergien, Unverträglichkeiten, Körper-/Gesundheitsziele, Ernährung, Scans, GTINs,
  Produkte, Bilder, MHD und Haushalt dürfen nie an Werbe-, allgemeine Analytics- oder
  Crash-Payloads gelangen. Werbung bleibt kontextuell/nicht personalisiert und fehlt in
  allen sensiblen Flows.
- PWA: installierbares Manifest, Icons, passende Metadaten, sichere Kamera-Permissions
  und eine brauchbare Offline-Ansicht. Keine falsche Behauptung vollständiger Offline-
  Synchronisation.
- Barrierefreiheit: Tastaturbedienung, sichtbarer Fokus, Labels, ausreichender Kontrast,
  reduzierte Bewegung und Screenreader-taugliche Statusmeldungen.
- Setze den vollständigen UI-/Performance-Vertrag um: WCAG 2.2 AA auf Web, 44-pt-iOS-
  und 48-dp-Android-Ziele, VoiceOver/TalkBack/Dynamic Type, semantische Tokens,
  kompakte/mittlere/erweiterte Layouts, lazy Scanner/OCR/Charts und die route-/geräte-
  spezifischen Bundle-, LCP/INP/CLS-, Startup-, Frame- und Memory-Budgets aus
  `plans/UI_UX_PERFORMANCE_PLAN.md`. Mache keine Lighthouse-Labzahl zu behaupteter
  Produktions-RUM-Evidence.
- Halte Oberfläche, Komponenten, Tokens, Informationshierarchie und Interaktionen
  verbindlich an `design.md`. Neue Screens dürfen nicht wie ein fremdes zweites Produkt
  wirken. Bei einem bewussten Design-System-Wechsel muss `design.md` mitgeändert werden.
- Verwende die Tafeln unter `public/assets/mockups/` als visuelle North-Star-Richtung und
  den Screen-Katalog in `mockups/README.md` als Umfang. Generative Mockups sind keine
  verlässliche Quelle für exakte Texte, Datumswerte, Navigation oder Fachlogik; dafür
  gelten `design.md` und `plans/USER_FLOWS.md`.
- Arbeite die Reihenfolge und Exit-Gates aus `plans/IMPLEMENTATION_PLAN.md` ab. Wenn die
  echte Repository-Situation eine Anpassung erfordert, aktualisiere den Plan transparent,
  statt still einen anderen Flow zu bauen.
- Setze den vollständigen Quality-Plan um. Jede exportierte Fachregel, jeder Use Case,
  API/RPC/Job/Webhook, jede DB-Funktion/RLS-Policy und jeder kritische Flow-Zweig hat
  meaningful automated coverage oder eine geprüfte, begründete, ablaufende Ausnahme.
  Playwright zeichnet beim ersten FE/BE-E2E-Fehler Trace, DOM, Netzwerk und Screenshot
  auf; Supabase/pgTAP beweist Schema, Funktionen, AAL1/AAL2 und alle Haushaltsrollen;
  Maestro plus gezielte Native-Tests beweisen iOS/Android. Security, Privacy, Load,
  Restore und Store-Sandbox sind Release-Gates, keine optionalen Reports.
- Implementiere die Fehler- und Observability-Architektur aus
  `plans/OBSERVABILITY_AND_ERROR_CONSOLE.md`: typisierte Fehler, Flow-/Trace-/Release-
  Korrelation, OpenTelemetry mit strikter Allowlist/Redaction und eine getrennte Ops-
  Konsole für Release-Beweis, Fehler, Flows, Provider/Jobs, Mobile-Vitals und Incidents.
  Keine Roh-Objekte, Tokens, Identität, GTIN/Produkt/MHD oder Gesundheitsdaten loggen.
- Aktualisiere `README.md` und `.env.example` mit vollständigem Setup, Migration,
  Seed/Preview, Testbefehlen und Deployment. Erkläre jede neue Variable.

## CEO-Zentrale, Finanzen und Steuerwahrheit

- Baue eine separat geschützte `/ops`-Anwendung gemäß
  `plans/CEO_CONTROL_CENTER.md` und `design-ceo.md`. Sie verbindet CEO Today, Umsatz/
  Abos, Nutzung/Funnel, Kosten/Marge, Steuer/Auszahlungen, Quality/Releases, Fehler/
  Incidents, Privacy/Compliance, Support, Forecast und Quellenqualität.
- Jede KPI besitzt eine versionierte Definition, autoritative Quelle, Zeitraum/Grain,
  Aktualität, Abdeckung und Vertrauensstatus. Vermische niemals Bruttoumsatz, Net Sales,
  Store-Proceeds, Auszahlung, Cash und periodisierten Umsatz; nenne eine Schätzung nie
  final, gebucht, abgestimmt, steuerberater-geprüft, gemeldet oder bezahlt.
- Ingestiere externe Apple-/Google-/Ad-/Payment-/Bank-/Kostenberichte zunächst immutable
  mit Hash und Parser-Version. Normalisiere anschließend in ein exaktes Double-Entry-
  Ledger mit Integer-Minor-Units/Decimal, Währung und getrennten Transaktions-, Leistungs-,
  Settlement- und Auszahlungsdaten. Kein binäres Floating Point für Geld.
- Beweise tägliche Schätzung→Monatsabschluss→Auszahlung→Bank-Abgleich. Unbekannte,
  doppelte, korrigierte, verspätete oder nicht abgestimmte Zeilen landen sichtbar in einer
  Review Queue und dürfen nicht als Null verschwinden.
- Steuerwerte sind bis zur konkreten Entity-/Vertrags-/Länderfreigabe durch den
  Steuerberater Schätzungen. Liefere zuerst einen validierten DATEV-Export und
  Evidence-Pack; keine automatische ELSTER-/OSS-Abgabe ohne separate Autorisierung,
  juristische Prüfung und End-to-End-Abnahme.
- Produktanalytics bleibt aggregiert und frei von Produkt/GTIN/MHD, Ernährung,
  Allergien, Gewicht, Bildern, Haushaltsnamen und Freitext. Sandbox/TestFlight/Internal-
  Test wird technisch von Produktionsgeld ausgeschlossen.
- Ergänze C13/C14 gemäß `plans/CEO_RISK_AUTOMATION.md`: 13-Wochen-Liquidität mit
  Quellenabdeckung, Trusted-Core-Loop, Paid-Value-Retention, Risiko-/Continuity-Register,
  Corporate-/Platform-Kalender, Owner/Deputy/Eskalation und A0–A3-Automationen. Missing/
  stale ist nie grün. A2 ist nur vordefiniert, reversibel und auditiert. Insolvenz-,
  Steuer- oder Behördenmeldung, Rechtsklassifikation, medizinische/Food-Safety-
  Entscheidung und Beweislöschung sind technisch nicht autonom ausführbar.

## Native Stores, Supabase und Hosting wirklich ausrollen

0. Entwickle die Store-App mit Expo/React Native und echtem nativen Mehrwert. Eine
   WebView-Hülle ist unzulässig. Nutze StoreKit/Google Play Billing für digitale Premium-
   Funktionen und erfülle `plans/APP_STORE_RELEASE_PLAN.md`.

1. Nutze die bereits verbundenen Supabase- und Vercel-Werkzeuge bzw. Integrationen,
   sofern sie in deiner Umgebung verfügbar sind.
2. Erstelle oder wähle ein FoodOS-Supabase-Projekt in einer EU-Region. Wende alle
   Migrationen an, konfiguriere Auth-Redirects und notiere Project URL sowie Anon Key
   ausschließlich an den dafür vorgesehenen Stellen. Lege keine Secrets in Git ab.
3. Importiere das Repository in Vercel, setze die benötigten Environment Variables für
   Preview und Production und deploye in einer EU-nahen Region.
4. Öffne die echte Production-URL und verifiziere mindestens Startseite, Auth-Redirect,
   Navigation, Produktlookup und eine geschützte Datenbankoperation. Prüfe außerdem die
   Browserkonsole und Serverlogs auf relevante Fehler.
5. Wenn eine Integration oder Berechtigung tatsächlich fehlt, erfinde weder Projekt
   noch URL. Führe alle lokal möglichen Arbeiten zu Ende und gib anschließend genau
   einen präzisen Blocker mit der minimal nötigen Nutzeraktion an. Danach soll der
   Deployment-Check ohne erneute Projektanalyse fortsetzbar sein.
6. Halte zusätzlich einen getesteten Docker-Betrieb mit dem gepinnten offiziellen
   Supabase-Self-Hosting-Stack, Migration, TLS, Backups/Restore, Secret-Rotation und nur
   80/443 öffentlich gemäß `plans/AUTH_AND_SELF_HOSTING.md` bereit.

## Git-Arbeitsweise

- Arbeite auf einem sicheren Feature-Branch, bevorzugt `agent/foodos-mvp`, sofern der
  aktuelle Git-Zustand das zulässt.
- Committe logisch zusammenhängende, verifizierte Änderungen. Überschreibe keine
  Nutzeränderungen und verwende keine destruktiven Git-Befehle.
- Wenn GitHub-Zugriff vorhanden ist, pushe den Branch und eröffne einen Draft-PR mit
  Zusammenfassung, Testnachweisen, Migrationshinweisen und Screenshots der mobilen UI.

## Definition of Done

Der Auftrag ist erst fertig, wenn diese Punkte nachweisbar erfüllt sind:

- Ein echter Nutzer kann sich anmelden und einen eigenen Haushalt anlegen.
- Derselbe Nutzer muss TOTP bestätigen; AAL1 und fremde Haushalte haben keinen Zugriff.
- Ein Barcode kann per Kamera oder manuell erfasst werden; Produktmetadaten werden
  dauerhaft gespeichert und später aus dem Cache geladen.
- GS1-MHD/Charge wird korrekt geparst; bei normalem EAN funktioniert der zweite
  MHD-Scan bzw. der manuelle Fallback.
- Inhaltsstoffe erscheinen nach persönlicher Relevanz sortiert, mit Begründung,
  Unsicherheit und ohne pauschale E-Nummern-Angst.
- Eine Charge kann zum Vorrat hinzugefügt und ein Verzehr gebucht werden; dabei ändern
  sich Inventar und Tages-/Wochenwerte korrekt und atomar.
- Wochenplan und daraus berechnete Einkaufsliste funktionieren mit gespeicherten Daten.
- Die Kernoberfläche ist bei 360 px Breite ohne horizontales Überlaufen nutzbar.
- Kompakte, mittlere und erweiterte Fenster sowie iOS-/Android-Referenzgeräte bewahren
  Flowzustand, Fokus und Primäraktion; Web LCP/INP/CLS und native Startup/Frame/Memory-
  Gates bestehen für den exakten Release-Build.
- Kritische neue oder wesentlich geänderte Flows besitzen echte repräsentative
  Usability-Evidence und keine ungelösten kritischen Verständnis-, Accessibility-,
  Safety-, Privacy- oder Datenverlustprobleme.
- Ein zweiter Testnutzer kann keine Daten des ersten Haushalts lesen oder ändern.
- `npm run verify` sowie alle für den Release erforderlichen Unit-, Property-/Mutation-,
  Komponenten-, API-, pgTAP/RLS-, Integrations-, Playwright-, Maestro-, Security-,
  Privacy-, Last-, Restore- und Store-Sandbox-Gates sind für das exakte Artifact grün.
  Es gibt keine C0/C1-Flakes, Skips, Blocked-, Not-Run- oder veraltete Evidence.
- Supabase-Migrationen sind angewandt und die Vercel-Production-URL wurde tatsächlich
  geöffnet und geprüft – oder es ist exakt ein externer Zugriffsblocker dokumentiert.
- Native Store-Builds, Kauf/Wiederherstellung, Datenschutz-/Daten-Sicherheitsangaben,
  Löschpfade und Deutschland-Country-Pack bestehen alle Release-Gates, bevor von einer
  kommerziellen Veröffentlichung gesprochen wird.
- Die CEO-Zentrale kann jeden Umsatz-/Steuer-/Qualitätswert bis zur Quelle und jeden
  Release-Status bis zum signierten Commit, Testlauf, Migrationsstand und Artifact-Digest
  nachvollziehen. Fehlende, veraltete, flaky oder blockierte Evidence bleibt NOT PROVEN.
- Ein exakter Rückruf sperrt die betroffene Charge; möglicher/Text-/staler Status bleibt
  korrekt unsicher und verweist auf die amtliche Quelle.
- Offline-Kill/Retry/Mehrgeräte-Konflikte bewahren bestätigte Nutzerabsicht mit genau
  einem Servereffekt; entfernte Nutzer und alte Backups können nichts wiederbeleben.
- MFA-Recovery, Model/OCR-Canary, signierte OTA-Runtime/Rollback und CEO-A0–A3-
  Autorisierung bestehen ihre benannten C0-Tests.
- Der Produkt-/Markt-/Marken-Gate besitzt echte Evidence oder blockiert den Ausbau; keine
  angenommene Nutzer-, Umsatz-, Liquiditäts- oder Compliance-Zahl wird als real gezeigt.

## Abschlussbericht

Gib am Ende kompakt aus:

1. was implementiert wurde,
2. welche Datenbankmigrationen und RLS-Prüfungen erfolgt sind,
3. welche Umgebungsvariablen benötigt werden, ohne Werte zu veröffentlichen,
4. die tatsächlich ausgeführten Test-/Build-Ergebnisse,
5. die verifizierte Production-URL und den geprüften Flow oder den einen verbleibenden
   externen Blocker,
6. bekannte, klar abgegrenzte Restpunkte nach MVP.
