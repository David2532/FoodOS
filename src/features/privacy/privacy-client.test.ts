import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { necessaryOnlyPrivacyChoices } from "@/domain/privacy";
import { clearStagedPrivacyChoice, readStagedPrivacyChoice, stagePrivacyChoice } from "./privacy-client";

describe("staged privacy choices", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("removes the pre-auth choice after persistence or sign-out", () => {
    const staged = stagePrivacyChoice(necessaryOnlyPrivacyChoices());

    expect(staged).not.toBeNull();
    expect(readStagedPrivacyChoice()).toEqual(staged);
    clearStagedPrivacyChoice();
    expect(readStagedPrivacyChoice()).toBeNull();
  });
});
