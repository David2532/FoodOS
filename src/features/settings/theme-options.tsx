"use client";

import { MonitorCog, Moon, SunMedium } from "lucide-react";
import { useThemePreference } from "./theme-provider";
import { themePreferenceLabel, type ThemePreference } from "./theme-preference";

const options: Array<{ value: ThemePreference; description: string; icon: typeof SunMedium }> = [
  { value: "system", description: "Folgt der Einstellung deines Geräts.", icon: MonitorCog },
  { value: "light", description: "Helle, ruhige Oberfläche.", icon: SunMedium },
  { value: "dark", description: "Dunkle, augenschonende Oberfläche.", icon: Moon }
];

export function ThemeOptions({ compact = false, onSelected }: { compact?: boolean; onSelected?: () => void }) {
  const { preference, resolvedTheme, setPreference } = useThemePreference();

  function select(nextPreference: ThemePreference) {
    setPreference(nextPreference);
    onSelected?.();
  }

  return (
    <fieldset className={`theme-options ${compact ? "compact" : ""}`}>
      <legend>Darstellung</legend>
      {!compact && <p>Wird nur auf diesem Gerät gespeichert. Aktuell: {themePreferenceLabel(preference)} ({resolvedTheme === "dark" ? "dunkel" : "hell"}).</p>}
      <div className="theme-option-list">
        {options.map(({ value, description, icon: Icon }) => (
          <label key={value} className={preference === value ? "selected" : undefined}>
            <input type="radio" name={compact ? "compact-theme-preference" : "theme-preference"} value={value} checked={preference === value} onChange={() => select(value)} />
            <Icon size={17} aria-hidden="true" />
            <span><strong>{themePreferenceLabel(value)}</strong><small>{description}</small></span>
          </label>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">Darstellung: {themePreferenceLabel(preference)}.</p>
    </fieldset>
  );
}
