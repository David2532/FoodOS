import { describe, expect, it } from "vitest";
import { normalizeThemePreference, parseThemePreference, resolveTheme, themePreferenceLabel } from "./theme-preference";

describe("theme preference", () => {
  it("accepts only the three known persisted values", () => {
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("neon")).toBeNull();
    expect(normalizeThemePreference(null)).toBe("system");
  });

  it("resolves system preference without changing an explicit user choice", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("uses short German labels for accessible controls", () => {
    expect(themePreferenceLabel("system")).toBe("System");
    expect(themePreferenceLabel("light")).toBe("Hell");
    expect(themePreferenceLabel("dark")).toBe("Dunkel");
  });
});
