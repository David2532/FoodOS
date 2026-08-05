import { z } from "zod";

export const financeCurrencySchema = z.string().regex(/^[A-Z]{3}$/);

export const supplierInvoiceIntakeSchema = z.object({
  sourceSystem: z.string().trim().min(2).max(40),
  sourceDocumentId: z.string().trim().min(2).max(160),
  supplier: z.string().trim().min(2).max(120),
  expenseLabel: z.string().trim().min(2).max(160),
  amountMinor: z.coerce.number().int().positive().max(999_999_999_999),
  currency: financeCurrencySchema,
  issuedOn: z.string().date(),
  dueOn: z.string().date().nullable()
}).superRefine((value, context) => {
  if (value.dueOn && value.dueOn < value.issuedOn) {
    context.addIssue({ code: "custom", path: ["dueOn"], message: "Das Fälligkeitsdatum darf nicht vor dem Rechnungsdatum liegen." });
  }
});

export type SupplierInvoiceIntake = z.infer<typeof supplierInvoiceIntakeSchema>;

export type OpsExpenseTrust = "SOURCE FINAL" | "ESTIMATE" | "NO SOURCE";
export type OpsPaymentState = "OPEN" | "PAID" | "UNKNOWN";

export type OpsExpense = {
  id: string;
  sourceSystem: string;
  sourceDocumentId: string;
  supplier: string;
  expenseLabel: string;
  amountMinor: number;
  currency: string;
  trust: OpsExpenseTrust;
  paymentState: OpsPaymentState;
  issuedOn: string;
  dueOn: string | null;
  recordedAt: string;
};

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency, currencyDisplay: "code" }).format(amountMinor / 100);
}

export function isOpenExpense(expense: Pick<OpsExpense, "paymentState">): boolean {
  return expense.paymentState === "OPEN";
}

export function sumExpensesByCurrency(expenses: readonly OpsExpense[], predicate: (expense: OpsExpense) => boolean): Array<{ currency: string; amountMinor: number }> {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!predicate(expense)) continue;
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amountMinor);
  }
  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}
