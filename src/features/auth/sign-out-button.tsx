"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

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
        await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
        router.refresh();
      }}
    >
      <LogOut size={19} />
    </button>
  );
}
