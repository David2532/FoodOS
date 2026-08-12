import { describe, expect, it } from "vitest";
import {
  formatMoneyMinor,
  isOpenExpense,
  paymentReconciliationSchema,
  resolveOpsExpenseTrust,
  resolveOpsPaymentState,
  sumExpensesByCurrency,
  type OpsExpense
} from "./ops-finance";

const expense = (overrides: Partial<OpsExpense> = {}): OpsExpense => ({
  id: "expense-1",
  sourceSystem: "supabase",
  sourceDocumentId: "invoice-1",
  supplier: "Supabase",
  expenseLabel: "Database subscription",
  amountMinor: 2500,
  currency: "USD",
  trust: "SOURCE FINAL",
  paymentState: "OPEN",
  issuedOn: "2026-08-05",
  dueOn: "2026-08-05",
  recordedAt: "2026-08-05T09:45:54Z",
  paymentEvidenceRecordedAt: null,
  ...overrides
});

describe("CEO finance domain", () => {
  it("formats exact minor units without floating point arithmetic", () => {
    expect(formatMoneyMinor(2500, "USD")).toBe("25,00 USD");
    expect(formatMoneyMinor(1999, "EUR")).toBe("19,99 EUR");
  });

  it("never combines currencies in a CEO total", () => {
    expect(sumExpensesByCurrency([expense(), expense({ id: "expense-2", amountMinor: 500, currency: "EUR" })], () => true)).toEqual([
      { currency: "EUR", amountMinor: 500 },
      { currency: "USD", amountMinor: 2500 }
    ]);
  });

  it("keeps an outstanding supplier invoice visibly open", () => {
    expect(isOpenExpense(expense())).toBe(true);
    expect(isOpenExpense(expense({ paymentState: "UNKNOWN" }))).toBe(true);
    expect(isOpenExpense(expense({ paymentState: "PAID" }))).toBe(false);
  });

  it("derives payment state from the newest immutable event and distrusts legacy paid flags", () => {
    expect(resolveOpsPaymentState("paid", [])).toBe("UNKNOWN");
    expect(resolveOpsPaymentState("open", [
      { eventSequence: 8, effectivePaymentState: "paid" },
      { eventSequence: 9, effectivePaymentState: "open" }
    ])).toBe("OPEN");
  });

  it("accepts exact minor-unit payment evidence metadata without raw banking data", () => {
    expect(paymentReconciliationSchema.parse({
      journalId: "70000000-0000-4000-8000-000000000011",
      paymentSystem: "paypal",
      externalPaymentId: "PAYPAL-TEST-PAYMENT-0001",
      artifactSha256: "a".repeat(64),
      parserVersion: "gmail-html-body-v1",
      amountMinor: 13_113,
      currency: "EUR",
      paidOn: "2026-08-05"
    })).toMatchObject({ amountMinor: 13_113, currency: "EUR" });
  });

  it("lets an immutable validation event correct a legacy metadata-only final label", () => {
    expect(resolveOpsExpenseTrust("source_final", "estimate")).toBe("ESTIMATE");
    expect(resolveOpsExpenseTrust("estimate", "source_final")).toBe("SOURCE FINAL");
    expect(resolveOpsExpenseTrust("no_source", null)).toBe("NO SOURCE");
  });
});
