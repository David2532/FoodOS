import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildVerificationPlan } from "./verify-changed.mjs";
import {
  loadAndValidateCompanyConfig,
  validateCompanyConfig,
  validateNativeAgentRuntime,
} from "./validate-company-config.mjs";

const CONFIG_PATH = new URL("../../config/agent-company.json", import.meta.url);
const commandIds = (files) => buildVerificationPlan(files).commands.map((command) => command.id);

async function readConfig() {
  return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
}

describe("FoodOS company agent registry", () => {
  it("validates the checked-in schema v2 registry, custom agents, and repo skills", async () => {
    await expect(loadAndValidateCompanyConfig()).resolves.toBeDefined();
    const runtime = await validateNativeAgentRuntime();
    expect(runtime.concurrency).toBe(4);
    expect(runtime.agents).toEqual(expect.arrayContaining(["ui_explorer", "ui_implementer", "visual_verifier", "asset_producer"]));
    expect(runtime.skills).toEqual(expect.arrayContaining(["foodos-ui-flow-spec", "foodos-ui-implementation", "foodos-visual-qa", "foodos-asset-production"]));
  });

  it("rejects the obsolete schema v1 contract", async () => {
    const config = await readConfig();
    config.schemaVersion = 1;
    expect(() => validateCompanyConfig(config)).toThrow("schemaVersion must be 2");
  });

  it("keeps C0/C1 work protected from soft limits", async () => {
    const config = await readConfig();
    config.capacityClasses.find((entry) => entry.id === "C1").softLimitMayStop = true;
    expect(() => validateCompanyConfig(config)).toThrow("C1 must not be stopped by a soft limit");
  });

  it("requires the UI, image-generation, and vector-production capability boundaries", async () => {
    const config = await readConfig();
    config.capabilities = config.capabilities.filter((entry) => entry.id !== "ui-design");
    expect(() => validateCompanyConfig(config)).toThrow("capabilities is missing ui-design");
  });

  it("prevents unreviewed generated assets from becoming autonomous release actions", async () => {
    const config = await readConfig();
    config.forbiddenAutonomousActions = config.forbiddenAutonomousActions.filter(
      (entry) => entry !== "unreviewed-generated-asset-release",
    );
    expect(() => validateCompanyConfig(config)).toThrow(
      "forbiddenAutonomousActions is missing unreviewed-generated-asset-release",
    );
  });
});

describe("agent-governance verification routing", () => {
  it("validates custom-agent TOML changes without a broad product build", () => {
    expect(commandIds([".codex/agents/ui_implementer.toml"])).toEqual(
      expect.arrayContaining(["agent-config", "agent-tests"]),
    );
  });

  it("validates repo skill changes even when the diff is Markdown-only", () => {
    expect(commandIds([".agents/skills/foodos-ui-flow-spec/SKILL.md"])).toEqual(
      expect.arrayContaining(["markdown", "agent-config", "agent-tests"]),
    );
  });
});
