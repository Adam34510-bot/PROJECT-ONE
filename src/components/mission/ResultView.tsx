import { useState } from "react";
import { AlertTriangle, Copy, Crown, ExternalLink, FileText, Check } from "lucide-react";
import { copyText, euro } from "../../lib/format";
import type { MissionResult } from "../../lib/types";
import { toast } from "../ui";

export function ResultView({ result }: { result: MissionResult }) {
  switch (result.type) {
    case "day":
      return (
        <div className="stack gap-12">
          <div className="day-plan">
            {result.blocks.map((b, i) => (
              <div key={i} className="day-block" data-kind={b.kind}>
                <span className="mono day-time">
                  {b.start}
                  <small>{b.end}</small>
                </span>
                <span className="day-bar" />
                <span className="grow">
                  <strong>{b.label}</strong>
                  <small>{b.kind === "focus" ? "Priorité, bloc de concentration" : b.kind === "fixed" ? "Horaire fixe" : b.kind === "break" ? "Pause" : "Tâche"}</small>
                </span>
              </div>
            ))}
          </div>
          {result.overflow.length > 0 && (
            <div className="notice" data-tone="danger">
              <AlertTriangle />
              <div>
                <strong>À reporter :</strong> {result.overflow.join(", ")}. La journée est pleine ; je vous conseille de les déplacer à demain.
              </div>
            </div>
          )}
        </div>
      );

    case "compare": {
      const max = Math.max(...result.offers.map((o) => o.total));
      return (
        <div className="stack gap-12">
          <div className="compare-list">
            {result.offers.map((o) => (
              <div key={o.name} className="compare-item" data-winner={o.name === result.winner}>
                <div className="row-between">
                  <strong className="row gap-8">
                    {o.name === result.winner && <Crown size={16} className="crown" />}
                    {o.name}
                  </strong>
                  <span className="score">
                    {o.score}
                    <small>/100</small>
                  </span>
                </div>
                <div className="compare-bar">
                  <span style={{ width: `${(o.total / max) * 100}%` }} />
                </div>
                <div className="row-between faint" style={{ fontSize: 13 }}>
                  <span>
                    {euro(o.monthly, true)} / mois
                  </span>
                  <span className="tnum">
                    Total {result.horizon} mois : <strong style={{ color: "var(--text)" }}>{euro(o.total, true)}</strong>
                  </span>
                </div>
                {(o.pros.length > 0 || o.cons.length > 0) && (
                  <div className="proscons">
                    {o.pros.map((p) => (
                      <span key={p} className="pro">
                        + {p}
                      </span>
                    ))}
                    {o.cons.map((p) => (
                      <span key={p} className="con">
                        − {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <ul className="reasoning">
            {result.reasoning.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      );
    }

    case "savings":
      return (
        <div className="stack gap-12">
          <div className="savings-total">
            <span className="faint">Économie estimée</span>
            <strong className="tnum">
              {euro(result.totalLow)} à {euro(result.totalHigh)} <small>/ an</small>
            </strong>
            <span className="badge" data-tone="muted">
              Estimation, non obtenue
            </span>
          </div>
          <div className="savings-list">
            {result.leads.map((l) => (
              <div key={l.category} className="savings-item">
                <div className="row-between">
                  <strong>{l.category}</strong>
                  <span className="tnum faint">{euro(l.current)} / an aujourd'hui</span>
                </div>
                <div className="savings-range">
                  <span style={{ width: `${l.current ? Math.min(100, (l.high / l.current) * 100) : 0}%` }} />
                </div>
                <div className="row-between" style={{ fontSize: 13 }}>
                  <span className="faint">{l.tip}</span>
                  <span className="tnum" style={{ whiteSpace: "nowrap" }}>
                    {l.high ? `${euro(l.low)} – ${euro(l.high)}` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 12.5 }}>
            Fourchettes indicatives basées sur des écarts de prix courants du marché français. Elles servent à prioriser, pas à promettre un résultat.
          </p>
        </div>
      );

    case "admin":
      return <LetterView letter={result.letter} checklist={result.checklist} />;

    case "travel": {
      const total = result.budget.reduce((s, b) => s + b.amount, 0);
      const colors = ["var(--hue-violet)", "var(--hue-blue)", "var(--hue-cyan)", "var(--hue-pink)"];
      return (
        <div className="stack gap-16">
          <div>
            <div className="budget-bar">
              {result.budget.map((b, i) => (
                <span key={b.label} style={{ width: `${(b.amount / total) * 100}%`, background: colors[i] }} title={`${b.label} : ${euro(b.amount)}`} />
              ))}
            </div>
            <div className="budget-legend">
              {result.budget.map((b, i) => (
                <span key={b.label}>
                  <i style={{ background: colors[i] }} />
                  {b.label} <strong className="tnum">{euro(b.amount)}</strong>
                </span>
              ))}
            </div>
          </div>
          <div className="itinerary">
            {result.itinerary.map((d) => (
              <div key={d.day} className="it-day">
                <span className="eyebrow">{d.day}</span>
                <ul>
                  {d.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Checklist items={result.checklist} title="À prévoir" />
          <div className="chips">
            {result.links.map((l) => (
              <a key={l.url} className="chip" href={l.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> {l.label}
              </a>
            ))}
          </div>
        </div>
      );
    }

    case "subscriptions":
      return (
        <div className="stack gap-12">
          <div className="row gap-16 wrap">
            <div className="mini-stat">
              <span className="faint">Total mensuel</span>
              <strong className="tnum">{euro(result.monthlyTotal, true)}</strong>
            </div>
            <div className="mini-stat">
              <span className="faint">Soit par an</span>
              <strong className="tnum">{euro(result.monthlyTotal * 12)}</strong>
            </div>
            <div className="mini-stat">
              <span className="faint">Économie possible (estimée)</span>
              <strong className="tnum">{euro(result.potentialYearly)} / an</strong>
            </div>
          </div>
          <div className="sub-table" role="table">
            {result.items.map((s) => (
              <div key={s.name} className="sub-row" role="row">
                <span className="grow" role="cell">
                  <strong>{s.name}</strong>
                  <small className="faint"> · usage {s.usage}</small>
                </span>
                <span className="tnum" role="cell">
                  {euro(s.monthly, true)}/mois
                </span>
                <span role="cell">
                  <span className="badge" data-tone={s.verdict === "résilier" ? "danger" : s.verdict === "à revoir" ? "warning" : "success"}>
                    {s.verdict}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case "appointment":
      return (
        <div className="grid-2">
          <Checklist items={result.questions} title="Questions à poser" />
          <Checklist items={result.documents} title="Documents à apporter" />
        </div>
      );
  }
}

function Checklist({ items, title }: { items: string[]; title: string }) {
  const [done, setDone] = useState<number[]>([]);
  return (
    <div className="checklist">
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {items.map((it, i) => (
        <label key={it} className="check-item">
          <input type="checkbox" checked={done.includes(i)} onChange={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} />
          <span className="box">{done.includes(i) && <Check size={12} />}</span>
          <span>{it}</span>
        </label>
      ))}
    </div>
  );
}

function LetterView({ letter, checklist }: { letter: string; checklist: string[] }) {
  return (
    <div className="stack gap-16">
      <div className="letter">
        <div className="letter-head">
          <span className="row gap-8">
            <FileText size={15} /> Courrier prêt à relire
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => ((await copyText(letter)) ? toast.success("Courrier copié.") : toast.error("Copie impossible."))}
          >
            <Copy /> Copier
          </button>
        </div>
        <pre className="letter-body">{letter}</pre>
      </div>
      <Checklist items={checklist} title="Pièces et vérifications" />
    </div>
  );
}
