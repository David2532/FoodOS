"use client";

import { ArrowLeft, CircleUserRound, KeyRound, ShieldCheck } from "lucide-react";
import type { PrivacyChoices } from "@/domain/privacy";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { DataExportButton } from "@/features/privacy/data-export-button";
import { PrivacyCenterButton } from "@/features/privacy/privacy-center-button";
import { PasswordChangeForm } from "./password-change-form";
import { ThemeOptions } from "./theme-options";

export function AccountSettingsView({ accountEmail, initialPrivacyChoices, onClose }: {
  accountEmail?: string;
  initialPrivacyChoices?: PrivacyChoices;
  onClose: () => void;
}) {
  return (
    <section className="settings-view page-enter" aria-labelledby="settings-title">
      <header className="settings-heading">
        <button className="icon-button" type="button" aria-label="Einstellungen schließen" onClick={onClose}><ArrowLeft size={20} aria-hidden="true" /></button>
        <div><p>Konto und Schutz</p><h2 id="settings-title">Einstellungen</h2></div>
      </header>

      <section className="settings-card account-summary" aria-labelledby="account-summary-title">
        <CircleUserRound size={28} aria-hidden="true" />
        <div><span id="account-summary-title">Angemeldet als</span><strong>{accountEmail ?? "FoodOS-Konto"}</strong><small>Private Haushaltsdaten bleiben nur nach deiner 2FA-Verifizierung zugänglich.</small></div>
      </section>

      <section className="settings-card" aria-labelledby="appearance-title">
        <div className="settings-section-heading"><span>Darstellung</span><h3 id="appearance-title">So soll FoodOS aussehen</h3></div>
        <ThemeOptions />
      </section>

      <section className="settings-card" aria-labelledby="security-title">
        <div className="settings-section-heading"><span>Sicherheit</span><h3 id="security-title"><KeyRound size={18} aria-hidden="true" /> Passwort ändern</h3></div>
        <PasswordChangeForm />
      </section>

      <section className="settings-card settings-action-list" aria-labelledby="account-actions-title">
        <div className="settings-section-heading"><span>Konto</span><h3 id="account-actions-title"><ShieldCheck size={18} aria-hidden="true" /> Daten und Sitzung</h3></div>
        {initialPrivacyChoices && <PrivacyCenterButton initialChoices={initialPrivacyChoices} variant="settings" />}
        <DataExportButton variant="settings" />
        <SignOutButton variant="settings" />
      </section>
    </section>
  );
}
