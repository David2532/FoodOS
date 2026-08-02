import { ChevronRight, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { InventoryItem } from "@/lib/types";

const inventory: InventoryItem[] = [
  { id: "1", name: "Lachsfilet", brand: "Fjordkrone", emoji: "🐟", remainingLabel: "280 g", location: "Kühlschrank", daysUntilExpiry: 1, bestBefore: "03.08.", accent: "#ff9277" },
  { id: "2", name: "Vollmilch 1,5 %", brand: "Milsani", emoji: "🥛", remainingLabel: "650 ml", location: "Kühlschrank", daysUntilExpiry: 3, bestBefore: "05.08.", accent: "#85c8ff" },
  { id: "3", name: "Hähnchenbrust", brand: "Meine Metzgerei", emoji: "🍗", remainingLabel: "400 g", location: "Kühlschrank", daysUntilExpiry: 4, bestBefore: "06.08.", accent: "#f1bf8b" },
  { id: "4", name: "Basmati Reis", brand: "Golden Sun", emoji: "🍚", remainingLabel: "1,2 kg", location: "Vorrat", accent: "#e6d39a" },
  { id: "5", name: "Designer Whey", brand: "ESN", emoji: "🥤", remainingLabel: "720 g", location: "Vorrat", accent: "#b7f36a" }
];

export function InventoryView({ onScan }: { onScan: () => void }) {
  return (
    <div className="stack-lg page-enter">
      <div className="search-row">
        <label className="search-box"><Search size={18} /><input placeholder="Lebensmittel suchen" /><kbd>24</kbd></label>
        <button className="filter-button" aria-label="Filter"><SlidersHorizontal size={19} /></button>
      </div>
      <div className="location-tabs"><button className="selected">Alle</button><button>Kühlschrank</button><button>Gefrierfach</button><button>Vorrat</button></div>

      <section className="inventory-summary">
        <div><p>BESTANDSWERT</p><strong>73,40 €</strong><span>aus letzten Preisen</span></div>
        <div className="summary-divider" />
        <div><p>BALD FÄLLIG</p><strong className="warm">3</strong><span>in 4 Tagen</span></div>
      </section>

      <section>
        <div className="section-heading"><div><p>NACH DRINGLICHKEIT</p><h2>Zuerst verwenden</h2></div><button className="small-action" onClick={onScan}><Plus size={16} /> Produkt</button></div>
        <div className="inventory-list">
          {inventory.map((item) => (
            <button className="inventory-row" key={item.id}>
              <span className="inventory-emoji" style={{ background: `${item.accent}20` }}>{item.emoji}</span>
              <span className="inventory-copy"><small>{item.location}</small><strong>{item.name}</strong><em>{item.brand} · {item.remainingLabel}</em></span>
              {item.bestBefore ? <span className={`expiry-pill ${item.daysUntilExpiry === 1 ? "urgent" : ""}`}><small>MHD</small>{item.bestBefore}</span> : <span className="stock-pill">Vorrat</span>}
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
