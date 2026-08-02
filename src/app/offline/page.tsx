import { CloudOff, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return <main className="auth-canvas">
    <section className="auth-shell offline-shell">
      <div className="mfa-intro"><span><CloudOff size={27} /></span><h1>Gerade offline</h1><p>Private Haushaltsdaten werden nicht als HTML im Browsercache abgelegt. Stelle die Verbindung wieder her, um deinen aktuellen Vorrat sicher zu laden.</p></div>
      <Link className="primary-button wide" href="/"><RefreshCw size={18} /> Erneut verbinden</Link>
    </section>
  </main>;
}
