"use client";

import { FormEvent, useId, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { formatMoneyMinor, type OpsExpense } from "@/domain/ops-finance";

type FormState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const defaultPaidOn = new Date().toISOString().slice(0, 10);

export function PaymentReconciliationForm({ expenses }: { expenses: OpsExpense[] }) {
  const formId = useId();
  const eligibleExpenses = useMemo(
    () => expenses.filter((expense) => expense.trust === "SOURCE FINAL" && expense.paymentState !== "PAID"),
    [expenses]
  );
  const [selectedJournalId, setSelectedJournalId] = useState(eligibleExpenses[0]?.id ?? "");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const selectedExpense = eligibleExpenses.find((expense) => expense.id === selectedJournalId) ?? eligibleExpenses[0] ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedExpense) return;

    setState({ kind: "saving" });
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/ops/finance/payment-reconciliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        journalId: selectedExpense.id,
        paymentSystem: data.get("paymentSystem"),
        externalPaymentId: data.get("externalPaymentId"),
        artifactSha256: data.get("artifactSha256"),
        parserVersion: data.get("parserVersion"),
        amountMinor: selectedExpense.amountMinor,
        currency: selectedExpense.currency,
        paidOn: data.get("paidOn")
      })
    }).catch(() => null);

    if (!response) {
      setState({ kind: "error", message: "Der Zahlungsnachweis konnte nicht gesichert werden. Prüfe die Verbindung und versuche es erneut." });
      return;
    }
    if (!response.ok) {
      setState({
        kind: "error",
        message: response.status === 403
          ? "Die CEO-AAL2-Berechtigung fehlt oder ist abgelaufen."
          : "Kein PAID-Status: Beleg, Betrag, Währung oder SOURCE-FINAL-Zuordnung konnten nicht eindeutig bestätigt werden."
      });
      return;
    }

    setState({ kind: "success" });
    window.location.reload();
  }

  return (
    <form className="ops-invoice-form" onSubmit={onSubmit} aria-describedby={`${formId}-note`}>
      <div className="ops-form-heading"><span>Payment Evidence</span><h2>Lieferantenzahlung abgleichen</h2></div>
      <p id={`${formId}-note`}>
        <strong>PAID</strong> entsteht nur aus einem unveränderlichen Ereignis für eine bereits autoritativ validierte Rechnung.
        FoodOS speichert hier keine IBAN, Karten-, Konto- oder Rohbelegdaten und behauptet damit nicht <strong>BANKED</strong>.
      </p>
      {selectedExpense ? (
        <>
          <div className="ops-form-grid">
            <label>Rechnung
              <select name="journalId" value={selectedExpense.id} onChange={(event) => setSelectedJournalId(event.target.value)} required>
                {eligibleExpenses.map((expense) => (
                  <option key={expense.id} value={expense.id}>
                    {expense.supplier} · {formatMoneyMinor(expense.amountMinor, expense.currency)} · {expense.sourceDocumentId}
                  </option>
                ))}
              </select>
            </label>
            <label>Zahlungsquelle
              <select name="paymentSystem" defaultValue="paypal" required>
                <option value="paypal">PayPal</option>
                <option value="supplier_portal">Lieferantenportal</option>
                <option value="payment_provider">Zahlungsanbieter</option>
              </select>
            </label>
            <label>Externe Zahlungs-ID<input name="externalPaymentId" required minLength={2} maxLength={160} autoComplete="off" /></label>
            <label>Beleg-SHA-256<input name="artifactSha256" required minLength={64} maxLength={64} pattern="[0-9a-fA-F]{64}" autoComplete="off" spellCheck={false} /></label>
            <label>Parser-Version<input name="parserVersion" required minLength={2} maxLength={80} pattern="[a-z0-9][a-z0-9._-]+" placeholder="gmail-html-body-v1" autoComplete="off" /></label>
            <label>Zahlungsdatum<input name="paidOn" required type="date" defaultValue={defaultPaidOn} /></label>
            <label>Minor Units<input value={selectedExpense.amountMinor} readOnly aria-readonly="true" /></label>
            <label>Währung<input value={selectedExpense.currency} readOnly aria-readonly="true" /></label>
          </div>
          <small>Die exakte Rechnungszuordnung, Minor Units und Währung werden zusätzlich in der Datenbank fail-closed geprüft.</small>
          {state.kind === "error" && <p className="ops-form-message error" role="alert">{state.message}</p>}
          {state.kind === "success" && <p className="ops-form-message success" role="status"><CheckCircle2 size={16} aria-hidden="true" /> Unveränderliches Payment-Evidence-Event wurde erfasst.</p>}
          <button className="primary-button ops-submit" disabled={state.kind === "saving"} type="submit">
            {state.kind === "saving"
              ? <><LoaderCircle className="spin" size={16} aria-hidden="true" /> Wird geprüft …</>
              : <><ShieldCheck size={16} aria-hidden="true" /> Evidenz prüfen und PAID setzen</>}
          </button>
        </>
      ) : (
        <p className="ops-form-message" role="status">
          Keine Rechnung ist bereit: Erst ein autoritativ validierter Lieferantenbeleg darf <strong>SOURCE FINAL</strong> werden.
        </p>
      )}
    </form>
  );
}
