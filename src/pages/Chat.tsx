import { useEffect, useMemo, useRef, useState } from "react";
import { History, MessageSquarePlus, Trash2, X, ArrowRight, FlaskConical, Mic, WifiOff, LogIn } from "lucide-react";
import { Composer } from "../components/chat/Composer";
import { MessageView } from "../components/chat/MessageView";
import { Orb, DemoBadge, Modal, StatusBadge, toast } from "../components/ui";
import { useAiMode } from "../lib/ai/client";
import { retryLast, sendMessage, usePending } from "../lib/chat";
import { useAccount } from "../lib/cloud/account";
import { relativeTime } from "../lib/format";
import { missionMeta } from "../lib/missions";
import { Link, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { useVoice } from "../lib/voice";

const STARTERS = [
  "Organise ma journée de demain",
  "Compare deux offres de box internet",
  "Aide-moi à préparer la résiliation de mon abonnement",
  "Organise un week-end avec un budget de 300 €",
  "Je préfère le train à l'avion",
  "Rappelle-moi de payer le loyer demain à 9h",
];

export default function Chat({ id }: { id?: string }) {
  const conversations = useStore((s) => s.conversations);
  const missions = useStore((s) => s.missions);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const conv = conversations.find((c) => c.id === id);
  const pending = usePending((s) => (id ? s.ids.includes(id) : false));
  const mode = useAiMode();
  const signedIn = useAccount((s) => s.status === "signedIn");
  const voice = useVoice();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv?.messages.length, pending]);

  useEffect(() => setHistoryOpen(false), [id]);

  const send = (text: string, viaVoice: boolean) => {
    const { conversationId, done } = sendMessage(mode, text, conv?.id);
    if (viaVoice) done.then((m) => (settings.voiceReplies ? voice.speak(m.text) : voice.setState("idle")));
    else if (settings.voiceReplies) done.then((m) => voice.speak(m.text));
    if (!conv) navigate(`/app/assistant/${conversationId}`, { replace: true });
  };

  const resumable = missions.filter((m) => ["awaiting", "running", "draft", "blocked"].includes(m.status)).slice(0, 4);
  const linkedMission = !conv ? undefined : conv.missionId ? missions.find((m) => m.id === conv.missionId) : missions.find((m) => m.conversationId === conv.id);
  const sorted = useMemo(() => [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [conversations]);

  if (id && !conv) {
    return (
      <div className="card card-pad">
        <p>Cette conversation n'existe plus (elle a peut-être été supprimée ou a dépassé la durée de conservation).</p>
        <Link to="/app/assistant" className="btn btn-secondary" style={{ marginTop: 16 }}>
          Nouvelle conversation
        </Link>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      <aside className={`chat-history card ${historyOpen ? "open" : ""}`} aria-label="Historique des conversations">
        <div className="row-between" style={{ padding: "16px 16px 8px" }}>
          <strong>Historique</strong>
          <div className="row gap-4">
            <Link to="/app/assistant" className="btn btn-ghost btn-icon btn-sm" aria-label="Nouvelle conversation" title="Nouvelle conversation">
              <MessageSquarePlus />
            </Link>
            <button className="btn btn-ghost btn-icon btn-sm hide-desktop" onClick={() => setHistoryOpen(false)} aria-label="Fermer l'historique">
              <X />
            </button>
          </div>
        </div>
        <div className="history-list">
          {sorted.length === 0 && <p className="faint" style={{ padding: "8px 16px", fontSize: 13 }}>Vos conversations apparaîtront ici.</p>}
          {sorted.map((c) => (
            <Link key={c.id} to={`/app/assistant/${c.id}`} className="history-item" aria-current={c.id === id ? "page" : undefined}>
              <span className="truncate">{c.title}</span>
              <small className="faint row gap-8">
                {relativeTime(c.updatedAt)} {c.demo && <DemoBadge />}
              </small>
            </Link>
          ))}
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-top">
          <button className="btn btn-secondary btn-sm hide-desktop" onClick={() => setHistoryOpen(true)}>
            <History /> Historique
          </button>
          <div className="grow truncate chat-title">{conv ? conv.title : "Nouvelle conversation"}</div>
          {linkedMission && (
            <Link to={`/app/missions/${linkedMission.id}`} className="btn btn-ghost btn-sm">
              Mission liée <ArrowRight />
            </Link>
          )}
          {conv && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmDelete(true)} aria-label="Supprimer la conversation" title="Supprimer">
              <Trash2 />
            </button>
          )}
        </div>

        {mode.status === "demo" && (
          <div className="chat-demo-banner">
            <FlaskConical size={14} /> Mode démonstration : réponses issues de scénarios prédéfinis, sans IA. Les parcours et les calculs, eux, sont réels.
          </div>
        )}

        {mode.status === "offline" && (
          <div className="chat-demo-banner">
            <WifiOff size={14} /> Hors ligne : l'assistant répondra dès le retour de la connexion. Vos missions, votre agenda et votre mémoire restent accessibles.
          </div>
        )}
        {mode.status === "live" && mode.auth && !signedIn && (
          <div className="chat-demo-banner">
            <LogIn size={14} /> L'assistant IA est réservé aux comptes connectés.{" "}
            <Link to="/app/compte" style={{ textDecoration: "underline" }}>
              Se connecter ou créer un compte
            </Link>
          </div>
        )}

        <div className="chat-scroll">
          {!conv || conv.messages.length === 0 ? (
            <div className="chat-empty">
              <Orb size="xl" state={voice.state} />
              <h2>
                Comment puis-je <span className="serif grad-text">vous aider</span> ?
              </h2>
              <p className="muted">Écrivez ou parlez. Je prépare, vous validez chaque action.</p>
              <div className="chips" style={{ justifyContent: "center" }}>
                {STARTERS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s, false)}>
                    {s}
                  </button>
                ))}
              </div>
              {voice.supported ? null : (
                <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>
                  <Mic size={12} style={{ display: "inline", verticalAlign: -1 }} /> La saisie vocale n'est pas prise en charge par ce navigateur.
                </p>
              )}
              {resumable.length > 0 && (
                <div className="resume-box">
                  <div className="eyebrow" style={{ marginBottom: 10 }}>
                    Reprendre une tâche en cours
                  </div>
                  {resumable.map((m) => {
                    const meta = missionMeta(m.kind);
                    return (
                      <Link key={m.id} to={`/app/missions/${m.id}`} className="resume-item" style={{ ["--hue" as string]: meta.hue }}>
                        <span className="icon-tile sm">
                          <meta.icon />
                        </span>
                        <span className="grow truncate">{m.title}</span>
                        <StatusBadge status={m.status} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="messages">
              {conv.messages.map((m, i) => (
                <MessageView
                  key={m.id}
                  msg={m}
                  conversationId={conv.id}
                  onQuickReply={(t) => send(t, false)}
                  previousUserText={[...conv.messages.slice(0, i)].reverse().find((x) => x.role === "user")?.text}
                  onRetry={
                    m.mode === "error" && i === conv.messages.length - 1 && !pending
                      ? () => {
                          const done = retryLast(mode, conv.id);
                          if (done && settings.voiceReplies) done.then((r) => r.mode !== "error" && voice.speak(r.text));
                        }
                      : undefined
                  }
                />
              ))}
              {pending && (
                <div className="msg msg-assistant">
                  <Orb size="sm" state="processing" />
                  <div className="msg-body">
                    <div className="typing">
                      <span />
                      <span />
                      <span />
                      <em>{mode.status === "live" ? "Analyse de votre demande…" : "Recherche du scénario…"}</em>
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="chat-composer">
          <Composer
            onSend={send}
            voice={voice}
            busy={pending}
            autoFocus={!conv}
            voiceReplies={settings.voiceReplies}
            onToggleVoiceReplies={() => updateSettings({ voiceReplies: !settings.voiceReplies })}
          />
        </div>
      </section>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer cette conversation ?"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (conv) deleteConversation(conv.id);
                setConfirmDelete(false);
                toast.success("Conversation supprimée.");
                navigate("/app/assistant", { replace: true });
              }}
            >
              Supprimer
            </button>
          </>
        }
      >
        Les messages seront effacés (ainsi que de votre sauvegarde en ligne si vous êtes connecté). Les missions créées depuis cette conversation sont conservées.
      </Modal>
    </div>
  );
}
