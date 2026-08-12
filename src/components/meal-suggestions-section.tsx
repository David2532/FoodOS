import { AlertTriangle, CalendarDays, Check, ChevronDown, PackageOpen, ScanLine, Utensils } from "lucide-react";
import type { MealSuggestion, MealSuggestionIngredient, MealSuggestionUnit } from "@/domain/meal-suggestions";
import type { AppView } from "@/lib/types";

function formatAmount(amount: number, unit: MealSuggestionUnit): string {
  const value = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(amount);
  return `${value} ${unit === "piece" ? "Stück" : unit}`;
}

function missingIngredient(suggestion: MealSuggestion): MealSuggestionIngredient | undefined {
  return suggestion.ingredients.find((ingredient) => ingredient.status === "missing");
}

export function MealSuggestionsSection({
  suggestions,
  recipeCount,
  onNavigate
}: {
  suggestions: MealSuggestion[];
  recipeCount: number;
  onNavigate: (view: AppView) => void;
}) {
  return <section className="meal-suggestions-section" aria-labelledby="meal-suggestions-title">
    <div className="section-heading">
      <div><p>AUS DEINEM VORRAT</p><h2 id="meal-suggestions-title">Was kann ich jetzt essen?</h2></div>
    </div>
    {suggestions.length ? <ol className="meal-suggestion-grid">
      {suggestions.map((suggestion, index) => {
        const missing = missingIngredient(suggestion);
        return <li key={suggestion.recipeId}>
          <article className="meal-suggestion-card">
            <header>
              <span className="meal-suggestion-icon" aria-hidden="true"><Utensils size={19} /></span>
              <div>
                <p>{`VORSCHLAG ${index + 1} · ${suggestion.servings.toLocaleString("de-DE")} ${suggestion.servings === 1 ? "PORTION" : "PORTIONEN"}`}</p>
                <h3>{suggestion.name}</h3>
              </div>
            </header>
            <p className={`meal-suggestion-fit ${missing ? "partial" : "complete"}`}>
              {missing ? <><AlertTriangle size={16} aria-hidden="true" /> Es fehlen {formatAmount(missing.missingAmount, missing.unit)} {missing.name}</> : <><Check size={16} aria-hidden="true" /> Alles vorhanden</>}
            </p>
            {suggestion.useSoonNames.length > 0 && <p className="meal-suggestion-reason">Nutzt bald fällige Vorräte: {suggestion.useSoonNames.join(", ")}.</p>}
            {suggestion.hasUncertainCoverage && <p className="meal-suggestion-uncertain"><AlertTriangle size={15} aria-hidden="true" /> Datums- oder Rückrufabdeckung ist für mindestens eine Packung unvollständig. Packungen vor dem Kochen prüfen.</p>}
            <details className="meal-suggestion-details">
              <summary>Zutaten prüfen <ChevronDown size={17} aria-hidden="true" /></summary>
              <dl>
                {suggestion.ingredients.map((ingredient) => <div key={`${ingredient.productId}-${ingredient.unit}`}>
                  <dt>{ingredient.name}</dt>
                  <dd>
                    <strong>{formatAmount(ingredient.requiredAmount, ingredient.unit)}</strong>
                    <span>{ingredient.status === "available" ? "vorhanden" : `${formatAmount(ingredient.missingAmount, ingredient.unit)} fehlen`}</span>
                  </dd>
                </div>)}
              </dl>
              <p>FoodOS zieht hier noch nichts vom Vorrat ab.</p>
            </details>
          </article>
        </li>;
      })}
    </ol> : <div className="empty-state meal-suggestion-empty">
      {recipeCount === 0 ? <CalendarDays size={24} aria-hidden="true" /> : <PackageOpen size={24} aria-hidden="true" />}
      <h3>{recipeCount === 0 ? "Noch keine Haushaltsrezepte" : "Aktuell kein passender Vorschlag"}</h3>
      <p>{recipeCount === 0
        ? "Lege unter Planen ein Rezept an, damit FoodOS es mit deinem Vorrat abgleichen kann."
        : "Bestand, Mengen oder Schutzregeln tragen gerade kein vollständiges oder fast vollständiges Rezept."}</p>
      <div className="meal-suggestion-empty-actions">
        <button className="primary-button" type="button" onClick={() => onNavigate(recipeCount === 0 ? "plan" : "inventory")}>
          {recipeCount === 0 ? <CalendarDays size={17} /> : <PackageOpen size={17} />}
          {recipeCount === 0 ? "Planen öffnen" : "Vorrat prüfen"}
        </button>
        {recipeCount > 0 && <button className="secondary-button" type="button" onClick={() => onNavigate("scan")}><ScanLine size={17} /> Einkauf erfassen</button>}
      </div>
    </div>}
  </section>;
}
