"use client";

import { useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { PrivacyChoices } from "@/domain/privacy";
import { PrivacyChoicesForm } from "./privacy-choices-form";
import { persistPrivacyChoice, stagePrivacyChoice } from "./privacy-client";

function choiceKey(choices: PrivacyChoices): string {
  return [choices.sensitiveProfile, choices.analytics, choices.marketing, choices.imageCloudProcessing, choices.offContribution, choices.advertising].map(Number).join("");
}

export function PrivacyCenterButton({ initialChoices, variant = "icon" }: { initialChoices: PrivacyChoices; variant?: "icon" | "settings" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState(initialChoices);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(next: PrivacyChoices) {
    const staged = stagePrivacyChoice(next);
    if (!staged) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await persistPrivacyChoice(staged);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setChoices(next);
    setMessage("Deine neue Auswahl wurde gespeichert. Zurückgezogene optionale Zwecke sind sofort deaktiviert.");
  }

  return (
    <>
      {variant === "settings" ? (
        <button className="settings-action" type="button" onClick={() => dialog.current?.showModal()}>
          <SlidersHorizontal size={19} aria-hidden="true" />
          <span><strong>Datenschutz verwalten</strong><small>Optionale Zwecke getrennt prüfen oder jederzeit zurückziehen.</small></span>
        </button>
      ) : <button className="icon-button" aria-label="Datenschutz verwalten" onClick={() => dialog.current?.showModal()}><SlidersHorizontal size={18} /></button>}
      <dialog className="privacy-dialog" ref={dialog} onClose={() => { setMessage(null); setError(null); }}>
        <div className="privacy-dialog-header"><div><span>F00 · Privacy Center</span><h2>Datenschutz</h2></div><button className="icon-button" aria-label="Datenschutz schließen" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <p>Optionale Zwecke sind getrennt. Ablehnen oder Zurückziehen verändert die Kernfunktionen nicht.</p>
        {message && <p className="auth-message success" role="status">{message}</p>}
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <PrivacyChoicesForm key={choiceKey(choices)} initial={choices} mode="manage" busy={busy} onSubmit={(next) => void save(next)} />
      </dialog>
    </>
  );
}
