import { readFile } from "node:fs/promises";

const CONFIG_PATH = new URL("../../config/agent-company.json", import.meta.url);
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
const REQUIRED_FORBIDDEN_ACTIONS = [
  "legal-filing",
  "tax-filing",
  "evidence-deletion",
  "medical-judgment",
  "food-safe-declaration",
  "irreversible-company-action",
];
const LEGACY_EXECUTIVE_IDS = new Set(["chief-of-staff", "chief_of_staff", "master-agent", "super-agent"]);

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

export function validateCompanyConfig(config) {
  if (config?.schemaVersion !== 1) fail("schemaVersion must be 1");
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
  for (const department of config.departments) {
    if (!executiveIds.has(department.executive)) fail(`${department.id} references unknown executive ${department.executive}`);
    if (!Array.isArray(department.teams) || department.teams.length === 0) fail(`${department.id} must contain teams`);
    if (new Set(department.teams).size !== department.teams.length) fail(`${department.id} contains duplicate teams`);
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
  if (!Array.isArray(config?.assurance?.agents) || config.assurance.agents.length < 5) fail("assurance agents are incomplete");

  const capabilityIds = uniqueIds(config.capabilities, "capabilities");
  requireMembers(capabilityIds, ["github", "supabase", "vercel", "data-analytics", "sales"], "capabilities");
  for (const capability of config.capabilities) {
    if (!departmentIds.has(capability.owner)) fail(`${capability.id} references unknown owner ${capability.owner}`);
  }

  if (!Array.isArray(config.workItemStates) || !config.workItemStates.includes("CAPACITY_EXCEPTION_PENDING")) {
    fail("workItemStates must include CAPACITY_EXCEPTION_PENDING");
  }

  const forbidden = new Set(config.forbiddenAutonomousActions ?? []);
  requireMembers(forbidden, REQUIRED_FORBIDDEN_ACTIONS, "forbiddenAutonomousActions");
  return config;
}

export async function loadAndValidateCompanyConfig() {
  const source = await readFile(CONFIG_PATH, "utf8");
  return validateCompanyConfig(JSON.parse(source));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await loadAndValidateCompanyConfig();
  console.log("FoodOS company agent registry: PASS");
}
