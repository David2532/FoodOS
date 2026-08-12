"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { householdInviteTokenSchema } from "@/contracts/household-membership";
import { acceptHouseholdInvitation } from "@/infrastructure/household-membership-client";

export function HouseholdInvitationAcceptance({ onAccepted }: { onAccepted?: () => void } = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage(null);
    const form = new FormData(formElement);
    const parsed = householdInviteTokenSchema.safeParse(String(form.get("inviteToken") ?? "").trim());
    if (!parsed.success) {
      setMessage({ kind: "error", text: "Gib den vollständigen einmaligen Einladungscode ein." });
      return;
    }
    setBusy(true);
    try {
      const accepted = await acceptHouseholdInvitation(parsed.data);
      setMessage({ kind: "success", text: `Du bist jetzt Mitglied in „${accepted.household_name}“. FoodOS lädt den gemeinsamen Haushalt sicher neu.` });
      formElement.reset();
      if (onAccepted) onAccepted();
      else router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Die Einladung konnte nicht sicher angenommen werden." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="household-invite-accept" aria-labelledby="household-invite-accept-title">
      <div className="settings-section-heading"><span>Schon eingeladen?</span><h3 id="household-invite-accept-title"><Users size={18} aria-hidden="true" /> Gemeinsam starten</h3></div>
      <p>Der Code wird nur zur einmaligen Annahme gesendet und weder in der URL noch auf diesem Gerät gespeichert.</p>
      <form className="auth-form" onSubmit={submit}>
        <label><span>Einmaliger Einladungscode</span><div><KeyRound size={18} aria-hidden="true" /><input name="inviteToken" autoComplete="off" minLength={43} maxLength={43} spellCheck={false} required /></div></label>
        <button className="secondary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Users size={16} />}{busy ? "Einladung wird geprüft …" : "Einladung sicher annehmen"}</button>
      </form>
      {message?.kind === "error" ? <p className="auth-message error" role="alert">{message.text}</p> : null}
      {message?.kind === "success" ? <p className="auth-message success" role="status">{message.text}</p> : null}
    </section>
  );
}
