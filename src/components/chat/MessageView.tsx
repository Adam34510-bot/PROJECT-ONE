import { Fragment, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Bell, Brain, Check, CircleHelp, Eye, Lightbulb, ListOrdered, ShieldAlert, X, FlaskConical, Sparkles, LogIn, RotateCcw } from "lucide-react";
import { Orb, toast } from "../ui";
import { missionMeta } from "../../lib/missions";
import { Link, navigate } from "../../lib/router";
import { useStore } from "../../lib/store";
import type { ChatBlock, ChatMessage } from "../../lib/types";

/** Rendu Markdown très léger : gras, listes, paragraphes. */
export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`l${out.length}`}>
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((l) => {
    const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (m) list.push(m[1]);
    else {
      flush();
      if (l.trim()) out.push(<p key={`p${out.length}`}>{inline(l)}</p>);
    }
  });
  flush();
  return <div className="rich">{out}</div>;
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
}

export function MessageView({
  msg,
  conversationId,
  onQuickReply,
  previousUserText,
  onRetry,
}: {
  msg: ChatMessage;
  conversationId: string;
  onQuickReply: (t: string) => void;
  previousUserText?: string;
  /** Proposé sur la dernière réponse en erreur : relance la même demande. */
  onRetry?: () => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="msg msg-user">
        <div className="bubble-user">{msg.text}</div>
      </div>
    );
  }
  return (
    <div className="msg msg-assistant">
      <Orb size="sm" />
      <div className="msg-body">
        <div className="msg-meta">
          <span>Assistant</span>
          {msg.mode === "demo" && (
            <span className="tag-demo" title="Réponse issue d'un scénario prédéfini, pas d'une IA">
              <FlaskConical size={11} /> Réponse de démonstration
            </span>
          )}
          {msg.mode === "live" && (
            <span className="tag-live">
              <Sparkles size={11} /> Réponse IA
            </span>
          )}
        </div>
        <div className={`bubble-assistant ${msg.mode === "error" ? "is-error" : ""}`}>
          {msg.mode === "error" && <AlertTriangle size={16} className="err-ico" />}
          <RichText text={msg.text} />
        </div>
        {msg.mode === "error" && (onRetry || msg.errorCode === "auth_required") && (
          <div className="row gap-8 wrap">
            {msg.errorCode === "auth_required" && (
              <Link to="/app/compte" className="btn btn-primary btn-sm">
                <LogIn /> Se connecter
              </Link>
            )}
            {onRetry && (
              <button className="btn btn-secondary btn-sm" onClick={onRetry}>
                <RotateCcw /> Réessayer
              </button>
            )}
          </div>
        )}
        {msg.blocks?.map((b, i) => (
          <Block key={i} block={b} index={i} msg={msg} conversationId={conversationId} onQuickReply={onQuickReply} previousUserText={previousUserText} />
        ))}
      </div>
    </div>
  );
}

function Block({
  block,
  index,
  msg,
  conversationId,
  onQuickReply,
  previousUserText,
}: {
  block: ChatBlock;
  index: number;
  msg: ChatMessage;
  conversationId: string;
  onQuickReply: (t: string) => void;
  previousUserText?: string;
}) {
  const updateBlock = useStore((s) => s.updateBlock);
  const addMemory = useStore((s) => s.addMemory);
  const memoryEnabled = useStore((s) => s.settings.memoryEnabled);
  const addAgendaItems = useStore((s) => s.addAgendaItems);
  const createFreeMission = useStore((s) => s.createFreeMission);
  const log = useStore((s) => s.log);

  switch (block.type) {
    case "steps":
      return (
        <div className="cblock">
          <div className="cblock-title">
            <ListOrdered /> Étapes proposées
          </div>
          <ol className="steps-list">
            {block.items.map((s, i) => (
              <li key={i}>
                <span className="n">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      );
    case "knowledge":
      return (
        <div className="cblock knowledge">
          {block.known.length > 0 && (
            <div>
              <div className="cblock-title">
                <Eye /> Ce que je sais
              </div>
              <ul>
                {block.known.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          )}
          {block.assumptions.length > 0 && (
            <div>
              <div className="cblock-title">
                <Lightbulb /> Ce que je suppose
              </div>
              <ul className="assume">
                {block.assumptions.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case "questions":
      return (
        <div className="cblock">
          {block.items.map((q, i) => (
            <div key={i} className="stack gap-8">
              <div className="cblock-title">
                <CircleHelp /> {q.question}
              </div>
              <div className="chips">
                {q.options.map((o) => (
                  <button key={o} className="chip" onClick={() => onQuickReply(o)}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "mission": {
      const meta = missionMeta(block.kind);
      return (
        <button
          className="cblock mission-launch"
          style={{ ["--hue" as string]: meta.hue }}
          onClick={() => {
            if (block.kind === "other") {
              const id = createFreeMission(previousUserText || "Demande libre", conversationId);
              toast.success("Demande enregistrée dans le centre des missions.");
              navigate(`/app/missions/${id}`);
            } else navigate(`/app/nouvelle/${block.kind}?conv=${conversationId}`);
          }}
        >
          <span className="icon-tile" style={{ ["--hue" as string]: meta.hue }}>
            <meta.icon />
          </span>
          <span className="grow" style={{ textAlign: "left" }}>
            <strong>{block.kind === "other" ? "Enregistrer comme mission" : `Lancer : ${meta.label}`}</strong>
            <small>{block.reason}</small>
          </span>
          <ArrowRight className="arrow" />
        </button>
      );
    }
    case "memory":
      return (
        <div className="cblock">
          <div className="cblock-title">
            <Brain /> Mémoriser cette préférence ?
          </div>
          {block.items.map((it) => (
            <div key={it.id} className="memory-candidate">
              <span className="grow">« {it.text} »</span>
              {it.state === "pending" ? (
                <div className="row gap-8">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!memoryEnabled}
                    title={memoryEnabled ? undefined : "Mémoire désactivée dans les paramètres"}
                    onClick={() => {
                      addMemory({ category: it.category, text: it.text, source: "conversation", confirmed: true });
                      updateBlock(conversationId, msg.id, index, { ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, state: "saved" as const } : x)) });
                      toast.success("Préférence mémorisée. Modifiable dans Mémoire.");
                    }}
                  >
                    <Check /> Retenir
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => updateBlock(conversationId, msg.id, index, { ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, state: "dismissed" as const } : x)) })}>
                    Ignorer
                  </button>
                </div>
              ) : (
                <span className={`badge`} data-tone={it.state === "saved" ? "success" : "muted"}>
                  {it.state === "saved" ? "Mémorisée" : "Ignorée"}
                </span>
              )}
            </div>
          ))}
          {!memoryEnabled && <small className="faint">La mémoire est désactivée dans vos paramètres.</small>}
        </div>
      );
    case "limits":
      return (
        <div className="cblock limits">
          <div className="cblock-title">
            <ShieldAlert /> Ce que je ne peux pas faire ici
          </div>
          <ul>
            {block.items.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </div>
      );
    case "reminder": {
      const when = new Date(`${block.date}T${block.time}`).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      return (
        <div className="cblock action-card" data-state={block.state}>
          <div className="row gap-12">
            <span className="icon-tile sm" style={{ ["--hue" as string]: "var(--hue-teal)" }}>
              <Bell />
            </span>
            <div className="grow">
              <strong>{block.label}</strong>
              <div className="faint" style={{ fontSize: 13 }}>
                {when}
              </div>
            </div>
          </div>
          {block.state === "awaiting" ? (
            <div className="action-row">
              <span className="badge" data-tone="warning">
                En attente de votre validation
              </span>
              <div className="row gap-8">
                <button className="btn btn-ghost btn-sm" onClick={() => updateBlock(conversationId, msg.id, index, { ...block, state: "declined" })}>
                  <X /> Refuser
                </button>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => {
                    const ids = addAgendaItems([{ date: block.date, start: block.time, label: block.label, kind: "reminder" }]);
                    const ok = useStore.getState().agenda.some((a) => a.id === ids[0]);
                    if (!ok) return toast.error("Le rappel n'a pas pu être créé.");
                    updateBlock(conversationId, msg.id, index, { ...block, state: "executed" });
                    log(`Rappel créé : ${block.label}.`);
                    toast.success("Rappel ajouté à votre agenda.");
                  }}
                >
                  <Check /> Valider
                </button>
              </div>
            </div>
          ) : (
            <div className="action-row">
              <span className="badge" data-tone={block.state === "executed" ? "success" : "muted"}>
                {block.state === "executed" ? "Exécutée et vérifiée : visible dans l'agenda" : "Refusée"}
              </span>
            </div>
          )}
        </div>
      );
    }
  }
}
