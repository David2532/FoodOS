"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AuthFrame } from "@/features/auth/auth-frame";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import type { PrivacyChoices } from "@/domain/privacy";
import { PrivacyChoicesForm } from "./privacy-choices-form";
import { readStagedPrivacyChoice, stagePrivacyChoice } from "./privacy-client";

type EntryState = "loading" | "privacy" | "sign-in";

export function EligibilityPrivacyGate({ authError, appleEnabled, demoEnabled, googleEnabled }: { authError?: string; appleEnabled: boolean; demoEnabled: boolean; googleEnabled: boolean }) {
  const [state, setState] = useState<EntryState>("loading");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setState(readStagedPrivacyChoice() ? "sign-in" : "privacy");
    });
    return () => { active = false; };
  }, []);

  if (state === "sign-in") {
    return <SignInScreen authError={authError} appleEnabled={appleEnabled} demoEnabled={demoEnabled} googleEnabled={googleEnabled} onEditPrivacy={() => setState("privacy")} />;
  }
  if (state === "loading") {
    return <AuthFrame eyebrow="Privat starten" title="Deine Auswahl wird geladen" description="FoodOS aktiviert vor deiner Entscheidung keine optionale Analyse oder Werbung."><div className="privacy-loading" role="status"><LoaderCircle className="spin" size={20} /> Datenschutz-Status wird geprüft …</div></AuthFrame>;
  }
  const submit = (choices: PrivacyChoices) => {
    stagePrivacyChoice(choices);
    setState("sign-in");
  };
  return (
    <AuthFrame eyebrow="Deutschland · ab 16" title="Privat starten" description="Nutze FoodOS nur mit den technisch notwendigen Daten oder erlaube einzelne optionale Zwecke. Nichts ist vorgewählt.">
      <PrivacyChoicesForm onSubmit={submit} />
      <p className="privacy-proof-note">Nach 2FA wird diese Auswahl versioniert in deinem Konto protokolliert. Du kannst sie jederzeit ebenso leicht zurückziehen.</p>
    </AuthFrame>
  );
}
