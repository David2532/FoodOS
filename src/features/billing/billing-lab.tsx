"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeEuro, Check, ChevronLeft, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { COMMERCIAL_PLANS, resolveEntitlement, type EntitlementInput } from "@/domain/entitlements";

const PREVIEW_NOW = new Date("2026-08-05T12:00:00.000Z");
const scenarios: Array<{ id: string; label: string; entitlement: EntitlementInput }> = [
  { id: "free", label: "Free", entitlement: { kind: "free" } },
  {
    id: "trial",
    label: "Trial · Tag 1",
    entitlement: {
      kind: "trial",
      startedAt: "2026-08-05T00:00:00.000Z",
      endsAt: "2026-08-19T00:00:00.000Z",
      cardRequired: false,
      autoRenews: false
    }
  },
  {
    id: "trial-ended",
    label: "Trial beendet",
    entitlement: {
      kind: "trial",
      startedAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-15T00:00:00.000Z",
      cardRequired: false,
      autoRenews: false
    }
  },
  {
    id: "plus",
    label: "Plus verifiziert",
    entitlement: {
      kind: "paid",
      plan: "plus",
      provider: "apple",
      status: "active",
      verifiedAt: "2026-08-05T09:00:00.000Z",
      periodEndsAt: "2026-09-05T09:00:00.000Z",
      autoRenews: true
    }
  },
  {
    id: "family",
    label: "Family verifiziert",
    entitlement: {
      kind: "paid",
      plan: "family",
      provider: "google",
      status: "active",
      verifiedAt: "2026-08-05T09:00:00.000Z",
      periodEndsAt: "2026-09-05T09:00:00.000Z",
      autoRenews: true
    }
  }
];

const planFeatures = {
  free: ["1 Haushalt", "50 aktive Vorräte", "3 smarte Pläne pro Monat", "Sicherheit und Kontorechte inklusive"],
  plus: ["Unbegrenzter Vorrat", "Unbegrenzte Planung", "Erweiterte Statistiken", "Werbefrei"],
  family: ["Alles aus Plus", "Bis zu 5 Mitglieder", "Gemeinsame Funktionen", "Individuelle Profile"]
} as const;

function euro(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function BillingLab({ accessLabel }: { accessLabel: "AAL2" | "Lokal" }) {
  const [scenarioId, setScenarioId] = useState("free");
  const scenario = scenarios.find((entry) => entry.id === scenarioId) ?? scenarios[0];
  const resolved = resolveEntitlement(scenario.entitlement, PREVIEW_NOW);

  return (
    <main className="billing-lab-canvas">
      <section className="billing-lab-shell" aria-labelledby="billing-lab-title">
        <header className="billing-lab-topbar">
          <Link href="/" aria-label="Zurück zu FoodOS"><ChevronLeft aria-hidden="true" /></Link>
          <div><p>DEV / PREVIEW · KEINE ZAHLUNG</p><h1 id="billing-lab-title">Tarife sicher durchspielen</h1></div>
          <span><ShieldCheck size={17} aria-hidden="true" /> {accessLabel}</span>
        </header>

        <section className="billing-lab-notice" aria-label="Testlabor-Hinweis">
          <BadgeEuro aria-hidden="true" />
          <div><strong>Reines Produkt- und Entitlement-Labor</strong><p>Keine Karte, kein Kauf, keine Abbuchung. StoreKit, Google Play und Stripe sind hier nicht verbunden.</p></div>
        </section>

        <section className="billing-scenario" aria-labelledby="billing-scenario-title">
          <div className="billing-section-heading"><p>Simulation</p><h2 id="billing-scenario-title">Welchen Zustand willst du sehen?</h2></div>
          <div className="billing-scenario-tabs" role="group" aria-label="Entitlement-Szenario wählen">
            {scenarios.map((entry) => <button key={entry.id} type="button" aria-pressed={scenarioId === entry.id} onClick={() => setScenarioId(entry.id)}>{entry.label}</button>)}
          </div>
          <div className="billing-current-state" role="status" aria-live="polite">
            <Sparkles aria-hidden="true" />
            <div><span>Wirksamer Tarif</span><strong>{COMMERCIAL_PLANS[resolved.plan].name} · {resolved.state === "trialing" ? "14 Tage Test" : resolved.state}</strong><small>{resolved.reason === "trial_ended" ? "Automatisch auf Free zurückgefallen. Deine Daten bleiben erhalten." : resolved.autoRenews ? "Nur als verifizierter Store-Zustand simuliert." : "Keine automatische Verlängerung."}</small></div>
          </div>
        </section>

        <section className="billing-plan-grid" aria-label="Tarifvergleich">
          {(Object.keys(COMMERCIAL_PLANS) as Array<keyof typeof COMMERCIAL_PLANS>).map((planId) => {
            const plan = COMMERCIAL_PLANS[planId];
            const active = resolved.plan === planId;
            return (
              <article className={`billing-plan-card ${active ? "active" : ""}`} key={planId}>
                <div className="billing-plan-title"><div>{planId === "family" ? <UsersRound aria-hidden="true" /> : <Sparkles aria-hidden="true" />}<h2>{plan.name}</h2></div>{active ? <span>Aktiv in der Simulation</span> : null}</div>
                <p className="billing-price">{plan.monthlyPriceEur === null ? <strong>0 €</strong> : <><strong>{euro(plan.monthlyPriceEur)}</strong><span>/ Monat</span></>}</p>
                {plan.annualPriceEur !== null ? <p className="billing-annual">oder {euro(plan.annualPriceEur)} pro Jahr</p> : <p className="billing-annual">Dauerhaft ohne Zahlungsdaten nutzbar</p>}
                <ul>{planFeatures[planId].map((feature) => <li key={feature}><Check size={15} aria-hidden="true" /> {feature}</li>)}</ul>
                {planId === "plus" ? <button type="button" className="primary-button" onClick={() => setScenarioId("trial")}>14-Tage-Test simulieren</button> : <button type="button" className="secondary-button" disabled>{planId === "free" ? "Immer verfügbar" : "Store-Verbindung fehlt"}</button>}
              </article>
            );
          })}
        </section>

        <footer className="billing-lab-footer"><ShieldCheck size={16} aria-hidden="true" /><p>2FA, Rückrufe, Verbrauchsdatum-Warnungen, Datenexport und Kontolöschung bleiben in jedem Tarif frei. Live-Zahlungen werden erst nach Store-, Rechts- und Reconciliation-Nachweis aktiviert.</p></footer>
      </section>
    </main>
  );
}
