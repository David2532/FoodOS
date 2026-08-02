"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";

export function MfaChallengeScreen({ factorId }: { factorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) {
      setError("Gib den sechsstelligen Code aus deiner Authenticator-App ein.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setBusy(false);
      setError("Die Sicherheitsprüfung konnte nicht gestartet werden.");
      return;
    }
    const result = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    setBusy(false);
    if (result.error) {
      setError("Der Code ist nicht gültig oder bereits abgelaufen.");
      return;
    }
    router.refresh();
  }

  return (
    <AuthFrame showSignOut eyebrow="Zweiter Faktor" title="Anmeldung bestätigen" description="Öffne deine Authenticator-App und gib den aktuellen FoodOS-Code ein.">
      <form className="auth-form" onSubmit={verify}>
        <label>
          <span>Sechsstelliger Code</span>
          <div><KeyRound size={18} /><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus required /></div>
        </label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <button className="primary-button wide" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}FoodOS entsperren</button>
      </form>
    </AuthFrame>
  );
}
