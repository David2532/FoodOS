"use client";

import { Download } from "lucide-react";

export function DataExportButton() {
  return <a className="icon-button" href="/api/account/export" download aria-label="Meine FoodOS-Daten als JSON exportieren"><Download size={18} /></a>;
}
