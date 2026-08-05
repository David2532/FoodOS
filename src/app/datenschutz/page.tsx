import { LegalPage } from "@/components/legal-page";

export default function PrivacyNoticePage() {
  return <LegalPage eyebrow="Technischer Beta-Hinweis · Stand 04.08.2026" title="Datenschutz bei FoodOS">
    <p>FoodOS befindet sich in einer lokalen beziehungsweise geschlossenen Deutschland-Beta. Dieser Hinweis beschreibt die aktuell implementierte Verarbeitung. Er ist noch kein juristisch freigegebener Production-Country-Pack; deshalb ist ein kommerzieller öffentlicher Start weiterhin gesperrt.</p>
    <h2>Notwendige Verarbeitung</h2><p>Konto, Authentifizierung, verpflichtende 2FA, Haushalt, Vorrat, Planung, Einkauf und sicherheitsrelevante Rückrufzustände werden verarbeitet, wenn du die jeweilige Funktion anforderst. Private Haushaltsdaten sind in der Datenbank durch AAL2 und Row Level Security getrennt.</p>
    <h2>Optionale Zwecke</h2><p>Persönliches Lebensmittelprofil, grobe Nutzungsanalyse, Neuigkeiten, Cloud-Bildverarbeitung, Beiträge zu Open Food Facts und kontextuelle Werbung werden getrennt gewählt und sind standardmäßig aus. Aktuell sind kein Analyse- und kein Werbe-SDK aktiv.</p>
    <h2>Datenminimierung und Speicherdauer</h2><p>FoodOS sendet keine Lebensmittel-, GTIN-, Datums-, Haushalts- oder Gesundheitsdaten an allgemeine Analyse- oder Werbesysteme. Rohbilder bleiben standardmäßig auf dem Gerät; ein künftiger Cloud-OCR-Upload benötigt eine ausdrückliche Auswahl und kurze Löschfrist.</p>
    <h2>Deine Kontrolle</h2><p>Du kannst optionale Zwecke im Privacy Center ebenso leicht zurückziehen und deine Daten als JSON exportieren. Die vollständige Kontolöschung und Prozessor-/Backup-Orchestrierung ist noch nicht releasebereit; diese Beta darf daher nicht als kommerziell datenschutzfertig dargestellt werden.</p>
  </LegalPage>;
}
