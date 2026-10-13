import { useMemo, useState } from "react";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import { DemoBadge, EmptyState, PageHeader, Segmented, StatusBadge } from "../components/ui";
import { euro, relativeTime } from "../lib/format";
import { MISSIONS, missionMeta, STATUS_META } from "../lib/missions";
import { Link } from "../lib/router";
import { useStore } from "../lib/store";
import type { MissionStatus } from "../lib/types";

type Filter = "all" | MissionStatus;

export default function Missions() {
  const missions = useStore((s) => s.missions);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);

  const count = (s: MissionStatus) => missions.filter((m) => m.status === s).length;
  const list = useMemo(
    () =>
      missions
        .filter((m) => filter === "all" || m.status === filter)
        .filter((m) => !q.trim() || `${m.title} ${m.request}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [missions, filter, q],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Centre des missions"
        title={
          <>
            Tout ce que vous m'avez <span className="serif grad-text">confié</span>
          </>
        }
        subtitle="Chaque mission garde sa demande, ses étapes, ses résultats et son historique. Vous pouvez la reprendre à tout moment."
        actions={
          <button className="btn btn-primary" onClick={() => setShowNew((v) => !v)} aria-expanded={showNew}>
            <Plus /> Nouvelle mission
          </button>
        }
      />

      {showNew && (
        <div className="new-mission-grid reveal">
          {MISSIONS.map((m) => (
            <Link key={m.kind} to={m.kind === "other" ? "/app/assistant" : `/app/nouvelle/${m.kind}`} className="quick-tile compact" style={{ ["--hue" as string]: m.hue }}>
              <span className="icon-tile sm">
                <m.icon />
              </span>
              <strong>{m.short}</strong>
            </Link>
          ))}
        </div>
      )}

      <div className="toolbar">
        <Segmented<Filter>
          label="Filtrer par statut"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Toutes", count: missions.length },
            { value: "draft", label: STATUS_META.draft.label, count: count("draft") },
            { value: "running", label: STATUS_META.running.label, count: count("running") },
            { value: "awaiting", label: STATUS_META.awaiting.label, count: count("awaiting") },
            { value: "done", label: STATUS_META.done.label, count: count("done") },
            { value: "blocked", label: STATUS_META.blocked.label, count: count("blocked") },
          ]}
        />
        <label className="search">
          <Search />
          <input className="input" placeholder="Rechercher une mission" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une mission" />
        </label>
      </div>

      {filter !== "all" && <p className="faint" style={{ fontSize: 13, margin: "-4px 0 14px" }}>{STATUS_META[filter].description}</p>}

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            title={missions.length ? "Aucune mission ne correspond" : "Aucune mission pour l'instant"}
            text={missions.length ? "Essayez un autre filtre ou une autre recherche." : "Lancez une mission rapide ou écrivez à l'assistant : elle apparaîtra ici avec son suivi."}
            action={
              <Link to="/app/nouvelle/day" className="btn btn-secondary">
                Organiser ma journée
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mission-grid">
          {list.map((m, i) => {
            const meta = missionMeta(m.kind);
            const doneSteps = m.steps.filter((s) => s.state === "done").length;
            const pct = m.steps.length ? Math.round((doneSteps / m.steps.length) * 100) : 0;
            const toValidate = m.actions.filter((a) => a.state === "awaiting").length;
            return (
              <Link key={m.id} to={`/app/missions/${m.id}`} className="mission-card card card-hover reveal" style={{ ["--hue" as string]: meta.hue, animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <div className="row-between">
                  <span className="row gap-8">
                    <span className="icon-tile sm">
                      <meta.icon />
                    </span>
                    <span className="eyebrow">{meta.short}</span>
                  </span>
                  <ArrowUpRight className="faint mc-arrow" size={18} />
                </div>
                <h3 className="mc-title">{m.title}</h3>
                <p className="mc-req faint">« {m.request} »</p>
                <div className="progress" aria-label={`${pct} % des étapes réalisées`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="row-between wrap" style={{ gap: 8 }}>
                  <div className="row gap-8 wrap">
                    <StatusBadge status={m.status} />
                    {m.demo && <DemoBadge />}
                  </div>
                  <small className="faint">{relativeTime(m.updatedAt)}</small>
                </div>
                {(toValidate > 0 || m.confirmedSavings || m.estimatedSavings) && (
                  <div className="mc-foot">
                    {toValidate > 0 && <span className="mc-pill warn">{toValidate} à valider</span>}
                    {m.confirmedSavings ? <span className="mc-pill ok">{euro(m.confirmedSavings)}/an confirmés</span> : m.estimatedSavings ? <span className="mc-pill">≈ {euro(m.estimatedSavings)}/an estimés</span> : null}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
