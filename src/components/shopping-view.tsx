"use client";

import { useState } from "react";
import { Check, ChevronDown, ListChecks, ShoppingCart } from "lucide-react";

const initial = [
  { id: 1, group: "Kühlung", name: "Hähnchenbrust", amount: "2 × 400 g", price: "7,98 €", emoji: "🍗" },
  { id: 2, group: "Kühlung", name: "Vollmilch 1,5 %", amount: "3 × 1 l", price: "3,27 €", emoji: "🥛" },
  { id: 3, group: "Obst & Gemüse", name: "Brokkoli", amount: "2 Köpfe", price: "3,58 €", emoji: "🥦" },
  { id: 4, group: "Vorrat", name: "Basmati Reis", amount: "1 × 1 kg", price: "2,49 €", emoji: "🍚" },
  { id: 5, group: "Vorrat", name: "Passierte Tomaten", amount: "2 × 500 g", price: "1,98 €", emoji: "🥫" }
];

export function ShoppingView() {
  const [checked, setChecked] = useState<number[]>([]);
  const toggle = (id: number) => setChecked((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  return (
    <div className="stack-lg page-enter">
      <section className="shopping-hero"><div><p>GESCHÄTZT</p><strong>36,80 €</strong><span>basierend auf deinen letzten Preisen</span></div><div><ListChecks size={20} /><strong>{checked.length} / {initial.length}</strong><span>erledigt</span></div></section>
      <div className="smart-list-note"><span>✨</span><div><strong>Automatisch berechnet</strong><p>Dein Wochenplan minus vorhandener Vorrat</p></div><ChevronDown size={18} /></div>
      <section className="shopping-list">
        {initial.map((item, index) => {
          const showGroup = index === 0 || initial[index - 1].group !== item.group;
          const isChecked = checked.includes(item.id);
          return <div key={item.id}>{showGroup && <h3>{item.group}</h3>}<button className={`shopping-row ${isChecked ? "checked" : ""}`} onClick={() => toggle(item.id)}><span className="shop-check">{isChecked && <Check size={14} />}</span><i>{item.emoji}</i><div><strong>{item.name}</strong><small>{item.amount}</small></div><em>{item.price}</em></button></div>;
        })}
      </section>
      <button className="primary-button wide"><ShoppingCart size={18} /> Einkauf abschließen</button>
    </div>
  );
}
