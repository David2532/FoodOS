"use client";

import { useState, type FormEvent } from "react";
import { AtSign, KeyRound, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";

const credentialsSchema = z.object({
  email: z.email("Gib eine gültige E-Mail-Adresse ein."),
  password: z.string().min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.").max(128)
});

type Mode = "login" | "register";

export function SignInScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüfe deine Eingaben.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword(parsed.data)
      : await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` }
        });
    setBusy(false);

    if (result.error) {
      setError(mode === "login"
        ? "Anmeldung fehlgeschlagen. Prüfe E-Mail, Passwort und die E-Mail-Bestätigung."
        : result.error.message);
      return;
    }

    if (mode === "register" && !result.data.session) {
      setNotice("Konto angelegt. Bestätige jetzt den Link in deiner E-Mail.");
      return;
    }

    router.refresh();
  }

  return (
    <AuthFrame
      eyebrow="Geschützter Zugang"
      title={mode === "login" ? "Willkommen zurück" : "FoodOS einrichten"}
      description="Melde dich zuerst mit E-Mail und Passwort an. Danach bestätigt deine Authenticator-App den zweiten Faktor."
    >
      <div className="auth-tabs" role="tablist" aria-label="Anmeldemodus">
        <button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Anmelden</button>
        <button role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Registrieren</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label>
          <span>E-Mail-Adresse</span>
          <div><AtSign size={18} /><input name="email" type="email" autoComplete="email" inputMode="email" required /></div>
        </label>
        <label>
          <span>Passwort</span>
          <div><KeyRound size={18} /><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} required /></div>
          {mode === "register" && <small>Mindestens 10 Zeichen. Verwende ein einzigartiges Passwort.</small>}
        </label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        {notice && <p className="auth-message success" role="status">{notice}</p>}
        <button className="primary-button wide" disabled={busy}>
          {busy && <LoaderCircle className="spin" size={17} />}
          {busy ? "Bitte warten …" : mode === "login" ? "Sicher anmelden" : "Konto erstellen"}
        </button>
      </form>
    </AuthFrame>
  );
}
