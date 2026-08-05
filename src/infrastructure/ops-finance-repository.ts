import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  resolveOpsExpenseTrust,
  resolveOpsPaymentState,
  type OpsExpense,
  type OpsFinanceTrustState,
  type OpsPaymentStateEvent
} from "@/domain/ops-finance";

const opsMemberSchema = z.object({ role: z.enum(["ceo", "finance", "engineering_responder", "release_manager", "privacy_security", "support"]) });
const sourceDocumentSchema = z.object({
  id: z.uuid(),
  source_system: z.string(),
  source_document_id: z.string(),
  supplier: z.string(),
  issued_on: z.string(),
  due_on: z.string().nullable(),
  captured_at: z.string()
});
const journalSchema = z.object({
  id: z.uuid(),
  source_document_id: z.uuid(),
  expense_label: z.string(),
  trust_state: z.enum(["source_final", "estimate", "no_source"]),
  payment_state: z.enum(["open", "paid", "unknown"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  total_minor: z.coerce.number().int().positive(),
  created_at: z.string()
});
const sourceValidationEventSchema = z.object({
  event_sequence: z.coerce.number().int().positive(),
  source_document_id: z.uuid(),
  effective_trust_state: z.enum(["source_final", "estimate", "no_source"])
});
const paymentEventSchema = z.object({
  event_sequence: z.coerce.number().int().positive(),
  journal_id: z.uuid(),
  effective_payment_state: z.enum(["open", "paid", "unknown"]),
  recorded_at: z.string()
});

export type OpsFinanceLoadResult =
  | { kind: "no-access" }
  | { kind: "unavailable"; message: string }
  | { kind: "ready"; expenses: OpsExpense[] };

export async function loadOpsFinanceDashboard(supabase: SupabaseClient): Promise<OpsFinanceLoadResult> {
  const membershipResult = await supabase.from("ops_members").select("role").maybeSingle();
  if (membershipResult.error) return { kind: "unavailable", message: "Die Ops-Daten konnten nicht geladen werden. Die Finanzansicht bleibt geschlossen." };
  const membership = opsMemberSchema.nullable().safeParse(membershipResult.data);
  if (!membership.success) return { kind: "unavailable", message: "Die Ops-Rollenzuordnung ist ungültig. Die Finanzansicht bleibt geschlossen." };
  if (!membership.data || membership.data.role !== "ceo") return { kind: "no-access" };

  const [sourceResult, journalResult, validationResult, paymentEventResult] = await Promise.all([
    supabase.from("ops_finance_source_documents").select("id, source_system, source_document_id, supplier, issued_on, due_on, captured_at"),
    supabase.from("ops_finance_journals").select("id, source_document_id, expense_label, trust_state, payment_state, currency, total_minor, created_at").order("created_at", { ascending: false }),
    supabase.from("ops_finance_source_validation_events").select("event_sequence, source_document_id, effective_trust_state"),
    supabase.from("ops_finance_payment_events").select("event_sequence, journal_id, effective_payment_state, recorded_at")
  ]);
  if (sourceResult.error || journalResult.error || validationResult.error || paymentEventResult.error) return { kind: "unavailable", message: "Die Ops-Finanzquelle oder das Ledger ist nicht verfügbar. Es wurde keine Ersatzkennzahl gebildet." };

  const sourceDocuments = z.array(sourceDocumentSchema).safeParse(sourceResult.data);
  const journals = z.array(journalSchema).safeParse(journalResult.data);
  const validationEvents = z.array(sourceValidationEventSchema).safeParse(validationResult.data);
  const paymentEvents = z.array(paymentEventSchema).safeParse(paymentEventResult.data);
  if (!sourceDocuments.success || !journals.success || !validationEvents.success || !paymentEvents.success) return { kind: "unavailable", message: "Eine Ops-Finanzquelle hat ein unerwartetes Format. Es wurde keine Ersatzkennzahl gebildet." };

  const sourceById = new Map(sourceDocuments.data.map((source) => [source.id, source]));
  const latestTrustBySource = new Map<string, { eventSequence: number; trust: OpsFinanceTrustState }>();
  for (const validation of validationEvents.data) {
    const current = latestTrustBySource.get(validation.source_document_id);
    if (!current || validation.event_sequence > current.eventSequence) {
      latestTrustBySource.set(validation.source_document_id, {
        eventSequence: validation.event_sequence,
        trust: validation.effective_trust_state
      });
    }
  }
  const paymentEventsByJournal = new Map<string, Array<OpsPaymentStateEvent & { recordedAt: string }>>();
  for (const paymentEvent of paymentEvents.data) {
    const events = paymentEventsByJournal.get(paymentEvent.journal_id) ?? [];
    events.push({
      eventSequence: paymentEvent.event_sequence,
      effectivePaymentState: paymentEvent.effective_payment_state,
      recordedAt: paymentEvent.recorded_at
    });
    paymentEventsByJournal.set(paymentEvent.journal_id, events);
  }
  const expenses: OpsExpense[] = [];
  for (const journal of journals.data) {
    const source = sourceById.get(journal.source_document_id);
    if (!source) return { kind: "unavailable", message: "Ein Ledger-Journal hat keine unveränderliche Quelle. Es wurde keine Ersatzkennzahl gebildet." };
    const journalPaymentEvents = paymentEventsByJournal.get(journal.id) ?? [];
    const latestPaymentEvent = journalPaymentEvents.reduce<(typeof journalPaymentEvents)[number] | null>(
      (latest, event) => !latest || event.eventSequence > latest.eventSequence ? event : latest,
      null
    );
    expenses.push({
      id: journal.id,
      sourceSystem: source.source_system,
      sourceDocumentId: source.source_document_id,
      supplier: source.supplier,
      expenseLabel: journal.expense_label,
      amountMinor: journal.total_minor,
      currency: journal.currency,
      trust: resolveOpsExpenseTrust(journal.trust_state, latestTrustBySource.get(source.id)?.trust ?? null),
      paymentState: resolveOpsPaymentState(journal.payment_state, journalPaymentEvents),
      issuedOn: source.issued_on,
      dueOn: source.due_on,
      recordedAt: journal.created_at,
      paymentEvidenceRecordedAt: latestPaymentEvent?.recordedAt ?? null
    });
  }
  return { kind: "ready", expenses };
}
