import { useMemo } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Hourglass, PiggyBank, Activity, CheckCircle2, Plus, Info } from "lucide-react";
import { Composer } from "../components/chat/Composer";
import { Orb, StatusBadge, DemoBadge, EmptyState } from "../components/ui";
import { Sparkline } from "../components/ui/charts";
import { useAiMode } from "../lib/ai/client";
import { sendMessage, usePending } from "../lib/chat";
import { euro, greeting, isoDay, minutesLabel, relativeTime, dateLong } from "../lib/format";
import { MISSIONS, missionMeta } from "../lib/missions";
import { Link, navigate } from "../lib/router";
import { computeStats, KPI_DEFINITIONS, monthlySeries } from "../lib/stats";
import { useStore } from "../lib/store";
import { useVoice } from "../lib/voice";

const SUGGESTIONS = [
  "Organise ma journée de demain",
  "Trouve-moi un moyen de réduire mes factures",
  "Organise un week-end avec un budget de 300 €",
  "Rappelle-moi d'appeler la banque demain à 10h",
];

export default function Home() {
  const profile = useStore((s) => s.profile);
  const missions = useStore((s) => s.missions);
  const agenda = useStore((s) => s.agenda);
  const audit = useStore((s) => s.audit);
  const toggleAgendaItem = useStore((s) => s.toggleAgendaItem);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const mode = useAiMode();
  const voice = useVoice();
  const pending = usePending((s) => s.ids.length > 0);

  const stats = useMemo(() => computeStats(missions, { includeDemo: true }), [missions]);
  const series = useMemo(() => monthlySeries(missions, 6, true), [missions]);
  const today = isoDay();
  const todayItems = agenda.filter((a) => a.date === today).sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));
  const awaiting = missions.filter((m) => m.status === "awaiting").slice(0, 4);
  const active = missions.filter((m) => m.status === "running" || m.status === "draft" || m.status === "blocked").slice(0, 4);

  const send = (text: string, viaVoice: boolean) => {
    const { conversationId, done } = sendMessage(mode, text);
    if (viaVoice) done.then((m) => (settings.voiceReplies ? voice.speak(m.text) : voice.setState("idle")));
    navigate(`/app/assistant/${conversationId}`);
  };

  const name = profile.name.trim();
  const summary =
    stats.awaiting > 0
      ? `${stats.awaiting} mission${stats.awaiting > 1 ? "s attendent" : " attend"} votre validation.`
      : todayItems.length
        ? `${todayItems.filter((t) => !t.done).length} élément(s) au programme aujourd'hui.`
        : "Rien ne vous attend. Que voulez-vous accomplir ?";

  return (
    <div className="home">
      <section className="home-hero card card-glow reveal">
        <div className="home-hero-bg" aria-hidden="true" />
        <div className="home-hero-head">
          <Orb size="lg" state={voice.state} />
          <div className="stack gap-8">
            <span className="eyebrow">{dateLong(new Date().toISOString())}</span>
            <h1 className="home-title">
              {greeting()}
              {name ? (
                <>
                  , <span className="serif grad-text">{name}</span>.
                </>
              ) : (
                "."
              )}
            </h1>
            <p className="muted">{summary}</p>
          </div>
        </div>
        <Composer
          large
          onSend={send}
          voice={voice}
          busy={pending}
          placeholder="Que voulez-vous accomplir ?"
          voiceReplies={settings.voiceReplies}
          onToggleVoiceReplies={() => updateSettings({ voiceReplies: !settings.voiceReplies })}
        />
        <div className="chips suggestion-chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s, false)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="section reveal reveal-1">
        <div className="section-title">
          <span>Missions rapides</span>
          <Link to="/app/missions">Toutes mes missions</Link>
        </div>
        <div className="quick-grid">
          {MISSIONS.map((m) => (
            <Link key={m.kind} to={m.kind === "other" ? "/app/assistant" : `/app/nouvelle/${m.kind}`} className="quick-tile" style={{ ["--hue" as string]: m.hue }}>
              <span className="icon-tile">
                <m.icon />
              </span>
              <span className="quick-text">
                <strong>{m.label}</strong>
                <small>{m.description}</small>
              </span>
              <ArrowRight className="quick-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="section reveal reveal-2">
        <div className="section-title">
          <span className="row gap-8">
            Mes résultats {stats.hasDemo && <DemoBadge label="Inclut la démo" />}
          </span>
          <Link to="/app/bilan">Voir le bilan</Link>
        </div>
        <div className="kpi-grid">
          <Kpi icon={<PiggyBank />} hue="var(--hue-green)" label="Économies confirmées" value={euro(stats.confirmed)} unit="/ an" def={KPI_DEFINITIONS.confirmed} spark={series.map((s) => s.confirmed)} />
          <Kpi icon={<Clock3 />} hue="var(--hue-blue)" label="Temps gagné estimé" value={minutesLabel(stats.timeSaved)} def={KPI_DEFINITIONS.time} spark={series.map((s) => s.time)} />
          <Kpi icon={<CheckCircle2 />} hue="var(--hue-violet)" label="Missions terminées" value={String(stats.done)} def={KPI_DEFINITIONS.done} spark={series.map((s) => s.done)} />
          <Kpi icon={<Hourglass />} hue="var(--hue-amber)" label="À valider" value={String(stats.awaiting)} def={KPI_DEFINITIONS.awaiting} sub={`${stats.running} en cours · ${stats.blocked} bloquée${stats.blocked > 1 ? "s" : ""}`} />
        </div>
        {stats.estimated > 0 && (
          <p className="estimate-note">
            <Info size={14} /> {euro(stats.estimated)} / an d'économies <strong>estimées</strong> restent à vérifier : elles ne sont pas comptées comme obtenues.
          </p>
        )}
      </section>

      <div className="home-columns">
        <section className="card card-pad reveal reveal-3">
          <div className="card-head">
            <span className="card-title">
              <Hourglass /> En attente de votre validation
            </span>
          </div>
          {awaiting.length ? (
            <div className="mission-rows">
              {awaiting.map((m) => (
                <MissionRow key={m.id} id={m.id} />
              ))}
            </div>
          ) : (
            <EmptyState title="Aucune validation en attente" text="Quand l'assistant prépare une action, elle apparaît ici. Rien n'est exécuté sans votre accord." />
          )}
          {active.length > 0 && (
            <>
              <div className="card-head" style={{ marginTop: 20 }}>
                <span className="card-title">
                  <Activity /> En cours et bloquées
                </span>
              </div>
              <div className="mission-rows">
                {active.map((m) => (
                  <MissionRow key={m.id} id={m.id} />
                ))}
              </div>
            </>
          )}
        </section>

        <div className="stack gap-16">
          <section className="card card-pad reveal reveal-3">
            <div className="card-head">
              <span className="card-title">
                <CalendarDays /> Aujourd'hui
              </span>
              <Link to="/app/nouvelle/day" className="btn btn-ghost btn-sm">
                <Plus /> Planifier
              </Link>
            </div>
            {todayItems.length ? (
              <ul className="agenda">
                {todayItems.map((a) => (
                  <li key={a.id} data-kind={a.kind} data-done={a.done}>
                    <button className="agenda-check" onClick={() => toggleAgendaItem(a.id)} aria-label={a.done ? "Marquer comme non fait" : "Marquer comme fait"} aria-pressed={a.done}>
                      {a.done && <Check size={12} />}
                    </button>
                    <span className="agenda-time mono">{a.start ?? "—"}</span>
                    <span className="grow agenda-label">{a.label}</span>
                    {a.demo && <DemoBadge />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>
                Votre agenda du jour est vide. Lancez « Organiser ma journée » pour le remplir.
              </p>
            )}
          </section>

          <section className="card card-pad reveal reveal-4">
            <div className="card-head">
              <span className="card-title">
                <Activity /> Dernières actions
              </span>
            </div>
            {audit.length ? (
              <ul className="timeline compact">
                {audit.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <span className="tl-dot" />
                    <span className="grow">{e.text}</span>
                    <span className="faint tl-time">{relativeTime(e.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>
                L'historique de vos actions apparaîtra ici.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, hue, label, value, unit, def, spark, sub }: { icon: React.ReactNode; hue: string; label: string; value: string; unit?: string; def: string; spark?: number[]; sub?: string }) {
  return (
    <div className="kpi card" style={{ ["--hue" as string]: hue }}>
      <div className="row-between">
        <span className="icon-tile sm">{icon}</span>
        <span className="kpi-info" tabIndex={0} aria-label={`Définition : ${def}`}>
          <Info size={14} />
          <span className="kpi-tip" role="tooltip">
            {def}
          </span>
        </span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value tnum">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {spark ? <Sparkline values={spark} color={hue} height={30} /> : <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function MissionRow({ id }: { id: string }) {
  const m = useStore((s) => s.missions.find((x) => x.id === id));
  if (!m) return null;
  const meta = missionMeta(m.kind);
  const pendingActions = m.actions.filter((a) => a.state === "awaiting").length;
  return (
    <Link to={`/app/missions/${m.id}`} className="mission-row" style={{ ["--hue" as string]: meta.hue }}>
      <span className="icon-tile sm">
        <meta.icon />
      </span>
      <span className="grow stack" style={{ minWidth: 0 }}>
        <span className="row gap-8" style={{ minWidth: 0 }}>
          <strong className="truncate">{m.title}</strong>
          {m.demo && <DemoBadge />}
        </span>
        <small className="faint truncate">
          {m.status === "awaiting" && pendingActions ? `${pendingActions} action${pendingActions > 1 ? "s" : ""} à valider · ` : ""}
          {m.status === "blocked" && m.blocker ? `${m.blocker.reason.slice(0, 60)}… · ` : ""}
          {relativeTime(m.updatedAt)}
        </small>
      </span>
      <StatusBadge status={m.status} />
    </Link>
  );
}
