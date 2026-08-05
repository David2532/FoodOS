"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";
import { MfaChallengeScreen, type MfaFactorOption } from "./mfa-challenge-screen";
import { MfaEnrollmentScreen } from "./mfa-enrollment-screen";

type GateState = { kind: "loading" } | { kind: "enroll" } | { kind: "challenge"; factors: MfaFactorOption[] } | { kind: "error"; message: string };

export function MfaGate() {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ kind: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (assurance.error) {
        setState({ kind: "error", message: "Der 2FA-Status konnte nicht geprüft werden." });
        return;
      }
      if (assurance.data.currentLevel === "aal2") {
        router.refresh();
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factors.error) {
        setState({ kind: "error", message: "Deine Authenticator-Faktoren konnten nicht geladen werden." });
        return;
      }
      const verified = factors.data.totp
        .filter((factor) => factor.status === "verified")
        .map((factor, index) => ({
          id: factor.id,
          label: factor.friendly_name?.trim() || `Authenticator ${index + 1}`
        }));
      setState(verified.length > 0 ? { kind: "challenge", factors: verified } : { kind: "enroll" });
    })();
    return () => { active = false; };
  }, [loadAttempt, router]);

  if (state.kind === "challenge") return <MfaChallengeScreen factors={state.factors} />;
  if (state.kind === "enroll") return <MfaEnrollmentScreen />;
  if (state.kind === "error") {
    return (
      <AuthFrame showSignOut eyebrow="Zweiter Faktor" title="2FA-Prüfung nicht verfügbar" description="FoodOS hält private Daten geschlossen, bis der Sicherheitsstatus eindeutig geprüft wurde.">
        <p className="auth-message error" role="alert">{state.message} Es wird kein neuer Faktor angelegt.</p>
        <button className="primary-button wide" type="button" onClick={() => { setState({ kind: "loading" }); setLoadAttempt((attempt) => attempt + 1); }}>Erneut sicher prüfen</button>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame showSignOut eyebrow="Zweiter Faktor" title="2FA wird geprüft" description="FoodOS lädt nur deinen verifizierten Sicherheitsstatus.">
      <div className="privacy-loading" role="status"><LoaderCircle className="spin" size={20} aria-hidden="true" /> 2FA-Status wird geprüft …</div>
    </AuthFrame>
  );
}
