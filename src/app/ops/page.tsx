import { AuthFrame } from "@/features/auth/auth-frame";
import { MfaGate } from "@/features/auth/mfa-gate";
import { OpsFinanceDashboard } from "@/features/ops/ops-finance-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOpsFinanceDashboard } from "@/infrastructure/ops-finance-repository";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  if (!isSupabaseConfigured()) return <AuthFrame eyebrow="CEO-ZENTRALE" title="Nicht konfiguriert" description="Die sichere Ops-Verbindung fehlt."><p className="auth-message error" role="alert">Die CEO-Zentrale bleibt ohne Supabase-Verbindung geschlossen.</p></AuthFrame>;
  const supabase = await createSupabaseServerClient();
  const claims = await supabase.auth.getClaims();
  if (!claims.data?.claims) redirect("/");
  if (claims.data.claims.aal !== "aal2") return <MfaGate />;
  const dashboard = await loadOpsFinanceDashboard(supabase);
  if (dashboard.kind === "no-access") return <AuthFrame eyebrow="CEO-ZENTRALE" title="Zugriff nicht erteilt" description="Die Finanzansicht ist von den privaten Haushaltsdaten getrennt."><p className="auth-message error" role="alert">Deinem Konto ist keine CEO-Rolle mit AAL2 zugewiesen. Die Inhalte bleiben geschlossen.</p></AuthFrame>;
  if (dashboard.kind === "unavailable") return <AuthFrame eyebrow="CEO-ZENTRALE" title="Datenquelle nicht verfügbar" description="Es werden keine Ersatzkennzahlen angezeigt."><p className="auth-message error" role="alert">{dashboard.message}</p></AuthFrame>;
  return <OpsFinanceDashboard expenses={dashboard.expenses} />;
}
