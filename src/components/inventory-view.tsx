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
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/types";

const previewInventory: InventoryItem[] = [
  { id: "1", productId: "preview-product-1", name: "Fiktives Lachsfilet", brand: "Preview", remainingLabel: "280 g", remainingAmount: 280, unit: "g", location: "Kühlschrank", daysUntilExpiry: 1, expiryDate: "03.08.", dateKind: "use_by", expiryState: "soon", nutrition: { kcal100g: 208, protein100g: 20 } },
  { id: "2", productId: "preview-product-2", name: "Fiktive Vollmilch", brand: "Preview", remainingLabel: "650 ml", remainingAmount: 650, unit: "ml", location: "Kühlschrank", daysUntilExpiry: 3, expiryDate: "05.08.", dateKind: "best_before", expiryState: "soon", nutrition: { kcal100g: 64, protein100g: 3.4 } },
  { id: "3", productId: "preview-product-3", name: "Fiktive Hähnchenbrust", brand: "Preview", remainingLabel: "400 g", remainingAmount: 400, unit: "g", location: "Kühlschrank", daysUntilExpiry: 4, expiryDate: "06.08.", dateKind: "use_by", expiryState: "soon", nutrition: { kcal100g: 110, protein100g: 23 } },
  { id: "4", productId: "preview-product-4", name: "Fiktiver Basmati-Reis", brand: "Preview", remainingLabel: "1,2 kg", remainingAmount: 1200, unit: "g", location: "Vorrat", expiryState: "unknown", nutrition: { kcal100g: 354, protein100g: 9 } }
];

interface InventoryViewProps {
  onScan: () => void;
  onConsumed?: () => void;
  items?: InventoryItem[];
}

export function InventoryView({ onScan, onConsumed, items }: InventoryViewProps) {
  const visibleItems = items ?? previewInventory;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationId = useRef("");
  const selected = useMemo(
    () => visibleItems.find((item) => item.id === selectedId),
    [selectedId, visibleItems]
  );
  const numericAmount = Number(amount);
  const previewNutrition = selected && Number.isFinite(numericAmount)
    ? nutritionForAmount(selected.nutrition, numericAmount)
    : null;

  function choose(item: InventoryItem) {
    setSelectedId(item.id);
    setAmount(item.unit === "piece" ? "1" : String(Math.min(item.remainingAmount, 100)));
    setError(null);
    mutationId.current = crypto.randomUUID();
  }

  async function consume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !onConsumed) return;
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
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("consume_inventory_batch", {
      target_batch: parsed.data.batchId,
      consumed_amount: parsed.data.amount,
      mutation_id: mutationId.current
    });
    setSaving(false);
    if (rpcError || !consumeBatchResultSchema.safeParse(data).success) {
      setError("Der Verzehr wurde nicht bestätigt. Du kannst sicher erneut versuchen; dieselbe Buchung wird nicht doppelt ausgeführt.");
      return;
    }
    setSelectedId(null);
    onConsumed();
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
        <div><p>HANDLUNG NÖTIG</p><strong className="warm">{visibleItems.filter((item) => ["past_use_by", "past_best_before", "today", "soon"].includes(item.expiryState)).length}</strong><span>Datum prüfen</span></div>
      </section>

      <section>
        <div className="section-heading"><div><p>NACH DRINGLICHKEIT</p><h2>Zuerst verwenden</h2></div><button className="small-action" onClick={onScan}><Plus size={16} /> Produkt</button></div>
        {visibleItems.length ? <div className="inventory-list">
          {visibleItems.map((item) => (
            <button className="inventory-row" key={item.id} onClick={() => choose(item)} aria-expanded={selectedId === item.id}>
              <span className="inventory-emoji">{item.imageUrl ? <Image src={item.imageUrl} alt="" width={47} height={47} /> : <PackageOpen size={21} />}</span>
              <span className="inventory-copy"><small>{item.location}</small><strong>{item.name}</strong><em>{item.brand} · {item.remainingLabel}</em></span>
              {item.expiryDate ? <span className={`expiry-pill ${item.expiryState === "past_use_by" || item.expiryState === "today" ? "urgent" : ""}`}><small>{item.dateKind === "use_by" ? "ZU VERBRAUCHEN" : "MHD"}</small>{item.expiryDate}</span> : <span className="stock-pill">Kein Datum</span>}
              <ChevronRight size={17} />
            </button>
          ))}
        </div> : <div className="empty-state"><PackageOpen size={24} /><h2>Noch nichts im Vorrat</h2><p>Erfasse eine konkrete Packung mit Menge und optionalem Datum.</p><button className="primary-button" onClick={onScan}><Plus size={17} /> Erstes Lebensmittel erfassen</button></div>}

        {selected && <form className="consume-card" onSubmit={consume} aria-label={`Verzehr von ${selected.name} buchen`}>
          <button type="button" className="consume-close" onClick={() => setSelectedId(null)} aria-label="Verzehr schließen"><X size={18} /></button>
          <p>VERZEHR BUCHEN</p><h2>{selected.name}</h2><span>Verfügbar: {selected.remainingLabel}</span>
          <label className="field-label"><span>Portion in {selected.unit === "piece" ? "Stück" : selected.unit}</span><input type="number" min="0.001" max={selected.remainingAmount} step="0.001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          {previewNutrition && selected.unit !== "piece" && <div className="consume-preview" aria-live="polite"><strong>{previewNutrition.kcal} kcal</strong><span>{previewNutrition.protein} g Protein · {previewNutrition.carbs} g Kohlenhydrate · {previewNutrition.fat} g Fett</span>{Object.values(selected.nutrition).every((value) => value == null) && <small>Keine Nährwerte vorhanden; der Bestand wird trotzdem korrekt reduziert.</small>}</div>}
          {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
          {onConsumed ? <button className="primary-button wide" disabled={saving || selected.unit === "piece"}>{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{saving ? "Wird gebucht …" : "Portion verbindlich buchen"}</button> : <p className="preview-save-note">Preview-Modus: Diese Buchung wird nicht gespeichert.</p>}
        </form>}
      </section>
    </div>
  );
}
