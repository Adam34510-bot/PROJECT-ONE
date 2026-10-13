import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  CircleSlash,
  ExternalLink,
  History,
  Lock,
  MessageCircle,
  MoreHorizontal,
  OctagonAlert,
  PiggyBank,
  Play,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
  Flag,
  Sparkles,
} from "lucide-react";
import { ResultView } from "../components/mission/ResultView";
import { ActionBadge, DemoBadge, Field, Modal, Notice, StatusBadge, toast } from "../components/ui";
import { dateTime, euro, parseNumber, relativeTime } from "../lib/format";
import { missionMeta, STATUS_META } from "../lib/missions";
import { Link, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { useActionRunner } from "../lib/useActions";
import type { MissionAction } from "../lib/types";

export default function MissionDetail({ id }: { id: string }) {
  const m = useStore((s) => s.missions.find((x) => x.id === id));
  const setActionState = useStore((s) => s.setActionState);
  const confirmSavings = useStore((s) => s.confirmSavings);
  const blockMission = useStore((s) => s.blockMission);
  const resumeMission = useStore((s) => s.resumeMission);
  const completeMission = useStore((s) => s.completeMission);
  const deleteMission = useStore((s) => s.deleteMission);
  const addMissionNote = useStore((s) => s.addMissionNote);
  const run = useActionRunner();

  const [savingsOpen, setSavingsOpen] = useState(false);
  const [savingsValue, setSavingsValue] = useState("");
  const [savingsErr, setSavingsErr] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockErr, setBlockErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState("");

  if (!m) {
    return (
      <div className="card card-pad">
        <p>Cette mission n'existe pas ou a été supprimée.</p>
        <Link to="/app/missions" className="btn btn-secondary" style={{ marginTop: 16 }}>
          Retour aux missions
        </Link>
      </div>
    );
  }

  const meta = missionMeta(m.kind);
  const done = m.steps.filter((s) => s.state === "done");
  const todo = m.steps.filter((s) => s.state !== "done");
  const awaiting = m.actions.filter((a) => a.state === "awaiting" || a.state === "prepared");
  const others = m.actions.filter((a) => a.state !== "awaiting" && a.state !== "prepared");

  const submitSavings = () => {
    const n = parseNumber(savingsValue);
    if (!(n > 0) || n > 100000) return setSavingsErr("Indiquez un montant annuel positif, en euros.");
    confirmSavings(m.id, Math.round(n));
    setSavingsOpen(false);
    toast.success("Économie confirmée. Elle apparaît désormais dans votre bilan.");
  };

  return (
    <div className="mission-detail" style={{ ["--hue" as string]: meta.hue }}>
      <div className="row-between" style={{ marginBottom: 18 }}>
        <Link to="/app/missions" className="btn btn-ghost btn-sm">
          <ArrowLeft /> Missions
        </Link>
        <div className="menu-wrap">
          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Plus d'options">
            <MoreHorizontal />
          </button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              {m.kind !== "other" && (
                <button onClick={() => navigate(`/app/nouvelle/${m.kind}?from=${m.id}`)}>
                  <RotateCcw /> Modifier et relancer
                </button>
              )}
              {m.status !== "blocked" && m.status !== "done" && (
                <button
                  onClick={() => {
                    setMenu(false);
                    setBlockOpen(true);
                  }}
                >
                  <Flag /> Signaler un blocage
                </button>
              )}
              {m.status !== "done" && (
                <button
                  onClick={() => {
                    completeMission(m.id);
                    setMenu(false);
                    toast.success("Mission marquée comme terminée.");
                  }}
                >
                  <CheckCircle2 /> Marquer comme terminée
                </button>
              )}
              <button className="danger" onClick={() => (setMenu(false), setDeleteOpen(true))}>
                <Trash2 /> Supprimer la mission
              </button>
            </div>
          )}
        </div>
      </div>

      <header className="md-head reveal">
        <span className="icon-tile lg">
          <meta.icon />
        </span>
        <div className="stack gap-8 grow" style={{ minWidth: 0 }}>
          <div className="row gap-8 wrap">
            <StatusBadge status={m.status} />
            {m.demo && <DemoBadge />}
            <span className="faint" style={{ fontSize: 13 }}>
              Mise à jour {relativeTime(m.updatedAt)}
            </span>
          </div>
          <h1 className="page-title">{m.title}</h1>
          <p className="md-request">
            <span className="eyebrow">Demande initiale</span>« {m.request} »
          </p>
        </div>
      </header>

      {m.status === "blocked" && m.blocker && (
        <div className="blocker card reveal">
          <OctagonAlert className="blocker-ico" />
          <div className="grow stack gap-8">
            <strong>Ce qui bloque</strong>
            <p>{m.blocker.reason}</p>
            <strong style={{ marginTop: 6 }}>Ce que je vous propose</strong>
            <p className="muted">{m.blocker.alternative}</p>
            {m.blocker.link && (
              <a className="btn btn-secondary btn-sm" href={m.blocker.link.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start" }}>
                <ExternalLink /> {m.blocker.link.label}
              </a>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resumeMission(m.id);
              toast.success("Mission reprise là où elle s'était arrêtée.");
            }}
          >
            <Play /> Reprendre
          </button>
        </div>
      )}
      {m.status !== "blocked" && m.blocker && (
        <Notice icon={<OctagonAlert />}>
          <strong>Point d'attention :</strong> {m.blocker.reason} {m.blocker.alternative}
        </Notice>
      )}

      <div className="md-grid">
        <div className="stack gap-16">
          {awaiting.length > 0 && (
            <section className="card card-pad reveal reveal-1 validate-card">
              <div className="card-head">
                <span className="card-title">
                  <ShieldCheck /> Actions qui nécessitent votre accord
                </span>
              </div>
              <p className="faint" style={{ fontSize: 13, marginTop: -8, marginBottom: 14 }}>
                Rien n'est exécuté sans votre validation. Chaque action indique précisément ce qui va se passer.
              </p>
              <div className="stack gap-12">
                {awaiting.map((a) => (
                  <ActionCard
                    key={a.id}
                    a={a}
                    onValidate={() => run(m.id, a)}
                    onDecline={() => setActionState(m.id, a.id, "declined")}
                    onComplete={m.kind !== "other" ? () => navigate(`/app/nouvelle/${m.kind}?from=${m.id}`) : undefined}
                  />
                ))}
              </div>
            </section>
          )}

          {m.result ? (
            <section className="card card-pad reveal reveal-2">
              <div className="card-head">
                <span className="card-title">
                  <Sparkles /> Résultat préparé
                </span>
                {m.demo && <DemoBadge />}
              </div>
              <ResultView result={m.result} />
            </section>
          ) : (
            <section className="card card-pad reveal reveal-2">
              <div className="card-head">
                <span className="card-title">
                  <MessageCircle /> Mission libre
                </span>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                Cette mission n'a pas de parcours guidé. Continuez avec l'assistant pour la préciser, puis marquez-la comme terminée quand c'est fait.
              </p>
              <div className="row gap-8 wrap" style={{ marginTop: 14 }}>
                <Link to={m.conversationId ? `/app/assistant/${m.conversationId}` : "/app/assistant"} className="btn btn-secondary btn-sm">
                  <MessageCircle /> Continuer avec l'assistant
                </Link>
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="card card-pad reveal reveal-3">
              <div className="card-head">
                <span className="card-title">
                  <Lock /> Autres actions
                </span>
              </div>
              <div className="stack gap-12">
                {others.map((a) => (
                  <ActionCard key={a.id} a={a} />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="stack gap-16">
          <section className="card card-pad reveal reveal-1">
            <div className="card-head">
              <span className="card-title">Étapes</span>
              <span className="faint mono" style={{ fontSize: 12 }}>
                {done.length}/{m.steps.length}
              </span>
            </div>
            <ol className="step-track">
              {m.steps.map((s) => (
                <li key={s.id} data-state={s.state}>
                  <span className="st-ico">{s.state === "done" ? <Check size={12} /> : s.state === "blocked" ? <X size={12} /> : <Circle size={8} />}</span>
                  <span className="grow">
                    {s.label}
                    {s.at && <small className="faint">{dateTime(s.at)}</small>}
                  </span>
                </li>
              ))}
            </ol>
            {todo.length > 0 && <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>{todo.length} étape(s) restante(s). {STATUS_META[m.status].description}</p>}
          </section>

          <section className="card card-pad reveal reveal-2">
            <div className="card-head">
              <span className="card-title">
                <PiggyBank /> Économies
              </span>
            </div>
            {m.confirmedSavings ? (
              <div className="savings-confirmed">
                <CheckCircle2 />
                <div>
                  <strong className="tnum">{euro(m.confirmedSavings)} / an</strong>
                  <small>Confirmée par vous</small>
                </div>
              </div>
            ) : m.estimatedSavings ? (
              <div className="stack gap-12">
                <div className="savings-estimated">
                  <span className="tnum">≈ {euro(m.estimatedSavings)} / an</span>
                  <small>Estimation : pas encore obtenue</small>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => (setSavingsValue(String(m.estimatedSavings ?? "")), setSavingsErr(""), setSavingsOpen(true))}>
                  J'ai constaté cette économie
                </button>
              </div>
            ) : (
              <div className="stack gap-12">
                <p className="faint" style={{ fontSize: 13.5 }}>Aucune économie associée à cette mission.</p>
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => (setSavingsValue(""), setSavingsErr(""), setSavingsOpen(true))}>
                  Déclarer une économie constatée
                </button>
              </div>
            )}
          </section>

          <section className="card card-pad reveal reveal-3">
            <div className="card-head">
              <span className="card-title">
                <History /> Historique
              </span>
            </div>
            <ul className="timeline">
              {[...m.history].reverse().map((h, i) => (
                <li key={i} data-tone={h.tone}>
                  <span className="tl-dot" />
                  <span className="grow">
                    {h.text}
                    <small className="faint">{dateTime(h.at)}</small>
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="note-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                addMissionNote(m.id, note.trim());
                setNote("");
              }}
            >
              <input className="input" placeholder="Ajouter une note…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Ajouter une note" />
              <button className="btn btn-secondary btn-sm" disabled={!note.trim()}>
                Ajouter
              </button>
            </form>
          </section>
        </div>
      </div>

      <Modal
        open={savingsOpen}
        onClose={() => setSavingsOpen(false)}
        title="Confirmer une économie"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setSavingsOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-success" onClick={submitSavings}>
              Confirmer
            </button>
          </>
        }
      >
        <p style={{ marginBottom: 16 }}>Ne confirmez que ce que vous avez réellement constaté (nouvelle facture, contrat signé, résiliation effective). Ce montant sera compté comme économie obtenue.</p>
        <Field label="Économie annuelle constatée" error={savingsErr} htmlFor="sv">
          <div className="input-affix">
            <input id="sv" className="input" inputMode="decimal" value={savingsValue} onChange={(e) => setSavingsValue(e.target.value)} aria-invalid={Boolean(savingsErr)} autoFocus />
            <span>€ / an</span>
          </div>
        </Field>
      </Modal>

      <Modal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Signaler un blocage"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setBlockOpen(false)}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (blockReason.trim().length < 8) return setBlockErr("Décrivez le blocage en quelques mots.");
                blockMission(m.id, blockReason.trim(), "Le suivi est conservé. Quand le point est réglé, cliquez sur « Reprendre » : la mission repart de l'étape en cours. Vous pouvez aussi écrire au support depuis la page Support.");
                setBlockOpen(false);
                setBlockReason("");
                toast.info("Mission marquée comme bloquée. Son suivi est conservé.");
              }}
            >
              Signaler
            </button>
          </>
        }
      >
        <Field label="Qu'est-ce qui bloque ?" error={blockErr} htmlFor="br">
          <textarea id="br" className="textarea" value={blockReason} onChange={(e) => (setBlockReason(e.target.value), setBlockErr(""))} placeholder="Ex. le site demande un identifiant que je n'ai pas." />
        </Field>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer cette mission ?"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
              Annuler
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                deleteMission(m.id);
                toast.success("Mission supprimée.");
                navigate("/app/missions", { replace: true });
              }}
            >
              Supprimer
            </button>
          </>
        }
      >
        La mission, son historique et les éléments d'agenda associés seront effacés (ainsi que de votre sauvegarde en ligne si vous êtes connecté).
      </Modal>
    </div>
  );
}

function ActionCard({ a, onValidate, onDecline, onComplete }: { a: MissionAction; onValidate?: () => void; onDecline?: () => void; onComplete?: () => void }) {
  const icon =
    a.state === "executed" ? <CheckCircle2 className="ac-ico ok" /> : a.state === "unavailable" ? <CircleSlash className="ac-ico muted" /> : a.state === "declined" ? <XCircle className="ac-ico muted" /> : a.state === "handed_off" ? <ExternalLink className="ac-ico info" /> : <ShieldCheck className="ac-ico warn" />;
  return (
    <div className="action-card" data-state={a.state}>
      <div className="row gap-12" style={{ alignItems: "flex-start" }}>
        {icon}
        <div className="grow stack gap-4">
          <strong>{a.label}</strong>
          <span className="faint" style={{ fontSize: 13.5 }}>
            {a.state === "unavailable" && a.unavailableReason ? a.unavailableReason : a.description}
          </span>
          {a.doneAt && a.state !== "unavailable" && <small className="faint">{dateTime(a.doneAt)}</small>}
        </div>
      </div>
      <div className="action-row">
        <ActionBadge state={a.state} />
        {a.state === "awaiting" && onValidate && (
          <div className="row gap-8">
            <button className="btn btn-ghost btn-sm" onClick={onDecline}>
              <X /> Refuser
            </button>
            <button className="btn btn-success btn-sm" onClick={onValidate}>
              <Check /> Valider et exécuter
            </button>
          </div>
        )}
        {a.state === "prepared" && (
          <button className="btn btn-secondary btn-sm" onClick={onComplete} disabled={!onComplete}>
            Compléter les informations
          </button>
        )}
      </div>
    </div>
  );
}
