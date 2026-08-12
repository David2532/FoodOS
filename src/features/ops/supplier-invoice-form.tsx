"use client";

import { FormEvent, useId, useState } from "react";
import { CheckCircle2, LoaderCircle, Plus } from "lucide-react";

type FormState = { kind: "idle" } | { kind: "saving" } | { kind: "success" } | { kind: "error"; message: string };

const defaultIssuedOn = new Date().toISOString().slice(0, 10);

export function SupplierInvoiceForm() {
  const formId = useId();
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "saving" });
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/ops/finance/supplier-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceSystem: data.get("sourceSystem"),
        sourceDocumentId: data.get("sourceDocumentId"),
        supplier: data.get("supplier"),
        expenseLabel: data.get("expenseLabel"),
        amountMinor: data.get("amountMinor"),
        currency: data.get("currency"),
        issuedOn: data.get("issuedOn"),
        dueOn: data.get("dueOn") || null
      })
    }).catch(() => null);
    if (!response) {
      setState({ kind: "error", message: "Die Rechnung konnte nicht gesichert werden. Prüfe deine Verbindung und versuche es erneut." });
      return;
    }
    if (!response.ok) {
      setState({ kind: "error", message: response.status === 403 ? "Die CEO-AAL2-Berechtigung fehlt oder ist abgelaufen." : "Die Rechnung wurde nicht gebucht. Prüfe die Angaben und versuche es erneut." });
      return;
    }
    event.currentTarget.reset();
    setState({ kind: "success" });
    window.location.reload();
  }

  return (
    <form className="ops-invoice-form" onSubmit={onSubmit} aria-describedby={`${formId}-note`}>
      <div className="ops-form-heading"><span>Quelleneingang</span><h2>Lieferantenrechnung erfassen</h2></div>
      <p id={`${formId}-note`}>Erfasst nur Rechnungsmetadaten als <strong>ESTIMATE</strong>. Erst ein separat ingestierter, autoritativer Beleg darf <strong>SOURCE FINAL</strong> werden; die Zahlung bleibt bis zum Abgleich <strong>OPEN</strong>.</p>
      <div className="ops-form-grid">
        <label>Quelle<select name="sourceSystem" defaultValue="supabase" required><option value="supabase">Supabase</option><option value="openai">OpenAI</option><option value="other">Andere Quelle</option></select></label>
        <label>Rechnungs-/Beleg-ID<input name="sourceDocumentId" required minLength={2} maxLength={160} autoComplete="off" /></label>
        <label>Lieferant<input name="supplier" required minLength={2} maxLength={120} autoComplete="organization" /></label>
        <label>Kostenbezeichnung<input name="expenseLabel" required minLength={2} maxLength={160} autoComplete="off" /></label>
        <label>Minor Units<input name="amountMinor" required min="1" step="1" inputMode="numeric" type="number" aria-describedby={`${formId}-amount`} /></label>
        <label>Währung<input name="currency" required defaultValue="USD" minLength={3} maxLength={3} pattern="[A-Z]{3}" autoCapitalize="characters" /></label>
        <label>Rechnungsdatum<input name="issuedOn" required type="date" defaultValue={defaultIssuedOn} /></label>
        <label>Fällig am<input name="dueOn" type="date" /></label>
      </div>
      <small id={`${formId}-amount`}>Beispiel: 25,00 USD werden als <strong>2500</strong> gespeichert. Währungen bleiben strikt getrennt.</small>
      {state.kind === "error" && <p className="ops-form-message error" role="alert">{state.message}</p>}
      {state.kind === "success" && <p className="ops-form-message success" role="status"><CheckCircle2 size={16} aria-hidden="true" /> Unveränderliche Metadaten und eine offene Kostenschätzung wurden erfasst.</p>}
      <button className="primary-button ops-submit" disabled={state.kind === "saving"} type="submit">{state.kind === "saving" ? <><LoaderCircle className="spin" size={16} aria-hidden="true" /> Wird erfasst …</> : <><Plus size={16} aria-hidden="true" /> Rechnung als OPEN erfassen</>}</button>
    </form>
  );
}
