import { ArrowRight, Beef, Clock3, Database, Flame, PackageCheck, PackageSearch, Plus, ShieldAlert, Wheat } from "lucide-react";
import type { NutritionMetricSummary, NutritionTotals } from "@/domain/nutrition-summary";
import type { AppSnapshot, AppView } from "@/lib/types";

function nutritionNumber(metric: NutritionMetricSummary, maximumFractionDigits = 1): string {
  if (metric.value === null) return "—";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits }).format(metric.value);
}

function nutritionCoverage(metric: NutritionMetricSummary): string | null {
  if (metric.status === "empty") return "Noch keine Buchung";
  if (metric.status === "unknown") return `${metric.totalEntries} ${metric.totalEntries === 1 ? "Buchung" : "Buchungen"} ohne Angabe`;
  if (metric.status === "partial") {
    const missing = metric.totalEntries - metric.knownEntries;
    return `${missing} von ${metric.totalEntries} Buchungen ohne Angabe`;
  }
  return null;
}

function NutritionMacros({ totals, period }: { totals: NutritionTotals; period: "heute" | "diese Woche" }) {
  const metrics = [
    { label: "Protein", metric: totals.proteinG, icon: <Beef size={16} /> },
    { label: "Carbs", metric: totals.carbsG, icon: <Wheat size={16} /> },
    { label: "Fett", metric: totals.fatG, icon: <Flame size={16} /> }
  ];
  return <div className="macro-grid">
    {metrics.map(({ label, metric, icon }) => {
      const coverage = nutritionCoverage(metric);
      return <div key={label}>
        {icon}<span>{label}</span>
        <strong aria-label={`${label} ${period}: ${metric.value === null ? "Unbekannt" : `${nutritionNumber(metric)} Gramm`}`}>
          {nutritionNumber(metric)} <small>{metric.value === null ? "unbekannt" : "g"}</small>
        </strong>
        {coverage && <small>{coverage}</small>}
      </div>;
    })}
  </div>;
}

export function TodayView({ onNavigate, onOpenCatalog, snapshot }: { onNavigate: (view: AppView) => void; onOpenCatalog?: (query?: string) => void; snapshot?: AppSnapshot }) {
  if (snapshot) {
    const urgent = snapshot.inventory.find((item) => ["past_use_by", "today", "soon", "past_best_before"].includes(item.expiryState));
    const target = snapshot.today.calorieTarget;
    const targetProgress = target && snapshot.today.kcal.value !== null ? Math.min(100, snapshot.today.kcal.value / target * 100) : 0;
    const todayCoverage = nutritionCoverage(snapshot.today.kcal);
    const weekCoverage = nutritionCoverage(snapshot.nutritionWeek.totals.kcal);
    return (
      <div className="stack-lg page-enter">
        <section className="hero-card" aria-labelledby="nutrition-today-title">
          <div className="hero-topline"><div id="nutrition-today-title"><span className="status-pulse" />Heute · {snapshot.today.entryCount} {snapshot.today.entryCount === 1 ? "Buchung" : "Buchungen"}</div></div>
          <div className="hero-number">
            <strong aria-label={`Kalorien heute: ${snapshot.today.kcal.value === null ? "Unbekannt" : `${nutritionNumber(snapshot.today.kcal, 0)} Kilokalorien`}`}>{nutritionNumber(snapshot.today.kcal, 0)}</strong>
            <span>{snapshot.today.kcal.value === null ? "kcal unbekannt" : target ? `/ ${target.toLocaleString("de-DE")} kcal` : "kcal heute"}</span>
          </div>
          {todayCoverage && <p role="status">{todayCoverage}</p>}
          {target && snapshot.today.kcal.value !== null && <div className="progress-track" aria-label={`${Math.round(targetProgress)} Prozent des Tagesziels`}><span style={{ width: `${targetProgress}%` }} /></div>}
          <NutritionMacros totals={snapshot.today} period="heute" />
          <button className="primary-button" onClick={() => onNavigate("inventory")}><PackageCheck size={18} /> Verzehr aus Vorrat buchen</button>
        </section>
        <section className="hero-card" aria-labelledby="nutrition-week-title">
          <div className="hero-topline"><div id="nutrition-week-title"><span className="status-pulse" />Diese Woche · {snapshot.nutritionWeek.totals.entryCount} {snapshot.nutritionWeek.totals.entryCount === 1 ? "Buchung" : "Buchungen"}</div></div>
          <div className="hero-number">
            <strong aria-label={`Kalorien diese Woche: ${snapshot.nutritionWeek.totals.kcal.value === null ? "Unbekannt" : `${nutritionNumber(snapshot.nutritionWeek.totals.kcal, 0)} Kilokalorien`}`}>{nutritionNumber(snapshot.nutritionWeek.totals.kcal, 0)}</strong>
            <span>{snapshot.nutritionWeek.totals.kcal.value === null ? "kcal unbekannt" : "kcal gesamt"}</span>
          </div>
          {weekCoverage && <p>{weekCoverage}</p>}
          <NutritionMacros totals={snapshot.nutritionWeek.totals} period="diese Woche" />
        </section>
        <CatalogShortcut onNavigate={onNavigate} />
        {snapshot.recallSource.status !== "fresh" && <section className="recall-source-warning" role="status"><ShieldAlert size={21} /><div><strong>{snapshot.recallSource.status === "stale" ? "Rückrufquelle ist veraltet" : "Rückrufprüfung nicht verfügbar"}</strong><p>Es ist keine aktuelle Aussage zur Betroffenheit oder Sicherheit möglich. Prüfe im Zweifel die amtliche Quelle lebensmittelwarnung.de.</p></div></section>}
        {urgent ? (
          <section className="expiry-card">
            <div className="expiry-icon"><Clock3 size={20} /></div>
            <div><p>{urgent.dateKind === "use_by" ? "VERBRAUCHSDATUM" : "ZUERST PRÜFEN"}</p><h3>{urgent.name}</h3><span>{urgent.expiryDate ? `${urgent.expiryDate} · ` : ""}{urgent.remainingLabel}</span></div>
            <button onClick={() => onNavigate("inventory")} aria-label={`${urgent.name} im Vorrat öffnen`}><ArrowRight size={18} /></button>
          </section>
        ) : (
          <section className="empty-state"><PackageCheck size={24} /><h2>{snapshot.inventory.length ? "Keine dringende Charge" : "Dein Vorrat ist leer"}</h2><p>{snapshot.inventory.length ? "Aktuell ist keine Charge mit Datum kurzfristig fällig." : "Scanne dein erstes Lebensmittel oder gib den Barcode manuell ein."}</p><button className="primary-button" onClick={() => onNavigate("scan")}><Plus size={17} /> Lebensmittel erfassen</button></section>
        )}
      </div>
    );
  }
  return (
    <div className="stack-lg page-enter">
      <section className="hero-card">
        <div className="hero-topline">
          <div><span className="status-pulse" />Auf Kurs</div>
          <button onClick={() => onNavigate("plan")}>Wochenansicht <ArrowRight size={14} /></button>
        </div>
        <div className="hero-number"><strong>1.420</strong><span>/ 2.200 kcal</span></div>
        <div className="progress-track"><span style={{ width: "64.5%" }} /></div>
        <div className="macro-grid">
          <div><Beef size={16} /><span>Protein</span><strong>112 <small>/ 150 g</small></strong></div>
          <div><Wheat size={16} /><span>Carbs</span><strong>138 <small>/ 220 g</small></strong></div>
          <div><Flame size={16} /><span>Fett</span><strong>46 <small>/ 70 g</small></strong></div>
        </div>
      </section>

      <CatalogShortcut onNavigate={onNavigate} />

      <section>
        <div className="section-heading">
          <div><p>HEUTE GEPLANT</p><h2>Noch zwei Mahlzeiten</h2></div>
          <button className="small-action" onClick={() => onOpenCatalog?.()}><Plus size={16} /> Hinzufügen</button>
        </div>
        <div className="meal-list">
          <article className="meal-card">
            <div className="meal-art rice"><span>🍚</span></div>
            <div className="meal-copy"><p>MITTAGESSEN · 13:00</p><h3>Reis & Hähnchen</h3><span>620 kcal · 54 g Protein</span></div>
            <button className="check-button" aria-label="Als gegessen markieren"><PackageCheck size={18} /></button>
          </article>
          <button type="button" className="meal-card meal-card-button" onClick={() => onOpenCatalog?.("Rühls Bestes Whey")}>
            <span className="meal-art shake"><PackageSearch size={25} /></span>
            <span className="meal-copy"><p>SNACK · AUS KATALOG</p><h3>Proteinshake auswählen</h3><span>z. B. Rühls Bestes Whey · mit Quellenbild, falls verfügbar</span></span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="expiry-card">
        <div className="expiry-icon"><Clock3 size={20} /></div>
        <div><p>ZUERST VERBRAUCHEN</p><h3>Lachs läuft morgen ab</h3><span>280 g im Kühlschrank</span></div>
        <button onClick={() => onNavigate("inventory")} aria-label="Dringende Charge im Vorrat öffnen"><ArrowRight size={18} /></button>
      </section>

      <section className="quick-section">
        <div className="section-heading"><div><p>SCHNELLBUCHUNG</p><h2>Deine Favoriten</h2></div></div>
        <div className="quick-grid">
          {[{ e: "🥛", n: "Milch", s: "250 ml" }, { e: "☕", n: "Flexpresso", s: "1 Scoop" }, { e: "🥤", n: "Whey", s: "30 g" }].map((item) => (
            <button className="quick-card" key={item.n}><span>{item.e}</span><strong>{item.n}</strong><small>{item.s}</small><i><Plus size={13} /></i></button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CatalogShortcut({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  return <section className="catalog-shortcut" aria-labelledby="catalog-shortcut-title">
    <span className="catalog-shortcut-icon"><Database size={21} /></span>
    <div>
      <p>ECHTER LEBENSMITTELKATALOG</p>
      <h2 id="catalog-shortcut-title">Produkt suchen oder scannen</h2>
      <span>Marke, Produktname oder Barcode – mit Quellen und Packungsdaten.</span>
    </div>
    <button type="button" onClick={() => onNavigate("scan")} aria-label="Lebensmittelkatalog öffnen"><ArrowRight size={18} /></button>
  </section>;
}
