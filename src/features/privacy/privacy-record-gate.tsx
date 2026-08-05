"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PrivacyChoices } from "@/domain/privacy";
import { AuthFrame } from "@/features/auth/auth-frame";
import { PrivacyChoicesForm } from "./privacy-choices-form";
import { clearStagedPrivacyChoice, persistPrivacyChoice, readStagedPrivacyChoice, stagePrivacyChoice, type StagedPrivacyChoice } from "./privacy-client";

type RecordState = { kind: "loading" } | { kind: "form"; error?: string };

export function PrivacyRecordGate() {
  const router = useRouter();
  const [state, setState] = useState<RecordState>({ kind: "loading" });

  async function persist(staged: StagedPrivacyChoice) {
    const result = await persistPrivacyChoice(staged);
    if (!result.ok) {
      setState({ kind: "form", error: result.message });
      return;
    }
    clearStagedPrivacyChoice();
    router.refresh();
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const staged = readStagedPrivacyChoice();
      if (!staged) {
        setState({ kind: "form" });
        return;
      }
      void persist(staged);
    });
    return () => { active = false; };
  // The stored mutation ID makes the Strict Mode replay idempotent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (choices: PrivacyChoices) => {
    const staged = stagePrivacyChoice(choices);
    if (!staged) {
      setState({ kind: "form", error: "Prüfe die Alters- und Hinweisbestätigung." });
      return;
    }
    setState({ kind: "loading" });
    void persist(staged);
  };

  return (
    <AuthFrame showSignOut eyebrow="Datenschutz" title={state.kind === "loading" ? "Auswahl wird gesichert" : "Deine Auswahl"} description="Private Haushaltsdaten bleiben bis zur bestätigten AAL2-Sitzung und dieser aktuellen Auswahl geschlossen.">
      {state.kind === "loading" ? <div className="privacy-loading" role="status"><LoaderCircle className="spin" size={20} /> Versionierter Eintrag wird gespeichert …</div> : <><PrivacyChoicesForm onSubmit={submit} />{state.error && <p className="auth-message error" role="alert">{state.error}</p>}</>}
    </AuthFrame>
  );
}
