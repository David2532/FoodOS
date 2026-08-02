"use client";

import { useState, type FormEvent } from "react";
import { Home, LoaderCircle, Target, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";

const onboardingSchema = z.object({
  householdName: z.string().trim().min(1, "Gib deinem Haushalt einen Namen.").max(80),
  displayName: z.string().trim().max(80).optional(),
  calorieTarget: z.coerce.number().int().min(800).max(10_000).optional(),
  proteinTarget: z.coerce.number().min(0).max(1000).optional()
});

export function OnboardingScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value ? Number(value) : undefined;
    };
    const parsed = onboardingSchema.safeParse({
      householdName: form.get("householdName"),
      displayName: String(form.get("displayName") ?? "").trim() || undefined,
      calorieTarget: optionalNumber("calorieTarget"),
      proteinTarget: optionalNumber("proteinTarget")
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüfe deine Angaben.");
      return;
    }

    setBusy(true);
    const { error: rpcError } = await getSupabaseBrowserClient().rpc("onboard_household", {
      household_name: parsed.data.householdName,
      display_name: parsed.data.displayName ?? null,
      calorie_target: parsed.data.calorieTarget ?? null,
      protein_target_g: parsed.data.proteinTarget ?? null
    });
    setBusy(false);
    if (rpcError) {
      setError("Der Haushalt konnte nicht vollständig angelegt werden. Deine Eingaben bleiben erhalten.");
      return;
    }
    router.refresh();
  }

  return (
    <AuthFrame showSignOut eyebrow="Sicherer Start" title="Deinen Haushalt anlegen" description="Haushalt und Profil werden gemeinsam gespeichert. Ziele sind optional und jederzeit änderbar.">
      <form className="auth-form" onSubmit={submit}>
        <label><span>Haushaltsname</span><div><Home size={18} /><input name="householdName" autoComplete="organization" maxLength={80} required /></div></label>
        <label><span>Dein Anzeigename · optional</span><div><UserRound size={18} /><input name="displayName" autoComplete="name" maxLength={80} /></div></label>
        <div className="onboarding-targets">
          <label><span>Tagesziel kcal · optional</span><div><Target size={18} /><input name="calorieTarget" type="number" inputMode="numeric" min={800} max={10000} /></div></label>
          <label><span>Protein g · optional</span><div><Target size={18} /><input name="proteinTarget" type="number" inputMode="decimal" min={0} max={1000} step="0.1" /></div></label>
        </div>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <button className="primary-button wide" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}{busy ? "Haushalt wird angelegt …" : "Haushalt sicher anlegen"}</button>
      </form>
    </AuthFrame>
  );
}
