"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { mealPlanDeleteResultSchema, mealPlanMutationResultSchema, type PlanningUnit } from "@/contracts/planning-shopping";
import { formatPlanningAmount, weekDatesFromMonday } from "@/domain/planning-shopping";
import { submitDurableRpc } from "@/infrastructure/offline-outbox";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { AppSnapshot, MealPlanItem } from "@/lib/types";

const mealLabels = { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", snack: "Snack" } as const;
function mutationError(message: string): string {
  if (/revision conflict/i.test(message)) return "Der Planeintrag wurde inzwischen geändert. Lade den aktuellen Stand und versuche es erneut.";
  if (/access denied|aal2 required/i.test(message)) return "Deine Berechtigung oder Zwei-Faktor-Sitzung ist nicht mehr aktuell. Melde dich erneut an.";
  return "Der Planeintrag konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.";
}

export function PlanView({ snapshot, onChanged }: { snapshot?: AppSnapshot; onChanged?: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MealPlanItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<MealPlanItem | null>(null);
  const [dateSelection, setDateSelection] = useState(() => ({
    weekStart: snapshot?.weekStart ?? "",
    date: snapshot?.weekStart ?? ""
  }));
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<PlanningUnit>("g");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const mutationId = useRef("");
  const dates = useMemo(() => snapshot ? weekDatesFromMonday(snapshot.weekStart) : [], [snapshot]);
  const selectedDate = snapshot && dateSelection.weekStart === snapshot.weekStart
    ? dateSelection.date
    : snapshot?.weekStart ?? "";
  const products = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; unit: PlanningUnit }>();
    snapshot?.inventory.forEach((item) => {
      if (!unique.has(item.productId)) unique.set(item.productId, { id: item.productId, name: item.name, unit: item.unit });
    });
    return [...unique.values()];
  }, [snapshot?.inventory]);
  const visiblePlan = useMemo(
    () => snapshot?.mealPlan.filter((entry) => entry.plannedFor === selectedDate) ?? [],
    [selectedDate, snapshot?.mealPlan]
  );

  function openCreate() {
    const firstProduct = products[0];
    setEditing(null);
    setDeleteCandidate(null);
    setSelectedProductId(firstProduct?.id ?? "");
    setSelectedUnit(firstProduct?.unit ?? "g");
    setFormOpen(true);
    setError(null);
    setStatus(null);
    mutationId.current = crypto.randomUUID();
  }

  function openEdit(entry: MealPlanItem) {
    setEditing(entry);
    setDeleteCandidate(null);
    setSelectedProductId(entry.productId);
    setSelectedUnit(entry.plannedUnit);
    setFormOpen(true);
    setError(null);
    setStatus(null);
    mutationId.current = crypto.randomUUID();
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setError(null);
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !onChanged) return;
    const form = new FormData(event.currentTarget);
    const args = {
      target_date: String(form.get("date")),
      target_meal_type: String(form.get("mealType")),
      target_amount: Number(form.get("amount")),
      target_unit: selectedUnit,
      mutation_id: mutationId.current
    };
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      if (editing) {
        const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("edit_meal_plan_item", {
          target_slot: editing.id,
          ...args,
          base_revision: editing.revision
        });
        const parsed = mealPlanMutationResultSchema.safeParse(data);
        if (rpcError || !parsed.success) {
          setError(mutationError(rpcError?.message ?? "unexpected_result"));
          return;
        }
        setStatus("Planeintrag aktualisiert.");
      } else {
        const result = await submitDurableRpc<unknown>({
          kind: "plan.add_product_v2",
          rpc: "plan_product_v2",
          householdId: snapshot.household.id,
          operationId: mutationId.current,
          args: {
            target_household: snapshot.household.id,
            target_product: selectedProductId,
            ...args
          }
        });
        if (result.status === "rejected") {
          setError(mutationError(result.message));
          return;
        }
        if (result.status === "queued") {
          setStatus("Auf diesem Gerät gespeichert. Der Eintrag wird nach Wiederherstellung der Verbindung synchronisiert.");
          setFormOpen(false);
          return;
        }
        if (!mealPlanMutationResultSchema.safeParse(result.data).success) {
          setError("Der Server hat ein unerwartetes Planungsergebnis geliefert.");
          return;
        }
        setStatus("Planeintrag erstellt.");
      }
      setFormOpen(false);
      setEditing(null);
      onChanged();
    } catch {
      setError("Der Planeintrag konnte weder lokal sicher gespeichert noch vom Server bestätigt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlanItem() {
    if (!deleteCandidate || !onChanged) return;
    if (!mutationId.current) mutationId.current = crypto.randomUUID();
    setDeleting(true);
    setError(null);
    setStatus(null);
    try {
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("delete_meal_plan_item", {
        target_slot: deleteCandidate.id,
        base_revision: deleteCandidate.revision,
        mutation_id: mutationId.current
      });
      const parsed = mealPlanDeleteResultSchema.safeParse(data);
      if (rpcError || !parsed.success) {
        setError(mutationError(rpcError?.message ?? "unexpected_result"));
        return;
      }
      setDeleteCandidate(null);
      setStatus("Planeintrag gelöscht.");
      onChanged();
    } catch {
      setError("Der Planeintrag konnte ohne Serververbindung nicht gelöscht werden. Er bleibt unverändert bestehen.");
    } finally {
      setDeleting(false);
    }
  }

  if (!snapshot) return <div className="stack-lg page-enter"><section className="empty-state"><CalendarPlus size={26} /><h2>Plan-Preview</h2><p>Im Preview-Modus wird kein Wochenplan gespeichert. Melde dich mit AAL2 an, um Produkte aus deinem Vorrat verbindlich einzuplanen.</p></section></div>;

  return <div className="stack-lg page-enter">
    <div className="day-picker" aria-label="Tag im Wochenplan wählen">{dates.map((date) => <button type="button" key={date} className={date === selectedDate ? "active" : undefined} aria-pressed={date === selectedDate} onClick={() => setDateSelection({ weekStart: snapshot.weekStart, date })}><span>{new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(new Date(`${date}T12:00:00Z`)).slice(0, 2).toUpperCase()}</span><strong>{Number(date.slice(-2))}</strong></button>)}</div>
    <section>
      <div className="section-heading"><div><p>HAUSHALTSPLAN</p><h2>{snapshot.mealPlan.length} Einträge</h2></div><button type="button" className="small-action" onClick={openCreate} disabled={!products.length}><Plus size={16} /> Planen</button></div>
      {status && <div className="success-banner" role="status"><CheckCircle2 size={17} /><span>{status}</span></div>}
      {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      {visiblePlan.length ? <div className="timeline">{visiblePlan.map((entry) => <div className="timeline-row plan-timeline-row" key={entry.id}><time>{new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(new Date(`${entry.plannedFor}T12:00:00Z`))}</time><span className="timeline-dot" /><article><small>{mealLabels[entry.mealType].toUpperCase()} · REVISION {entry.revision}</small><strong>{entry.productName}</strong><em>{formatPlanningAmount(entry.plannedAmount, entry.plannedUnit)} · im Haushalt geplant</em></article><div className="plan-row-actions"><button type="button" aria-label={`${entry.productName} bearbeiten`} onClick={() => openEdit(entry)}><Pencil size={15} /></button><button type="button" aria-label={`${entry.productName} löschen`} onClick={() => { setDeleteCandidate(entry); setFormOpen(false); setError(null); mutationId.current = crypto.randomUUID(); }}><Trash2 size={15} /></button></div></div>)}</div> : <div className="empty-state"><CalendarPlus size={24} /><h2>An diesem Tag nichts geplant</h2><p>Plane eine konkrete Menge aus deinem Vorrat für diesen Tag ein.</p></div>}
      {!products.length && <div className="empty-state"><PackageOpen size={22} /><p>Erfasse zuerst ein Produkt im Vorrat, bevor du es planen kannst.</p></div>}
    </section>
    {deleteCandidate && <section className="inline-confirmation" role="alertdialog" aria-labelledby="delete-plan-title"><div><strong id="delete-plan-title">{deleteCandidate.productName} aus dem Plan löschen?</strong><p>Die Einkaufsliste ändert sich erst bei der nächsten Berechnung.</p></div><div><button type="button" className="secondary-button" onClick={() => setDeleteCandidate(null)} disabled={deleting}><X size={16} /> Abbrechen</button><button type="button" className="destructive-button" onClick={() => void deletePlanItem()} disabled={deleting}>{deleting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />} Löschen</button></div></section>}
    {formOpen && <form className="batch-form" onSubmit={savePlan}>
      <div className="batch-form-heading"><span><CalendarPlus size={20} /></span><div><p>{editing ? "PLANEINTRAG BEARBEITEN" : "NEU PLANEN"}</p><strong>{editing ? editing.productName : "Menge und Einheit festlegen"}</strong><small>Die Menge wird ohne still angenommene Umrechnung gespeichert.</small></div></div>
      <label className="field-label"><span>Produkt aus dem Vorrat</span><select name="product" value={selectedProductId} disabled={Boolean(editing)} onChange={(event) => { const product = products.find((candidate) => candidate.id === event.target.value); setSelectedProductId(event.target.value); if (product) setSelectedUnit(product.unit); }} required>{editing && !products.some((product) => product.id === editing.productId) && <option value={editing.productId}>{editing.productName} (nicht mehr im Vorrat)</option>}{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
      <div className="batch-grid"><label className="field-label"><span>Tag</span><select name="date" defaultValue={editing?.plannedFor ?? selectedDate}>{dates.map((date) => <option value={date} key={date}>{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00Z`))}</option>)}</select></label><label className="field-label"><span>Mahlzeit</span><select name="mealType" defaultValue={editing?.mealType ?? "dinner"}><option value="breakfast">Frühstück</option><option value="lunch">Mittagessen</option><option value="dinner">Abendessen</option><option value="snack">Snack</option></select></label></div>
      <div className="batch-grid"><label className="field-label"><span>Planmenge</span><input name="amount" type="number" inputMode="decimal" min="0.001" max="1000000" step="0.001" defaultValue={editing?.plannedAmount ?? 1} required /></label><label className="field-label"><span>Einheit</span><select name="unit" value={selectedUnit} onChange={(event) => setSelectedUnit(event.target.value as PlanningUnit)}><option value="g">g</option><option value="ml">ml</option><option value="piece">Stück</option></select></label></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={closeForm} disabled={saving}><X size={16} /> Abbrechen</button><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <CalendarPlus size={18} />}{saving ? "Wird gespeichert …" : editing ? "Änderung speichern" : "Eintrag erstellen"}</button></div>
    </form>}
  </div>;
}
