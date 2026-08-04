export const THEME_PREFERENCE_COOKIE = "foodos-theme";
export const THEME_PREFERENCE_STORAGE_KEY = "foodos:theme-preference:v1";

export const themePreferences = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export function parseThemePreference(value: unknown): ThemePreference | null {
  return typeof value === "string" && (themePreferences as readonly string[]).includes(value)
    ? value as ThemePreference
    : null;
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return parseThemePreference(value) ?? "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function themePreferenceLabel(preference: ThemePreference): string {
  return ({ system: "System", light: "Hell", dark: "Dunkel" })[preference];
}
