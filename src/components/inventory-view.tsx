"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  LoaderCircle,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import { consumeBatchResultSchema, consumptionInputSchema } from "@/contracts/inventory";
import { nutritionForAmount } from "@/lib/food-math";
import { submitDurableRpc } from "@/infrastructure/offline-outbox";
import type { InventoryItem } from "@/lib/types";

const previewRecall: InventoryItem["recall"] = {
  kind: "source_unavailable",
  blocksConsumption: false,
  stale: true,
  wording: "Preview-Modus: Es wurden keine amtlichen Rückrufdaten geladen."
};
const previewInventory: InventoryItem[] = [
  { id: "1", productId: "preview-product-1", name: "Fiktives Lachsfilet", brand: "Preview", remainingLabel: "280 g", remainingAmount: 280, unit: "g", location: "Kühlschrank", daysUntilExpiry: 1, expiryDate: "03.08.", dateKind: "use_by", expiryState: "soon", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 208, protein100g: 20 } },
  { id: "2", productId: "preview-product-2", name: "Fiktive Vollmilch", brand: "Preview", remainingLabel: "650 ml", remainingAmount: 650, unit: "ml", location: "Kühlschrank", daysUntilExpiry: 3, expiryDate: "05.08.", dateKind: "best_before", expiryState: "soon", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 64, protein100g: 3.4 } },
  { id: "3", productId: "preview-product-3", name: "Fiktive Hähnchenbrust", brand: "Preview", remainingLabel: "400 g", remainingAmount: 400, unit: "g", location: "Kühlschrank", daysUntilExpiry: 4, expiryDate: "06.08.", dateKind: "use_by", expiryState: "soon", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 110, protein100g: 23 } },
  { id: "4", productId: "preview-product-4", name: "Fiktiver Basmati-Reis", brand: "Preview", remainingLabel: "1,2 kg", remainingAmount: 1200, unit: "g", location: "Vorrat", expiryState: "unknown", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 354, protein100g: 9 } }
];

interface InventoryViewProps {
  onScan: () => void;
  onConsumed?: () => void;
  items?: InventoryItem[];
  householdId?: string;
}

export function InventoryView({ onScan, onConsumed, items, householdId }: InventoryViewProps) {
  const visibleItems = items ?? previewInventory;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastBestBeforeConfirmed, setPastBestBeforeConfirmed] = useState(false);
  const [personalRiskConfirmed, setPersonalRiskConfirmed] = useState(false);
  const mutationId = useRef("");
  const selected = useMemo(
    () => visibleItems.find((item) => item.id === selectedId),
    [selectedId, visibleItems]
  );
  const numericAmount = Number(amount);
  const previewNutrition = selected && Number.isFinite(numericAmount)
    ? nutritionForAmount(selected.nutrition, numericAmount)
    : null;
  const consumptionBlocked = selected?.expiryState === "past_use_by" || selected?.recall.blocksConsumption === true;

  function choose(item: InventoryItem) {
    setSelectedId(item.id);
    setAmount(item.unit === "piece" ? "1" : String(Math.min(item.remainingAmount, 100)));
    setError(null);
    setPastBestBeforeConfirmed(false);
    setPersonalRiskConfirmed(false);
    mutationId.current = crypto.randomUUID();
  }

  async function consume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !onConsumed || !householdId) return;
    const parsed = consumptionInputSchema.safeParse({ batchId: selected.id, amount });
    if (!parsed.success || parsed.data.amount > selected.remainingAmount) {
      setError("Die Portion muss größer als 0 sein und darf den Bestand nicht überschreiten.");
      return;
    }
    if (selected.unit === "piece") {
      setError("Für Stück-Einheiten muss zuerst ein bestätigtes Gewicht hinterlegt werden.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await submitDurableRpc<unknown>({
        kind: "inventory.consume_batch",
        rpc: "consume_inventory_batch_v2",
        householdId,
        operationId: mutationId.current,
        args: {
          target_batch: parsed.data.batchId,
          consumed_amount: parsed.data.amount,
          mutation_id: mutationId.current,
          confirm_past_best_before: pastBestBeforeConfirmed,
          confirm_personal_risk: personalRiskConfirmed
        }
      });
      setSaving(false);
      if (result.status === "queued") {
        setSelectedId(null);
        return;
      }
      if (result.status === "rejected" || !consumeBatchResultSchema.safeParse(result.data).success) {
        const knownError = result.status === "rejected" ? result.message : "";
      setError(knownError.includes("Best-before confirmation") ? "Bestätige die Prüfung nach überschrittenem MHD."
        : knownError.includes("Personal risk confirmation") ? "Bestätige den persönlichen Konflikt vor der Buchung."
          : knownError.includes("Use-by date") || knownError.includes("recall") ? "Diese Charge darf nicht als Verzehr gebucht werden."
            : "Der Verzehr wurde nicht bestätigt. Du kannst sicher erneut versuchen; dieselbe Buchung wird nicht doppelt ausgeführt.");
      return;
      }
      setSelectedId(null);
      onConsumed();
    } catch {
      setSaving(false);
      setError("Die Buchung konnte weder lokal sicher gespeichert noch vom Server bestätigt werden.");
    }
  }

  return (
    <div className="stack-lg page-enter">
      <div className="search-row">
        <label className="search-box"><span className="sr-only">Lebensmittel suchen</span><Search size={18} /><input placeholder="Lebensmittel suchen" /><kbd>{visibleItems.length}</kbd></label>
        <button className="filter-button" aria-label="Filter"><SlidersHorizontal size={19} /></button>
      </div>
      <div className="location-tabs"><button className="selected">Alle</button><button>Kühlschrank</button><button>Gefrierfach</button><button>Vorrat</button></div>

      <section className="inventory-summary">
        <div><p>AKTIVE CHARGEN</p><strong>{visibleItems.length}</strong><span>dauerhaft gespeichert</span></div>
        <div className="summary-divider" />
        <div><p>HANDLUNG NÖTIG</p><strong className="warm">{visibleItems.filter((item) => ["past_use_by", "past_best_before", "today", "soon"].includes(item.expiryState) || item.recall.kind !== "none" || item.personalRiskMatches.length > 0).length}</strong><span>Sicherheit prüfen</span></div>
      </section>

      <section>
        <div className="section-heading"><div><p>NACH DRINGLICHKEIT</p><h2>Zuerst verwenden</h2></div><button className="small-action" onClick={onScan}><Plus size={16} /> Produkt</button></div>
        {visibleItems.length ? <div className="inventory-list">
          {visibleItems.map((item) => (
            <button className="inventory-row" key={item.id} onClick={() => choose(item)} aria-expanded={selectedId === item.id}>
              <span className="inventory-emoji">{item.imageUrl ? <Image src={item.imageUrl} alt="" width={47} height={47} unoptimized /> : <PackageOpen size={21} />}</span>
              <span className="inventory-copy"><small>{item.location}</small><strong>{item.name}</strong><em>{[item.brand, item.remainingLabel, item.lotNumber ? `Charge ${item.lotNumber}` : null].filter(Boolean).join(" · ")}</em></span>
              {item.expiryDate ? <span className={`expiry-pill ${item.expiryState === "past_use_by" || item.expiryState === "today" ? "urgent" : ""}`}><small>{item.dateKind === "use_by" ? "ZU VERBRAUCHEN" : "MHD"}</small>{item.expiryDate}</span> : <span className="stock-pill">Kein Datum</span>}
              <ChevronRight size={17} />
            </button>
          ))}
        </div> : <div className="empty-state"><PackageOpen size={24} /><h2>Noch nichts im Vorrat</h2><p>Erfasse eine konkrete Packung mit Menge und optionalem Datum.</p><button className="primary-button" onClick={onScan}><Plus size={17} /> Erstes Lebensmittel erfassen</button></div>}

        {selected && <form className="consume-card" onSubmit={consume} aria-label={`Verzehr von ${selected.name} buchen`}>
          <button type="button" className="consume-close" onClick={() => setSelectedId(null)} aria-label="Verzehr schließen"><X size={18} /></button>
          <p>VERZEHR BUCHEN</p><h2>{selected.name}</h2><span>Verfügbar: {selected.remainingLabel}{selected.lotNumber ? ` · Charge ${selected.lotNumber}` : ""}</span>
          {selected.expiryState === "past_use_by" && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span><strong>Nicht verwenden.</strong> Das Verbrauchsdatum ist überschritten; ein Verzehr kann nicht gebucht werden.</span></div>}
          {selected.recall.kind !== "none" && <div className={selected.recall.blocksConsumption ? "error-banner" : "safety-banner"} role={selected.recall.blocksConsumption ? "alert" : "status"}><AlertTriangle size={17} /><span>{selected.recall.wording}{selected.recall.sourceUrl && <> <a href={selected.recall.sourceUrl} target="_blank" rel="noreferrer">Amtliche Quelle öffnen</a></>}</span></div>}
          {!consumptionBlocked && <label className="field-label"><span>Portion in {selected.unit === "piece" ? "Stück" : selected.unit}</span><input type="number" min="0.001" max={selected.remainingAmount} step="0.001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>}
          {!consumptionBlocked && selected.expiryState === "past_best_before" && <label className="risk-confirmation"><input type="checkbox" checked={pastBestBeforeConfirmed} onChange={(event) => setPastBestBeforeConfirmed(event.target.checked)} required /><span><strong>MHD-Prüfung bestätigen</strong><small>Geruch, Aussehen, Verpackung und Lagerung wurden geprüft. Ein MHD ist kein Verbrauchsdatum.</small></span></label>}
          {!consumptionBlocked && selected.personalRiskMatches.length > 0 && <label className="risk-confirmation"><input type="checkbox" checked={personalRiskConfirmed} onChange={(event) => setPersonalRiskConfirmed(event.target.checked)} required /><span><strong>Persönlichen Konflikt bestätigen</strong><small>Treffer im Profil: {selected.personalRiskMatches.join(", ")}. Prüfe bei Allergien immer die Packungskennzeichnung.</small></span></label>}
          {previewNutrition && selected.unit !== "piece" && <div className="consume-preview" aria-live="polite"><strong>{previewNutrition.kcal} kcal</strong><span>{previewNutrition.protein} g Protein · {previewNutrition.carbs} g Kohlenhydrate · {previewNutrition.fat} g Fett</span>{Object.values(selected.nutrition).every((value) => value == null) && <small>Keine Nährwerte vorhanden; der Bestand wird trotzdem korrekt reduziert.</small>}</div>}
          {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
          {onConsumed && !consumptionBlocked ? <button className="primary-button wide" disabled={saving || selected.unit === "piece"}>{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{saving ? "Wird gebucht …" : "Portion verbindlich buchen"}</button> : !onConsumed && !consumptionBlocked ? <p className="preview-save-note">Preview-Modus: Diese Buchung wird nicht gespeichert.</p> : null}
        </form>}
      </section>
    </div>
  );
}
