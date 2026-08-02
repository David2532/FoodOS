# FoodOS Design System

Version 1.1 · Adaptive mobile-first · Dark nutritional utility · Deutsche Oberfläche

Dieses Dokument ist die verbindliche visuelle und interaktive Produktspezifikation für
FoodOS. Es schützt die App davor, bei neuen Features zu einer Ansammlung uneinheitlicher
Karten und Formulare zu werden. Bestehende funktionierende Muster werden weitergeführt;
neue Screens müssen sich wie derselbe Teil von FoodOS anfühlen.

Visuelle North-Star-Tafeln und der vollständige Screen-Katalog liegen unter
[`mockups/README.md`](mockups/README.md). Die Tafeln zeigen Stil und Hierarchie, sind aber
wegen ihrer generativen Natur nicht verbindlich für exakte Texte, Daten oder Navigation.
Die fachlich exakten Abläufe stehen in [`plans/USER_FLOWS.md`](plans/USER_FLOWS.md).
Messbare Web-/Native-Performance, plattformspezifische Apple-/Android-Regeln,
Accessibility-Gates und der UI-Engineering-Workflow stehen verbindlich in
[`plans/UI_UX_PERFORMANCE_PLAN.md`](plans/UI_UX_PERFORMANCE_PLAN.md). Nutzerverständnis
wird nach [`plans/UX_RESEARCH_AND_USABILITY_TESTING.md`](plans/UX_RESEARCH_AND_USABILITY_TESTING.md)
mit echten Testpersonen geprüft; visuelle Qualität allein ist keine Usability-Evidence.

## 1. Produktgefühl

FoodOS soll sich wie ein ruhiges, intelligentes Haushaltswerkzeug anfühlen – nicht wie
eine medizinische Warn-App und nicht wie ein aggressiver Fitness-Tracker.

Die gewünschte Wirkung ist:

- **Sofort verständlich:** Der wichtigste nächste Schritt ist ohne Nachdenken sichtbar.
- **Verlässlich:** Herkunft, Unsicherheit und Status der Daten werden ehrlich gezeigt.
- **Ruhig:** Dunkle natürliche Flächen, wenig visuelles Rauschen, gezielte Akzentfarbe.
- **Praktisch:** Große Trefferflächen, einhändige Nutzung, keine unnötigen Dialogketten.
- **Motivierend:** Fortschritt statt Schuld; Warnungen bleiben sachlich und lösbar.

Die Designpersönlichkeit lässt sich als „smarte Speisekammer bei Nacht“ beschreiben:
waldgrün, warm, präzise und hochwertig.

## 2. Gestaltungsprinzipien

### Handlung vor Erklärung

Jeder Screen hat genau eine dominante Primäraktion. Sekundäraktionen sind sichtbar,
aber konkurrieren nicht mit ihr. Lange Erklärungen erscheinen erst bei Bedarf.

### Zustand vor Dekoration

Farbe, Icon und Text erklären einen echten Zustand: MHD, Datenqualität, persönliches
Risiko, Synchronisierung oder Fortschritt. Farbe wird nie nur dekorativ für zufällige
Karten eingesetzt.

### Persönlich relevant vor allgemein interessant

Persönliche Allergene, bald ablaufende Produkte und konkrete Fehlmengen stehen oberhalb
allgemeiner Produktinformationen. Vollständige Rohdaten bleiben erreichbar, dominieren
aber nicht den ersten Blick.

### Bestätigung bei Unsicherheit

Erkannte MHD-, Chargen- oder OCR-Daten werden vor dem Speichern bestätigt. Die UI darf
eine Vermutung nie wie eine Tatsache aussehen lassen.

### Progressive Offenlegung

Der erste Blick zeigt Name, Menge, Status und Handlung. Zutatenrohtext, Provenienz,
Evidenzdetails und technische Metadaten öffnen sich in Details oder Bottom Sheets.

## 3. Informationsarchitektur

Die primäre Navigation besitzt dauerhaft fünf Ziele:

| Ziel | Nutzerfrage | Primäraktion |
|---|---|---|
| Heute | „Was ist heute wichtig?“ | Verzehr buchen |
| Vorrat | „Was habe ich und was läuft ab?“ | Produkt/Charge öffnen |
| Scan | „Was kommt neu hinein?“ | Kamera starten |
| Plan | „Was esse ich diese Woche?“ | Mahlzeit einplanen |
| Einkauf | „Was fehlt mir?“ | Artikel abhaken/hinzufügen |

Der Scan ist in der Mitte hervorgehoben, bleibt aber Teil derselben Bottom Navigation.
Profil, Haushalt, Ziele, Datenexport und Einstellungen liegen hinter dem Avatar bzw.
dem rechten Topbar-Button und werden nicht als sechster Tab ergänzt.

Detailansichten ersetzen die jeweilige Inhaltsfläche und besitzen eine klare
Zurück-Navigation. Mobile Formulare und kurze Entscheidungen öffnen bevorzugt als
Bottom Sheet; komplexe Datenbearbeitung erhält einen eigenen Screen.

### Werbung und Premium

Werbung ist ein klar beschrifteter, zurückhaltender Fremdinhalt und nie Teil der
Primärnavigation. Maximal eine kontextuelle Banner-/Native-Fläche darf auf einer
unkritischen Übersicht stehen. Keine Werbung erscheint bei Anmeldung/2FA, Kamera/Scan,
MHD/Verbrauchsdatum, Inhaltsstoff- oder Ernährungsprofil, Consent, Fehler, Export oder
Kontolöschung. Rückruf-, Sync-Konflikt- und Wiederherstellungsflächen sind ebenfalls
werbefrei. Interstitials unterbrechen keinen Nutzerflow.

Premium-Upsells erklären konkreten laufenden Nutzen und bleiben ablehnbar. Sicherheits-,
Warn-, Datenschutz-, Export-, Lösch- und Korrekturfunktionen sehen nie gesperrt aus.
Consent ist weder Kaufzwang noch Verkaufsargument.

## 4. Kernabläufe

Jeder Kernablauf wird als zusammenhängender Produkt-Flow gestaltet und implementiert.
Ein Flow besitzt immer einen klaren Einstieg, Fortschritt, Bestätigung, Abbruchweg und
eine sinnvolle Erholung nach Fehlern. Screens dürfen nicht nur für den Happy Path schön
aussehen. Navigation, Texte, Datenmutationen und Feedback müssen denselben Zustand
erzählen; eine erfolgreiche UI ohne erfolgreiche Persistenz gilt nicht als Erfolg.

### Lebensmittel hinzufügen

1. Scan-Tab öffnen.
2. Kamera erlauben oder Barcode manuell eingeben.
3. Produkt wird lokal bzw. über Open Food Facts gefunden.
4. Produktidentität und Datenqualität werden angezeigt.
5. GS1-Daten werden direkt übernommen oder ein zweiter MHD-/Chargen-Scan angeboten.
6. Nutzer bestätigt/korrigiert Datum, Menge, Einheit und Lagerort.
7. Eine kurze Erfolgsmeldung bestätigt den neuen Vorratsbestand und bietet
   „Weiter scannen“ als nächste Aktion an.

### Produkt verstehen

1. Produktkopf: Bild, Name, Marke, Menge und Quellenstatus.
2. Persönlich relevante Hinweise: Allergene/Ausschlüsse zuerst.
3. Nährwerte als kompakte Zusammenfassung pro 100 g/ml oder bestätigter Portion.
4. Inhaltsstoffe nach Relevanz sortiert, jeweils mit Begründung und Unsicherheit.
5. Vollständige Zutaten, Labels und Metadaten aufklappbar.

### Verzehr buchen

1. Produkt oder geplante Mahlzeit auswählen.
2. Charge und Portionsmenge bestätigen.
3. Live-Vorschau zeigt Kalorien/Makros und verbleibenden Bestand.
4. Eine Primäraktion bucht Verzehr und Bestandsänderung atomar.
5. Dashboard aktualisiert sich sichtbar, aber ohne übertriebene Celebration.

### Ablaufdatum behandeln

Die App bietet immer eine konkrete Handlung: „Heute einplanen“, „Verbraucht“,
„Entsorgt“ oder „Datum korrigieren“. Ein roter Status ohne Handlung ist unzulässig.

### Produktrückruf behandeln

1. Ein möglicher oder exakter Treffer steht über normalem MHD-/Plan-Inhalt.
2. Zeige Match-Qualität, betroffene Charge/Packung, offizielle Quelle und Aktualität.
3. Gib die offizielle Handlung wieder; FoodOS erklärt nicht stärker und verspricht keine
   Sicherheit.
4. `UNCHECKED`/veraltete Quelle bleibt sichtbar und verlinkt zur offiziellen Prüfung.
5. Nutzer kann „Packung vergleichen“, „Entsorgt/zurückgebracht“ oder „Falsch zugeordnet
   melden“, aber den amtlichen Datensatz nicht als sicher überschreiben.

### Offline und Konflikt behandeln

Nach einer Bestätigung steht sichtbar, ob die Änderung nur auf diesem Gerät, in der
Warteschlange, synchronisiert, abgelehnt oder konfliktbehaftet ist. Ein Konflikt zeigt
lokalen und Serverwert samt Folge; Sicherheits-, Mengen-, Mitgliedschafts- und
Löschkonflikte werden nie still per „zuletzt gespeichert“ entschieden.

## 5. Layout und Raster

### Mobile Basis

- Primärer Zielbereich: 360–430 px Breite.
- Inhaltsbreite: `100%`, im Desktop-Preview maximal 520 px.
- Horizontaler Seitenabstand: 18 px; bei maximal 380 px auf 13 px reduzieren.
- Topbar: 44 px Bedienelemente plus Safe-Area-Abstand.
- Bottom Navigation: fest, Safe Area berücksichtigen; Inhalt erhält mindestens 112 px
  unteren Abstand, damit nichts verdeckt wird.
- Hauptabstand zwischen Sektionen: 24 px.
- Karteninnenabstand: 14–20 px abhängig von Informationsdichte.

### Desktop

FoodOS bleibt eine fokussierte Consumer-App und wird nicht zu einem fremden Desktop-
Dashboard. Das Layout richtet sich jedoch nach dem verfügbaren Fenster statt nur nach
einem Gerätenamen: kompakt unter 600 px, mittel von 600–839 px und erweitert ab 840 px.
Mittlere/erweiterte Fenster dürfen Navigation Rail/Sidebar und passende List-Detail-
Ansichten nutzen, etwa Vorrat plus Charge, ohne Informationsarchitektur oder Task-Reihe
zu wechseln. Reine Form-/Fokusflows bleiben sinnvoll begrenzt. Maus, Tastatur, Scrollbar,
Split View, Rotation und dynamische Größenänderung müssen Zustand und Fokus bewahren.

### Spacing-Skala

Nur diese Basisschritte verwenden: `4, 8, 12, 16, 20, 24, 32, 40, 48` px. Kleine
optische Korrekturen von 1–2 px sind erlaubt, dürfen aber kein zweites Raster erzeugen.

## 6. Design Tokens

Die bestehenden CSS-Variablen bleiben die technische Quelle. Neue Komponenten sollen
keine zufälligen Hex-Werte einführen. Technisch werden Primitive, semantische Tokens,
Komponenten-Tokens und Komponentenrezepte getrennt. Ein Theme ändert semantische
Zuordnungen, nicht die Fachbedeutung. Das aktuelle Design-Tokens-Community-Group-
Previewformat wird wegen seines eigenen Warnhinweises nicht als stabile autoritative
Spezifikation implementiert; ein Adapter folgt erst auf eine stabile Veröffentlichung.

### Farbe

| Token | Wert | Verwendung |
|---|---:|---|
| `--canvas` | `#07100c` | App-Hintergrund |
| `--surface` | `#0d1913` | Standardkarte/Feld |
| `--surface-2` | `#122219` | erhöhte Fläche |
| `--surface-3` | `#182b20` | aktive/kräftige Fläche |
| `--ink` | `#f5f8f3` | Haupttext |
| `--muted` | `#829188` | Meta- und Hilfstext |
| `--muted-2` | `#aab4ae` | sekundärer Text |
| `--line` | `rgba(223,255,234,.09)` | dezente Trennung |
| `--lime` | `#b7f36a` | Primäraktion, Erfolg, aktive Navigation |
| `--warm` | `#ff947a` | dringend, abgelaufen, persönlicher Konflikt |
| `--blue` | `#83c9ff` | neutrale Information, Sync, Training |

Zusätzliche semantische Farben:

| Semantik | Vordergrund | Hintergrundidee |
|---|---:|---:|
| Beobachten | `#ffbb65` | `rgba(255,187,101,.10)` |
| MHD bald | `#cfad74` | `rgba(210,169,101,.08)` |
| Unbekannt | `--muted` | `rgba(255,255,255,.06)` |

Rot/Orange/Grün dürfen nie allein Bedeutung tragen. Jeder Status erhält zusätzlich
Text und ein eindeutiges Icon.

### Typografie

- Schrift: Geist über das vorhandene Next.js-Font-Setup; Arial nur als Fallback.
- Große Kennzahl: 40–44 px, enges Tracking, Gewicht 700–780.
- Screen-Titel: 20–22 px, Gewicht 700–750.
- Sektionstitel: 18–20 px, Gewicht 700.
- Kartentitel: 13–16 px, Gewicht 650–750.
- Fließtext: 14–16 px, Zeilenhöhe mindestens 1.45; lange Erklärtexte bevorzugt 16 px.
- Meta/Label: 11–13 px; Versalien nur für kurze Labels mit erhöhtem Tracking.
- Interaktive, erklärende, sicherheits- oder datumsrelevante Texte dürfen nicht unter
  12 px fallen. Kleinere Metadaten sind nur für redundante, nicht kritische Hinweise
  zulässig und müssen den Kontrast trotzdem erfüllen.
- Zahlen verwenden nach Möglichkeit tabellarische Ziffern, besonders bei Kalorien,
  Makros, Preisen und Beständen.

### Form und Tiefe

- Große Hero-Karten: 22–26 px Radius.
- Standardkarten: 17–20 px Radius.
- Buttons/Felder: 13–15 px Radius.
- Pills/Chips: voller Radius oder 8–10 px.
- Schatten sparsam; Tiefe entsteht primär durch Flächen und Linien.
- Keine Glassmorphism-Flächen ohne ausreichenden opaken Fallback.

## 7. Komponenten

### Topbar

Links steht die FoodOS-Marke oder eine Zurück-Aktion, mittig Kontext und Screen-Titel,
rechts Benachrichtigung, Profil oder passende Sekundäraktion. Pro Seite maximal zwei
Icon-Buttons. Icon-Buttons benötigen zugängliche Namen und mindestens 44 × 44 CSS px/pt
auf Web/iOS beziehungsweise 48 × 48 dp auf Android.

### Bottom Navigation

Fünf gleich breite Ziele. Aktivzustand besteht aus Farbe, Icon-Fläche und Text. Der
mittlere Scan-Button darf erhöht erscheinen, aber keine Inhalte verdecken. Ein Badge
zeigt nur handlungsrelevante Anzahl, etwa dringende MHD-Fälle.

### Karten

Eine Karte hat einen klaren Zweck. Vermeide Karten in Karten, außer eine kleine
Statusfläche erklärt direkt die übergeordnete Kennzahl. Klickbare Karten erhalten
sichtbaren Hover-, Active- und Fokuszustand.

### Primärbutton

Limettengrün, dunkler Text, mindestens 48 px hoch, klare Verbform: „Zum Vorrat
hinzufügen“, „Verzehr buchen“, „Liste erstellen“. Pro Viewportbereich möglichst nur ein
Primärbutton. Während Speicherung bleibt die Breite stabil; Spinner plus konkreter Text
wie „Wird gespeichert …“.

### Sekundärbutton

Dunkle Surface oder Outline. Kein grauer Text mit zu geringem Kontrast. Destruktive
Aktionen sind nie Primärbutton und benötigen eine Bestätigung mit benanntem Objekt.

### Eingabefelder

- Sichtbares Label oberhalb des Felds; Placeholder ersetzt kein Label.
- Mindesthöhe 48 px, Touchziel 44 px.
- Einheit als kontrolliertes Suffix oder Auswahlfeld, nicht in den Placeholder mischen.
- Validierung erscheint am Feld und erklärt eine Lösung.
- Datumsfelder zeigen deutsches Format `TT.MM.JJJJ`, speichern intern ISO-Format.
- Barcode- und Mengenfelder öffnen die passende mobile Tastatur.

### Bottom Sheet

Für Portion, Lagerort, MHD-Bestätigung, Filter und schnelle Auswahl. Besitzt Handle,
Titel, Schließen-Aktion, Fokusfalle, Escape-Verhalten und Safe-Area-Padding. Bei geöffneter
Tastatur muss die Primäraktion sichtbar erreichbar bleiben.

### Toast und Inline-Feedback

Toasts bestätigen kurz reversible Erfolge und verschwinden nicht zu schnell. Fehler,
die eine Nutzerentscheidung benötigen, erscheinen inline. Destruktive Bestandsaktionen
bieten wenn technisch möglich „Rückgängig“.

### Skeleton

Skeletons spiegeln die echte Zielstruktur und pulsieren dezent. Kein Spinner für eine
ganze Seite, wenn bereits bekannte lokale Daten angezeigt werden können.

## 8. Screen-Spezifikation

### Heute

Reihenfolge:

1. Exakter/möglicher Rückruf oder Verbrauchsdatum-Aktion, falls vorhanden.
2. Tagesziel-Hero mit verbraucht/verbleibend und Fortschritt.
3. Makros Protein, Kohlenhydrate, Fett.
4. Dringendste MHD-Aktion, falls vorhanden.
5. Heutige Mahlzeiten und Verzehr.
6. Schnellaktionen.

Der Hero zeigt eine große Kennzahl, aber höchstens vier gleichzeitige Metriken. Wochen-
details öffnen sich über eine klar beschriftete Aktion.

### Vorrat

Suche bleibt oberhalb der Filter. Lagerorte sind horizontal scrollbare Chips. Die Liste
sortiert standardmäßig nach Handlungsrelevanz: Rückruf/prüfen, Verbrauchsdatum,
abgelaufenes MHD, bald fällig, geöffnet, normal.
Jede Zeile zeigt Produkt, Restmenge, Lagerort und MHD-Status. Ein Produkt mit mehreren
Chargen darf in einer Produktgruppe erscheinen, muss die nächste fällige Charge aber
sofort sichtbar machen.

### Scan

Die Kamera ist der visuelle Fokus. Die Scanfläche zeigt Rahmen, kurze Anweisung,
Permission-Zustand und eine Taschenlampenaktion, falls verfügbar. Unterhalb folgen
manuelle Eingabe und höchstens drei kurze Schritte. Nach erfolgreichem Produktfund wird
die Kamera beendet, damit Batterie und Privatsphäre geschont werden.

### Produktergebnis

Reihenfolge:

1. Produktidentität und Datenquellen-Konfidenz.
2. Primäre Aktion „MHD/Charge scannen“ bzw. erkannte Daten bestätigen.
3. Offizieller Rückrufstatus/Quellenabdeckung, falls vorhanden.
4. Persönliche Warnung, falls vorhanden.
5. Kompakte Nährwerte.
6. Sortierte Inhaltsstoffbewertung.
7. Vollständige Zutaten und Metadaten aufklappbar.
8. Sticky Primäraktion „Zum Vorrat hinzufügen“ nach vollständiger Bestätigung.

Ein unbekanntes Produkt ist kein Fehler-Endzustand. Biete ein kurzes manuelles Formular
und optional die spätere Datenverbesserung an.

### Plan

Die Wochentage bleiben kompakt und eindeutig auswählbar. Der ausgewählte Tag zeigt
Zielerreichung und eine vertikale Mahlzeiten-Timeline. Vorschläge aus bald ablaufendem
Vorrat erhalten eine sachliche Kennzeichnung. Drag-and-drop ist optional; jede Aktion
muss auch über Buttons erreichbar sein.

### Einkauf

Oben: Artikelanzahl, grobe Kostenschätzung nur bei vorhandenen Preisdaten und Sync-
status. Darunter Gruppierung nach Kategorie. Große Checkboxen, Menge/Einheit sichtbar,
Quelle „aus Wochenplan“ oder „manuell“. Abgehakte Artikel wandern ans Ende, bleiben in
derselben Sitzung aber erreichbar.

## 9. Statussystem

### MHD und Verbrauchsdatum

| Zustand | Darstellung | Standardaktion |
|---|---|---|
| Mehr als 7 Tage | neutral/grün | Details |
| 3–7 Tage | sandfarben, „bald“ | Einplanen |
| 0–2 Tage | orange, Tageszahl | Heute einplanen |
| Überschrittenes MHD | warm, „MHD überschritten“ | Prüfen/entscheiden |
| Überschrittenes Verbrauchsdatum | rot/warm, eindeutig | Nicht verwenden/entsorgen |
| Unbekannt | grau, „Kein Datum“ | Datum ergänzen |

MHD und Verbrauchsdatum dürfen sprachlich und visuell nicht gleichgesetzt werden.

### Inhaltsstoffrelevanz

| Stufe | Label | Icon-Idee | Tonalität |
|---|---|---|---|
| Rot | Für dich vermeiden | Shield Alert | direkt, persönlich begründet |
| Orange | Im Blick behalten | Triangle Alert | kontext- und dosisbezogen |
| Gelb | Wissenswert | Info | neutral erklärend |
| Grün | Kein Konflikt erkannt | Circle Check | vorsichtig positiv |
| Grau | Nicht bewertet | Circle Help | Datenlücke transparent |

„Gesund“, „giftig“ oder „schädlich“ werden nicht pauschal als Badge verwendet.

### Datenqualität

- **Bestätigt:** vom Nutzer geprüft oder strukturiert eindeutig erkannt.
- **Quelle:** aus vertrauenswürdiger externer Datenquelle übernommen.
- **Erkannt:** OCR/Parser-Ergebnis mit sichtbarer Konfidenz, noch unbestätigt.
- **Unvollständig:** relevante Felder fehlen.
- **Konflikt:** zwei Quellen widersprechen sich; Nutzerentscheidung erforderlich.

### Rückruf und Quellenabdeckung

| Zustand | Darstellung | Standardaktion |
|---|---|---|
| Exakt betroffen | warmrot, Quelle und Charge | Offizielle Handlung ansehen |
| Möglicherweise betroffen | orange, fehlender Abgleich benannt | Packung/Charge vergleichen |
| Textkandidat | neutral, keine Betroffenheitsbehauptung | Details prüfen |
| Kein Treffer in aktuellen Quellen | neutral, Abdeckung/Aktualität sichtbar | Quellen ansehen |
| Ungeprüft/veraltet | grau/amber, niemals grün | Offiziell prüfen/erneut laden |

### Synchronisation

- **Auf diesem Gerät:** lokal bestätigt, noch nicht serverbestätigt.
- **Wartet/Synchronisiert:** Operation und Anzahl, ohne private Payload im Status.
- **Aktuell:** konkrete Revision serverbestätigt.
- **Konflikt:** Entscheidung mit beiden relevanten Zuständen nötig.
- **Abgelehnt:** Berechtigung/Validierung geändert; keine Endlosschleife.

## 10. Sprache und Microcopy

- Schreibe kurzes, natürliches Deutsch und verwende konsequent „du“.
- Buttons beginnen möglichst mit einem Verb.
- Sage genau, was passiert: „2 Portionen zum Vorrat hinzufügen“ statt „Speichern“.
- Fehler enthalten Ursache und nächste Lösung: „Kamera blockiert. Erlaube den Zugriff
  in deinen Browser-Einstellungen oder gib den Barcode manuell ein.“
- Keine Schuldformulierungen wie „Ziel verfehlt“. Besser: „Heute noch 32 g Protein bis
  zu deinem Zielbereich.“
- Keine medizinische Gewissheit: „Für dein hinterlegtes Allergen relevant“ statt
  „Dieses Produkt ist gefährlich“.
- Datum relativ plus absolut, wenn wichtig: „morgen · 03.08.“.
- Unbekanntes bleibt sichtbar unbekannt: „Keine Angabe gefunden“ statt `0`.

## 11. Interaktion und Bewegung

- Standardtransition: 160–220 ms, `ease-out`.
- Seitenwechsel: maximal 320 ms mit geringer Y-Bewegung und Fade.
- Scanner-Beam darf kontinuierlich animieren, stoppt aber bei `prefers-reduced-motion`.
- Erfolg: kurzer Farb-/Check-Wechsel, kein Konfetti für normale Buchungen.
- Aktive Buttons reagieren sofort mit kleiner Helligkeits- oder Scale-Änderung, ohne
  Layoutsprung.
- Swipe-Gesten sind nur Abkürzungen; jede Funktion bleibt über sichtbare Controls
  erreichbar.

## 12. Asset Direction

FoodOS verwendet wenige, gezielt platzierte Assets. Echte Produktdaten stehen im
Vordergrund; Illustrationen unterstützen Orientierung und leere Zustände, ersetzen aber
keine Information.

### Visuelle Richtung

- Organische, reduzierte Formen mit dunklem Waldgrün und limettengrünem Lichtakzent.
- Nahbare Lebensmittel- und Vorratsmotive statt klinischer Gesundheitsästhetik.
- Weiche Tiefenstaffelung, kontrollierte Körnung und klare Silhouetten.
- Keine fotorealistischen Menschen als Standardmotiv, keine 3D-Emoji-Sammlung, keine
  Neon-Gaming-Welt und kein generischer Corporate-Gradient-Stil.
- Illustrationen bleiben ruhig genug, damit Status, Zahlen und Primäraktion dominieren.

### Benötigte Asset-Familien

| Familie | Einsatz | Empfohlenes Format |
|---|---|---|
| App-Icon/Marke | Manifest, Homescreen, Topbar | authored SVG + PNG-Größen |
| Onboarding | maximal 2–3 kurze Schritte | AVIF/WebP, konsistente Serie |
| Empty State | leerer Vorrat, Plan, Einkauf | kleine AVIF/WebP-Illustration |
| Kamera-Hilfe | Permission/Scan-Anleitung | SVG-Illustration |
| Produktbild | konkretes gescanntes Produkt | echte Quellen-URL/optimierter Cache |
| Status/Navigation | UI-Bedienung | Lucide oder authored SVG |

Für präzise Interfacegrafik gilt: Vektor zuerst. Bildgenerierung ist für illustrative
Motive vorgesehen, nicht für Icons, Diagramme, Text, Barcodes oder Nährwertgrafiken.

### Technische Asset-Regeln

- Dateinamen sind semantisch, kleingeschrieben und mit Bindestrichen, zum Beispiel
  `empty-inventory-dark.webp`.
- Keine eingebrannten deutschen Texte, damit Übersetzung und Barrierefreiheit möglich
  bleiben.
- Rasterbilder besitzen explizite Breite/Höhe und passende responsive Varianten.
- Ein normales mobiles Illustrationsasset sollte nach Optimierung möglichst unter
  150 KB bleiben; größere Hero-Assets benötigen eine sichtbare Qualitätsbegründung.
- Dekorative Bilder haben leeren Alt-Text; informative Bilder erhalten kurze,
  zweckbezogene Beschreibung.
- Herkunft, Generationshinweis und Einsatz werden in `public/assets/ASSETS.md` gepflegt.
- Assets werden im echten Dark-Theme bei 360 und 430 px geprüft; kein heller Rechteck-
  Hintergrund, unerwarteter Beschnitt oder schlecht lesbarer Kontrast.

## 13. Barrierefreiheit

- WCAG 2.2 AA als Mindestziel.
- Textkontrast mindestens 4.5:1, große Texte und UI-Grenzen mindestens 3:1.
- Touchziele mindestens 44 × 44 CSS px/pt auf Web/iOS und 48 × 48 dp auf Android;
  Abstand verhindert Fehlbedienung. Die kleinere normative WCAG-Ausnahme ist kein
  Standard für primäre FoodOS-Aktionen.
- Jede Icon-Aktion hat `aria-label` oder sichtbaren Text.
- Fokus ist klar limettengrün und wird niemals deaktiviert, ohne Ersatz zu liefern.
- Sticky Topbar, Bottom Navigation, Sheet und Bildschirmtastatur dürfen den fokussierten
  Control oder die zugehörige Fehlermeldung nicht vollständig verdecken.
- Statusänderungen wie Scanerfolg, Fehler und Speichern werden über geeignete Live-
  Regionen angesagt, ohne Screenreader zu überfluten.
- Diagramme und Progressringe besitzen Textäquivalente.
- Farbe ist nie der einzige Träger von Bedeutung.
- `prefers-reduced-motion` deaktiviert Scanner-, Puls- und Seitenanimationen.
- Password Manager, Einfügen und Plattform-Autofill funktionieren in Passwort-/TOTP-
  Flows; Authentifizierung verlangt keine zusätzliche Gedächtnisaufgabe.
- Drag, Swipe, Long Press und Kamera sind Abkürzungen; dieselbe Aufgabe bleibt über
  sichtbare, keyboard-/screenreader-bedienbare Controls möglich.
- Kritische Flows werden manuell mit Tastatur sowie VoiceOver/TalkBack geprüft;
  automatisierte Accessibility-Scans allein gelten nicht als vollständige Evidence.

## 14. Responsive und technische Regeln

- Kein horizontales Überlaufen bei 320, 360, 390 und 430 px.
- Mittlere und erweiterte Fenster verwenden gezielte Navigation/Panes statt eine
  gestreckte Telefonansicht; beim Wechsel bleiben Eingabe, Auswahl, Scroll-/Fokuspunkt
  und bestätigte lokale Absicht erhalten.
- Safe Areas auf iOS für Topbar, Bottom Navigation und Bottom Sheets berücksichtigen.
- Lange Produktnamen umbrechen auf maximal zwei Zeilen; vollständiger Name in Details.
- Deutsche Wörter wie „Mindesthaltbarkeitsdatum“ dürfen das Layout nicht sprengen.
- On-Screen-Tastatur darf Eingaben und Bestätigungsbutton nicht verdecken.
- Produktbilder mit fester Aspect Ratio und neutralem Fallback; keine Layoutverschiebung.
- Inhalte funktionieren bei 200 % Zoom und mit größerer Systemschrift sinnvoll weiter.
- Server-/semantisches HTML bleibt auf Web der Standard. Kamera, Scanner, Charts und
  andere schwere Client-Funktionen werden route-/intentbasiert nachgeladen.
- Bilder verwenden explizite Dimensionen und responsive `next/image`-/native Image-
  Varianten; Fonts werden selbst/über das Framework optimiert und blockieren keine
  externe Laufzeitanfrage.
- Web-Release-Gates: LCP höchstens 2,5 s, INP höchstens 200 ms und CLS höchstens 0,1 am
  75. Perzentil getrennt nach Mobile/Desktop. Native Release-Builds werden auf gepinnten
  Referenzgeräten auf Start, Frames, Frozen Frames, Speicher und Batterie geprüft.
- Konkrete Bundle-, Payload-, Bild-, Startup- und Frame-Budgets sowie Ausnahmen folgen
  `plans/UI_UX_PERFORMANCE_PLAN.md`; Durchschnittswerte dürfen keine schlechte Geräte-
  oder Release-Kohorte verbergen.

## 15. Verbotene Muster

- Keine neue Farbe für jede Kategorie.
- Keine Neonverläufe, 3D-Illustrationen oder Gaming-Ästhetik.
- Keine unbeschrifteten Icons für kritische Aktionen.
- Keine wichtigen Interaktionen ausschließlich über Hover oder Swipe.
- Keine Vollbildmodal-Kaskaden.
- Keine pauschalen roten Warnungen für E-Nummern oder unbekannte Zutaten.
- Keine erfundenen Nährwerte, Preise, MHD-Daten oder Konfidenzen.
- Kein „nicht zurückgerufen/sicher“, wenn Quellen ungeprüft, veraltet oder unvollständig
  sind; kein Text-Fuzzy-Match als exakte Betroffenheit.
- Kein stilles Last-write-wins für Menge, Datum, Recall, Consent, Mitgliedschaft oder
  Löschung und kein Erfolg, solange nur die UI statt lokal/serverseitig bestätigt hat.
- Keine zehn Kennzahlen im Dashboard-Hero.
- Keine deaktivierten Buttons ohne sichtbare Erklärung.
- Keine Primäraktion unter der festen Bottom Navigation.
- Keine finalen Placeholder-Illustrationen, Wasserzeichen oder uneinheitlichen Emoji-
  Assets, wenn ein richtiges Asset benötigt wird.

## 16. Abnahmekriterien für jede UI-Änderung

Vor Abschluss eines Screens muss geprüft werden:

- Der wichtigste Inhalt und die Primäraktion sind in fünf Sekunden erkennbar.
- Der Screen passt ohne horizontales Scrollen auf 360 px Breite.
- Loading, leerer Zustand, Fehler, Erfolg und fehlende Berechtigung sind gestaltet.
- Tastatur- und Touchbedienung funktionieren.
- Fokus, Labels und Screenreader-Status sind vorhanden.
- Unsichere oder externe Daten zeigen Quelle/Konfidenz angemessen.
- MHD und Verbrauchsdatum werden fachlich korrekt unterschieden.
- Rückruf hat Vorrang, zeigt Match-Qualität/Quelle/Aktualität und keine Sicherheitsgarantie.
- Offline-/Sync-Status unterscheidet lokal, wartend, bestätigt, Konflikt und abgelehnt.
- Inhaltsstoffstatus besitzt Text und Icon zusätzlich zur Farbe.
- Die UI verwendet vorhandene Tokens und Komponenten statt neuer Ad-hoc-Stile.
- Die Primäraktion wird nicht von Navigation, Tastatur oder Safe Area verdeckt.
- Neue Assets passen zur Asset Direction, sind optimiert, zugänglich und dokumentiert.
- Bundle-/Core-Web-Vitals- beziehungsweise Native-Startup/Frame-Auswirkung wurde für die
  betroffene Route/Plattform gemessen und liegt im Budget oder besitzt eine befristete,
  begründete Ausnahme.
- Neue oder wesentlich geänderte kritische Flows besitzen echte Usability-Evidence und
  keine ungelösten kritischen Verständnis-, Safety-, Privacy- oder Datenverlustprobleme.

Bei visuellen Änderungen sind mindestens Screenshots der betroffenen Zustände bei
360 × 800 px und 430 × 932 px zu prüfen. Für kritische Flows werden zusätzlich Kamera-
Permission denied, unbekanntes Produkt, OCR mit niedriger Konfidenz, Offline und sehr
langer Produktname getestet. Recall-Flows prüfen zusätzlich exakten Treffer, mögliche
Betroffenheit, veraltete Quelle, Korrektur/Rücknahme und werbefreie Darstellung.
