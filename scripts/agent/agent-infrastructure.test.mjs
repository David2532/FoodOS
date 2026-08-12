import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatScopeContext, runContextCli } from "./agent-context.mjs";
import { checkMarkdownFiles } from "./check-markdown.mjs";
import { createMigration, validateMigrationName } from "./migration-new.mjs";
import { getScope, listScopes, validateScopes } from "./scopes.mjs";
import {
  buildVerificationPlan,
  collectChangedFiles,
  executeVerificationPlan,
  parseVerifyArgs,
  resolveComparisonBase,
} from "./verify-changed.mjs";

const temporaryDirectories = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const ids = (files) => buildVerificationPlan(files).commands.map((item) => item.id);
const result = (status, stdout = "") => ({ status, stdout, stderr: "" });

describe("scope routing", () => {
  it("validates and lists every supported scope", () => {
    expect(validateScopes()).toBeDefined();
    expect(listScopes()).toEqual([
      "account", "auth", "billing", "catalog", "database", "deployment", "inventory", "nutrition",
      "offline", "ops", "planning", "privacy", "recalls", "scan", "shopping", "ui",
    ]);
    expect(getScope("auth").risk).toBe("critical");
  });

  it("rejects an unknown scope with a non-zero CLI result", () => {
    const messages = [];
    expect(runContextCli(["unknown"], { log: (line) => messages.push(line), error: (line) => messages.push(line) })).toBe(1);
    expect(messages.join("\n")).toContain("Unknown scope");
  });

  it("prints compact paths and checks without reading file contents", () => {
    const context = formatScopeContext("catalog");
    expect(context).toContain("docs/PUBLIC_CATALOG_OPERATIONS.md");
    expect(context).toContain("npm run catalog:verify");
    expect(context.split("\n").length).toBeLessThan(35);
    expect(context).not.toContain("# FoodOS");
  });
});

describe("changed verification selection", () => {
  it("keeps Markdown-only changes away from the Next build", () => {
    const plan = buildVerificationPlan(["README.md"]);
    expect(plan.commands.map((item) => item.id)).toEqual(["markdown"]);
    expect(plan.skipped).toContainEqual({ id: "build", reason: "Markdown-only diff" });
  });

  it("selects related unit tests and typecheck for domain changes", () => {
    expect(ids(["src/domain/expiry.ts"])).toEqual(["unit-related", "typecheck"]);
  });

  it("selects database tests for migrations", () => {
    expect(ids(["supabase/migrations/20990101000000_example.sql"])).toContain("db");
  });

  it("selects auth unit, database and authenticated E2E checks", () => {
    const selected = ids(["src/features/auth/sign-in-screen.tsx"]);
    expect(selected).toEqual(expect.arrayContaining(["eslint-changed", "unit-related", "typecheck", "db", "auth-e2e"]));
  });

  it("selects a production build for central package changes", () => {
    expect(ids(["package.json"])).toContain("build");
  });

  it("reports an unavailable Supabase stack as BLOCKED and never PASS", () => {
    const plan = buildVerificationPlan(["supabase/tests/example.sql"]);
    const lines = [];
    const exitCode = executeVerificationPlan(plan, {
      write: (line) => lines.push(line),
      checkRequirement: () => false,
      run: () => {
        throw new Error("must not run");
      },
    });
    expect(exitCode).toBe(2);
    expect(lines).toContain("BLOCKED db: local Supabase stack is unavailable");
    expect(lines.some((line) => line.startsWith("PASS"))).toBe(false);
  });

  it("returns non-zero and FAIL when a selected command fails", () => {
    const lines = [];
    const exitCode = executeVerificationPlan(buildVerificationPlan(["README.md"]), {
      write: (line) => lines.push(line),
      run: () => ({ status: 3, stdout: "", stderr: "bad markdown" }),
      checkRequirement: () => true,
    });
    expect(exitCode).toBe(1);
    expect(lines.some((line) => line.startsWith("FAIL markdown"))).toBe(true);
    expect(lines.some((line) => line.startsWith("PASS markdown"))).toBe(false);
  });
});

describe("comparison base selection", () => {
  it("uses an explicit base before PR discovery", () => {
    const calls = [];
    const base = resolveComparisonBase({
      explicitBase: "release-base",
      git: (args) => {
        calls.push(args);
        return result(0, "abc123\n");
      },
      gh: () => {
        throw new Error("gh must not run");
      },
    });
    expect(base).toEqual({ ref: "release-base", sha: "abc123", strategy: "explicit --base" });
    expect(calls).toHaveLength(1);
  });

  it("uses the merge-base of the current PR base branch", () => {
    const base = resolveComparisonBase({
      env: {},
      gh: () => result(0, "main\n"),
      git: (args) => {
        if (args[0] === "merge-base") return result(0, "merge123\n");
        if (args[0] === "rev-parse") return result(0, "main123\n");
        return result(1);
      },
    });
    expect(base.strategy).toBe("merge-base with current PR");
    expect(base.sha).toBe("merge123");
  });

  it("reports HEAD~1 as a visible fallback", () => {
    const base = resolveComparisonBase({
      env: {},
      gh: () => result(1),
      git: (args) => args.at(-1) === "HEAD~1^{commit}" ? result(0, "parent123\n") : result(1),
    });
    expect(base).toEqual({ ref: "HEAD~1", sha: "parent123", strategy: "explicitly reported HEAD~1 fallback" });
  });

  it("parses both supported explicit base forms", () => {
    expect(parseVerifyArgs(["--base=main"])).toEqual({ base: "main" });
    expect(parseVerifyArgs(["--base", "main"])).toEqual({ base: "main" });
  });

  it("includes committed, working-tree, staged and untracked paths", () => {
    const outputs = ["README.md\n", "src/domain/expiry.ts\n", "package.json\n", "scripts/agent/new.mjs\n"];
    const files = collectChangedFiles("base123", () => result(0, outputs.shift()));
    expect(files).toEqual(["README.md", "package.json", "scripts/agent/new.mjs", "src/domain/expiry.ts"]);
  });
});

describe("safe migration helper and Markdown checker", () => {
  it("creates only a forward-only review frame and refuses collisions", () => {
    const directory = mkdtempSync(join(tmpdir(), "foodos-migration-"));
    temporaryDirectories.push(directory);
    const now = new Date("2030-01-02T03:04:05.000Z");
    const target = createMigration("add_example_policy", { cwd: directory, directory: "migrations", now });
    expect(target).toContain("20300102030405_add_example_policy.sql");
    expect(readFileSync(target, "utf8")).toContain("Forward-only migration");
    expect(() => createMigration("add_example_policy", { cwd: directory, directory: "migrations", now })).toThrow("already exists");
  });

  it("accepts only lowercase snake_case migration names", () => {
    expect(validateMigrationName("add_rls_policy")).toBe("add_rls_policy");
    expect(() => validateMigrationName("Add-RLS")).toThrow("lowercase snake_case");
  });

  it("accepts the repository handoff template links", () => {
    expect(checkMarkdownFiles(["docs/agent/HANDOFF_TEMPLATE.md"])).toEqual([]);
  });
});
