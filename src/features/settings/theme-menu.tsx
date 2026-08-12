"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SunMoon } from "lucide-react";
import { useThemePreference } from "./theme-provider";
import { themePreferenceLabel } from "./theme-preference";
import { ThemeOptions } from "./theme-options";

export function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popupId = useId();
  const { preference } = useThemePreference();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    requestAnimationFrame(() => container.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, open]);

  return (
    <div className="theme-menu" ref={container}>
      <button
        className="icon-button"
        type="button"
        ref={trigger}
        aria-label={`Darstellung ändern. Aktuell: ${themePreferenceLabel(preference)}.`}
        aria-expanded={open}
        aria-controls={popupId}
        onClick={() => setOpen((current) => !current)}
      >
        <SunMoon size={18} aria-hidden="true" />
      </button>
      {open && <div className="theme-menu-popup" id={popupId}><ThemeOptions compact onSelected={() => close(true)} /></div>}
    </div>
  );
}
