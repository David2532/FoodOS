import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchOfficialRecallRecords,
  LEBENSMITTELWARNUNG_SOURCE_KEY
} from "../../../../infrastructure/recall/lebensmittelwarnung";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request, secret: string): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function runRecallIngestion(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceRoleKey) {
    return NextResponse.json({ error: "Recall ingestion is not configured." }, { status: 503 });
  }
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const sourceResult = await supabase
    .from("recall_sources")
    .select("approved, license_reviewed_at")
    .eq("source_key", LEBENSMITTELWARNUNG_SOURCE_KEY)
    .maybeSingle();
  if (sourceResult.error || !sourceResult.data) {
    return NextResponse.json({ error: "Recall source registry unavailable." }, { status: 503 });
  }
  if (!sourceResult.data.approved || !sourceResult.data.license_reviewed_at) {
    return NextResponse.json({ error: "Recall source approval is incomplete." }, { status: 409 });
  }

  try {
    const records = await fetchOfficialRecallRecords();
    let inserted = 0;
    let replayed = 0;
    let corrected = 0;
    for (const record of records) {
      const result = await supabase.rpc("ingest_recall_event", {
        target_source_key: LEBENSMITTELWARNUNG_SOURCE_KEY,
        source_record_id: record.sourceRecordId,
        payload_sha256: record.payloadSha256,
        parser_version: record.parserVersion,
        title: record.title,
        product_name: record.productName,
        brand: null,
        gtins: record.gtins,
        lot_numbers: record.lotNumbers,
        reason: record.reason ?? null,
        source_url: record.sourceUrl,
        published_at: record.publishedAt,
        source_updated_at: null,
        retrieved_at: record.retrievedAt,
        raw_payload: record.rawPayload
      });
      if (result.error) throw new Error("Recall persistence failed");
      const value = result.data as { idempotent_replay?: unknown; corrected?: unknown } | null;
      if (value?.idempotent_replay === true) replayed += 1;
      else inserted += 1;
      if (value?.corrected === true) corrected += 1;
    }
    return NextResponse.json({
      source: LEBENSMITTELWARNUNG_SOURCE_KEY,
      records: records.length,
      inserted,
      replayed,
      corrected
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await supabase.from("recall_sources").update({
      last_attempt_at: new Date().toISOString(),
      last_error_code: "INGESTION_FAILED"
    }).eq("source_key", LEBENSMITTELWARNUNG_SOURCE_KEY);
    return NextResponse.json({ error: "Recall ingestion failed safely." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return runRecallIngestion(request);
}

export async function POST(request: Request) {
  return runRecallIngestion(request);
}
