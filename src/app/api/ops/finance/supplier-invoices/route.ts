import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supplierInvoiceIntakeSchema } from "@/domain/ops-finance";
import { hasSameConfiguredOrigin } from "@/domain/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number): Response {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
}

function metadataHash(input: { sourceSystem: string; sourceDocumentId: string; supplier: string; expenseLabel: string; amountMinor: number; currency: string; issuedOn: string; dueOn: string | null }): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  if (!hasSameConfiguredOrigin(request)) return noStoreJson({ error: "INVALID_REQUEST_ORIGIN" }, 403);
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return noStoreJson({ error: "SERVICE_UNAVAILABLE" }, 503);
  }
  const claims = await supabase.auth.getClaims();
  if (claims.error || !claims.data?.claims) return noStoreJson({ error: "AUTHENTICATION_REQUIRED" }, 401);
  if (claims.data.claims.aal !== "aal2") return noStoreJson({ error: "AAL2_REQUIRED" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "INVALID_INVOICE" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return noStoreJson({ error: "INVALID_INVOICE" }, 400);
  const raw = body as Record<string, unknown>;
  const parsed = supplierInvoiceIntakeSchema.safeParse({
    ...raw,
    sourceSystem: typeof raw.sourceSystem === "string" ? raw.sourceSystem.trim().toLowerCase() : raw.sourceSystem,
    currency: typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : raw.currency
  });
  if (!parsed.success) return noStoreJson({ error: "INVALID_INVOICE" }, 400);

  const invoice = parsed.data;
  const result = await supabase.rpc("record_ops_supplier_invoice", {
    input_source_system: invoice.sourceSystem,
    input_source_document_id: invoice.sourceDocumentId,
    input_supplier: invoice.supplier,
    input_expense_label: invoice.expenseLabel,
    input_amount_minor: invoice.amountMinor,
    input_currency: invoice.currency,
    input_issued_on: invoice.issuedOn,
    input_due_on: invoice.dueOn,
    input_source_sha256: metadataHash(invoice)
  });
  if (result.error || !result.data) return noStoreJson({ error: "INVOICE_NOT_RECORDED" }, 422);
  return noStoreJson({ status: "recorded", journalId: result.data }, 201);
}
