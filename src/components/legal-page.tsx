import Link from "next/link";

export function LegalPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <main className="legal-canvas"><article className="legal-card"><Link className="legal-back" href="/">← Zurück zu FoodOS</Link><p>{eyebrow}</p><h1>{title}</h1>{children}</article></main>;
}
