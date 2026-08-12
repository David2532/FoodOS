import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = new URL("../../", import.meta.url);
const CONFIG_PATH = new URL("config/agent-company.json", REPO_ROOT);
const CODEX_CONFIG_PATH = new URL(".codex/config.toml", REPO_ROOT);
const CODEX_AGENTS_PATH = new URL(".codex/agents/", REPO_ROOT);
const REPO_SKILLS_PATH = new URL(".agents/skills/", REPO_ROOT);

const REQUIRED_EXECUTIVES = [
  "ai-ceo",
  "orchestrator",
  "cpo",
  "cto",
  "coo",
  "cfo",
  "cmo",
  "cro",
  "cdao",
  "ciso",
  "clo",
];
const REQUIRED_DEPARTMENTS = [
  "product",
  "engineering",
  "operations",
  "finance",
  "marketing",
  "sales-partnerships",
  "data-analytics-research",
  "security-reliability",
  "legal-ip-compliance",
];
const REQUIRED_AUTHORITY = ["A0", "A1", "A2", "A3"];
const REQUIRED_CAPACITY = ["C0", "C1", "C2", "C3"];
const REQUIRED_CAPABILITIES = [
  "github",
  "supabase",
  "vercel",
  "data-analytics",
  "sales",
  "ui-design",
  "image-generation",
  "vector-asset-production",
];
const REQUIRED_ASSET_STATES = [
  "BRIEF",
  "CONCEPT",
  "RECONSTRUCTED",
  "INTEGRATED",
  "VERIFIED",
  "REJECTED",
  "BLOCKED",
];
const REQUIRED_FORBIDDEN_ACTIONS = [
  "legal-filing",
  "tax-filing",
  "evidence-deletion",
  "medical-judgment",
  "food-safe-declaration",
  "irreversible-company-action",
  "trademark-clearance-claim",
  "unreviewed-generated-asset-release",
];
const REQUIRED_DEPARTMENT_TEAMS = {
  product: ["product-experience-direction", "ux-flow", "ui-system", "accessibility-visual-qa"],
  engineering: ["frontend-integration", "visual-integration-qa"],
  marketing: ["brand-direction", "asset-art-direction", "image-generation", "vector-reconstruction", "asset-production"],
};
const LEGACY_EXECUTIVE_IDS = new Set(["chief-of-staff", "chief_of_staff", "master-agent", "super-agent"]);
const REQUIRED_NATIVE_AGENTS = [
  { name: "ui_explorer", sandbox: "read-only" },
  { name: "design_reference_researcher", sandbox: "read-only" },
  { name: "ux_flow_designer", sandbox: "read-only" },
  { name: "ui_system_architect", sandbox: "read-only" },
  { name: "ui_implementer", sandbox: "workspace-write" },
  { name: "visual_verifier", sandbox: "workspace-write" },
  { name: "asset_art_director", sandbox: "read-only" },
  { name: "image_concept_artist", sandbox: "workspace-write" },
  { name: "asset_producer", sandbox: "workspace-write" },
];
const REQUIRED_SKILLS = [
  "foodos-ui-flow-spec",
  "foodos-ui-implementation",
  "foodos-visual-qa",
  "foodos-asset-production",
];
const ALLOWED_SANDBOX_MODES = new Set(["read-only", "workspace-write"]);

function fail(message) {
  throw new Error(`Invalid FoodOS company agent registry: ${message}`);
}

function uniqueIds(entries, label) {
  if (!Array.isArray(entries) || entries.length === 0) fail(`${label} must be a non-empty array`);
  const ids = entries.map((entry) => entry?.id);
  if (ids.some((id) => typeof id !== "string" || id.length === 0)) fail(`${label} contains an invalid id`);
  if (new Set(ids).size !== ids.length) fail(`${label} contains duplicate ids`);
  return new Set(ids);
}

function requireMembers(actual, required, label) {
  for (const id of required) {
    if (!actual.has(id)) fail(`${label} is missing ${id}`);
  }
}

function tomlString(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`^\\s*${escaped}\\s*=\\s*"([^"]+)"\\s*$`, "m"))?.[1];
}

function tomlMultiline(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*=\\s*"""([\\s\\S]*?)"""`, "m"))?.[1]?.trim();
}

function parseSkillFrontmatter(source, expectedName) {
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) fail(`skill ${expectedName} is missing YAML frontmatter`);
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) fail(`skill ${expectedName} has an unterminated YAML frontmatter block`);
  const frontmatter = normalized.slice(4, end);
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  if (name !== expectedName) fail(`skill directory ${expectedName} declares name ${name ?? "<missing>"}`);
  if (!description || description.length < 60 || !/^Use\s+(?:when|after|for)\b/i.test(description)) {
    fail(`skill ${expectedName} needs a concise trigger-first description`);
  }
  if (normalized.split("\n").length > 500) fail(`skill ${expectedName} exceeds the 500-line budget`);
  if (normalized.slice(end + 5).trim().length < 250) fail(`skill ${expectedName} instructions are incomplete`);
  return { name, description };
}

export function validateCompanyConfig(config) {
  if (config?.schemaVersion !== 2) fail("schemaVersion must be 2");
  if (config?.principles?.separationOfDuties !== true) fail("separationOfDuties must stay enabled");
  if (config?.principles?.selfApprovalForbidden !== true) fail("selfApprovalForbidden must stay enabled");
  if (config?.principles?.missingEvidenceNeverPasses !== true) fail("missingEvidenceNeverPasses must stay enabled");
  if (config?.principles?.featureScopeProtectedFromSoftLimits !== true) fail("featureScopeProtectedFromSoftLimits must stay enabled");
  if (config?.principles?.productionWritesDefaultDenied !== true) fail("productionWritesDefaultDenied must stay enabled");

  const executiveIds = uniqueIds(config.executives, "executives");
  requireMembers(executiveIds, REQUIRED_EXECUTIVES, "executives");
  for (const id of executiveIds) {
    if (LEGACY_EXECUTIVE_IDS.has(id)) fail(`legacy executive id ${id} is forbidden`);
  }

  const orchestrator = config.executives.find((entry) => entry.id === "orchestrator");
  if (orchestrator?.reportsTo !== "ai-ceo") fail("orchestrator must report to ai-ceo");
  if (orchestrator?.mayApproveOwnWork !== false) fail("orchestrator may not approve its own work");
  if (orchestrator?.normallyImplementsProductCode !== false) fail("orchestrator must remain a coordination role");

  for (const executive of config.executives) {
    if (executive.id !== "ai-ceo" && executive.reportsTo && !executiveIds.has(executive.reportsTo)) {
      fail(`${executive.id} reports to unknown executive ${executive.reportsTo}`);
    }
  }

  const departmentIds = uniqueIds(config.departments, "departments");
  requireMembers(departmentIds, REQUIRED_DEPARTMENTS, "departments");
  const allTeams = new Set();
  for (const department of config.departments) {
    if (!executiveIds.has(department.executive)) fail(`${department.id} references unknown executive ${department.executive}`);
    if (!Array.isArray(department.teams) || department.teams.length === 0) fail(`${department.id} must contain teams`);
    if (new Set(department.teams).size !== department.teams.length) fail(`${department.id} contains duplicate teams`);
    for (const team of department.teams) {
      if (allTeams.has(team)) fail(`team ${team} is assigned to more than one department`);
      allTeams.add(team);
    }
    requireMembers(new Set(department.teams), REQUIRED_DEPARTMENT_TEAMS[department.id] ?? [], `${department.id} teams`);
  }

  const authorityIds = uniqueIds(config.authorityLevels, "authorityLevels");
  requireMembers(authorityIds, REQUIRED_AUTHORITY, "authorityLevels");
  const a3 = config.authorityLevels.find((entry) => entry.id === "A3");
  if (a3?.requiresHumanApproval !== true) fail("A3 must require human approval");

  const capacityIds = uniqueIds(config.capacityClasses, "capacityClasses");
  requireMembers(capacityIds, REQUIRED_CAPACITY, "capacityClasses");
  for (const protectedClass of ["C0", "C1"]) {
    const entry = config.capacityClasses.find((candidate) => candidate.id === protectedClass);
    if (entry?.softLimitMayStop !== false) fail(`${protectedClass} must not be stopped by a soft limit`);
  }

  if (config?.assurance?.reportsToHumanOwner !== true) fail("assurance must retain its independent route to the human owner");
  if (!Array.isArray(config?.assurance?.agents) || config.assurance.agents.length < 8) fail("assurance agents are incomplete");
  if (!config.assurance.agents.includes("accessibility-visual-auditor")) fail("assurance is missing accessibility-visual-auditor");

  const capabilityIds = uniqueIds(config.capabilities, "capabilities");
  requireMembers(capabilityIds, REQUIRED_CAPABILITIES, "capabilities");
  for (const capability of config.capabilities) {
    if (!departmentIds.has(capability.owner)) fail(`${capability.id} references unknown owner ${capability.owner}`);
  }

  if (!Array.isArray(config.workItemStates) || !config.workItemStates.includes("CAPACITY_EXCEPTION_PENDING")) {
    fail("workItemStates must include CAPACITY_EXCEPTION_PENDING");
  }

  const assetStates = new Set(config.assetStates ?? []);
  requireMembers(assetStates, REQUIRED_ASSET_STATES, "assetStates");

  const forbidden = new Set(config.forbiddenAutonomousActions ?? []);
  requireMembers(forbidden, REQUIRED_FORBIDDEN_ACTIONS, "forbiddenAutonomousActions");
  return config;
}

export async function validateNativeAgentRuntime(options = {}) {
  const read = options.readFile ?? readFile;
  const list = options.readdir ?? readdir;
  const codexConfig = await read(CODEX_CONFIG_PATH, "utf8");
  if (!/^\s*\[agents\]\s*$/m.test(codexConfig)) fail(".codex/config.toml is missing [agents]");
  if (!/^\s*enabled\s*=\s*true\s*$/m.test(codexConfig)) fail("project subagents must stay enabled");
  const concurrency = Number(codexConfig.match(/^\s*max_concurrent_threads_per_session\s*=\s*(\d+)\s*$/m)?.[1]);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    fail("max_concurrent_threads_per_session must stay between 1 and 4");
  }

  const expectedAgents = new Map(REQUIRED_NATIVE_AGENTS.map((agent) => [agent.name, agent]));
  const agentFiles = (await list(CODEX_AGENTS_PATH, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".toml"))
    .map((entry) => entry.name)
    .sort();
  if (agentFiles.length === 0) fail(".codex/agents contains no custom agents");

  const agentNames = new Set();
  for (const filename of agentFiles) {
    const source = await read(new URL(filename, CODEX_AGENTS_PATH), "utf8");
    const name = tomlString(source, "name");
    const description = tomlString(source, "description");
    const sandbox = tomlString(source, "sandbox_mode");
    const instructions = tomlMultiline(source, "developer_instructions");
    if (!name) fail(`custom agent file ${filename} is missing name`);
    if (agentNames.has(name)) fail(`custom agent name ${name} is duplicated`);
    agentNames.add(name);
    if (!description || description.length < 70) fail(`custom agent ${name} has an incomplete description`);
    if (!ALLOWED_SANDBOX_MODES.has(sandbox)) fail(`custom agent ${name} has unsupported sandbox ${sandbox ?? "<missing>"}`);
    const expected = expectedAgents.get(name);
    if (expected && sandbox !== expected.sandbox) fail(`custom agent ${name} must use sandbox ${expected.sandbox}`);
    if (!instructions || instructions.length < 300 || !/FoodOS/i.test(instructions)) {
      fail(`custom agent ${name} has incomplete FoodOS developer instructions`);
    }
    if ([...LEGACY_EXECUTIVE_IDS].some((legacy) => name.includes(legacy))) fail(`custom agent ${name} uses a legacy super-agent identity`);
  }
  requireMembers(agentNames, REQUIRED_NATIVE_AGENTS.map((agent) => agent.name), "native custom agents");

  const skillDirectories = (await list(REPO_SKILLS_PATH, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (skillDirectories.length === 0) fail(".agents/skills contains no repo skills");

  const skillNames = new Set();
  for (const directory of skillDirectories) {
    const source = await read(new URL(`${directory}/SKILL.md`, REPO_SKILLS_PATH), "utf8");
    const skill = parseSkillFrontmatter(source, directory);
    if (skillNames.has(skill.name)) fail(`skill ${skill.name} is duplicated`);
    skillNames.add(skill.name);
  }
  requireMembers(skillNames, REQUIRED_SKILLS, "repo skills");

  return { concurrency, agents: [...agentNames].sort(), skills: [...skillNames].sort() };
}

export async function loadAndValidateCompanyConfig(options = {}) {
  const read = options.readFile ?? readFile;
  const source = await read(CONFIG_PATH, "utf8");
  const config = validateCompanyConfig(JSON.parse(source));
  await validateNativeAgentRuntime({ readFile: read, readdir: options.readdir });
  return config;
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  await loadAndValidateCompanyConfig();
  console.log("FoodOS company agent registry and native Codex runtime: PASS");
}
