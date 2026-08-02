"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, Home, PackageOpen, ScanLine, ShoppingBasket, Sparkles } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import type { AppSnapshot, AppView } from "@/lib/types";
import { TodayView } from "./today-view";
import { InventoryView } from "./inventory-view";
import { ScanView } from "./scan-view";
import { PlanView } from "./plan-view";
import { ShoppingView } from "./shopping-view";

const navigation: Array<{ id: AppView; label: string; icon: typeof Home }> = [
  { id: "today", label: "Heute", icon: Home },
  { id: "inventory", label: "Vorrat", icon: PackageOpen },
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "plan", label: "Plan", icon: CalendarDays },
  { id: "shopping", label: "Einkauf", icon: ShoppingBasket }
];

const titles: Record<AppView, { eyebrow: string; title: string }> = {
  today: { eyebrow: "Sonntag, 2. August", title: "Hey David" },
  inventory: { eyebrow: "24 Lebensmittel", title: "Dein Vorrat" },
  scan: { eyebrow: "Barcode · MHD · Zutaten", title: "Produkt scannen" },
  plan: { eyebrow: "3.–9. August", title: "Deine Woche" },
  shopping: { eyebrow: "Nächster Einkauf", title: "12 Dinge fehlen" }
};

export function FoodOsApp({ authenticated = false, preview = false, initialSnapshot }: { authenticated?: boolean; preview?: boolean; initialSnapshot?: AppSnapshot }) {
  const router = useRouter();
  const [view, setView] = useState<AppView>("today");
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
          {authenticated ? <SignOutButton /> : (
            <button className="icon-button" aria-label={preview ? "Lokaler Preview-Modus" : "Benachrichtigungen"}>
              <Bell size={20} />
              <span className="notification-dot" />
            </button>
          )}
        </header>

        <div className="view-scroll" key={view}>
          {preview && <div className="preview-banner" role="status">Preview-Modus · Beispieldaten werden nicht gespeichert</div>}
          {view === "today" && <TodayView onNavigate={setView} snapshot={initialSnapshot} />}
          {view === "inventory" && <InventoryView onScan={() => setView("scan")} onConsumed={initialSnapshot ? () => router.refresh() : undefined} items={initialSnapshot?.inventory} />}
          {view === "scan" && <ScanView householdId={initialSnapshot?.household.id} onSaved={() => { setView("inventory"); router.refresh(); }} />}
          {view === "plan" && <PlanView snapshot={initialSnapshot} onChanged={initialSnapshot ? () => router.refresh() : undefined} />}
          {view === "shopping" && <ShoppingView snapshot={initialSnapshot} onChanged={initialSnapshot ? () => router.refresh() : undefined} />}
        </div>

        <nav className="bottom-nav" aria-label="Hauptnavigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${active ? "active" : ""} ${item.id === "scan" ? "scan-nav" : ""}`}
                onClick={() => setView(item.id)}
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
