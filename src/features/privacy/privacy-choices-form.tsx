"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { necessaryOnlyPrivacyChoices, type PrivacyChoices } from "@/domain/privacy";

const optionalChoices: Array<{ key: keyof Pick<PrivacyChoices, "sensitiveProfile" | "analytics" | "marketing" | "imageCloudProcessing" | "offContribution" | "advertising">; label: string; description: string }> = [
  { key: "sensitiveProfile", label: "Persönliches Lebensmittelprofil", description: "Allergene und Ausschlüsse nur für deine persönliche Einordnung verarbeiten." },
  { key: "analytics", label: "Nutzungsanalyse", description: "Nur grobe, produktfreie Abläufe messen. Keine GTINs, Lebensmittel, Daten oder Gesundheitsangaben." },
  { key: "marketing", label: "Neuigkeiten", description: "Optionale Produkt-Neuigkeiten erhalten. Sicherheits- und Konto-Nachrichten bleiben davon getrennt." },
  { key: "imageCloudProcessing", label: "Cloud-Bildverarbeitung", description: "Ein ausdrücklich ausgewähltes Paketbild kurzzeitig für OCR verarbeiten, wenn On-Device nicht reicht." },
  { key: "offContribution", label: "Open Food Facts beitragen", description: "Korrekturen oder Bilder nur in einem späteren, nochmals bestätigten Beitrag teilen." },
  { key: "advertising", label: "Kontextuelle Werbung", description: "Nur nicht personalisierte Werbung außerhalb sensibler Bereiche zulassen. Aktuell ist kein Werbe-SDK aktiv." }
];

export function PrivacyChoicesForm({ initial = necessaryOnlyPrivacyChoices(), mode = "initial", busy = false, onSubmit }: { initial?: PrivacyChoices; mode?: "initial" | "manage"; busy?: boolean; onSubmit: (choices: PrivacyChoices) => void }) {
  const [choices, setChoices] = useState(initial);
  const canContinue = choices.ageConfirmed && choices.termsAccepted;
  const update = (key: keyof PrivacyChoices, value: boolean) => setChoices((current) => ({ ...current, [key]: value }));
  const submitNecessary = () => onSubmit({ ...necessaryOnlyPrivacyChoices(), ageConfirmed: choices.ageConfirmed, termsAccepted: choices.termsAccepted });

  return (
    <div className="privacy-choice-form">
      {mode === "initial" ? (
        <div className="privacy-required" aria-label="Erforderliche Bestätigungen">
          <label>
            <input type="checkbox" checked={choices.ageConfirmed} onChange={(event) => update("ageConfirmed", event.currentTarget.checked)} />
            <span><strong>Ich bin mindestens 16 Jahre alt.</strong><small>FoodOS ist in der Deutschland-Beta für Personen ab 16 vorgesehen.</small></span>
          </label>
          <label>
            <input type="checkbox" checked={choices.termsAccepted} onChange={(event) => update("termsAccepted", event.currentTarget.checked)} />
            <span><strong>Ich habe die Hinweise gelesen.</strong><small><Link href="/datenschutz" target="_blank">Datenschutz</Link> und <Link href="/nutzungsrahmen" target="_blank">Nutzungsrahmen</Link> öffnen in einem neuen Tab.</small></span>
          </label>
        </div>
      ) : (
        <div className="privacy-necessary-note"><ShieldCheck size={19} /><span><strong>Notwendige Verarbeitung bleibt aktiv.</strong><small>Konto, Sicherheit, Haushalt und deine ausdrücklich angeforderten Kernfunktionen funktionieren ohne optionale Zwecke.</small></span></div>
      )}

      {mode === "initial" && (
        <button className="primary-button wide" type="button" disabled={!canContinue || busy} onClick={submitNecessary}>
          <ShieldCheck size={17} /> {busy ? "Wird gespeichert …" : "Nur notwendige verwenden"}
        </button>
      )}

      <details className="privacy-options" open={mode === "manage"}>
        <summary><span>Optionale Einstellungen</span><ChevronDown size={17} /></summary>
        <div className="privacy-option-list">
          {optionalChoices.map((option) => (
            <label key={option.key}>
              <input type="checkbox" checked={choices[option.key]} onChange={(event) => update(option.key, event.currentTarget.checked)} />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </div>
        <button className={mode === "manage" ? "primary-button wide" : "secondary-button wide"} type="button" disabled={!canContinue || busy} onClick={() => onSubmit(choices)}>
          <Check size={17} /> {busy ? "Auswahl wird gespeichert …" : "Auswahl speichern"}
        </button>
        {mode === "manage" && <button className="privacy-text-button" type="button" disabled={busy} onClick={submitNecessary}>Alle optionalen Zwecke zurückziehen</button>}
      </details>
    </div>
  );
}
