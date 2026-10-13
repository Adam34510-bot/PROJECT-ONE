import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Hourglass, PiggyBank, TrendingUp, BookOpen } from "lucide-react";
import { DemoBadge, EmptyState, PageHeader, Segmented, Switch } from "../components/ui";
import { BarChart, Ring } from "../components/ui/charts";
import { euro, minutesLabel } from "../lib/format";
import { MISSIONS } from "../lib/missions";
import { Link } from "../lib/router";
import { computeStats, KPI_DEFINITIONS, monthlySeries } from "../lib/stats";
import { useStore } from "../lib/store";

type Period = "30" | "90" | "365" | "all";
const PERIOD_MONTHS: Record<Period, number> = { "30": 3, "90": 4, "365": 12, all: 12 };

export default function Bilan() {
  const missions = useStore((s) => s.missions);
  const [period, setPeriod] = useState<Period>("90");
  const [includeDemo, setIncludeDemo] = useState(true);

  const sinceDays = period === "all" ? undefined : Number(period);
  const stats = useMemo(() => computeStats(missions, { includeDemo, sinceDays }), [missions, includeDemo, sinceDays]);
  const prev = useMemo(() => {
    if (!sinceDays) return null;
    const older = missions.filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return t < Date.now() - sinceDays * 86400000 && t >= Date.now() - 2 * sinceDays * 86400000;
    });
    return computeStats(older, { includeDemo });
  }, [missions, includeDemo, sinceDays]);
  const series = useMemo(() => monthlySeries(missions, PERIOD_MONTHS[period], includeDemo), [missions, period, includeDemo]);
  const byKind = useMemo(
    () =>
      MISSIONS.filter((k) => k.kind !== "other")
        .map((k) => ({ meta: k, count: stats.list.filter((m) => m.kind === k.kind).length, done: stats.list.filter((m) => m.kind === k.kind && m.status === "done").length }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count),
    [stats.list],
  );
  const maxKind = Math.max(1, ...byKind.map((b) => b.count));
  const total = stats.list.length;
  const trend = (cur: number, old?: number) => {
    if (old === undefined || prev === null) return null;
    if (old === 0) return cur > 0 ? "Nouveau sur la période" : null;
    const d = Math.round(((cur - old) / old) * 100);
    return `${d >= 0 ? "+" : ""}${d} % vs période précédente`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Bilan personnel"
        title={
          <>
            Ce que l'assistant vous a <span className="serif grad-text">rapporté</span>
          </>
        }
        subtitle="Les économies confirmées et les estimations sont toujours séparées. Chaque indicateur a une définition précise, en bas de page."
      />

      <div className="toolbar">
        <Segmented<Period>
          label="Période"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "30", label: "30 jours" },
            { value: "90", label: "3 mois" },
            { value: "365", label: "12 mois" },
            { value: "all", label: "Tout" },
          ]}
        />
        <label className="row gap-8" style={{ fontSize: 13.5, color: "var(--text-2)" }}>
          <Switch checked={includeDemo} onChange={setIncludeDemo} label="Inclure les données de démonstration" />
          Inclure la démo {stats.hasDemo && includeDemo && <DemoBadge />}
        </label>
      </div>

      {total === 0 ? (
        <div className="card">
          <EmptyState
            title="Pas encore de données sur cette période"
            text="Terminez une mission ou confirmez une économie : votre bilan se construira automatiquement."
            action={
              <Link className="btn btn-secondary" to="/app/nouvelle/savings">
                Trouver des économies
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="bilan-hero card card-glow reveal">
            <div className="bh-main">
              <span className="eyebrow">Économies confirmées sur la période</span>
              <strong className="bh-value tnum">{euro(stats.confirmed)}</strong>
              <span className="muted">par an, constatées et confirmées par vous</span>
              {trend(stats.confirmed, prev?.confirmed) && (
                <span className="badge" data-tone="success" style={{ alignSelf: "flex-start", marginTop: 6 }}>
                  <TrendingUp /> {trend(stats.confirmed, prev?.confirmed)}
                </span>
              )}
            </div>
            <div className="bh-side">
              <div className="bh-est">
                <span className="faint">Estimations à vérifier</span>
                <strong className="tnum">≈ {euro(stats.estimated)} / an</strong>
                <small className="faint">Non comptées comme obtenues</small>
              </div>
              <Ring value={stats.done} max={total} size={92} stroke={9} color="var(--hue-violet)">
                <div style={{ textAlign: "center", lineHeight: 1.1 }}>
                  <strong className="tnum" style={{ fontSize: 20 }}>{Math.round((stats.done / total) * 100)}%</strong>
                  <div className="faint" style={{ fontSize: 10.5 }}>terminées</div>
                </div>
              </Ring>
            </div>
          </div>

          <div className="kpi-grid" style={{ marginTop: 16 }}>
            <MiniKpi icon={<Clock3 />} hue="var(--hue-blue)" label="Temps gagné estimé" value={minutesLabel(stats.timeSaved)} sub={trend(stats.timeSaved, prev?.timeSaved)} />
            <MiniKpi icon={<CheckCircle2 />} hue="var(--hue-violet)" label="Missions terminées" value={String(stats.done)} sub={trend(stats.done, prev?.done)} />
            <MiniKpi icon={<Hourglass />} hue="var(--hue-amber)" label="En attente de validation" value={String(stats.awaiting)} sub={`${stats.running} en cours`} />
            <MiniKpi icon={<PiggyBank />} hue="var(--hue-green)" label="Missions avec économie confirmée" value={String(stats.list.filter((m) => m.confirmedSavings).length)} sub={`sur ${total} missions`} />
          </div>

          <div className="bilan-charts">
            <section className="card card-pad reveal reveal-1">
              <div className="card-head">
                <span className="card-title">Historique mensuel</span>
              </div>
              <BarChart
                data={series.map((s) => ({ label: s.label, value: s.done, secondary: s.created }))}
                format={(n) => `${n} mission${n > 1 ? "s" : ""}`}
                primaryLabel="Terminées"
                secondaryLabel="Créées"
                color="var(--hue-violet)"
                secondaryColor="var(--hue-blue)"
              />
              <div className="legend">
                <span>
                  <i style={{ background: "var(--hue-violet)" }} /> Terminées
                </span>
                <span>
                  <i style={{ background: "var(--hue-blue)" }} /> Créées
                </span>
              </div>
            </section>
            <section className="card card-pad reveal reveal-2">
              <div className="card-head">
                <span className="card-title">Économies confirmées par mois</span>
              </div>
              <BarChart data={series.map((s) => ({ label: s.label, value: s.confirmed }))} format={(n) => `${euro(n)} / an`} primaryLabel="Confirmées" color="var(--hue-green)" />
              <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>Rattachées au mois où la mission a été terminée.</p>
            </section>
          </div>

          <section className="card card-pad reveal reveal-3" style={{ marginTop: 16 }}>
            <div className="card-head">
              <span className="card-title">Répartition par type de mission</span>
            </div>
            <div className="kind-bars">
              {byKind.map(({ meta, count, done }) => (
                <div key={meta.kind} className="kind-bar" style={{ ["--hue" as string]: meta.hue }}>
                  <span className="row gap-8 kb-label">
                    <meta.icon size={15} /> {meta.short}
                  </span>
                  <span className="kb-track">
                    <span style={{ width: `${(count / maxKind) * 100}%` }} />
                    <span className="kb-done" style={{ width: `${(done / maxKind) * 100}%` }} />
                  </span>
                  <span className="mono faint kb-num">
                    {done}/{count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="card card-pad section" style={{ marginTop: 16 }}>
        <div className="card-head">
          <span className="card-title">
            <BookOpen /> Définitions des indicateurs
          </span>
        </div>
        <dl className="defs">
          <dt>Économies confirmées</dt>
          <dd>{KPI_DEFINITIONS.confirmed}</dd>
          <dt>Estimations à vérifier</dt>
          <dd>{KPI_DEFINITIONS.estimated}</dd>
          <dt>Temps gagné estimé</dt>
          <dd>{KPI_DEFINITIONS.time}</dd>
          <dt>Missions terminées</dt>
          <dd>{KPI_DEFINITIONS.done}</dd>
          <dt>En attente de validation</dt>
          <dd>{KPI_DEFINITIONS.awaiting}</dd>
        </dl>
      </section>
    </div>
  );
}

function MiniKpi({ icon, hue, label, value, sub }: { icon: React.ReactNode; hue: string; label: string; value: string; sub?: string | null }) {
  return (
    <div className="kpi card" style={{ ["--hue" as string]: hue }}>
      <span className="icon-tile sm">{icon}</span>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value tnum">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
