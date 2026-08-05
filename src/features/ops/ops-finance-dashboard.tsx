"use client";

import { AlertTriangle, BadgeEuro, FileWarning, ShieldCheck } from "lucide-react";
import { formatMoneyMinor, isOpenExpense, sumExpensesByCurrency, type OpsExpense } from "@/domain/ops-finance";
import { SupplierInvoiceForm } from "./supplier-invoice-form";

function AmountList({ amounts }: { amounts: Array<{ currency: string; amountMinor: number }> }) {
  if (!amounts.length) return <strong className="ops-no-value">Keine Quelle</strong>;
  return <strong>{amounts.map((amount) => formatMoneyMinor(amount.amountMinor, amount.currency)).join(" · ")}</strong>;
}

function FinanceMetric({ label, detail, amounts, tone = "neutral" }: { label: string; detail: string; amounts: Array<{ currency: string; amountMinor: number }>; tone?: "neutral" | "warning" }) {
  return <article className={`ops-metric ${tone}`}><span>{label}</span><AmountList amounts={amounts} /><small>{detail}</small></article>;
}

function formatDate(date: string | null): string {
  if (!date) return "Kein Fälligkeitsdatum";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

export function OpsFinanceDashboard({ expenses }: { expenses: OpsExpense[] }) {
  const booked = sumExpensesByCurrency(expenses, (expense) => expense.trust === "SOURCE FINAL");
  const open = sumExpensesByCurrency(expenses, (expense) => expense.trust === "SOURCE FINAL" && isOpenExpense(expense));
  const paid = sumExpensesByCurrency(expenses, (expense) => expense.paymentState === "PAID");
  return (
    <main className="ops-canvas">
      <section className="ops-shell">
        <header className="ops-topbar"><div><p>INTERN · AAL2 · CEO TODAY</p><h1>FoodOS CEO-Zentrale</h1></div><span className="ops-proof"><ShieldCheck size={16} aria-hidden="true" /> FINANCE SOURCE</span></header>
        <section className="ops-hero" aria-labelledby="ops-money-title"><div><p>GELD · QUELLEN · FÄLLIGKEITEN</p><h2 id="ops-money-title">Kosten bleiben getrennt von Zahlung und Cash.</h2><span>Keine Umsatz-, Cash- oder Margenkennzahl wird ohne eigene Quelle ersetzt.</span></div><BadgeEuro size={42} aria-hidden="true" /></section>
        <section className="ops-metrics" aria-label="Finanzstatus">
          <FinanceMetric label="Gebuchte Lieferantenkosten" detail="SOURCE FINAL · nicht bezahlt/reconciled" amounts={booked} />
          <FinanceMetric label="Offene Verbindlichkeiten" detail="Rechnung vorhanden · Zahlung noch nicht abgeglichen" amounts={open} tone="warning" />
          <FinanceMetric label="Abgeglichene Zahlungen" detail="Nur mit Bank-/Zahlungsnachweis" amounts={paid} />
        </section>
        <section className="ops-grid">
          <section className="ops-card ops-source-card" aria-labelledby="ops-sources-title"><div className="ops-section-heading"><div><p>UNVERÄNDERLICHE QUELLEN</p><h2 id="ops-sources-title">Lieferantenkosten</h2></div><span>{expenses.length} Quelle{expenses.length === 1 ? "" : "n"}</span></div>
            {expenses.length ? <ul className="ops-expense-list">{expenses.map((expense) => <li key={expense.id}><div><strong>{expense.expenseLabel}</strong><span>{expense.supplier} · Quelle {expense.sourceSystem}/{expense.sourceDocumentId}</span><small>Ausgestellt {formatDate(expense.issuedOn)} · fällig {formatDate(expense.dueOn)}</small></div><div className="ops-expense-amount"><strong>{formatMoneyMinor(expense.amountMinor, expense.currency)}</strong><span className={`ops-state ${expense.paymentState.toLowerCase()}`}>{expense.trust} · {expense.paymentState}</span></div></li>)}</ul> : <div className="ops-empty"><FileWarning size={20} aria-hidden="true" /><div><strong>Noch keine geprüfte Kostenquelle</strong><p>ChatGPT Pro wird nicht als Ausgabe gezählt: In der verbundenen Mailbox liegt kein Betrag oder Zahlungsbeleg vor.</p></div></div>}
          </section>
          <aside className="ops-card ops-risk-card"><AlertTriangle size={20} aria-hidden="true" /><div><p>AKTION NÖTIG</p><h2>Providerzugriff blockiert</h2><span>Die Produktivdatenbank ist aktuell schreibgeschützt. Daher wurde keine Rechnung und keine CEO-Rolle in Production erzeugt.</span></div></aside>
        </section>
        <SupplierInvoiceForm />
      </section>
    </main>
  );
}
