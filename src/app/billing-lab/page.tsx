import { notFound } from "next/navigation";
import { BillingLab } from "@/features/billing/billing-lab";
import { isBillingLabEnvironment } from "@/domain/entitlements";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BillingLabPage() {
  if (!isBillingLabEnvironment(process.env)) notFound();

  if (process.env.NODE_ENV === "production") {
    if (!isSupabaseConfigured()) notFound();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.aal !== "aal2") notFound();
  }

  return <BillingLab accessLabel={process.env.NODE_ENV === "production" ? "AAL2" : "Lokal"} />;
}
