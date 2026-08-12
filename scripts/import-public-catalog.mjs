#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable, Transform } from "node:stream";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import { catalogServerConfiguration } from "./catalog-environment.mjs";
import { catalogRowForInsert, normalizePublicCatalogProduct } from "./public-catalog-core.mjs";

const DEFAULT_SOURCE = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";
const BATCH_SIZE = 250;
const PROGRESS_INTERVAL = 1_000;
const MINIMUM_ACCEPTED = 25_000;
const MINIMUM_REMOTE_SOURCE_BYTES = 1_000_000_000;
const MINIMUM_ACCEPTANCE_RATIO = 0.001;
const MINIMUM_METADATA_SAMPLES = 100;
const MAX_LINE_BYTES = 512 * 1024;
const HEADER_TIMEOUT_MS = 30_000;
const IMPORT_RUN_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const OFFICIAL_SOURCE_HOSTS = new Set([
  "static.openfoodfacts.org",
  "world.openfoodfacts.org",
  "openfoodfacts-ds.s3.eu-west-3.amazonaws.com"
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function loadLocalEnvironment() {
  const environmentFile = resolve(".env.local");
  if (!existsSync(environmentFile)) return;
  for (const line of readFileSync(environmentFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
    process.env[match[1]] = value;
  }
}

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}

function positiveInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < MINIMUM_ACCEPTED) throw fail("invalid-minimum-accepted");
  return parsed;
}

function minimumAcceptanceRatio(value) {
  if (!value) return MINIMUM_ACCEPTANCE_RATIO;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < MINIMUM_ACCEPTANCE_RATIO || parsed > 1) {
    throw fail("invalid-minimum-acceptance-ratio");
  }
  return parsed;
}

function expectedLocalSourceDigest(source) {
  if (source.isRemote) return undefined;
  const digest = process.env.PUBLIC_CATALOG_LOCAL_SOURCE_SHA256?.trim().toLowerCase();
  if (!digest || !/^[a-f0-9]{64}$/.test(digest)) throw fail("catalog-local-source-digest-required");
  return digest;
}

export function sourceDescriptor(input) {
  const source = input ?? DEFAULT_SOURCE;
  if (/^https:/i.test(source)) {
    const url = new URL(source);
    if (!OFFICIAL_SOURCE_HOSTS.has(url.hostname)) throw fail("unapproved-source-host");
    if (!/\.jsonl(?:\.gz)?$/i.test(url.pathname)) throw fail("source-must-be-jsonl");
    return { value: url.toString(), isRemote: true, compressed: /\.gz$/i.test(url.pathname) };
  }
  const file = resolve(source);
  if (!existsSync(file) || !/\.jsonl(?:\.gz)?$/i.test(file)) throw fail("source-file-must-be-jsonl");
  return { value: file, isRemote: false, compressed: /\.gz$/i.test(file), contentLength: statSync(file).size };
}

function clientFromEnvironment() {
  const { url, credential } = catalogServerConfiguration();
  if (!url || !credential) throw fail("catalog-import-credentials-missing");
  return createClient(url, credential, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function catalogUserAgent() {
  const value = process.env.OPEN_FOOD_FACTS_USER_AGENT?.trim();
  const contact = "(?:[^\\s()]+@[^\\s()]+|\\+?https:\\/\\/[^\\s()]+)";
  if (!value || !new RegExp(`^[^/\\s]+/[^\\s]+\\s+\\(${contact}\\)$`).test(value)) {
    throw fail("catalog-user-agent-required");
  }
  return value;
}

async function fetchHeaders(url, headers, abortSignal, redirect) {
  const requestAbort = new AbortController();
  const abortRequest = () => requestAbort.abort();
  const timer = setTimeout(abortRequest, HEADER_TIMEOUT_MS);
  abortSignal.addEventListener("abort", abortRequest, { once: true });
  try {
    return await fetch(url, { headers, signal: requestAbort.signal, redirect });
  } catch (error) {
    if (requestAbort.signal.aborted) throw fail(abortSignal.aborted ? "catalog-import-interrupted" : "catalog-source-header-timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    abortSignal.removeEventListener("abort", abortRequest);
  }
}

function responseContentLength(response) {
  const value = Number(response.headers.get("content-length"));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export async function sourceStream(source, abortSignal, userAgent) {
  if (!source.isRemote) {
    return {
      stream: createReadStream(source.value),
      compressed: source.compressed,
      sourceRevision: undefined,
      contentLength: source.contentLength
    };
  }
  const headers = { "User-Agent": userAgent };
  let response = await fetchHeaders(source.value, headers, abortSignal, "manual");
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw fail("catalog-source-redirect-missing");
    const redirected = new URL(location, source.value);
    if (redirected.protocol !== "https:" || !OFFICIAL_SOURCE_HOSTS.has(redirected.hostname)) throw fail("catalog-source-redirect-unapproved");
    await response.body?.cancel();
    response = await fetchHeaders(redirected, headers, abortSignal, "error");
  }
  if (!response.ok || !response.body) throw fail("catalog-source-unavailable");
  return {
    stream: Readable.fromWeb(response.body),
    compressed: source.compressed && response.headers.get("content-encoding")?.toLowerCase() !== "gzip",
    sourceRevision: response.headers.get("etag")?.replaceAll('"', "").slice(0, 128) ?? undefined,
    contentLength: responseContentLength(response)
  };
}

function digestingStream(stream, digest) {
  const tap = new Transform({
    transform(chunk, _encoding, callback) {
      digest.update(chunk);
      callback(null, chunk);
    }
  });
  return stream.pipe(tap);
}

function lineLimitStream() {
  let lineLength = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      for (const byte of chunk) {
        if (byte === 10) {
          lineLength = 0;
        } else {
          lineLength += 1;
          if (lineLength > MAX_LINE_BYTES) {
            callback(fail("catalog-line-too-large"));
            return;
          }
        }
      }
      callback(null, chunk);
    }
  });
}

export function readLines(stream, compressed) {
  const input = compressed ? stream.pipe(createGunzip()) : stream;
  return createInterface({ input: input.pipe(lineLimitStream()), crlfDelay: Infinity });
}

async function updateRun(supabase, runId, values) {
  const { error } = await supabase.from("product_catalog_import_runs").update(values).eq("id", runId);
  if (error) throw fail("catalog-import-run-update-failed");
}

export function parseCapacityResult(value) {
  if (!value || typeof value !== "object"
    || !Number.isSafeInteger(value.database_size_bytes)
    || !Number.isSafeInteger(value.soft_limit_bytes)
    || !Number.isSafeInteger(value.hard_limit_bytes)
    || value.database_size_bytes < 0
    || value.soft_limit_bytes <= 0
    || value.hard_limit_bytes <= value.soft_limit_bytes
    || typeof value.can_write !== "boolean"
    || value.can_write !== (value.database_size_bytes < value.soft_limit_bytes)) {
    throw fail("catalog-capacity-result-invalid");
  }
  return value;
}

async function ensureCapacity(supabase) {
  const { data, error } = await supabase.rpc("product_catalog_import_capacity").single();
  if (error) throw fail("catalog-capacity-check-failed");
  const capacity = parseCapacityResult(data);
  if (!capacity.can_write) throw fail("catalog-storage-soft-limit-reached");
  return capacity;
}

async function insertBatch(supabase, runId, batch) {
  if (!batch.length) return;
  await ensureCapacity(supabase);
  const { error } = await supabase.from("product_catalog_products").upsert(
    batch.map((product) => catalogRowForInsert(product, runId)),
    { onConflict: "import_run_id,gtin" }
  );
  if (error) throw fail("catalog-import-batch-write-failed");
}

async function markFailed(supabase, runId, code) {
  if (!runId) return;
  const { error } = await supabase.from("product_catalog_import_runs")
    .update({ status: "failed", failed_at: new Date().toISOString(), failure_code: code.slice(0, 120) })
    .eq("id", runId);
  if (error) throw fail("catalog-import-failure-status-unknown");
}

async function leaveResumable(supabase, runId, code) {
  if (!runId) return;
  await updateRun(supabase, runId, {
    last_interrupted_at: new Date().toISOString(),
    last_progress_at: new Date().toISOString(),
    failure_code: code.slice(0, 120)
  });
}

async function createStagingRun(supabase, source) {
  const { data, error } = await supabase.from("product_catalog_import_runs").insert({
    source_provider: "open-food-facts",
    source_dataset_url: source.isRemote ? source.value : `file://${basename(source.value)}`,
    source_schema_version: "off-jsonl-v3.6-compatible",
    source_retrieved_at: new Date().toISOString(),
    database_license: "ODbL-1.0; DbCL-1.0",
    image_license: "CC-BY-SA-4.0",
    country_filter: ["de"],
    status: "staging"
  }).select("id").single();
  if (error || !data?.id) throw fail("catalog-staging-run-create-failed");
  return data.id;
}

async function loadStagingRun(supabase, runId, source) {
  if (!IMPORT_RUN_ID_PATTERN.test(runId)) throw fail("catalog-resume-run-invalid");
  const { data, error } = await supabase.from("product_catalog_import_runs")
    .select("id, status, source_dataset_url, source_schema_version, source_revision, attempted_row_count, accepted_product_count, rejected_row_count, filtered_row_count, duplicate_row_count, candidate_row_count, ingestion_completed_at, seal_cursor_gtin, resume_count")
    .eq("id", runId)
    .single();
  if (error || !data) throw fail("catalog-resume-run-not-found");
  const expectedSource = source.isRemote ? source.value : `file://${basename(source.value)}`;
  if (data.status !== "staging"
    || data.source_dataset_url !== expectedSource
    || data.source_schema_version !== "off-jsonl-v3.6-compatible") {
    throw fail("catalog-resume-run-incompatible");
  }
  if (!Number.isSafeInteger(data.resume_count) || data.resume_count < 0) throw fail("catalog-resume-run-invalid");
  await updateRun(supabase, runId, {
    resume_count: data.resume_count + 1,
    last_progress_at: new Date().toISOString(),
    last_interrupted_at: null,
    failure_code: null
  });
  return data;
}

function parseIngestionCheckpoint(value) {
  if (!value || typeof value !== "object"
    || !Number.isSafeInteger(value.persisted_product_count)
    || !Number.isSafeInteger(value.duplicate_row_count)
    || value.persisted_product_count < 0
    || value.duplicate_row_count < 0) {
    throw fail("catalog-ingestion-checkpoint-invalid");
  }
  return value;
}

async function checkpointIngestion(supabase, runId, counters, sourceRevision) {
  const { data, error } = await supabase.rpc("checkpoint_product_catalog_ingestion", {
    target_import_run_id: runId,
    target_attempted_row_count: counters.attempted,
    target_rejected_row_count: counters.rejected,
    target_filtered_row_count: counters.filtered,
    target_candidate_row_count: counters.candidates,
    target_source_revision: sourceRevision
  }).single();
  if (error) throw fail("catalog-ingestion-checkpoint-failed");
  return parseIngestionCheckpoint(data);
}

export async function activateProductCatalogImport(supabase, runId) {
  const { error } = await supabase.rpc("activate_product_catalog_import", { target_import_run_id: runId });
  if (error) throw fail("catalog-activation-failed");
}

export function parseSealBatchResult(value) {
  if (!value || typeof value !== "object"
    || !Number.isSafeInteger(value.sealed_product_count)
    || value.sealed_product_count < 0
    || typeof value.is_complete !== "boolean") {
    throw fail("catalog-import-seal-invalid");
  }
  return value;
}

async function sealProductCatalogImport(supabase, runId) {
  let sealedProductCount = 0;
  for (let batchIndex = 0; batchIndex < 100_000; batchIndex += 1) {
    const { data, error } = await supabase
      .rpc("seal_product_catalog_import_batch", { target_import_run_id: runId })
      .single();
    if (error) throw fail("catalog-import-seal-failed");
    const batch = parseSealBatchResult(data);
    sealedProductCount += batch.sealed_product_count;
    if (!Number.isSafeInteger(sealedProductCount)) throw fail("catalog-import-seal-overflow");
    if (batch.is_complete) return sealedProductCount;
  }
  throw fail("catalog-import-seal-batch-limit");
}

async function inspectImport(supabase, runId) {
  const { data, error } = await supabase.rpc("inspect_product_catalog_import", { target_import_run_id: runId }).single();
  if (error || !data || typeof data !== "object") throw fail("catalog-import-integrity-inspection-failed");
  const record = data;
  const fields = [
    "persisted_product_count",
    "invalid_gtin_count",
    "mismatched_product_hash_count",
    "nutrition_evidence_count",
    "ingredients_evidence_count",
    "allergen_evidence_count",
    "provenance_evidence_count"
  ];
  if (fields.some((field) => !Number.isSafeInteger(record[field]) || record[field] < 0)
    || typeof record.normalized_content_sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(record.normalized_content_sha256)) {
    throw fail("catalog-import-integrity-inspection-invalid");
  }
  return record;
}

export function assertIntegrity(integrity, { attempted, rejected, filtered, candidates, minimumAccepted, minimumRatio }) {
  const persisted = integrity.persisted_product_count;
  const duplicates = candidates - persisted;
  if (!Number.isSafeInteger(duplicates) || duplicates < 0 || attempted !== persisted + rejected + filtered + duplicates) {
    throw fail("catalog-import-counter-integrity-failed");
  }
  if (persisted < minimumAccepted) throw fail("catalog-minimum-accepted-not-reached");
  if (persisted / attempted < minimumRatio) throw fail("catalog-acceptance-ratio-too-low");
  if (integrity.invalid_gtin_count !== 0) throw fail("catalog-invalid-gtin-persisted");
  if (integrity.mismatched_product_hash_count !== 0) throw fail("catalog-product-hash-mismatch");
  if (integrity.nutrition_evidence_count < MINIMUM_METADATA_SAMPLES
    || integrity.ingredients_evidence_count < MINIMUM_METADATA_SAMPLES
    || integrity.allergen_evidence_count < MINIMUM_METADATA_SAMPLES
    || integrity.provenance_evidence_count < MINIMUM_METADATA_SAMPLES) {
    throw fail("catalog-schema-drift-detected");
  }
  return { persisted, duplicates };
}

async function main() {
  loadLocalEnvironment();
  const source = sourceDescriptor(argument("source") ?? process.env.PUBLIC_CATALOG_DUMP_URL);
  const resumeRunId = argument("resume-run");
  const minimumAccepted = positiveInteger(argument("minimum-accepted"), MINIMUM_ACCEPTED);
  const minimumRatio = minimumAcceptanceRatio(argument("minimum-acceptance-ratio"));
  const supabase = clientFromEnvironment();
  const userAgent = source.isRemote ? catalogUserAgent() : undefined;
  const localSourceDigest = expectedLocalSourceDigest(source);
  const abort = new AbortController();
  let runId;
  let activeStream;
  let mayResume = false;
  const onInterrupt = () => {
    abort.abort();
    activeStream?.destroy();
  };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    // Credential/database validation occurs before the potentially multi-gigabyte download.
    const resumedRun = resumeRunId ? await loadStagingRun(supabase, resumeRunId, source) : undefined;
    runId = resumedRun?.id ?? await createStagingRun(supabase, source);
    mayResume = Boolean(resumedRun);

    let attempted;
    let rejected;
    let filtered;
    let candidates;
    let persisted;
    let duplicates;

    if (resumedRun?.ingestion_completed_at) {
      const storedCounters = [
        resumedRun.attempted_row_count,
        resumedRun.accepted_product_count,
        resumedRun.rejected_row_count,
        resumedRun.filtered_row_count,
        resumedRun.duplicate_row_count,
        resumedRun.candidate_row_count
      ];
      if (storedCounters.some((value) => !Number.isSafeInteger(value) || value < 0)
        || resumedRun.candidate_row_count !== resumedRun.accepted_product_count + resumedRun.duplicate_row_count
        || resumedRun.attempted_row_count !== resumedRun.rejected_row_count
          + resumedRun.filtered_row_count + resumedRun.candidate_row_count) {
        throw fail("catalog-resume-counters-invalid");
      }
      attempted = resumedRun.attempted_row_count;
      rejected = resumedRun.rejected_row_count;
      filtered = resumedRun.filtered_row_count;
      candidates = resumedRun.candidate_row_count;
      persisted = resumedRun.accepted_product_count;
      duplicates = resumedRun.duplicate_row_count;
    } else {
      const input = await sourceStream(source, abort.signal, userAgent);
      if (source.isRemote && (!input.contentLength || input.contentLength < MINIMUM_REMOTE_SOURCE_BYTES)) {
        throw fail("catalog-source-too-small");
      }
      if (resumedRun?.source_revision && input.sourceRevision !== resumedRun.source_revision) {
        throw fail("catalog-source-revision-changed");
      }
      activeStream = input.stream;
      if (input.sourceRevision) {
        await updateRun(supabase, runId, {
          source_revision: input.sourceRevision,
          last_progress_at: new Date().toISOString()
        });
      }
      const sourceDigest = createHash("sha256");
      const lines = readLines(digestingStream(input.stream, sourceDigest), input.compressed);
      attempted = 0;
      rejected = 0;
      filtered = 0;
      candidates = 0;
      let batch = [];

      try {
        for await (const line of lines) {
          if (abort.signal.aborted) throw fail("catalog-import-interrupted");
          if (!line.trim()) continue;
          attempted += 1;
          let record;
          try {
            record = JSON.parse(line);
          } catch {
            rejected += 1;
            continue;
          }
          const normalized = normalizePublicCatalogProduct(record);
          if (normalized.kind === "filtered") {
            filtered += 1;
          } else if (normalized.kind === "rejected") {
            rejected += 1;
          } else {
            batch.push(normalized.product);
            candidates += 1;
            if (batch.length >= BATCH_SIZE) {
              await insertBatch(supabase, runId, batch);
              batch = [];
            }
          }
          if (attempted % PROGRESS_INTERVAL === 0) {
            await updateRun(supabase, runId, {
              attempted_row_count: attempted,
              rejected_row_count: rejected,
              filtered_row_count: filtered,
              candidate_row_count: candidates,
              last_progress_at: new Date().toISOString()
            });
          }
        }
      } finally {
        lines.close();
        input.stream.destroy();
      }

      await insertBatch(supabase, runId, batch);
      const sourceContentSha256 = sourceDigest.digest("hex");
      if (localSourceDigest && sourceContentSha256 !== localSourceDigest) throw fail("catalog-local-source-digest-mismatch");
      const checkpoint = await checkpointIngestion(
        supabase,
        runId,
        { attempted, rejected, filtered, candidates },
        input.sourceRevision ?? sourceContentSha256
      );
      persisted = checkpoint.persisted_product_count;
      duplicates = checkpoint.duplicate_row_count;
      mayResume = true;
    }

    await sealProductCatalogImport(supabase, runId);
    const integrity = await inspectImport(supabase, runId);
    const integrityCounters = assertIntegrity(integrity, {
      attempted,
      rejected,
      filtered,
      candidates,
      minimumAccepted,
      minimumRatio
    });
    if (integrityCounters.persisted !== persisted || integrityCounters.duplicates !== duplicates) {
      throw fail("catalog-resume-integrity-mismatch");
    }
    await updateRun(supabase, runId, {
      normalized_content_sha256: integrity.normalized_content_sha256,
      last_progress_at: new Date().toISOString(),
      failure_code: null
    });
    await activateProductCatalogImport(supabase, runId);
    process.stdout.write(`Catalog import activated: accepted=${persisted}; rejected=${rejected}; filtered=${filtered}; duplicates=${duplicates}; attempted=${attempted}\n`);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "catalog-import-failed";
    let finalCode = code;
    try {
      if (mayResume || code === "catalog-import-interrupted" || code === "catalog-storage-soft-limit-reached") {
        await leaveResumable(supabase, runId, code);
      } else {
        await markFailed(supabase, runId, code);
      }
    } catch {
      finalCode = "catalog-import-failure-status-unknown";
    }
    process.stderr.write(`Catalog import failed safely: ${finalCode}\n`);
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
