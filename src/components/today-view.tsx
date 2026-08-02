import { ArrowRight, Beef, Clock3, Flame, PackageCheck, Plus, Wheat } from "lucide-react";
import type { AppView } from "@/lib/types";

export function TodayView({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  return (
    <div className="stack-lg page-enter">
      <section className="hero-card">
        <div className="hero-topline">
          <div><span className="status-pulse" />Auf Kurs</div>
          <button onClick={() => onNavigate("plan")}>Wochenansicht <ArrowRight size={14} /></button>
        </div>
        <div className="hero-number"><strong>1.420</strong><span>/ 2.200 kcal</span></div>
        <div className="progress-track"><span style={{ width: "64.5%" }} /></div>
        <div className="macro-grid">
          <div><Beef size={16} /><span>Protein</span><strong>112 <small>/ 150 g</small></strong></div>
          <div><Wheat size={16} /><span>Carbs</span><strong>138 <small>/ 220 g</small></strong></div>
          <div><Flame size={16} /><span>Fett</span><strong>46 <small>/ 70 g</small></strong></div>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div><p>HEUTE GEPLANT</p><h2>Noch zwei Mahlzeiten</h2></div>
          <button className="small-action"><Plus size={16} /> Hinzufügen</button>
        </div>
        <div className="meal-list">
          <article className="meal-card">
            <div className="meal-art rice"><span>🍚</span></div>
            <div className="meal-copy"><p>MITTAGESSEN · 13:00</p><h3>Reis & Hähnchen</h3><span>620 kcal · 54 g Protein</span></div>
            <button className="check-button" aria-label="Als gegessen markieren"><PackageCheck size={18} /></button>
          </article>
          <article className="meal-card">
            <div className="meal-art shake"><span>🥛</span></div>
            <div className="meal-copy"><p>SNACK · 17:30</p><h3>Flexpresso Shake</h3><span>280 kcal · 31 g Protein</span></div>
            <button className="check-button" aria-label="Als gegessen markieren"><PackageCheck size={18} /></button>
          </article>
        </div>
      </section>

      <section className="expiry-card">
        <div className="expiry-icon"><Clock3 size={20} /></div>
        <div><p>ZUERST VERBRAUCHEN</p><h3>Lachs läuft morgen ab</h3><span>280 g im Kühlschrank</span></div>
        <button onClick={() => onNavigate("inventory")}><ArrowRight size={18} /></button>
      </section>

      <section className="quick-section">
        <div className="section-heading"><div><p>SCHNELLBUCHUNG</p><h2>Deine Favoriten</h2></div></div>
        <div className="quick-grid">
          {[{ e: "🥛", n: "Milch", s: "250 ml" }, { e: "☕", n: "Flexpresso", s: "1 Scoop" }, { e: "🥤", n: "Whey", s: "30 g" }].map((item) => (
            <button className="quick-card" key={item.n}><span>{item.e}</span><strong>{item.n}</strong><small>{item.s}</small><i><Plus size={13} /></i></button>
          ))}
        </div>
      </section>
    </div>
  );
}
