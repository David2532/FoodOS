import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const normalize = (file) => file.replaceAll("\\", "/").replace(/^\.\//, "");
const isMarkdown = (file) => /\.mdx?$/i.test(file);
const isSource = (file) => /^(?:src|scripts)\//.test(file);
const isAuth = (file) => /(?:^|\/)(?:auth|e2e-auth)(?:\/|-)|(?:mfa|aal2|session|password)/i.test(file);
const isCatalog = (file) => /(?:catalog|open-food-facts|product-cache)/i.test(file);
const isUi = (file) => /^(?:src\/(?:app|components|features)\/)/.test(file);
const isDomain = (file) => /^src\/(?:domain|lib|contracts)\//.test(file);
const isDatabase = (file) => /^supabase\/(?:migrations|tests)\//.test(file);
const isE2e = (file) => /^(?:e2e|e2e-auth)\//.test(file);
const isAgentGovernance = (file) =>
  file === "AGENTS.md" ||
  file === "config/agent-company.json" ||
  file === ".codex/config.toml" ||
  /^\.codex\/agents\/[^/]+\.toml$/.test(file) ||
  /^\.agents\/skills\/[^/]+\//.test(file) ||
  /^docs\/agent\/(?:COMPANY_AGENT_OPERATING_MODEL|WORKER_EXECUTION_CONTRACT|UI_AND_ASSET_AGENT_CONTRACT|CODEX_EXECUTION_PLAYBOOK|CODEX_UI_AGENT_ARCHITECTURE|V1_TO_V2_MIGRATION)\.md$/.test(file) ||
  /^scripts\/agent\/(?:validate-company-config|agent-company\.test)\.mjs$/.test(file);
const isCentralBuild = (file) =>
  /^(?:package(?:-lock)?\.json|next\.config\.[cm]?[jt]s|tsconfig\.json|vercel\.json)$/.test(file) ||
  /^src\/app\/(?:layout\.[jt]sx|globals\.css)$/.test(file);
const isSecurityCriticalUnknown = (file) =>
  /^(?:src\/app\/api|src\/infrastructure|\.github\/workflows)\//.test(file) ||
  /(?:middleware|security)/i.test(file);

const command = (id, label, program, args, requirements = []) => ({ id, label, program, args, requirements });

function addCommand(commands, next) {
  if (!commands.some((current) => current.id === next.id)) commands.push(next);
}

export function parseVerifyArgs(args) {
  let base;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--base=")) base = value.slice("--base=".length);
    else if (value === "--base" && args[index + 1]) base = args[++index];
    else throw new Error(`Unknown option: ${value}`);
  }
  if (base !== undefined && base.trim() === "") throw new Error("--base requires a non-empty Git ref");
  return { base };
}

export function buildVerificationPlan(inputFiles) {
  const files = [...new Set(inputFiles.map(normalize).filter(Boolean))].sort();
  const commands = [];
  const skipped = [];
  const markdownFiles = files.filter(isMarkdown);

  if (files.length === 0) {
    skipped.push({ id: "verification", reason: "no changed files" });
    return { files, commands, skipped };
  }

  if (markdownFiles.length > 0) {
    addCommand(commands, command("markdown", "Markdown consistency", process.execPath, ["scripts/agent/check-markdown.mjs", ...markdownFiles]));
  }

  if (files.some(isAgentGovernance)) {
    addCommand(commands, command("agent-config", "Company registry and native Codex agents", "npm", ["run", "agent:validate-company"]));
    addCommand(commands, command("agent-tests", "Agent infrastructure tests", "npm", ["run", "test:unit", "--", "scripts/agent"]));
  }

  if (files.every(isMarkdown)) {
    skipped.push({ id: "build", reason: "Markdown-only diff" });
    skipped.push({ id: "unit", reason: "Markdown-only diff" });
    return { files, commands, skipped };
  }

  if (files.some((file) => file.startsWith("scripts/agent/"))) {
    addCommand(commands, command("agent-tests", "Agent infrastructure tests", "npm", ["run", "test:unit", "--", "scripts/agent"]));
  }

  const relatedSources = files.filter((file) => isSource(file));
  if (files.some(isDomain)) {
    addCommand(commands, command("unit-related", "Related unit tests", "npm", ["run", "test:unit:changed", "--", ...relatedSources.filter((file) => /^src\//.test(file))]));
    addCommand(commands, command("typecheck", "TypeScript", "npm", ["run", "typecheck"]));
  }

  if (files.some(isUi)) {
    const uiFiles = files.filter((file) => isUi(file) && /\.[cm]?[jt]sx?$/.test(file));
    if (uiFiles.length > 0) {
      addCommand(commands, command("eslint-changed", "ESLint changed UI", "npm", ["exec", "--", "eslint", ...uiFiles]));
    }
    addCommand(commands, command("unit-related", "Related unit tests", "npm", ["run", "test:unit:changed", "--", ...relatedSources.filter((file) => /^src\//.test(file))]));
    addCommand(commands, command("typecheck", "TypeScript", "npm", ["run", "typecheck"]));
  }

  if (files.some(isCentralBuild)) {
    addCommand(commands, command("build", "Production build", "npm", ["run", "build"]));
  }

  if (files.some(isDatabase)) {
    addCommand(commands, command("db", "Database and RLS tests", "npm", ["run", "test:db"], ["supabase"]));
  }

  if (files.some(isCatalog)) {
    addCommand(commands, command("catalog-core", "Catalog core tests", "npm", [
      "run", "test:unit", "--",
      "scripts/public-catalog-core.test.mjs",
      "src/lib/catalog-preview.test.ts",
      "src/lib/open-food-facts-search.test.ts",
      "src/lib/open-food-facts-user-agent.test.ts",
      "src/lib/open-food-facts.test.ts",
      "src/lib/product-cache.test.ts",
    ]));
    addCommand(commands, command("catalog-verify", "Catalog verification", "npm", ["run", "catalog:verify"], ["catalog-env"]));
  }

  if (files.some(isAuth)) {
    addCommand(commands, command("unit-related", "Related unit tests", "npm", ["run", "test:unit:changed", "--", ...relatedSources.filter((file) => /^src\//.test(file))]));
    addCommand(commands, command("typecheck", "TypeScript", "npm", ["run", "typecheck"]));
    addCommand(commands, command("db", "Database and RLS tests", "npm", ["run", "test:db"], ["supabase"]));
    addCommand(commands, command("auth-e2e", "Authenticated E2E", "npm", ["run", "test:e2e:auth"], ["supabase", "browser"]));
  } else if (files.some(isE2e)) {
    addCommand(commands, command("e2e", "UI E2E", "npm", ["run", "test:e2e"], ["browser"]));
  }

  const known = (file) =>
    isMarkdown(file) || isDomain(file) || isUi(file) || isDatabase(file) || isE2e(file) ||
    isCatalog(file) || isAgentGovernance(file) || isCentralBuild(file) ||
    file.startsWith("scripts/agent/") || file === "package.json";
  const unknownCode = files.filter((file) => !known(file) && /\.(?:[cm]?[jt]sx?|sql|json|ya?ml)$/i.test(file));

  if (unknownCode.some(isSecurityCriticalUnknown)) {
    addCommand(commands, command("full-verify", "Broad verification for security-critical files", "npm", ["run", "verify:full"]));
  } else if (unknownCode.length > 0) {
    addCommand(commands, command("unit", "Unit tests for unmapped code", "npm", ["run", "test:unit"]));
    addCommand(commands, command("typecheck", "TypeScript", "npm", ["run", "typecheck"]));
  }

  if (commands.length === 0) {
    addCommand(commands, command("full-verify", "Broad verification for unmapped change", "npm", ["run", "verify:full"]));
  }

  return { files, commands, skipped };
}

const successful = (result) => result && result.status === 0;
const output = (result) => String(result?.stdout ?? "").trim();

export function resolveComparisonBase({ explicitBase, env = process.env, git, gh }) {
  const verify = (ref) => git(["rev-parse", "--verify", `${ref}^{commit}`]);

  if (explicitBase) {
    const resolved = verify(explicitBase);
    if (!successful(resolved)) throw new Error(`Explicit base ref is invalid: ${explicitBase}`);
    return { ref: explicitBase, sha: output(resolved), strategy: "explicit --base" };
  }

  let baseBranch = env.GITHUB_BASE_REF?.trim();
  let baseSource = baseBranch ? "GITHUB_BASE_REF" : undefined;
  if (!baseBranch && gh) {
    const currentPr = gh(["pr", "view", "--json", "baseRefName", "--jq", ".baseRefName"]);
    if (successful(currentPr) && output(currentPr)) {
      baseBranch = output(currentPr);
      baseSource = "current PR";
    }
  }

  if (baseBranch) {
    for (const candidate of [`refs/remotes/origin/${baseBranch}`, baseBranch]) {
      if (!successful(verify(candidate))) continue;
      const mergeBase = git(["merge-base", "HEAD", candidate]);
      if (successful(mergeBase) && output(mergeBase)) {
        return { ref: candidate, sha: output(mergeBase), strategy: `merge-base with ${baseSource}` };
      }
    }
  }

  const fallback = verify("HEAD~1");
  if (!successful(fallback)) throw new Error("No explicit/PR base and HEAD~1 is unavailable");
  return { ref: "HEAD~1", sha: output(fallback), strategy: "explicitly reported HEAD~1 fallback" };
}

export function collectChangedFiles(baseSha, git) {
  const calls = [
    ["diff", "--name-only", "--diff-filter=ACMR", baseSha, "HEAD"],
    ["diff", "--name-only", "--diff-filter=ACMR"],
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const files = new Set();
  for (const args of calls) {
    const result = git(args);
    if (!successful(result)) throw new Error(`git ${args.join(" ")} failed`);
    for (const file of output(result).split(/\r?\n/).filter(Boolean)) files.add(normalize(file));
  }
  return [...files].sort();
}

function defaultRun(program, args, cwd) {
  if (program === "npm" && process.env.npm_execpath) {
    return spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, encoding: "utf8", env: process.env });
  }
  return spawnSync(program, args, { cwd, encoding: "utf8", env: process.env });
}

function defaultRequirement(requirement, cwd) {
  if (requirement === "catalog-env") {
    return Boolean(process.env.SUPABASE_URL
      && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  }
  if (requirement === "browser") {
    const probe = spawnSync(process.execPath, ["-e", "const fs=require('node:fs');const {chromium}=require('@playwright/test');process.exit(fs.existsSync(chromium.executablePath())?0:1)"], { cwd });
    return probe.status === 0;
  }
  if (requirement === "supabase") {
    const probe = defaultRun("npm", ["exec", "--", "supabase", "status", "-o", "json"], cwd);
    return probe.status === 0;
  }
  return false;
}

const requirementReason = {
  "catalog-env": "server-only catalog verification environment is unavailable",
  browser: "Playwright browser is unavailable",
  supabase: "local Supabase stack is unavailable",
};

export function executeVerificationPlan(plan, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const write = options.write ?? ((line) => console.log(line));
  const run = options.run ?? ((program, args) => defaultRun(program, args, cwd));
  const check = options.checkRequirement ?? ((requirement) => defaultRequirement(requirement, cwd));
  let failed = false;
  let blocked = false;

  for (const item of plan.skipped) write(`SKIPPED ${item.id}: ${item.reason}`);
  for (const item of plan.commands) {
    const missing = item.requirements.find((requirement) => !check(requirement));
    if (missing) {
      blocked = true;
      write(`BLOCKED ${item.id}: ${requirementReason[missing] ?? `${missing} is unavailable`}`);
      continue;
    }
    const result = run(item.program, item.args);
    if (result?.status === 0) {
      write(`PASS ${item.id}: ${item.label}`);
      continue;
    }
    failed = true;
    write(`FAIL ${item.id}: ${item.label} exited with ${result?.status ?? "no status"}`);
    const detail = `${result?.error?.message ?? ""}\n${result?.stderr ?? ""}\n${result?.stdout ?? ""}`.trim().split(/\r?\n/).filter(Boolean).slice(-6);
    for (const line of detail) write(`FAIL ${item.id} detail: ${line}`);
  }
  return failed ? 1 : blocked ? 2 : 0;
}

function processRunner(program, cwd) {
  return (args) => spawnSync(program, args, { cwd, encoding: "utf8", env: process.env });
}

export function runVerifyChangedCli(args, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const write = options.write ?? ((line) => console.log(line));
  let parsed;
  try {
    parsed = parseVerifyArgs(args);
    const git = options.git ?? processRunner("git", cwd);
    const gh = options.gh ?? processRunner("gh", cwd);
    const base = resolveComparisonBase({ explicitBase: parsed.base, env: options.env, git, gh });
    const files = collectChangedFiles(base.sha, git);
    write(`NOT_RUN context: ${base.strategy}; ${base.ref}; ${files.length} changed file(s)`);
    return executeVerificationPlan(buildVerificationPlan(files), { ...options, cwd, write });
  } catch (error) {
    write(`FAIL setup: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  process.exitCode = runVerifyChangedCli(process.argv.slice(2));
}
