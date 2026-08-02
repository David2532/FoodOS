import { ArrowRight, Beef, Clock3, Flame, PackageCheck, Plus, ShieldAlert, Wheat } from "lucide-react";
import type { AppSnapshot, AppView } from "@/lib/types";

export function TodayView({ onNavigate, snapshot }: { onNavigate: (view: AppView) => void; snapshot?: AppSnapshot }) {
  if (snapshot) {
    const urgent = snapshot.inventory.find((item) => ["past_use_by", "today", "soon", "past_best_before"].includes(item.expiryState));
    const target = snapshot.today.calorieTarget;
    const targetProgress = target ? Math.min(100, snapshot.today.kcal / target * 100) : 0;
    return (
      <div className="stack-lg page-enter">
        <section className="hero-card">
          <div className="hero-topline"><div><span className="status-pulse" />Dauerhaft verbunden</div></div>
          <div className="hero-number"><strong>{Math.round(snapshot.today.kcal).toLocaleString("de-DE")}</strong><span>{target ? `/ ${target.toLocaleString("de-DE")} kcal` : "kcal heute"}</span></div>
          {target && <div className="progress-track"><span style={{ width: `${targetProgress}%` }} /></div>}
          <div className="macro-grid">
            <div><Beef size={16} /><span>Protein</span><strong>{Math.round(snapshot.today.proteinG)} <small>{snapshot.today.proteinTargetG ? `/ ${Math.round(snapshot.today.proteinTargetG)} g` : "g"}</small></strong></div>
            <div><Wheat size={16} /><span>Carbs</span><strong>{Math.round(snapshot.today.carbsG)} <small>g</small></strong></div>
            <div><Flame size={16} /><span>Fett</span><strong>{Math.round(snapshot.today.fatG)} <small>g</small></strong></div>
          </div>
          <button className="primary-button" onClick={() => onNavigate("inventory")}><PackageCheck size={18} /> Verzehr aus Vorrat buchen</button>
        </section>
        {snapshot.recallSource.status !== "fresh" && <section className="recall-source-warning" role="status"><ShieldAlert size={21} /><div><strong>{snapshot.recallSource.status === "stale" ? "Rückrufquelle ist veraltet" : "Rückrufprüfung nicht verfügbar"}</strong><p>Es ist keine aktuelle Aussage zur Betroffenheit oder Sicherheit möglich. Prüfe im Zweifel die amtliche Quelle lebensmittelwarnung.de.</p></div></section>}
        {urgent ? (
          <section className="expiry-card">
            <div className="expiry-icon"><Clock3 size={20} /></div>
            <div><p>{urgent.dateKind === "use_by" ? "VERBRAUCHSDATUM" : "ZUERST PRÜFEN"}</p><h3>{urgent.name}</h3><span>{urgent.expiryDate ? `${urgent.expiryDate} · ` : ""}{urgent.remainingLabel}</span></div>
            <button onClick={() => onNavigate("inventory")} aria-label={`${urgent.name} im Vorrat öffnen`}><ArrowRight size={18} /></button>
          </section>
        ) : (
          <section className="empty-state"><PackageCheck size={24} /><h2>{snapshot.inventory.length ? "Keine dringende Charge" : "Dein Vorrat ist leer"}</h2><p>{snapshot.inventory.length ? "Aktuell ist keine Charge mit Datum kurzfristig fällig." : "Scanne dein erstes Lebensmittel oder gib den Barcode manuell ein."}</p><button className="primary-button" onClick={() => onNavigate("scan")}><Plus size={17} /> Lebensmittel erfassen</button></section>
        )}
      </div>
    );
  }
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
        <button onClick={() => onNavigate("inventory")} aria-label="Dringende Charge im Vorrat öffnen"><ArrowRight size={18} /></button>
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
