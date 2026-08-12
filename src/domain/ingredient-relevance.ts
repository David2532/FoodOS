import type { IngredientAssessment, Product, RiskLevel } from "@/lib/types";

export interface FoodRiskPreference {
  key: string;
  kind: "allergen" | "intolerance" | "exclusion" | "medical";
  severity: "notice" | "avoid" | "strict_avoid";
}

export interface IngredientFact {
  name: string;
  normalizedName?: string;
  eNumber?: string;
  allergen: boolean;
  confidence: number;
  sourceLabel: string;
}

const rank: Record<RiskLevel, number> = { avoid: 0, watch: 1, info: 2, ok: 3, unknown: 4 };

function canonical(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("de-DE").replace(/^[a-z]{2}[:_-]/, "").replace(/[^a-z0-9äöüß]+/g, " ").trim();
}

export function criticalFoodRiskMatches(candidateNames: string[], preferences: FoodRiskPreference[]): string[] {
  const criticalKeys = new Set(preferences
    .filter((preference) => preference.severity === "avoid" || preference.severity === "strict_avoid")
    .map((preference) => canonical(preference.key)));
  return [...new Set(candidateNames.filter((candidate) => criticalKeys.has(canonical(candidate))))];
}

export function assessIngredientFacts(facts: IngredientFact[], preferences: FoodRiskPreference[]): IngredientAssessment[] {
  const preferenceMap = new Map(preferences.map((preference) => [canonical(preference.key), preference]));
  return facts.map((fact, index) => {
    const key = canonical(fact.normalizedName ?? fact.name);
    const preference = preferenceMap.get(key);
    let level: RiskLevel = "unknown";
    let reason = "Für diesen Inhaltsstoff liegen nicht genug belastbare Daten für eine persönliche Einordnung vor.";
    if (preference) {
      level = preference.severity === "notice" ? "watch" : "avoid";
      reason = preference.kind === "allergen"
        ? "Passt zu einem von dir hinterlegten Allergen. Prüfe bei einer echten Allergie immer die vollständige Packungskennzeichnung."
        : "Passt zu einem von dir ausdrücklich ausgeschlossenen Inhaltsstoff.";
    } else if (fact.allergen) {
      level = "info";
      reason = "Als kennzeichnungspflichtiges Allergen erfasst, aber nicht als persönlicher Konflikt hinterlegt.";
    } else if (fact.confidence >= 0.8) {
      level = "ok";
      reason = "In deinem aktuellen Profil ist kein persönlicher Konflikt hinterlegt. Das ist keine allgemeine Gesundheits- oder Sicherheitsbewertung.";
    }
    return {
      name: fact.name,
      eNumber: fact.eNumber,
      level,
      reason,
      sourceLabel: fact.sourceLabel,
      confidence: fact.confidence,
      _index: index
    };
  }).sort((left, right) => rank[left.level] - rank[right.level] || left._index - right._index)
    .map((assessment) => ({
      name: assessment.name,
      eNumber: assessment.eNumber,
      level: assessment.level,
      reason: assessment.reason,
      sourceLabel: assessment.sourceLabel,
      confidence: assessment.confidence
    }));
}

export function personalizeProductAssessments(product: Product, preferences: FoodRiskPreference[]): Product {
  if (!preferences.length) return product;
  const facts: IngredientFact[] = [
    ...product.allergens.map((name) => ({ name, normalizedName: name, allergen: true, confidence: .95, sourceLabel: "Produktkennzeichnung" })),
    ...product.structuredIngredients.map((ingredient) => ({ name: ingredient.name, normalizedName: ingredient.normalizedName, allergen: false, confidence: .82, sourceLabel: "Zutatenliste" })),
    ...product.additives.map((name) => ({ name, normalizedName: name, eNumber: name.toUpperCase(), allergen: false, confidence: .82, sourceLabel: "Zusatzstoffkennzeichnung" }))
  ];
  const personal = assessIngredientFacts(facts, preferences).filter((assessment) => assessment.level === "avoid" || assessment.level === "watch");
  const personalKeys = new Set(personal.map((assessment) => canonical(assessment.name)));
  return {
    ...product,
    assessments: [
      ...personal,
      ...product.assessments.filter((assessment) => !personalKeys.has(canonical(assessment.name)))
    ]
  };
}
