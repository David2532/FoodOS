import { fileURLToPath } from "node:url";
import { getScope, listScopes } from "./scopes.mjs";

const yesNo = (value) => (value ? "possible" : "not normally required");
const lines = (title, values) => [title, ...values.map((value) => `  - ${value}`)];

export function formatScopeContext(name) {
  const scope = getScope(name);
  return [
    `Scope: ${name}`,
    `Risk: ${scope.risk}`,
    ...lines("Read first:", scope.docs),
    ...lines("Implementation paths:", scope.code),
    ...lines("Relevant tests:", scope.tests),
    ...lines("Targeted checks:", scope.checks),
    "Conditional gates:",
    `  - Migration/RLS: ${yesNo(scope.gates.migrationOrRls)}`,
    `  - UI E2E: ${yesNo(scope.gates.uiE2e)}`,
    `  - Production build: ${yesNo(scope.gates.productionBuild)}`,
    ...lines("Run full verify when:", scope.fullVerifyWhen),
  ].join("\n");
}

export function runContextCli(args, io = console) {
  if (args.length === 1 && args[0] === "--list") {
    io.log(listScopes().join("\n"));
    return 0;
  }
  if (args.length !== 1) {
    io.error("Usage: npm run agent:context -- <scope> | --list");
    return 1;
  }
  try {
    io.log(formatScopeContext(args[0]));
    return 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runContextCli(process.argv.slice(2));
}
