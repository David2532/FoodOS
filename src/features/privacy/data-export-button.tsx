"use client";

import { Download } from "lucide-react";

export function DataExportButton({ variant = "icon" }: { variant?: "icon" | "settings" }) {
  if (variant === "settings") {
    return (
      <a className="settings-action" href="/api/account/export" download>
        <Download size={19} aria-hidden="true" />
        <span><strong>Daten exportieren</strong><small>Eine maschinenlesbare Kopie deiner FoodOS-Daten herunterladen.</small></span>
      </a>
    );
  }

  return <a className="icon-button" href="/api/account/export" download aria-label="Meine FoodOS-Daten als JSON exportieren"><Download size={18} /></a>;
}
