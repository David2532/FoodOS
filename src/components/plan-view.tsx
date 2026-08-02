"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarPlus, LoaderCircle, PackageOpen, Plus } from "lucide-react";
import { z } from "zod";
import { submitDurableRpc } from "@/infrastructure/offline-outbox";
import type { AppSnapshot } from "@/lib/types";

const mealLabels = { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", snack: "Snack" } as const;

function weekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(`${weekStart}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
}

export function PlanView({ snapshot, onChanged }: { snapshot?: AppSnapshot; onChanged?: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationId = useRef("");
  const dates = useMemo(() => weekDates(snapshot?.weekStart ?? new Date().toISOString().slice(0, 10)), [snapshot?.weekStart]);
  const products = useMemo(() => {
    const unique = new Map<string, string>();
    snapshot?.inventory.forEach((item) => unique.set(item.productId, item.name));
    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [snapshot?.inventory]);

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !onChanged) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const result = await submitDurableRpc<unknown>({
        kind: "plan.add_product",
        rpc: "plan_product",
        householdId: snapshot.household.id,
        operationId: mutationId.current,
        args: {
          target_household: snapshot.household.id,
          target_product: String(form.get("product")),
          target_date: String(form.get("date")),
          target_meal_type: String(form.get("mealType")),
          target_servings: Number(form.get("servings")),
          mutation_id: mutationId.current
        }
      });
      setSaving(false);
      if (result.status === "rejected" || (result.status === "acked" && !z.uuid().safeParse(result.data).success)) {
        setError(result.status === "rejected" ? result.message : "Der Server hat ein unerwartetes Ergebnis geliefert.");
        return;
      }
      setFormOpen(false);
      if (result.status === "acked") onChanged();
    } catch {
      setSaving(false);
      setError("Der Planeintrag konnte weder lokal sicher gespeichert noch vom Server bestätigt werden.");
    }
  }

  if (!snapshot) return <div className="stack-lg page-enter"><section className="empty-state"><CalendarPlus size={26} /><h2>Plan-Preview</h2><p>Im Preview-Modus wird kein Wochenplan gespeichert. Melde dich mit AAL2 an, um Produkte aus deinem Vorrat verbindlich einzuplanen.</p></section></div>;

  return <div className="stack-lg page-enter">
    <div className="day-picker">{dates.map((date) => <button key={date}><span>{new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(new Date(`${date}T12:00:00Z`)).slice(0, 2).toUpperCase()}</span><strong>{Number(date.slice(-2))}</strong></button>)}</div>
    <section>
      <div className="section-heading"><div><p>GESPEICHERTER WOCHENPLAN</p><h2>{snapshot.mealPlan.length} Einträge</h2></div><button className="small-action" onClick={() => { setFormOpen(true); mutationId.current = crypto.randomUUID(); }} disabled={!products.length}><Plus size={16} /> Planen</button></div>
      {snapshot.mealPlan.length ? <div className="timeline">{snapshot.mealPlan.map((entry) => <div className="timeline-row" key={entry.id}><time>{new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(new Date(`${entry.plannedFor}T12:00:00Z`))}</time><span className="timeline-dot" /><article><small>{mealLabels[entry.mealType].toUpperCase()}</small><strong>{entry.productName}</strong><em>{entry.servings.toLocaleString("de-DE")} Portionen · dauerhaft gespeichert</em></article></div>)}</div> : <div className="empty-state"><CalendarPlus size={24} /><h2>Noch nichts geplant</h2><p>Plane ein vorhandenes Produkt für einen Tag und eine Mahlzeit ein.</p></div>}
      {!products.length && <div className="empty-state"><PackageOpen size={22} /><p>Erfasse zuerst ein Produkt im Vorrat, bevor du es planen kannst.</p></div>}
    </section>
    {formOpen && <form className="batch-form" onSubmit={savePlan}>
      <label className="field-label"><span>Produkt aus dem Vorrat</span><select name="product" required>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
      <div className="batch-grid"><label className="field-label"><span>Tag</span><select name="date">{dates.map((date) => <option value={date} key={date}>{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00Z`))}</option>)}</select></label><label className="field-label"><span>Mahlzeit</span><select name="mealType"><option value="breakfast">Frühstück</option><option value="lunch">Mittagessen</option><option value="dinner">Abendessen</option><option value="snack">Snack</option></select></label></div>
      <label className="field-label"><span>Portionen</span><input name="servings" type="number" min="0.1" max="100" step="0.1" defaultValue="1" required /></label>
      {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      <button className="primary-button wide" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <CalendarPlus size={18} />}{saving ? "Wird geplant …" : "Eintrag speichern"}</button>
    </form>}
  </div>;
}
