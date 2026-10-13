import { useState } from "react";
import { Copy, LifeBuoy, MessageSquareWarning, Send, Inbox } from "lucide-react";
import { Badge, EmptyState, Field, Notice, PageHeader, toast } from "../components/ui";
import { copyText, dateTime } from "../lib/format";
import { useStore } from "../lib/store";
import { sendTicketOnline, useAccount } from "../lib/cloud/account";
import type { SupportTicket } from "../lib/types";

const CATS: Record<SupportTicket["category"], string> = {
  question: "Question",
  bug: "Problème technique",
  mission_bloquee: "Tâche bloquée",
  facturation: "Abonnement",
  autre: "Autre",
};

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "";

const FAQ = [
  ["L'assistant peut-il agir sans moi ?", "Non. Chaque action est préparée puis attend votre validation. Les actions externes (envoi, réservation, paiement) restent de votre côté dans cette version."],
  ["Pourquoi « mode démo » ?", "Aucune clé d'IA n'est configurée sur le serveur. Les réponses du chat viennent alors de scénarios prédéfinis, signalés comme tels ; les parcours et les calculs restent réels."],
  ["Où sont stockées mes données ?", "Sur cet appareil, et dans votre sauvegarde en ligne si vous êtes connecté à un compte. Vous pouvez les exporter ou les supprimer depuis Paramètres."],
];

export default function Support() {
  const tickets = useStore((s) => s.tickets);
  const missions = useStore((s) => s.missions);
  const addTicket = useStore((s) => s.addTicket);
  const blockMission = useStore((s) => s.blockMission);

  const [category, setCategory] = useState<SupportTicket["category"]>("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [missionId, setMissionId] = useState("");
  const [markBlocked, setMarkBlocked] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openMissions = missions.filter((m) => m.status !== "done");

  const signedIn = useAccount((a) => a.status === "signedIn");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (subject.trim().length < 4) e.subject = "Un objet d'au moins 4 caractères.";
    if (message.trim().length < 20) e.message = "Décrivez votre demande en au moins 20 caractères.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Adresse e-mail invalide.";
    if (category === "mission_bloquee" && !missionId) e.mission = "Choisissez la mission concernée.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const ticket = { category, subject: subject.trim(), message: message.trim(), email: email.trim() || undefined, missionId: missionId || undefined };
    let status: SupportTicket["status"] = "enregistree";
    if (signedIn) {
      setSending(true);
      try {
        await sendTicketOnline(ticket);
        status = "envoyee";
      } catch {
        toast.error("Envoi impossible pour le moment (connexion ?). La demande est gardée sur l'appareil.");
      } finally {
        setSending(false);
      }
    } else if (SUPPORT_EMAIL) {
      const body = `${ticket.message}\n\n— Catégorie : ${CATS[category]}${ticket.email ? `\n— Contact : ${ticket.email}` : ""}`;
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[NEXORA] ${ticket.subject}`)}&body=${encodeURIComponent(body)}`;
      status = "email";
    }
    addTicket({ ...ticket, status });
    if (category === "mission_bloquee" && missionId && markBlocked) {
      const m = missions.find((x) => x.id === missionId);
      if (m && m.status !== "blocked") blockMission(missionId, message.trim().slice(0, 200), "Signalé au support. Le suivi est conservé : reprenez la mission quand le point est réglé.");
    }
    setSubject("");
    setMessage("");
    setMissionId("");
    toast.success(
      status === "envoyee"
        ? "Demande envoyée au support. Elle figure dans votre historique."
        : status === "email"
          ? "Votre messagerie s'ouvre avec la demande pré-remplie : envoyez-la pour qu'elle nous parvienne."
          : "Demande enregistrée dans votre historique.",
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title={
          <>
            On s'en <span className="serif grad-text">occupe</span>
          </>
        }
        subtitle="Posez une question, signalez un problème ou une tâche bloquée."
      />
      <div className="support-layout">
        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <LifeBuoy /> Nouvelle demande
            </span>
          </div>
          <div className="stack gap-16">
            <Field label="Catégorie">
              <div className="chips">
                {(Object.keys(CATS) as SupportTicket["category"][]).map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
                    {c === "mission_bloquee" && <MessageSquareWarning />}
                    {CATS[c]}
                  </button>
                ))}
              </div>
            </Field>
            {category === "mission_bloquee" && (
              <>
                <Field label="Mission concernée" error={errors.mission} htmlFor="sm">
                  <select id="sm" className="select" value={missionId} onChange={(e) => setMissionId(e.target.value)} aria-invalid={Boolean(errors.mission)}>
                    <option value="">Choisir une mission…</option>
                    {openMissions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="row gap-8" style={{ fontSize: 13.5 }}>
                  <input type="checkbox" checked={markBlocked} onChange={(e) => setMarkBlocked(e.target.checked)} /> Marquer la mission comme bloquée (son suivi est conservé)
                </label>
              </>
            )}
            <Field label="Objet" error={errors.subject} htmlFor="ss">
              <input id="ss" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} aria-invalid={Boolean(errors.subject)} />
            </Field>
            <Field label="Message" error={errors.message} htmlFor="sg" aside={<span className="faint mono">{message.length}/2000</span>}>
              <textarea id="sg" className="textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 2000))} aria-invalid={Boolean(errors.message)} />
            </Field>
            <Field label="E-mail de contact" hint="Facultatif" error={errors.email} htmlFor="se">
              <input id="se" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Notice>
              {signedIn
                ? "Votre demande est transmise au support avec votre compte, et gardée dans l'historique ci-contre."
                : SUPPORT_EMAIL
                  ? `Votre messagerie s'ouvrira avec la demande pré-remplie, à envoyer à ${SUPPORT_EMAIL}. Elle est aussi gardée dans l'historique.`
                  : "Le support en ligne nécessite un compte connecté. Sans compte, la demande est gardée dans l'historique ci-contre et vous pouvez la copier."}
            </Notice>
            <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => void submit()} disabled={sending}>
              {sending ? <span className="spinner" /> : <Send />} {signedIn ? "Envoyer la demande" : SUPPORT_EMAIL ? "Préparer l'e-mail" : "Enregistrer la demande"}
            </button>
          </div>
        </section>

        <div className="stack gap-16">
          <section className="card card-pad">
            <div className="card-head">
              <span className="card-title">
                <Inbox /> Historique des demandes
              </span>
            </div>
            {tickets.length === 0 ? (
              <EmptyState title="Aucune demande" text="Vos demandes de support apparaîtront ici avec leur statut." />
            ) : (
              <ul className="ticket-list">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <div className="row-between wrap" style={{ gap: 8 }}>
                      <strong>{t.subject}</strong>
                      <Badge tone={t.status === "envoyee" ? "success" : t.status === "email" ? "info" : "muted"}>
                        {t.status === "envoyee" ? "Envoyée au support" : t.status === "email" ? "Confiée à la messagerie" : "Enregistrée sur l'appareil"}
                      </Badge>
                    </div>
                    <small className="faint">
                      {CATS[t.category]} · {dateTime(t.createdAt)}
                      {t.missionId ? ` · ${missions.find((m) => m.id === t.missionId)?.title ?? "mission supprimée"}` : ""}
                    </small>
                    <p className="faint" style={{ fontSize: 13.5 }}>{t.message}</p>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ alignSelf: "flex-start" }}
                      onClick={async () => ((await copyText(`${t.subject}\n\n${t.message}`)) ? toast.success("Demande copiée.") : toast.error("Copie impossible."))}
                    >
                      <Copy /> Copier
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card card-pad">
            <div className="card-head">
              <span className="card-title">Questions fréquentes</span>
            </div>
            <div className="faq compact">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
