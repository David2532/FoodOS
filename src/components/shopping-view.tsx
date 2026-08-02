"use client";

import { useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Check, ListChecks, LoaderCircle, Plus, RefreshCw, ShoppingCart } from "lucide-react";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { AppSnapshot, ShoppingItem } from "@/lib/types";

function amountLabel(item: ShoppingItem) {
  if (item.requiredAmount == null) return "Menge offen";
  const unit = item.unit === "piece" ? "Stück" : item.unit ?? "";
  return `${item.requiredAmount.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${unit}`.trim();
}

export function ShoppingView({ snapshot, onChanged }: { snapshot?: AppSnapshot; onChanged?: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationId = useRef("");

  async function generate() {
    if (!snapshot || !onChanged) return;
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("generate_shopping_from_plan", {
      target_household: snapshot.household.id,
      target_week_start: snapshot.weekStart
    });
    setBusy(false);
    if (rpcError || !z.uuid().safeParse(data).success) {
      setError("Die Einkaufsliste konnte nicht aus dem Plan berechnet werden.");
      return;
    }
    onChanged();
  }

  async function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !onChanged) return;
    const form = new FormData(event.currentTarget);
    const rawAmount = String(form.get("amount") ?? "").trim();
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("add_manual_shopping_item", {
      target_household: snapshot.household.id,
      target_week_start: snapshot.weekStart,
      item_label: String(form.get("label")),
      item_amount: rawAmount ? Number(rawAmount) : null,
      item_unit: rawAmount ? String(form.get("unit")) : null,
      mutation_id: mutationId.current
    });
    setBusy(false);
    if (rpcError || !z.uuid().safeParse(data).success) {
      setError("Der manuelle Eintrag wurde nicht bestätigt. Eine sichere Wiederholung erzeugt keinen Doppelposten.");
      return;
    }
    setFormOpen(false);
    onChanged();
  }

  async function toggle(item: ShoppingItem) {
    if (!onChanged) return;
    setError(null);
    const { error: rpcError } = await getSupabaseBrowserClient().rpc("set_shopping_item_checked", {
      target_item: item.id,
      checked: !item.checked
    });
    if (rpcError) {
      setError("Der Status wurde nicht gespeichert. Prüfe die Verbindung und versuche es erneut.");
      return;
    }
    onChanged();
  }

  if (!snapshot) return <div className="stack-lg page-enter"><section className="empty-state"><ShoppingCart size={25} /><h2>Einkaufs-Preview</h2><p>Beispielposten werden im Preview-Modus nicht als echte Einkaufsliste ausgegeben.</p></section></div>;

  const checkedCount = snapshot.shoppingItems.filter((item) => item.checked).length;
  return <div className="stack-lg page-enter">
    <section className="shopping-hero"><div><p>AKTUELLE WOCHE</p><strong>{snapshot.shoppingItems.length}</strong><span>gespeicherte Posten</span></div><div><ListChecks size={20} /><strong>{checkedCount} / {snapshot.shoppingItems.length}</strong><span>erledigt</span></div></section>
    <div className="shopping-actions"><button className="outline-button" onClick={() => void generate()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Plan minus Vorrat berechnen</button><button className="small-action" onClick={() => { setFormOpen(true); mutationId.current = crypto.randomUUID(); }}><Plus size={16} /> Manuell</button></div>
    {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
    {formOpen && <form className="batch-form" onSubmit={addManual}>
      <label className="field-label"><span>Bezeichnung</span><input name="label" minLength={1} maxLength={160} autoFocus required /></label>
      <div className="batch-grid"><label className="field-label"><span>Menge · optional</span><input name="amount" type="number" min="0.001" step="0.001" /></label><label className="field-label"><span>Einheit</span><select name="unit"><option value="piece">Stück</option><option value="g">g</option><option value="ml">ml</option></select></label></div>
      <button className="primary-button wide" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />} Posten speichern</button>
    </form>}
    <section className="shopping-list">
      {snapshot.shoppingItems.length ? snapshot.shoppingItems.map((item) => <button key={item.id} className={`shopping-row ${item.checked ? "checked" : ""}`} onClick={() => void toggle(item)}><span className="shop-check">{item.checked && <Check size={14} />}</span><i>{item.source === "plan" ? "P" : "+"}</i><div><strong>{item.label}</strong><small>{amountLabel(item)} · {item.source === "plan" ? "aus Wochenplan" : "manuell"}</small></div></button>) : <div className="empty-state"><ShoppingCart size={24} /><h2>Liste ist leer</h2><p>Berechne Fehlmengen aus deinem Wochenplan oder füge einen Posten manuell hinzu.</p></div>}
    </section>
  </div>;
}
