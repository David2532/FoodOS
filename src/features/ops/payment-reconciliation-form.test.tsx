/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { OpsExpense } from "@/domain/ops-finance";
import { PaymentReconciliationForm } from "./payment-reconciliation-form";

const expense = (overrides: Partial<OpsExpense> = {}): OpsExpense => ({
  id: "70000000-0000-4000-8000-000000000011",
  sourceSystem: "openai",
  sourceDocumentId: "chatgpt-pro-2026-08-05",
  supplier: "OpenAI",
  expenseLabel: "ChatGPT Pro",
  amountMinor: 13_113,
  currency: "EUR",
  trust: "SOURCE FINAL",
  paymentState: "OPEN",
  issuedOn: "2026-08-05",
  dueOn: "2026-08-05",
  recordedAt: "2026-08-05T10:00:00Z",
  paymentEvidenceRecordedAt: null,
  ...overrides
});

afterEach(cleanup);

describe("Q-OPS-FINANCE-UI-002 payment reconciliation form", () => {
  it("offers PAID reconciliation only for SOURCE FINAL expenses without a paid event", () => {
    render(<PaymentReconciliationForm expenses={[
      expense(),
      expense({ id: "estimate", trust: "ESTIMATE", sourceDocumentId: "estimate" }),
      expense({ id: "already-paid", paymentState: "PAID", sourceDocumentId: "paid" })
    ]} />);

    expect(screen.getByRole("option", { name: /OpenAI.*131,13.*EUR.*chatgpt-pro-2026-08-05/i })).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect((screen.getByRole("button", { name: /Evidenz prüfen und PAID setzen/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Minor Units") as HTMLInputElement).value).toBe("13113");
    expect((screen.getByLabelText("Währung") as HTMLInputElement).value).toBe("EUR");
  });

  it("shows a fail-closed state and does not request banking account data", () => {
    render(<PaymentReconciliationForm expenses={[expense({ trust: "ESTIMATE" })]} />);

    expect(screen.getByText(/Keine Rechnung ist bereit/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /PAID setzen/i })).toBeNull();
    expect(screen.queryByLabelText(/IBAN|Konto|Karte/i)).toBeNull();
  });
});
