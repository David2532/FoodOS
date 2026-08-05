"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, CircleUserRound, Home, PackageOpen, ScanLine, ShoppingBasket, Sparkles } from "lucide-react";
import { AccountSettingsView } from "@/features/settings/account-settings-view";
import { ThemeMenu } from "@/features/settings/theme-menu";
import type { PrivacyChoices } from "@/domain/privacy";
import type { AppSnapshot, AppView } from "@/lib/types";
import { TodayView } from "./today-view";
import { InventoryView } from "./inventory-view";
import { ScanView } from "./scan-view";
import { PlanView } from "./plan-view";
import { ShoppingView } from "./shopping-view";
import { OutboxStatus } from "./outbox-status";

const navigation: Array<{ id: AppView; label: string; icon: typeof Home }> = [
  { id: "today", label: "Heute", icon: Home },
  { id: "inventory", label: "Vorrat", icon: PackageOpen },
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "plan", label: "Plan", icon: CalendarDays },
  { id: "shopping", label: "Einkauf", icon: ShoppingBasket }
];

const titles: Record<AppView, { eyebrow: string; title: string }> = {
  today: { eyebrow: "Dein Überblick", title: "Heute in FoodOS" },
  inventory: { eyebrow: "Chargen · Sicherheit · Bestand", title: "Dein Vorrat" },
  scan: { eyebrow: "Katalog · Barcode · MHD", title: "Finden & erfassen" },
  plan: { eyebrow: "Aus deinem echten Vorrat", title: "Deine Woche" },
  shopping: { eyebrow: "Aus Plan und Bestand", title: "Dein Einkauf" },
  settings: { eyebrow: "Konto · Sicherheit · Darstellung", title: "Einstellungen" }
};

export function FoodOsApp({
  authenticated = false,
  preview = false,
  authEntryAvailable = false,
  billingLabAvailable = false,
  accountEmail,
  initialPrivacyChoices,
  initialSnapshot
}: {
  authenticated?: boolean;
  preview?: boolean;
  authEntryAvailable?: boolean;
  billingLabAvailable?: boolean;
  accountEmail?: string;
  initialPrivacyChoices?: PrivacyChoices;
  initialSnapshot?: AppSnapshot;
}) {
  const router = useRouter();
  const [view, setView] = useState<AppView>("today");
  const [scanCatalogQuery, setScanCatalogQuery] = useState<string | undefined>();
  const openCatalog = (query?: string) => {
    setScanCatalogQuery(query);
    setView("scan");
  };
  const current = useMemo(() => {
    if (!initialSnapshot) return titles[view];
    if (view === "today") return { eyebrow: initialSnapshot.household.name, title: "Heute" };
    if (view === "inventory") return { eyebrow: `${initialSnapshot.inventory.length} Chargen`, title: "Dein Vorrat" };
    return titles[view];
  }, [initialSnapshot, view]);

  return (
    <main className="app-canvas">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="app-shell">
        <header className="topbar">
          <button className="brand-mark" aria-label="FoodOS Start" onClick={() => setView("today")}>
            <Sparkles size={18} strokeWidth={2.4} />
          </button>
          <div className="topbar-copy">
            <p>{current.eyebrow}</p>
            <h1>{current.title}</h1>
          </div>
          {authenticated ? <div className="topbar-actions"><button className="icon-button" type="button" aria-label="Konto und Einstellungen öffnen" onClick={() => setView("settings")}><CircleUserRound size={20} aria-hidden="true" /></button></div> : (
            <div className="topbar-actions"><ThemeMenu /><button className="icon-button" aria-label={preview ? "Lokaler Preview-Modus" : "Benachrichtigungen"}>
              <Bell size={20} />
              <span className="notification-dot" />
            </button></div>
          )}
        </header>

        <div className="view-scroll" key={view}>
          {preview && (
            <aside className="preview-banner" aria-label="Preview-Modus">
              <p role="status">Preview-Modus · Beispieldaten werden nicht gespeichert</p>
              {authEntryAvailable && <Link className="preview-account-link" href="/">Konto erstellen oder anmelden</Link>}
            </aside>
          )}
          {authenticated && <OutboxStatus />}
          {view === "today" && <TodayView onNavigate={setView} onOpenCatalog={openCatalog} snapshot={initialSnapshot} />}
          {view === "inventory" && <InventoryView householdId={initialSnapshot?.household.id} onScan={() => setView("scan")} onConsumed={initialSnapshot ? () => router.refresh() : undefined} items={initialSnapshot?.inventory} />}
          {view === "scan" && <ScanView householdId={initialSnapshot?.household.id} initialCatalogQuery={scanCatalogQuery} onSaved={() => { setView("inventory"); router.refresh(); }} preview={preview} />}
          {view === "plan" && <PlanView snapshot={initialSnapshot} onChanged={initialSnapshot ? () => router.refresh() : undefined} />}
          {view === "shopping" && <ShoppingView snapshot={initialSnapshot} onChanged={initialSnapshot ? () => router.refresh() : undefined} />}
          {view === "settings" && authenticated && <AccountSettingsView accountEmail={accountEmail} billingLabAvailable={billingLabAvailable} initialPrivacyChoices={initialPrivacyChoices} onClose={() => setView("today")} />}
        </div>

        <nav className="bottom-nav" aria-label="Hauptnavigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${active ? "active" : ""} ${item.id === "scan" ? "scan-nav" : ""}`}
                onClick={() => {
                  if (item.id === "scan") setScanCatalogQuery(undefined);
                  setView(item.id);
                }}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-icon"><Icon size={21} strokeWidth={active ? 2.5 : 2} /></span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </section>
    </main>
  );
}
