import { ArrowRight, Beef, Clock3, Database, Flame, PackageCheck, PackageSearch, Plus, ShieldAlert, Wheat } from "lucide-react";
import type { NutritionMetricSummary, NutritionTotals } from "@/domain/nutrition-summary";
import type { MealSuggestion } from "@/domain/meal-suggestions";
import type { AppSnapshot, AppView } from "@/lib/types";
import { MealSuggestionsSection } from "./meal-suggestions-section";

const previewSuggestions: MealSuggestion[] = [{
  recipeId: "preview-gemuesereis",
  name: "Gemüse-Reis-Pfanne",
  servings: 2,
  availability: "complete",
  ingredients: [
    { productId: "preview-rice", name: "Reis", requiredAmount: 200, availableAmount: 200, missingAmount: 0, unit: "g", status: "available" },
    { productId: "preview-vegetables", name: "Gemüse", requiredAmount: 300, availableAmount: 300, missingAmount: 0, unit: "g", status: "available" }
  ],
  useSoonNames: ["Gemüse"],
  hasUncertainCoverage: false
}];

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
    const safetyIntervention = snapshot.inventory.find((item) => item.expiryState === "past_use_by" || item.recall.kind === "exact" || item.recall.kind === "possible_gtin");
    const urgent = snapshot.inventory.find((item) => ["today", "soon", "past_best_before"].includes(item.expiryState) && item.recall.kind !== "exact" && item.recall.kind !== "possible_gtin");
    const target = snapshot.today.calorieTarget;
    const targetProgress = target && snapshot.today.kcal.value !== null ? Math.min(100, snapshot.today.kcal.value / target * 100) : 0;
    const todayCoverage = nutritionCoverage(snapshot.today.kcal);
    const weekCoverage = nutritionCoverage(snapshot.nutritionWeek.totals.kcal);
    return (
      <div className="stack-lg page-enter">
        {safetyIntervention && <section className="expiry-card safety-intervention" role="alert">
          <div className="expiry-icon"><ShieldAlert size={20} /></div>
          <div><p>{safetyIntervention.recall.kind === "exact" ? "RÜCKRUF · EXAKTER TREFFER" : safetyIntervention.recall.kind === "possible_gtin" ? "RÜCKRUF · MÖGLICHER TREFFER" : "VERBRAUCHSDATUM ÜBERSCHRITTEN"}</p><h3>{safetyIntervention.name} zuerst prüfen</h3><span>{safetyIntervention.recall.kind === "exact" || safetyIntervention.expiryState === "past_use_by" ? "Nicht zum Verzehr vorgeschlagen" : "Packung und amtliche Quelle vergleichen"}</span></div>
          <button onClick={() => onNavigate("inventory")} aria-label={`${safetyIntervention.name} im Vorrat prüfen`}><ArrowRight size={18} /></button>
        </section>}
        {snapshot.recallSource.status !== "fresh" && <section className="recall-source-warning" role="status"><ShieldAlert size={21} /><div><strong>{snapshot.recallSource.status === "stale" ? "Rückrufquelle ist veraltet" : "Rückrufprüfung nicht verfügbar"}</strong><p>Es ist keine aktuelle Aussage zur Betroffenheit oder Sicherheit möglich. Prüfe im Zweifel die amtliche Quelle lebensmittelwarnung.de.</p></div></section>}
        <MealSuggestionsSection suggestions={snapshot.mealSuggestions} recipeCount={snapshot.mealSuggestionRecipeCount} onNavigate={onNavigate} />
        {urgent ? (
          <section className="expiry-card">
            <div className="expiry-icon"><Clock3 size={20} /></div>
            <div><p>{urgent.dateKind === "use_by" ? "VERBRAUCHSDATUM" : "ZUERST PRÜFEN"}</p><h3>{urgent.name}</h3><span>{urgent.expiryDate ? `${urgent.expiryDate} · ` : ""}{urgent.remainingLabel}</span></div>
            <button onClick={() => onNavigate("inventory")} aria-label={`${urgent.name} im Vorrat öffnen`}><ArrowRight size={18} /></button>
          </section>
        ) : (
          !snapshot.inventory.length && <section className="empty-state"><PackageCheck size={24} /><h2>Dein Vorrat ist leer</h2><p>Scanne dein erstes Lebensmittel oder gib den Barcode manuell ein.</p><button className="primary-button" onClick={() => onNavigate("scan")}><Plus size={17} /> Lebensmittel erfassen</button></section>
        )}
        <section className="nutrition-card today-nutrition" aria-labelledby="nutrition-today-title">
          <div className="nutrition-heading"><div><p>TAGESSTATUS</p><h2 id="nutrition-today-title">Heute · {snapshot.today.entryCount} {snapshot.today.entryCount === 1 ? "Buchung" : "Buchungen"}</h2></div><strong aria-label={`Kalorien heute: ${snapshot.today.kcal.value === null ? "Unbekannt" : `${nutritionNumber(snapshot.today.kcal, 0)} Kilokalorien`}`}>{nutritionNumber(snapshot.today.kcal, 0)} <small>{snapshot.today.kcal.value === null ? "kcal unbekannt" : target ? `/ ${target.toLocaleString("de-DE")} kcal` : "kcal"}</small></strong></div>
          {todayCoverage && <p role="status">{todayCoverage}</p>}
          {target && snapshot.today.kcal.value !== null && <div className="progress-track" aria-label={`${Math.round(targetProgress)} Prozent des Tagesziels`}><span style={{ width: `${targetProgress}%` }} /></div>}
          <NutritionMacros totals={snapshot.today} period="heute" />
          <details className="nutrition-week-details">
            <summary>Diese Woche anzeigen</summary>
            <p><strong aria-label={`Kalorien diese Woche: ${snapshot.nutritionWeek.totals.kcal.value === null ? "Unbekannt" : `${nutritionNumber(snapshot.nutritionWeek.totals.kcal, 0)} Kilokalorien`}`}>{nutritionNumber(snapshot.nutritionWeek.totals.kcal, 0)} kcal</strong> · {snapshot.nutritionWeek.totals.entryCount} Buchungen</p>
            {weekCoverage && <p>{weekCoverage}</p>}
            <NutritionMacros totals={snapshot.nutritionWeek.totals} period="diese Woche" />
          </details>
          <button className="small-action" onClick={() => onNavigate("inventory")}><PackageCheck size={18} /> Verzehr aus Vorrat buchen</button>
        </section>
        <CatalogShortcut onNavigate={onNavigate} />
      </div>
    );
  }
  return (
    <div className="stack-lg page-enter">
      <MealSuggestionsSection suggestions={previewSuggestions} recipeCount={1} onNavigate={onNavigate} />
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
