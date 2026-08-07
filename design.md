# FoodOS Design System

Version **2.0** · Adaptive mobile-first · Quiet Intelligence · Deutsche Oberfläche  
Status: **verbindlicher Produkt- und UI-Vertrag**

Dieses Dokument beschreibt, wie FoodOS aussehen, reagieren und sich anfühlen muss. Es ist
für Menschen und Codex-Agenten geschrieben. Es ersetzt keine fachlichen Regeln, sondern
übersetzt die kanonische Produktvision in eine konsistente, testbare Oberfläche.

## Quellen und Rangfolge

1. `plans/FOODOS_MASTER_PLAN.md` — Gesamtpriorität und Quellenkarte.
2. `plans/PRODUCT_NORTH_STAR.md` — Nutzerpromise und Einfachheitsgrenze.
3. `plans/USER_FLOWS.md` — stabile Flow-IDs und fachliches Verhalten.
4. `design.md` — visuelle Hierarchie, Navigation, Komponentenrezepte und UI-Abnahme.
5. bestehende semantische CSS-Tokens und Komponenten — technische Ist-Quelle.
6. Mockups, Figma, v0, Screenshots und generierte Bilder — Referenz oder Konzept, niemals
   automatisch Autorität für Navigation, Daten, Sicherheit oder Produktverhalten.

Messbare Performance- und Plattformregeln stehen zusätzlich in
`plans/UI_UX_PERFORMANCE_PLAN.md`. Echte Usability-Evidence folgt
`plans/UX_RESEARCH_AND_USABILITY_TESTING.md`. Die native Codex-UI-Agentenstruktur steht in
`docs/agent/CODEX_UI_AGENT_ARCHITECTURE.md`.

---

## 1. Produktgefühl

FoodOS ist ein ruhiges, intelligentes Haushaltswerkzeug. Es wirkt hochwertig und modern,
aber nicht wie ein Fitness-Tracker, Krankenhausprodukt, Gaming-Interface oder generisches
SaaS-Dashboard.

Die gewünschte Wirkung:

- **sofort verständlich:** Der wichtigste nächste Schritt ist ohne Erklärung sichtbar;
- **fast:** häufige Handlungen reagieren unmittelbar und unterbrechen den Nutzer nicht;
- **verlässlich:** Quelle, Aktualität und Unsicherheit werden ehrlich dargestellt;
- **ruhig:** wenige Flächen, klare Abstände und gezielte Akzente statt visueller Lautstärke;
- **praktisch:** einhändig, große Trefferflächen, sinnvolle Standardwerte, schnelle Korrektur;
- **motivierend:** Fortschritt und Möglichkeiten statt Schuld und künstlicher Dringlichkeit.

Interne Kurzform: **smarte Speisekammer bei Nacht** — waldgrün, warm, präzise und ruhig.

---

## 2. Nicht verhandelbare Designprinzipien

### Ergebnis vor Oberfläche

Jeder Screen beginnt mit der Nutzerfrage und dem nächsten sinnvollen Ergebnis. Die UI ist
kein Schaukasten für Funktionen oder Kennzahlen.

### Handlung vor Erklärung

Pro Schritt existiert eine dominante Primäraktion. Details erscheinen progressiv und
konkurrieren nicht mit der Aufgabe.

### Erfassen statt verwalten

Ein Einkauf ist eine zusammenhängende Sitzung. Bekannte Produkte erzeugen keine
Einzelformulare. Das System übernimmt Produktdaten, Vorschläge und Wiederholungen; der
Nutzer bestätigt nur Unsicherheit und sicherheitskritische Angaben.

### Zustand vor Dekoration

Farbe, Icon, Text und Bewegung erklären einen realen Zustand: erkannt, unklar, lokal,
synchronisiert, bald fällig, betroffen oder nicht geprüft. Dekoration erhält keine eigene
Hierarchiestufe.

### Persönlich relevant vor allgemein interessant

Allergene, Rückruf, Verbrauchsdatum, bald fällige Produkte und konkrete Fehlmengen stehen
vor allgemeinen Produktdetails oder Statistiken.

### Fakten vor Interpretation

Nährwerte, Zutaten, Portion, Quelle und Datenabdeckung werden vor einer persönlichen
Einordnung gezeigt. Es gibt keinen unerklärten universellen Gesund-/Ungesund-Score.

### Korrektur ist normal

Jede Automatisierung besitzt einen kurzen, reversiblen Korrekturweg. Fehler werden nicht
versteckt und zwingen nicht zum Neustart eines kompletten Einkaufs oder Plans.

---

## 3. Kanonische Informationsarchitektur

FoodOS besitzt **vier primäre Ziele**:

| Ziel | Nutzerfrage | Dominante Aktion |
|---|---|---|
| **Heute** | „Was kann ich jetzt essen und was ist wichtig?“ | Mahlzeit auswählen |
| **Erfassen** | „Was kommt aus diesem Einkauf in meinen Vorrat?“ | Einkauf starten/fortsetzen |
| **Vorrat** | „Was habe ich, wo liegt es und was sollte ich nutzen?“ | Produkt oder schnelle Korrektur öffnen |
| **Planen** | „Was koche ich, was fehlt und was kaufe ich?“ | Rezept/Plan/Einkauf fortsetzen |

`Einkauf` ist kein fünfter Hauptbereich. Einkaufsliste, Wochenplan und Rezeptplanung bilden
einen zusammenhängenden Bereich unter **Planen**. Profil, Haushalt, Ziele, Datenschutz,
Integrationen, Export und Einstellungen liegen hinter dem Avatar beziehungsweise „Mehr“.

Auf kompakten Geräten verwendet FoodOS eine Bottom Navigation mit vier eindeutigen Zielen.
**Erfassen** darf als zentrale Handlung visuell hervorgehoben werden, bleibt aber ein
normal beschrifteter und zugänglicher Navigationspunkt. Auf mittleren und erweiterten
Fenstern wird dieselbe Informationsarchitektur als Rail/Sidebar oder List-Detail-Layout
dargestellt; die Aufgabe und Reihenfolge ändern sich nicht.

Kritische Sicherheitsinterventionen dürfen auf Heute vor der normalen Essensentscheidung
stehen. Ohne solche Intervention ist **„Was kann ich jetzt essen?“** die visuelle und
inhaltliche Hauptentscheidung, nicht ein großer Kalorien-Dashboard-Hero.

---

## 4. Kernabläufe

### 4.1 Einkauf erfassen

Ziel: Ein kompletter Einkauf wird mit möglichst wenig Unterbrechung in einen verlässlichen
digitalen Vorrat umgewandelt.

1. Nutzer startet **Einkauf erfassen**.
2. Kamera/Barcode, Bon, E-Beleg oder manuelle Eingabe stehen als Erfassungswege bereit.
3. Bei bekanntem Barcode folgt sofort Ton/Haptik, Produktname, Miniatur, Menge und Status.
4. Die Kamera bleibt für den nächsten Artikel aktiv.
5. Ein identischer erneuter Scan erhöht die Menge, ohne eine Detailseite zu öffnen.
6. Hohe Konfidenz und geringes Risiko werden direkt in die Sitzung übernommen.
7. Unklare Produktzuordnung, Menge, Lagerort oder optionale Daten landen in einer Queue.
8. Unsicheres Verbrauchsdatum, Allergen oder Recall-Merkmal verlangt explizite Bestätigung.
9. **Fertig** öffnet genau eine zusammengefasste Unsicherheitsprüfung.
10. Bestätigen übernimmt den Einkauf atomar/idempotent und bietet direkt
    **„Was kann ich damit essen?“** an.

Die Kamera endet nur bei Nutzerabbruch, Hintergrund/Timeout, Berechtigungsverlust oder
wenn die Sitzung abgeschlossen wird. Ein Produktfund allein beendet die Einkaufssitzung
nicht.

#### Erfassungs-HUD

Während des Scans dominieren Kamera und Rückmeldung. Sichtbar sind höchstens:

- kurze Scan-Anweisung;
- Anzahl erfasster Packungen;
- letzter Treffer mit Menge;
- Status der unklaren Angaben;
- Taschenlampe/Permission-Hilfe;
- **Fertig** und ein ruhiger manueller Fallback.

Keine Produktdetailseite, Nährwerttabelle oder Zutatenanalyse unterbricht den schnellen
Scan. Diese Inhalte bleiben nachgelagert erreichbar.

### 4.2 Unsicherheit prüfen

Die Abschlussfläche gruppiert nach nötiger Entscheidung statt nach technischen Quellen:

1. sicherheitskritisch bestätigen;
2. Produktzuordnung auswählen;
3. Menge/Lagerort kurz korrigieren;
4. nichtkritische Angaben später ergänzen.

Jede Zeile zeigt die Vermutung, den Grund der Unsicherheit, Quelle/Konfidenz und eine
schnelle Korrektur. Nichtkritische Felder dürfen auf „später“ stehen. Die App erfindet
keine MHD- oder Verbrauchsdaten, um die Queue leer erscheinen zu lassen.

### 4.3 Heute — Was kann ich jetzt essen?

Reihenfolge:

1. exakter/möglicher Rückruf oder überschrittenes Verbrauchsdatum, falls handlungsrelevant;
2. Entscheidung **Was kann ich jetzt essen?** mit zwei bis vier starken Vorschlägen;
3. bald verbrauchen;
4. kompakter Tages-/Nährstoffstatus;
5. heutige Mahlzeiten beziehungsweise letzte Aktionen;
6. Einkauf erfassen oder Plan fortsetzen.

Ein Vorschlag nennt knapp:

- warum er passt;
- ob alles vorhanden ist;
- welche Zutat fehlt oder ersetzt werden kann;
- Kochzeit und Portionen;
- relevante Ablaufpriorität;
- Kalorien/Makros, wenn zuverlässig verfügbar;
- persönlichen Allergen-/Ausschlussstatus.

### 4.4 Vorrat

Suche steht vor Filtern. Standardreihenfolge ist handlungsorientiert:

1. Rückruf/prüfen;
2. Verbrauchsdatum;
3. überschrittenes MHD;
4. bald fällig;
5. geöffnet;
6. normal;
7. Daten unvollständig.

Jede Zeile zeigt Produkt, nutzbare Restmenge beziehungsweise verständliche Schätzung,
Lagerort und wichtigsten Status. Mehrere Chargen dürfen gruppiert werden, die nächste
relevante Charge bleibt sichtbar.

Schnellkorrektur erlaubt Packung, Stück, Anteil oder ungefähre Restmenge. Exakte Gramm
werden nur verlangt, wenn Berechnung oder Sicherheit sie benötigt.

### 4.5 Rezept, Portionen und Kochen

Rezeptgruppen:

1. vollständig kochbar;
2. mit sicherer Alternative kochbar;
3. fast kochbar mit kurzer Fehlmenge;
4. Inspiration außerhalb des aktuellen Vorrats.

Rezeptkarten erklären ihren Rang, etwa: „Alles vorhanden · Spinat heute nutzen · 18 Min.“
Portionsänderungen aktualisieren Fehlmengen und Nährwerte vor Bestätigung. Der Kochmodus
zeigt eine klare Schrittfolge und bietet danach einen **Vorschlag** für den tatsächlichen
Bestandsverbrauch. Unsichere Mengen werden nicht still abgezogen. Reste lassen sich mit
wenigen Angaben wieder einlagern.

### 4.6 Produkt und persönliche Eignung

Reihenfolge:

1. Produktidentität, Packung und Quellenstatus;
2. persönlicher Allergen-/Ausschlusshinweis;
3. Recall-/Datumsstatus der konkreten Packung;
4. kompakte Nährwerte mit Portionsbasis;
5. positive und zu beachtende Faktoren;
6. Inhaltsstoffe nach persönlicher Relevanz;
7. vollständige Daten, Quelle, Aktualität und Unsicherheit.

Beispiel für eine zulässige Zusammenfassung:

> „Passt gut zu deinem Protein-Ziel. Enthält dein hinterlegtes Allergen und relativ viel
> Salz. Nährwerte vollständig, Zutatenliste teilweise strukturiert.“

### 4.7 Planen und Einkauf zurückführen

Plan, Rezepte und Einkaufsliste teilen denselben Bestand. Fehlmengen entstehen aus Plan
minus nutzbarem Vorrat; manuelle Artikel bleiben erhalten. Abgehakte oder importierte
Einkäufe öffnen eine neue Erfassungssitzung, statt erneut alle Produkte einzeln einzugeben.

---

## 5. Interaktionsbudgets

Diese Werte sind Ziel- und Abnahmekriterien, keine Behauptung über den aktuellen Stand:

- bekannter warmer Barcode: Rückmeldung und nächste Scanbereitschaft möglichst unter 1 s;
- identischer Artikel: ein erneuter Scan, keine Detailansicht;
- 15 bekannte Produkte: eine Sitzung, höchstens eine abschließende Prüffläche;
- Produktname, Nährwerte, Zutaten und Standard-Packungsgröße werden nie abgetippt, wenn
  eine validierte Quelle sie liefert;
- pro Schritt genau eine dominante Primäraktion;
- Hauptaktion innerhalb komfortabler Daumenreichweite und nie von Safe Area/Tastatur
  verdeckt;
- Nutzer erkennt Hauptinhalt und nächste Aktion innerhalb von fünf Sekunden;
- kritische Warnung enthält immer eine konkrete Handlung;
- Korrektur eines normalen Mengen-/Lagerortfehlers dauert wenige Sekunden und erfordert
  keinen Flow-Neustart.

Ein technisch vollständiger Flow, der wiederholt vermeidbare Felder verlangt, gilt als
nicht bestanden.

---

## 6. Layout und adaptive Struktur

### Kompakt

- Zielbereich: 360–430 px; 320 px darf nicht horizontal überlaufen.
- Inhaltsbreite: 100 %, in Desktop-Vorschau maximal sinnvoll begrenzen.
- Seitenabstand: 18 px; bei sehr schmalen Geräten 13–16 px.
- Hauptabstand zwischen Sektionen: 24 px.
- Karten-/Flächeninnenabstand: 14–20 px nach Dichte.
- Topbar und Bottom Navigation berücksichtigen iOS/Android Safe Areas.
- Inhalt erhält ausreichend unteren Abstand; Sticky Actions bleiben oberhalb Navigation
  und Bildschirmtastatur erreichbar.

### Mittel

- 600–839 px.
- Navigation darf zur Rail werden.
- List-Detail oder Haupt-/Nebenbereich nur, wenn beide denselben Task unterstützen.
- Resize bewahrt Eingabe, Auswahl, Scrollposition, Fokus und bestätigte lokale Absicht.

### Erweitert

- ab 840 px.
- keine breitgezogene Telefonspalte und kein fremdes Enterprise-Dashboard.
- sinnvolle List-Detail-Aufteilung, etwa Vorrat + Produkt/Charge oder Plan + Rezept.
- Fokusflows bleiben begrenzt und lesbar.

### Raster

Basisschritte: `4, 8, 12, 16, 20, 24, 32, 40, 48` px. Optische Korrekturen von 1–2 px
sind erlaubt, erzeugen aber keine zweite Spacing-Skala.

---

## 7. Design Tokens

Die tatsächlich implementierten CSS-Variablen sind technische Quelle. Neue Komponenten
verwenden semantische Tokens und keine zufälligen Hex-Werte.

### Kernfarben

| Token | aktueller Wert | Rolle |
|---|---:|---|
| `--canvas` | `#07100c` | App-Hintergrund |
| `--surface` | `#0d1913` | Standardfläche |
| `--surface-2` | `#122219` | erhöhte Fläche |
| `--surface-3` | `#182b20` | aktive/kräftige Fläche |
| `--ink` | `#f5f8f3` | Haupttext |
| `--muted` | `#829188` | Meta/Hilfe |
| `--muted-2` | `#aab4ae` | sekundärer Text |
| `--line` | `rgba(223,255,234,.09)` | Trennung |
| `--lime` | `#b7f36a` | Primäraktion/aktiver Zustand |
| `--warm` | `#ff947a` | Dringlichkeit/persönlicher Konflikt |
| `--blue` | `#83c9ff` | Information/Sync |

Farbe trägt nie allein Bedeutung. Status erhält zusätzlich Text und eindeutiges Icon.
Ein Theme ändert semantische Zuordnung, nicht fachliche Bedeutung.

### Typografie

- Geist über das vorhandene Next.js-Font-Setup; System-Fallback ohne externe Laufzeitlast.
- Display/Entscheidung: 32–44 px, Gewicht 700–780, sparsam.
- Screen-Titel: 20–24 px, Gewicht 700–750.
- Sektion: 18–20 px, Gewicht 700.
- Kartentitel/Produkt: 14–17 px, Gewicht 650–750.
- Fließtext: 14–16 px, Zeilenhöhe mindestens 1.45.
- Meta/Label: 12–13 px; kritischer Text niemals kleiner als 12 px.
- Kalorien, Makros, Preise und Mengen verwenden tabellarische Ziffern, wenn möglich.

### Form und Tiefe

- große Entscheidungsfläche: 22–26 px Radius;
- Standardfläche: 17–20 px;
- Button/Feld: 13–15 px;
- Chips: voller Radius oder 8–10 px;
- Tiefe primär durch Flächen und Linien, Schatten nur gezielt;
- kein Glassmorphism ohne opaken, kontrastreichen Fallback.

### Bewegung

- Standard: 160–220 ms, `ease-out`;
- Seitenwechsel höchstens 320 ms und geringe Bewegung;
- Scanfeedback sofort; Animation blockiert keinen nächsten Scan;
- normale Buchung erhält keinen Konfetti-Effekt;
- `prefers-reduced-motion` deaktiviert Scanner-, Puls- und Seitenbewegung;
- Swipe/Drag sind Abkürzung, nie einzige Bedienmöglichkeit.

---

## 8. Komponentenrezepte

Komponenten sind wiederverwendbare Zustands- und Hierarchierezepte, keine Sammlung von
Dekorationskarten.

### App Shell

Topbar, Inhaltsbereich, vierteilige Navigation/Rail, Safe Areas, Fokus- und
Resize-Erhaltung. Maximal zwei Icon-Aktionen pro Topbar.

### Decision Hero

Eine Nutzerfrage, kurze Begründung, ein klares Ergebnis und eine Primäraktion. Höchstens
vier unterstützende Kennzahlen; keine Metrik-Wand.

### Capture HUD

Kamera, Scanrahmen, letzter Treffer, Sitzungszähler, Unklar-Anzahl, Licht/Permission und
Fertig-Aktion. Keine Detailanalyse im laufenden Scan.

### Capture Queue Row

Produkt/Packung, Menge, Quelle/Status und schnelle Korrektur. Gleiches Produkt wird
aggregiert, bleibt aber nachvollziehbar.

### Uncertainty Review

Gruppiert nach Entscheidung, zeigt Vermutung und Grund, verwendet schnelle Controls und
erlaubt „später“ für nichtkritische Daten.

### Inventory Row

Produkt, Restmenge/Schätzung, Lagerort, nächster relevanter Status und klare Öffnen- oder
Korrigieren-Aktion. Kein verschachteltes Kartenlayout.

### Recipe Candidate

Titel, Kochbarkeit, Begründung, Zeit, Portion, Fehlmenge und relevante Nährwerte. Bild nur,
wenn es Hierarchie verbessert und Quelle/Lizenz klar ist.

### Safety Callout

Status, betroffene Packung, Quelle/Aktualität, offizielle Handlung und Wiederholungs-/
Korrekturweg. Kein bloßer roter Alarm ohne Aktion.

### Bottom Sheet

Handle, Titel, Schließen, Fokusfalle, Escape/Zurück, Safe Area und sichtbare Primäraktion
bei geöffneter Tastatur. Für kurze Entscheidungen; komplexe Bearbeitung erhält Screen.

### Feedback

Toasts nur für kurze reversible Erfolge. Entscheidungsbedürftige Fehler erscheinen inline.
Lokal/wartend/bestätigt/konflikt/abgelehnt bleibt unterscheidbar.

---

## 9. Pflichtzustände

| Zustand | UI-Vertrag |
|---|---|
| `idle` | nächster Schritt verständlich |
| `loading` | bekannte Inhalte stabil halten, lokaler Fortschritt sichtbar |
| `success` | tatsächliches Ergebnis und nächste Aktion nennen |
| `empty` | Grund erklären und Einstieg anbieten |
| `error` | Ursache, Lösung, Retry und erhaltene Eingabe |
| `offline` | Cache-Freshness und mögliche/unmögliche Aktion trennen |
| `permission_denied` | konkreter Wiederherstellungsweg plus Fallback |
| `conflict` | Werte, Auswirkung und bewusste Entscheidung zeigen |
| `uncertain` | Vermutung, Quelle/Konfidenz und Bestätigung zeigen |
| `partial` | verfügbare Fakten zeigen, fehlende Felder nicht als Null interpretieren |

Skeletons spiegeln die Zielstruktur. Eine ganze Seite erhält keinen Spinner, wenn bekannte
lokale Daten gezeigt werden können.

---

## 10. Daten-, Gesundheits- und Sicherheitsdarstellung

- MHD (Qualität) und Verbrauchsdatum (Sicherheit) sind sprachlich und visuell verschieden.
- Nach überschrittenem Verbrauchsdatum keine Verzehr-/Rezeptempfehlung.
- Recall unterscheidet exakt, möglich, Textkandidat und ungeprüft/veraltet.
- Quellenfehler wird niemals zu „nicht zurückgerufen“ oder grün.
- Allergene/Ausschlüsse sind persönlich begründet; E-Nummer allein ist kein Schadensbeleg.
- Unbekannte Nährwerte, Zutaten, Mengen, Daten und Quellen bleiben unbekannt.
- AI darf ranken, formulieren und Optionen vorschlagen. Deterministische Systeme behalten
  Mengenrechnung, Nährstoffsummen, Allergene, Recall, Datum und Autorisierung.
- Persönliche Produkteignung zeigt positive Faktoren, Vorsicht, Zielbezug, Portion,
  Datenabdeckung und Unsicherheit; keine Diagnose oder Heilversprechen.
- Werbung fehlt in Auth, Scan, Datum, Recall, Allergie, Nährstoffdetail, Consent, Fehler,
  Export und Löschung.

---

## 11. Asset Direction und Medienwahl

Neue Assets entstehen nur, wenn sie Verständnis, Vertrauen, Task-Erfolg oder
Wiedererkennbarkeit verbessern.

Reihenfolge der Entscheidung:

1. kein Asset;
2. Live-Typografie und Layout;
3. vorhandenes Lucide-/FoodOS-Icon;
4. deterministisches CSS oder authored SVG;
5. echtes, quellenbasiertes Produktbild;
6. originale generierte Illustration als Konzept.

### Visuelle Richtung

- Quiet Intelligence + Household Flow;
- dunkles Waldgrün, warme neutrale Töne, kontrollierter Limettenakzent;
- klare Silhouetten, organische reduzierte Formen, sparsame Körnung;
- keine Blatt-Gabel-Gehirn-Roboter-Clipart;
- keine Neon-Gaming-, Fitness-Bro-, Krankenhaus-, 3D-Emoji- oder generische SaaS-Optik;
- Illustration bleibt hinter Daten und Hauptaktion.

### Technische Regeln

- Logos, Wortmarken, UI-Icons, Scannerrahmen, Diagramme und Barcodes: Vektor/CSS zuerst.
- KI-Bild ist `CONCEPT`, nie automatisch finale Marke oder UI-Grafik.
- Produktfoto einer realen Marke nur aus ausgewiesener Quelle; sonst neutraler Kein-Bild-
  Zustand.
- keine eingebrannte kritische oder lokalisierbare Copy;
- semantische kleingeschriebene Dateinamen;
- explizite Dimensionen und responsive Varianten;
- normales mobiles Illustrationsasset nach Optimierung möglichst unter 150 KB;
- Zweck, Quelle/Generationsmethode, Lizenz, Status und Einsatz in
  `docs/brand/ASSET_MANIFEST.md`;
- finaler Status nur nach unabhängiger visueller und Accessibility-Prüfung.

---

## 12. Barrierefreiheit und Performance

- WCAG 2.2 AA als Mindestziel.
- Textkontrast 4.5:1; große Texte und relevante UI-Grenzen 3:1.
- Touchziele mindestens 44 × 44 CSS px/pt auf Web/iOS und 48 × 48 dp auf Android.
- sichtbare Labels ersetzen Placeholder; Icon-Aktionen besitzen zugängliche Namen.
- Fokus bleibt sichtbar und wird nicht von Topbar, Navigation, Sheet oder Tastatur verdeckt.
- Statusänderungen werden angemessen angekündigt, ohne Screenreader zu überfluten.
- Diagramme/Progress besitzen Textäquivalent; Farbe ist nie alleinige Bedeutung.
- Kamera, Swipe, Drag und Long Press besitzen sichtbaren Fallback.
- 200 % Zoom und größere Systemschrift bleiben nutzbar.
- Scanner, OCR, Charts und andere schwere Client-Funktionen werden intentbasiert geladen.
- Bilder besitzen feste Aspect Ratio und Dimensionen; keine Layoutverschiebung.
- Web-Ziele: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 am 75. Perzentil je Mobile/Desktop.
- Kritische Flows werden zusätzlich manuell mit Tastatur und VoiceOver/TalkBack geprüft;
  automatisierte Scans allein sind keine vollständige Evidence.

---

## 13. Codex-, Figma-, v0-, shadcn- und Testregeln

### Native UI-Agenten

Standardkette für eine wesentliche UI-Änderung:

```text
ui_explorer
-> ux_flow_designer + $foodos-ui-flow-spec
-> CPO-Richtung
-> ui_system_architect
-> ui_implementer + $foodos-ui-implementation
-> $foodos-ui-quality-review:
   interaction_verifier
   accessibility_verifier
   visual_verifier + $foodos-visual-qa
-> Finding -> ui_implementer -> Retest durch den ursprünglichen Verifier
-> erforderliche Produkt-/Safety-/Release-Freigabe
```

Nicht jede kleine Korrektur benötigt die ganze Kette. Implementierer und Verifier bleiben
bei materieller Arbeit getrennt. Jede erforderliche Prüflinie behält ihren eigenen Status;
Bewertungen oder Scores dürfen keinen Blocker und keine fehlende Evidence wegmitteln.

### Figma

Strukturierte Figma-Komponenten, Variablen und Code-Mappings sind hilfreicher als ein
Screenshot, wenn ein freigegebenes natives Design existiert. Figma ist keine Voraussetzung
für FoodOS und überschreibt weder Code-Tokens noch Produkt-/Safety-Regeln.

### v0

v0 darf einen bounded visuellen Vorschlag oder Komponentenprototyp liefern. Kein kompletter
generierter Projektstand wird über FoodOS kopiert. Jede Übernahme wird gegen bestehende
Komponenten, Tokens, Abhängigkeiten, Accessibility, Performance und Domainverträge geprüft.

### shadcn/ui

Bestehende FoodOS-Primitives zuerst. Vor einem Baustein: ansehen, Dokumentation prüfen,
`--dry-run`/Diff bewerten. Kein blindes `init`, `add --all`, Überschreiben oder paralleles
Designsystem. Eine FoodOS-Registry ist erst sinnvoll, wenn die Primitive stabil sind.

### Storybook

Storybook wird eingeführt, wenn eine stabile gemeinsam genutzte Komponentenbasis isolierte
State-Stories, Interaktion, Accessibility und visuelle Regression wirtschaftlich rechtfertigt.
Es ist kein Gate vor dem ersten Scan-first-Slice.

### Browser und Playwright

Der gerenderte Screen ist visuelle Wahrheit. Nach relevanten Änderungen: Seite öffnen,
Netzwerk/Console prüfen, echte Interaktion ausführen, Screenshots der Zustände aufnehmen.
Screenshot-Diffs laufen nur in kontrollierter, stabiler Umgebung, damit Font-/Rendering-
Unterschiede keine wertlosen Flakes erzeugen.

---

## 14. Visuelle Evidence-Matrix

Mindestens prüfen:

- 360 × 800;
- 390 × 844;
- 430 × 932;
- mittel/erweitert, wenn Layout betroffen;
- Dark Mode; Light Mode nur, wenn unterstützt/geändert;
- Standard, Loading, Empty, Error;
- Permission denied;
- Offline/Sync-Konflikt;
- sehr langer deutscher Produktname;
- große Schrift/200 % Zoom;
- reduzierte Bewegung;
- Kamera/Scanner: unbekanntes Produkt, Doppel-Scan, niedrige Konfidenz, Abschluss-Queue;
- Recall: exakt, möglich, veraltet/ungeprüft und Korrektur/Rücknahme, wenn betroffen.

Screenshotnamen enthalten Route, Zustand und Viewport. Keine privaten Nutzerdaten in
Evidence oder PRs.

---

## 15. Verbotene Muster

- fünf oder mehr konkurrierende Haupttabs;
- Produktformular nach jedem bekannten Scan;
- große Kalorienzahl als Standard-Hauptentscheidung auf Heute;
- Kartenmosaik, Karten in Karten und Kennzahlfriedhof;
- zufällige Hex-Werte, neue Farbe je Kategorie oder zweites Spacing-System;
- generische Verläufe, Glassmorphism, Neon oder 3D-Deko ohne funktionalen Grund;
- unbeschriftete kritische Icons;
- wichtige Aktion nur über Hover, Swipe, Drag oder Kamera;
- Modal-/Bottom-Sheet-Kaskaden;
- deaktivierter Button ohne sichtbaren Grund;
- Primäraktion unter Navigation, Safe Area oder Tastatur;
- unbekannte Daten als Null, grün oder „sicher“;
- pauschale Rotwarnung für E-Nummern oder allgemeine „gesund/ungesund“-Badges;
- generiertes Logo ohne saubere Vektorrekonstruktion;
- erfundene Produktbilder, Nährwerte, Preise, MHDs oder Konfidenzen;
- finaler visueller PASS ohne echten Browserzustand und unabhängigen Verifier.

---

## 16. Definition of Done für UI-Änderungen

Eine UI-Änderung ist erst abgeschlossen, wenn:

- Nutzerziel, Hauptaktion und Akzeptanzkriterium benannt sind;
- aktuelle Implementierung und wiederverwendbare Komponenten geprüft wurden;
- der Flow weniger oder gleich viel vermeidbare Arbeit erzeugt;
- alle betroffenen Pflichtzustände implementiert sind;
- kompakt/mittel/erweitert korrekt reagieren;
- Touch, Tastatur, Fokus, Screenreader, Textskalierung und reduzierte Bewegung geprüft sind;
- Quelle, Konfidenz, MHD/use-by, Recall, Allergen und Sync fachlich korrekt erscheinen;
- vorhandene Tokens/Primitives verwendet oder begründbar erweitert wurden;
- Assets notwendig, optimiert, dokumentiert und unabhängig geprüft sind;
- Browser, Console/Netzwerk, Interaktion und passende Tests für den exakten Commit geprüft
  wurden;
- materielle UI-Findings strukturiert an den Implementierer geroutet und nach dem Fix vom
  ursprünglichen unabhängigen Verifier am neuen exakten Commit erneut geprüft wurden;
- Status ehrlich `PASS`, `FAIL`, `FLAKY`, `BLOCKED` oder `NOT_RUN` lautet;
- eine wesentliche neue Nutzerinteraktion echte Usability-Evidence erhält, bevor daraus
  Produkt-Markt- oder Verständlichkeitsbehauptungen entstehen.
