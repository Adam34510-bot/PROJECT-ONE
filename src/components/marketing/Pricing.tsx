import { Check, Minus } from "lucide-react";
import type { Plan } from "../../lib/types";

export const PLANS: { id: Plan; name: string; price: string; tagline: string; features: string[]; highlight?: boolean }[] = [
  {
    id: "free",
    name: "Gratuit",
    price: "0 €",
    tagline: "Pour découvrir l'assistant",
    features: ["10 missions par mois", "Tous les parcours guidés", "Mémoire et bilan personnel", "Publicité éventuelle, limitée et non intrusive"],
  },
  {
    id: "standard",
    name: "Standard",
    price: "9,99 €",
    tagline: "Pour déléguer le quotidien",
    features: ["60 missions par mois", "Davantage d'intégrations", "Capacités d'exécution élargies", "Aucune publicité"],
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "19,99 €",
    tagline: "Pour tout centraliser",
    features: ["Missions sans limite pratique", "Intégrations et automatisations avancées", "Capacités d'IA plus poussées", "Aucune publicité"],
  },
];

export const COMPARISON: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: "Missions par mois", values: ["10", "60", "Illimitées*"] },
  { label: "Parcours guidés (journée, économies, démarches…)", values: [true, true, true] },
  { label: "Assistant conversationnel et voix", values: [true, true, true] },
  { label: "Intégrations externes", values: ["Essentielles", "Étendues", "Toutes"] },
  { label: "Automatisations récurrentes", values: [false, "Basiques", "Avancées"] },
  { label: "Publicité", values: ["Limitée", false, false] },
];

export function PricingCards({ current, onChoose, cta = "Choisir" }: { current?: Plan; onChoose: (p: Plan) => void; cta?: string }) {
  return (
    <div className="pricing">
      {PLANS.map((p) => (
        <div key={p.id} className={`price-card card ${p.highlight ? "card-glow is-highlight" : ""}`}>
          {p.highlight && <span className="price-flag">Le plus choisi</span>}
          <div className="stack gap-4">
            <strong className="price-name">{p.name}</strong>
            <span className="faint" style={{ fontSize: 13.5 }}>
              {p.tagline}
            </span>
          </div>
          <div className="price-amount">
            <span className="tnum">{p.price}</span>
            <small>/ mois</small>
          </div>
          <ul className="price-features">
            {p.features.map((f) => (
              <li key={f}>
                <Check /> {f}
              </li>
            ))}
          </ul>
          <button className={`btn btn-block ${p.highlight ? "btn-primary" : "btn-secondary"}`} onClick={() => onChoose(p.id)} disabled={current === p.id}>
            {current === p.id ? "Formule actuelle" : cta}
          </button>
        </div>
      ))}
    </div>
  );
}

export function ComparisonTable() {
  return (
    <div className="compare-table card" role="table" aria-label="Comparaison des formules">
      <div className="ct-row ct-head" role="row">
        <span role="columnheader" />
        {PLANS.map((p) => (
          <span key={p.id} role="columnheader">
            {p.name}
          </span>
        ))}
      </div>
      {COMPARISON.map((r) => (
        <div key={r.label} className="ct-row" role="row">
          <span role="cell">{r.label}</span>
          {r.values.map((v, i) => (
            <span key={i} role="cell" className="ct-val">
              {v === true ? <Check className="ok" /> : v === false ? <Minus className="no" /> : v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
