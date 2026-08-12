import { ShieldCheck, Sparkles } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import { ThemeMenu } from "@/features/settings/theme-menu";

export function AuthFrame({
  eyebrow,
  title,
  description,
  showSignOut = false,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  showSignOut?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-canvas">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="auth-shell">
        <div className="auth-brand">
          <span><Sparkles size={20} /></span>
          <strong>Food<span>OS</span></strong>
          <div className="auth-brand-actions"><ThemeMenu />{showSignOut && <SignOutButton />}</div>
        </div>
        <div className="auth-heading">
          <p><ShieldCheck size={14} /> {eyebrow}</p>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
        {children}
        <p className="auth-privacy">Deine Vorrats- und Ernährungsdaten bleiben durch Haushaltsschutz und 2FA getrennt.</p>
      </section>
    </main>
  );
}
