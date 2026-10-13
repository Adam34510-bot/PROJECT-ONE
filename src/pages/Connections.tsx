import { useEffect, useState } from "react";
import { Bell, Calendar, Database, Landmark, Mail, Mic, Sparkles, Train, Stethoscope, FileText, CheckCircle2, CircleDashed, Ban, Puzzle, ScrollText, Download, HardDrive, ShieldCheck, Cloud, CalendarPlus } from "lucide-react";
import { Badge, PageHeader, Notice, toast } from "../components/ui";
import { useAiMode } from "../lib/ai/client";
import { dateTime, downloadText, isoDay } from "../lib/format";
import { showSystemNotification } from "../lib/notify";
import { micHelp } from "../lib/voice";
import { agendaToIcs } from "../lib/ics";
import { cloudConfigured, useAccount } from "../lib/cloud/account";
import { Link } from "../lib/router";
import { useStore } from "../lib/store";

type PermState = "granted" | "denied" | "prompt" | "unsupported" | "checking";

const SERVICES = [
  { id: "gcal", name: "Google Agenda", icon: Calendar, status: "prep", perms: ["Lire vos événements", "Créer des événements après validation"], data: "Titres, dates et lieux des événements", via: "API officielle Google Calendar (OAuth)" },
  { id: "gmail", name: "Gmail", icon: Mail, status: "prep", perms: ["Créer des brouillons", "Lire les e-mails de factures (filtrés)"], data: "Expéditeurs et objets ciblés, jamais l'ensemble de la boîte", via: "API officielle Gmail (OAuth, périmètre restreint)" },
  { id: "outlook", name: "Microsoft Outlook", icon: Mail, status: "prep", perms: ["Agenda et brouillons d'e-mails"], data: "Événements et brouillons", via: "Microsoft Graph (OAuth)" },
  { id: "bank", name: "Comptes bancaires", icon: Landmark, status: "prep", perms: ["Lecture seule des transactions", "Aucun virement possible"], data: "Libellés et montants des prélèvements récurrents", via: "Agrégateur agréé DSP2 (accès lecture seule)" },
  { id: "notion", name: "Notion", icon: FileText, status: "prep", perms: ["Créer des pages de suivi"], data: "Pages créées par l'assistant uniquement", via: "API officielle Notion" },
  { id: "sncf", name: "Réservation de trains", icon: Train, status: "none", perms: ["Recherche et réservation"], data: "—", via: "Pas d'API publique de réservation : l'assistant ouvre le site au bon endroit" },
  { id: "doctolib", name: "Prise de rendez-vous médicaux", icon: Stethoscope, status: "none", perms: ["Réservation de créneaux"], data: "—", via: "Pas d'API publique : rendez-vous à prendre directement" },
] as const;

export default function Connections() {
  const mode = useAiMode();
  const waitlist = useStore((s) => s.waitlist);
  const toggleWaitlist = useStore((s) => s.toggleWaitlist);
  const audit = useStore((s) => s.audit);
  const agenda = useStore((s) => s.agenda);
  const account = useAccount();
  const upcoming = agenda.filter((a) => !a.demo && !a.done && a.date >= isoDay());
  const [mic, setMic] = useState<PermState>("checking");
  const [notif, setNotif] = useState<PermState>("checking");
  const [storageOk, setStorageOk] = useState<boolean | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("__p1test", "1");
      localStorage.removeItem("__p1test");
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
    setNotif("Notification" in window ? (Notification.permission === "default" ? "prompt" : (Notification.permission as PermState)) : "unsupported");
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((r) => {
          setMic(r.state as PermState);
          r.onchange = () => setMic(r.state as PermState);
        })
        .catch(() => setMic(navigator.mediaDevices ? "prompt" : "unsupported"));
    } else setMic(navigator.mediaDevices ? "prompt" : "unsupported");
  }, []);

  const testMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic("granted");
      toast.success("Micro accessible. Il ne s'active que lorsque vous appuyez sur le bouton micro.");
    } catch {
      setMic("denied");
      toast.error(micHelp());
    }
  };

  const askNotif = async () => {
    if (!("Notification" in window)) return;
    const r = await Notification.requestPermission();
    setNotif(r === "default" ? "prompt" : (r as PermState));
    if (r === "granted") {
      const shown = await showSystemNotification("PROJECT ONE", "Notifications activées pour vos rappels.");
      toast.success(shown ? "Notifications activées." : "Notifications autorisées.");
    } else if (r === "denied") toast.error("Notifications refusées. Vous pourrez les réactiver dans les réglages du navigateur.");
  };

  const permBadge = (s: PermState) =>
    s === "granted" ? <Badge tone="success" dot>Autorisé</Badge> : s === "denied" ? <Badge tone="danger">Refusé</Badge> : s === "unsupported" ? <Badge tone="muted">Non pris en charge</Badge> : s === "checking" ? <Badge tone="muted">Vérification…</Badge> : <Badge tone="muted">Non demandé</Badge>;

  return (
    <div>
      <PageHeader
        eyebrow="Connexions et confidentialité"
        title={
          <>
            Vous gardez la <span className="serif grad-text">main</span>
          </>
        }
        subtitle="Chaque connexion indique ce qu'elle autorise et quelles données elle voit. Aucune connexion n'est simulée : ce qui n'existe pas encore est indiqué comme tel."
      />

      <section className="section">
        <div className="section-title">Actif sur cet appareil</div>
        <div className="conn-grid">
          <ConnCard icon={<HardDrive />} name="Stockage de l'appareil" status={storageOk === null ? <Badge tone="muted">Vérification…</Badge> : storageOk ? <Badge tone="success" dot>Actif</Badge> : <Badge tone="danger">Indisponible</Badge>}>
            <Row k="Rôle" v="Conserve vos missions, mémoire et réglages" />
            <Row k="Données" v={account.status === "signedIn" ? "Sur ce navigateur, avec une copie dans votre compte" : "Uniquement sur ce navigateur"} />
            {storageOk === false && <p className="field-error">Stockage bloqué (navigation privée ?) : les données seront perdues à la fermeture.</p>}
          </ConnCard>
          <ConnCard
            icon={<Cloud />}
            name="Compte et sauvegarde"
            status={
              !cloudConfigured ? (
                <Badge tone="muted">Non configuré</Badge>
              ) : account.status === "signedIn" ? (
                <Badge tone={account.sync === "error" ? "danger" : account.sync === "offline" ? "warning" : "success"} dot>
                  {account.sync === "error" ? "Erreur de synchronisation" : account.sync === "offline" ? "Hors ligne" : "Connecté"}
                </Badge>
              ) : (
                <Badge tone="muted">Non connecté</Badge>
              )
            }
            action={
              <Link to="/app/compte" className="btn btn-secondary btn-sm">
                {account.status === "signedIn" ? "Gérer" : cloudConfigured ? "Se connecter" : "Détails"}
              </Link>
            }
          >
            <Row k="Rôle" v="Retrouver vos données sur tous vos appareils" />
            <Row k="Hébergement" v={cloudConfigured ? "Supabase (base Postgres, accès limité à votre compte)" : "En attente de configuration par le propriétaire du site"} />
            {account.email && <Row k="Compte" v={account.email} />}
          </ConnCard>
          <ConnCard
            icon={<Sparkles />}
            name="Modèle d'IA"
            status={
              mode.status === "live" ? (
                <Badge tone="success" dot>Connecté</Badge>
              ) : mode.status === "demo" ? (
                <Badge tone="warning">Mode démonstration</Badge>
              ) : mode.status === "offline" ? (
                <Badge tone="warning">Hors ligne</Badge>
              ) : (
                <Badge tone="muted">Vérification…</Badge>
              )
            }
          >
            <Row k="Fournisseur" v={mode.status === "live" ? `Anthropic · ${mode.model}` : mode.status === "offline" ? "Injoignable sans connexion" : "Aucun : scénarios prédéfinis"} />
            {mode.status === "live" && mode.auth && <Row k="Accès" v={`Comptes connectés, ${mode.dailyLimit ?? 50} messages par jour`} />}
            <Row k="Données envoyées" v={mode.status === "live" ? "Votre message, l'historique récent et la mémoire confirmée" : "Aucune"} />
            <Row k="Clé API" v="Stockée côté serveur uniquement, jamais dans le navigateur" />
          </ConnCard>
          <ConnCard
            icon={<Mic />}
            name="Microphone"
            status={permBadge(mic)}
            action={
              mic !== "unsupported" && (
                <button className="btn btn-secondary btn-sm" onClick={testMic}>
                  Tester l'accès
                </button>
              )
            }
          >
            <Row k="Usage" v="Saisie vocale, uniquement quand vous appuyez sur le micro" />
            <Row k="Écoute permanente" v="Non, pas dans cette version" />
            {mic === "denied" && <Row k="Retirer / rétablir" v="Réglages du navigateur > Autorisations du site" />}
          </ConnCard>
          <ConnCard
            icon={<Bell />}
            name="Notifications"
            status={permBadge(notif)}
            action={
              notif === "prompt" && (
                <button className="btn btn-secondary btn-sm" onClick={askNotif}>
                  Autoriser
                </button>
              )
            }
          >
            <Row k="Usage" v="Rappels, échéances, actions à valider, bilan de la semaine" />
            <Row k="Limite" v="Application ouverte ou en arrière-plan. Fermée : nécessite un serveur de notifications (étape suivante)" />
            {notif === "unsupported" && /iPhone|iPad/.test(navigator.userAgent) && <Row k="Sur iPhone" v="Installez d'abord l'application sur l'écran d'accueil (iOS 16.4 ou plus récent)" />}
            {notif === "granted" && <Row k="Retirer" v="Réglages du navigateur > Notifications" />}
          </ConnCard>
          <ConnCard
            icon={<CalendarPlus />}
            name="Export vers votre calendrier"
            status={<Badge tone="success" dot>Disponible</Badge>}
            action={
              <button
                className="btn btn-secondary btn-sm"
                disabled={!upcoming.length}
                onClick={() => {
                  downloadText("project-one-agenda.ics", agendaToIcs(upcoming), "text/calendar");
                  useStore.getState().log(`Agenda exporté vers le calendrier (${upcoming.length} élément(s)).`);
                  toast.success("Fichier calendrier créé : ouvrez-le pour ajouter les événements.");
                }}
              >
                Exporter ({upcoming.length})
              </button>
            }
          >
            <Row k="Usage" v="Ajoute vos tâches et rappels à venir dans Apple Calendrier, Google Agenda ou Outlook" />
            <Row k="Compte requis" v="Aucun : fichier .ics standard, ouvert par votre application de calendrier" />
          </ConnCard>
        </div>
      </section>

      <section className="section">
        <div className="section-title">Services externes</div>
        <Notice>
          Aucun service externe n'est connecté dans cette version. Les intégrations passeront par des <strong>API officielles</strong> et des autorisations explicites, révocables à tout moment.
        </Notice>
        <div className="conn-grid" style={{ marginTop: 14 }}>
          {SERVICES.map((s) => (
            <ConnCard
              key={s.id}
              icon={<s.icon />}
              name={s.name}
              muted
              status={
                s.status === "prep" ? (
                  <Badge tone="info">
                    <CircleDashed /> En préparation
                  </Badge>
                ) : (
                  <Badge tone="muted">
                    <Ban /> Indisponible
                  </Badge>
                )
              }
              action={
                s.status === "prep" && (
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleWaitlist(s.id)} aria-pressed={waitlist.includes(s.id)}>
                    {waitlist.includes(s.id) ? (
                      <>
                        <CheckCircle2 /> Intérêt noté
                      </>
                    ) : (
                      "Ça m'intéresse"
                    )}
                  </button>
                )
              }
            >
              <Row k="Autorisations prévues" v={s.perms.join(" · ")} />
              <Row k="Données accessibles" v={s.data} />
              <Row k="Technologie" v={s.via} />
              <Row k="Date de connexion" v="Jamais connecté" />
              <Row k="Retirer l'autorisation" v="Sans objet tant que non connecté" />
            </ConnCard>
          ))}
        </div>
        {waitlist.length > 0 && <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>Votre intérêt est enregistré sur cet appareil pour prioriser les prochaines intégrations. Il n'est envoyé nulle part.</p>}
      </section>

      <section className="section">
        <div className="section-title">
          <span className="row gap-8">
            <ScrollText size={15} /> Journal d'activité
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => downloadText("journal-activite.txt", audit.map((a) => `${dateTime(a.at)} — ${a.text}`).join("\n") || "Journal vide")}
          >
            <Download /> Exporter
          </button>
        </div>
        <div className="card card-pad">
          {audit.length === 0 ? (
            <p className="faint" style={{ fontSize: 14 }}>Aucune action enregistrée.</p>
          ) : (
            <ul className="timeline">
              {audit.slice(0, showAll ? 300 : 8).map((a) => (
                <li key={a.id}>
                  <span className="tl-dot" />
                  <span className="grow">
                    {a.text}
                    <small className="faint">{dateTime(a.at)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {audit.length > 8 && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Réduire" : `Tout afficher (${audit.length})`}
            </button>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-title">Nos engagements</div>
        <div className="promise-grid">
          {[
            [ShieldCheck, "Validation systématique", "Aucune action externe sans votre accord explicite, même pour les tâches courantes."],
            [Database, "Aucune revente", "Vos données personnelles ne sont ni vendues ni utilisées pour de la publicité."],
            [Ban, "Pas de faux succès", "Une action n'est marquée exécutée que si elle a réellement abouti et été vérifiée."],
            [Puzzle, "Plateforme ouverte, demain", "Des intégrations créées par des développeurs externes, soumises aux mêmes règles d'autorisation."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={t as string} className="promise card card-pad">
                <I />
                <strong>{t as string}</strong>
                <p className="faint">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ConnCard({ icon, name, status, action, children, muted }: { icon: React.ReactNode; name: string; status: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={`conn-card card ${muted ? "is-muted" : ""}`}>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div className="row gap-12">
          <span className="icon-tile sm" style={{ ["--hue" as string]: muted ? "var(--text-3)" : "var(--accent)" }}>
            {icon}
          </span>
          <strong>{name}</strong>
        </div>
        {status}
      </div>
      <dl className="conn-rows">{children}</dl>
      {action && <div style={{ marginTop: "auto" }}>{action}</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="conn-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
