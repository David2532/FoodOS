"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { clearOfflineData, getOutboxSummary } from "@/infrastructure/offline-outbox";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="icon-button"
      aria-label="Sicher abmelden"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const summary = await getOutboxSummary().catch(() => ({ queued: 0, sending: 0, rejected: 0 }));
        const pending = summary.queued + summary.sending;
        if (pending > 0 && !window.confirm(`${pending} bestätigte Änderung${pending === 1 ? " ist" : "en sind"} noch nicht mit dem Server synchronisiert. Beim Abmelden werden diese lokalen Daten verworfen. Trotzdem abmelden?`)) {
          setBusy(false);
          return;
        }
        await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
        await clearOfflineData();
        router.refresh();
      }}
    >
      <LogOut size={19} />
    </button>
  );
}
