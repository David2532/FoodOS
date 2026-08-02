import { Check, ChevronRight, Dumbbell, Plus } from "lucide-react";

const days = [{ d: "MO", n: 3 }, { d: "DI", n: 4 }, { d: "MI", n: 5 }, { d: "DO", n: 6 }, { d: "FR", n: 7 }, { d: "SA", n: 8 }, { d: "SO", n: 9 }];

export function PlanView() {
  return (
    <div className="stack-lg page-enter">
      <div className="day-picker">{days.map((day, index) => <button className={index === 0 ? "active" : ""} key={day.d}><span>{day.d}</span><strong>{day.n}</strong>{index === 0 && <i />}</button>)}</div>
      <section className="plan-summary">
        <div><p>GEPLANT</p><strong>2.160</strong><span>von 2.200 kcal</span></div>
        <div className="plan-ring"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="16" /><circle className="value" cx="21" cy="21" r="16" /></svg><span>98%</span></div>
        <div className="training-chip"><Dumbbell size={15} /> Trainingstag</div>
      </section>
      <section className="timeline">
        <div className="timeline-row"><time>08:00</time><span className="timeline-dot done"><Check size={11} /></span><article><small>FRÜHSTÜCK</small><strong>Flexpresso & Milch</strong><em>310 kcal · 33 g Protein</em></article><ChevronRight size={18} /></div>
        <div className="timeline-row"><time>13:00</time><span className="timeline-dot" /><article><small>MITTAGESSEN</small><strong>Reis & Hähnchen</strong><em>620 kcal · 54 g Protein</em></article><ChevronRight size={18} /></div>
        <div className="timeline-row"><time>17:30</time><span className="timeline-dot" /><article><small>SNACK</small><strong>Whey Shake</strong><em>280 kcal · 31 g Protein</em></article><ChevronRight size={18} /></div>
        <div className="timeline-row"><time>20:00</time><span className="timeline-dot warm" /><article className="suggested"><small>RESTEVERWERTUNG</small><strong>Lachs mit Nudeln</strong><em>680 kcal · 48 g Protein</em></article><ChevronRight size={18} /></div>
      </section>
      <button className="outline-button"><Plus size={17} /> Mahlzeit hinzufügen</button>
    </div>
  );
}
