import { LegalPage } from "@/components/legal-page";

export default function UsageTermsPage() {
  return <LegalPage eyebrow="Lokale/geschlossene Beta · Stand 04.08.2026" title="Nutzungsrahmen">
    <p>FoodOS ist in diesem Stand ein Entwicklungs- und Beta-Produkt für Personen ab 16 Jahren in Deutschland. Es gibt noch kein öffentliches kommerzielles Angebot, kein Abonnement und keine verbindliche Verfügbarkeitszusage.</p>
    <h2>Lebensmittelangaben</h2><p>FoodOS hilft beim Organisieren. Die App erklärt weder ein Lebensmittel für sicher noch ersetzt sie amtliche Rückrufhinweise, medizinische Beratung oder die Prüfung der echten Verpackung. Ein MHD ist ein Qualitätsdatum; ein überschrittenes Verbrauchsdatum führt zu keiner Verzehrempfehlung.</p>
    <h2>Quellen und Bestätigung</h2><p>Normale EAN-Barcodes enthalten üblicherweise kein konkretes Haltbarkeitsdatum. Produkt-, GS1- und OCR-Angaben bleiben quellenbezogen und müssen bei unsicheren Feldern bestätigt werden. Fehlende Daten bleiben sichtbar unbekannt.</p>
    <h2>Beta-Grenzen</h2><p>Native Store-Apps, sichere Faktor-Wiederherstellung, vollständige Kontolöschung, Production-Deployment und der rechtliche Deutschland-Country-Pack sind noch nicht freigegeben. Diese Grenzen werden nicht durch die Nutzung der lokalen Demo aufgehoben.</p>
  </LegalPage>;
}
