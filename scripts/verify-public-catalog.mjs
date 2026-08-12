#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { catalogServerConfiguration } from "./catalog-environment.mjs";

function loadLocalEnvironment() {
  const file = resolve(".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
}

loadLocalEnvironment();
const { url, credential } = catalogServerConfiguration();
if (!url || !credential) {
  process.stderr.write("Catalog verification blocked: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY are required.\n");
  process.exitCode = 2;
} else {
  const supabase = createClient(url, credential, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: run, error: runError } = await supabase.from("product_catalog_import_runs")
    .select("id, generation, source_provider, source_schema_version, source_revision, source_retrieved_at, attempted_row_count, accepted_product_count, rejected_row_count, filtered_row_count, duplicate_row_count, normalized_content_sha256")
    .eq("status", "active")
    .order("generation", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError || !run) {
    process.stderr.write("Catalog verification failed: no active catalog generation.\n");
    process.exitCode = 1;
  } else {
    const { data: integrity, error: integrityError } = await supabase.rpc("inspect_product_catalog_import", { target_import_run_id: run.id }).single();
    const counterFields = [
      "persisted_product_count",
      "invalid_gtin_count",
      "mismatched_product_hash_count",
      "nutrition_evidence_count",
      "ingredients_evidence_count",
      "allergen_evidence_count",
      "provenance_evidence_count"
    ];
    const validIntegrity = integrity
      && typeof integrity === "object"
      && counterFields.every((field) => Number.isSafeInteger(integrity[field]) && integrity[field] >= 0)
      && typeof integrity.normalized_content_sha256 === "string"
      && /^[a-f0-9]{64}$/.test(integrity.normalized_content_sha256);
    const validHash = typeof run.normalized_content_sha256 === "string"
      && run.normalized_content_sha256 === integrity?.normalized_content_sha256;
    const countersMatch = validIntegrity
      && run.accepted_product_count === integrity.persisted_product_count
      && run.attempted_row_count === run.accepted_product_count + run.rejected_row_count + run.filtered_row_count + run.duplicate_row_count;
    const sourceIsTraceable = typeof run.source_provider === "string"
      && typeof run.source_schema_version === "string"
      && typeof run.source_revision === "string"
      && run.source_revision.length > 0
      && typeof run.source_retrieved_at === "string"
      && !Number.isNaN(Date.parse(run.source_retrieved_at));
    const metadataIsRepresentative = validIntegrity
      && integrity.nutrition_evidence_count >= 100
      && integrity.ingredients_evidence_count >= 100
      && integrity.allergen_evidence_count >= 100
      && integrity.provenance_evidence_count >= 100;
    if (integrityError || !validIntegrity || !countersMatch || integrity.persisted_product_count < 25_000
      || integrity.invalid_gtin_count !== 0 || integrity.mismatched_product_hash_count !== 0
      || !validHash || !sourceIsTraceable || !metadataIsRepresentative) {
      process.stderr.write("Catalog verification failed: active generation integrity requirements are not met.\n");
      process.exitCode = 1;
    } else {
      process.stdout.write(`Catalog verified: generation=${run.generation}; accepted=${integrity.persisted_product_count}; rejected=${run.rejected_row_count}; filtered=${run.filtered_row_count}; duplicates=${run.duplicate_row_count}; provider=${run.source_provider}; schema=${run.source_schema_version}\n`);
    }
  }
}
