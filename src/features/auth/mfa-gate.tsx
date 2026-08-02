"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { MfaChallengeScreen } from "./mfa-challenge-screen";
import { MfaEnrollmentScreen } from "./mfa-enrollment-screen";

type GateState = { kind: "loading" } | { kind: "enroll" } | { kind: "challenge"; factorId: string } | { kind: "error"; message: string };

export function MfaGate() {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ kind: "loading" });

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
      const verified = factors.data.totp.find((factor) => factor.status === "verified");
      setState(verified ? { kind: "challenge", factorId: verified.id } : { kind: "enroll" });
    })();
    return () => { active = false; };
  }, [router]);

  if (state.kind === "challenge") return <MfaChallengeScreen factorId={state.factorId} />;
  if (state.kind === "enroll") return <MfaEnrollmentScreen />;
  if (state.kind === "error") return <MfaEnrollmentScreen initialError={state.message} />;
  return <MfaEnrollmentScreen loading />;
}
