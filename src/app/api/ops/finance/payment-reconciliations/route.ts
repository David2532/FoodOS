import { NextResponse } from "next/server";
import { paymentReconciliationSchema } from "@/domain/ops-finance";
import { hasSameConfiguredOrigin } from "@/domain/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number): Response {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
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
    return noStoreJson({ error: "INVALID_PAYMENT_EVIDENCE" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return noStoreJson({ error: "INVALID_PAYMENT_EVIDENCE" }, 400);
  }

  const raw = body as Record<string, unknown>;
  const parsed = paymentReconciliationSchema.safeParse({
    ...raw,
    paymentSystem: typeof raw.paymentSystem === "string" ? raw.paymentSystem.trim().toLowerCase() : raw.paymentSystem,
    artifactSha256: typeof raw.artifactSha256 === "string" ? raw.artifactSha256.trim().toLowerCase() : raw.artifactSha256,
    parserVersion: typeof raw.parserVersion === "string" ? raw.parserVersion.trim().toLowerCase() : raw.parserVersion,
    currency: typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : raw.currency
  });
  if (!parsed.success) return noStoreJson({ error: "INVALID_PAYMENT_EVIDENCE" }, 400);

  const evidence = parsed.data;
  const result = await supabase.rpc("record_ops_supplier_payment", {
    input_journal_id: evidence.journalId,
    input_payment_system: evidence.paymentSystem,
    input_external_payment_id: evidence.externalPaymentId,
    input_artifact_sha256: evidence.artifactSha256,
    input_parser_version: evidence.parserVersion,
    input_amount_minor: evidence.amountMinor,
    input_currency: evidence.currency,
    input_paid_on: evidence.paidOn
  });
  if (result.error || result.data === null) {
    return noStoreJson({ error: "PAYMENT_NOT_RECONCILED" }, 422);
  }

  return noStoreJson({ status: "recorded", eventSequence: result.data }, 201);
}
