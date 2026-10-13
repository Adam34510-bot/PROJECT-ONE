import { useState } from "react";
import { Bell, Clock, Database, Download, Gem, Languages, Palette, ShieldCheck, Trash2, ArrowRight, FlaskConical } from "lucide-react";
import { Field, Modal, PageHeader, Segmented, Switch, toast } from "../components/ui";
import { downloadText } from "../lib/format";
import { Link, navigate } from "../lib/router";
import { PLAN_LIMITS, useStore } from "../lib/store";
import type { Settings as S } from "../lib/types";
import { useAccount } from "../lib/cloud/account";
import { InstallCard } from "../components/InstallCard";

const TOPICS = ["Validations en attente", "Rappels", "Économies détectées", "Missions bloquées", "Bilan hebdomadaire", "Échéances de contrats"];

export default function Settings() {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const plan = useStore((st) => st.plan);
  const hasDemo = useStore((st) => st.hasDemo || st.missions.some((m) => m.demo));
  const clearDemo = useStore((st) => st.clearDemo);
  const resetAll = useStore((st) => st.resetAll);
  const applyRetention = useStore((st) => st.applyRetention);
  const signedIn = useAccount((a) => a.status === "signedIn");
  const [delOpen, setDelOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const exportData = () => {
    const st = useStore.getState();
    const data = {
      exportedAt: new Date().toISOString(),
      profile: st.profile,
      settings: st.settings,
      plan: st.plan,
      missions: st.missions,
      conversations: st.conversations,
      agenda: st.agenda,
      memory: st.memory,
      tickets: st.tickets,
      audit: st.audit,
    };
    downloadText(`nexora-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
    st.log("Export de toutes les données effectué.");
    toast.success("Export téléchargé (format JSON).");
  };

  const setNotif = (k: keyof S["notifications"], v: boolean) => update({ notifications: { ...s.notifications, [k]: v } });

  return (
    <div>
      <PageHeader eyebrow="Paramètres" title="Réglages" subtitle={signedIn ? "Vos préférences s'appliquent immédiatement et sont sauvegardées dans votre compte." : "Toutes les préférences sont enregistrées sur cet appareil et s'appliquent immédiatement."} />

      <div className="settings-grid">
        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <Palette /> Apparence
            </span>
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Thème</div>
              <div className="desc">Le mode sombre est le thème signature.</div>
            </div>
            <Segmented<S["theme"]>
              label="Thème"
              value={s.theme}
              onChange={(v) => update({ theme: v })}
              options={[
                { value: "dark", label: "Sombre" },
                { value: "light", label: "Clair" },
                { value: "system", label: "Système" },
              ]}
            />
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Réduire les animations</div>
              <div className="desc">Utile en cas de sensibilité au mouvement.</div>
            </div>
            <Switch checked={s.reducedMotion} onChange={(v) => update({ reducedMotion: v })} label="Réduire les animations" />
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <Languages /> Langue et voix
            </span>
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Langue de l'interface</div>
              <div className="desc">Anglais, espagnol, allemand et italien en préparation.</div>
            </div>
            <select className="select" style={{ width: 170 }} value="fr" onChange={() => undefined} aria-label="Langue">
              <option value="fr">Français</option>
              <option disabled>English (bientôt)</option>
              <option disabled>Español (bientôt)</option>
            </select>
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Lire les réponses à voix haute</div>
              <div className="desc">Selon la prise en charge de votre navigateur.</div>
            </div>
            <Switch checked={s.voiceReplies} onChange={(v) => update({ voiceReplies: v })} label="Lecture audio des réponses" />
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <Bell /> Notifications
            </span>
          </div>
          {(
            [
              ["reminders", "Rappels et échéances", "Au moment prévu, si l'application est ouverte ou en arrière-plan."],
              ["validations", "Actions à valider", "Une fois par jour s'il reste des actions en attente."],
              ["savings", "Économies à vérifier", "Une semaine après une estimation, pour la confirmer."],
              ["weekly", "Bilan hebdomadaire", "Le résumé de la semaine passée, chaque lundi."],
            ] as [keyof S["notifications"], string, string][]
          ).map(([k, l, d]) => (
            <div key={k} className="setting-row">
              <div>
                <div className="label">{l}</div>
                <div className="desc">{d}</div>
              </div>
              <Switch checked={s.notifications[k]} onChange={(v) => setNotif(k, v)} label={l} />
            </div>
          ))}
          <p className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
            L'autorisation du navigateur se gère dans <Link to="/app/connexions" style={{ textDecoration: "underline" }}>Connexions</Link>.
          </p>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <Clock /> Horaires de communication
            </span>
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Ne pas déranger</div>
              <div className="desc">Aucune notification pendant cette plage.</div>
            </div>
            <Switch checked={s.quietHours.enabled} onChange={(v) => update({ quietHours: { ...s.quietHours, enabled: v } })} label="Ne pas déranger" />
          </div>
          <div className="grid-2" style={{ opacity: s.quietHours.enabled ? 1 : 0.5 }}>
            <Field label="De">
              <input type="time" className="input" value={s.quietHours.from} disabled={!s.quietHours.enabled} onChange={(e) => update({ quietHours: { ...s.quietHours, from: e.target.value } })} />
            </Field>
            <Field label="À">
              <input type="time" className="input" value={s.quietHours.to} disabled={!s.quietHours.enabled} onChange={(e) => update({ quietHours: { ...s.quietHours, to: e.target.value } })} />
            </Field>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="label" style={{ fontWeight: 550, marginBottom: 4, fontSize: 14.5 }}>
              Sujets d'alerte
            </div>
            <p className="faint" style={{ fontSize: 12.5, marginBottom: 10 }}>
              Sujets qui peuvent afficher une notification du téléphone quand l'application est en arrière-plan. Les autres s'affichent à votre retour dans l'application.
            </p>
            <div className="chips">
              {TOPICS.map((t) => (
                <button key={t} className="chip" aria-pressed={s.alertTopics.includes(t)} onClick={() => update({ alertTopics: s.alertTopics.includes(t) ? s.alertTopics.filter((x) => x !== t) : [...s.alertTopics, t] })}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <ShieldCheck /> Mémoire et confidentialité
            </span>
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Mémoire de l'assistant</div>
              <div className="desc">
                <Link to="/app/memoire" style={{ textDecoration: "underline" }}>Consulter et modifier</Link>
              </div>
            </div>
            <Switch checked={s.memoryEnabled} onChange={(v) => update({ memoryEnabled: v })} label="Mémoire activée" />
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Conservation des conversations</div>
              <div className="desc">Les conversations plus anciennes sont supprimées automatiquement.</div>
            </div>
            <select
              className="select"
              style={{ width: 170 }}
              value={s.retentionDays}
              onChange={(e) => {
                update({ retentionDays: Number(e.target.value) as S["retentionDays"] });
                setTimeout(applyRetention, 0);
              }}
              aria-label="Durée de conservation"
            >
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
              <option value={365}>1 an</option>
              <option value={0}>Conserver</option>
            </select>
          </div>
          <div className="setting-row">
            <div>
              <div className="label">Exporter mes données</div>
              <div className="desc">Toutes vos données dans un fichier JSON lisible.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exportData}>
              <Download /> Exporter
            </button>
          </div>
          {hasDemo && (
            <div className="setting-row">
              <div>
                <div className="label">Données de démonstration</div>
                <div className="desc">Missions, agenda et conversations fictifs.</div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  clearDemo();
                  toast.success("Données de démonstration supprimées.");
                }}
              >
                <FlaskConical /> Supprimer la démo
              </button>
            </div>
          )}
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <Gem /> Abonnement
            </span>
          </div>
          <Link to="/app/abonnement" className="row-between setting-link">
            <span>
              <span className="label">Formule {PLAN_LIMITS[plan].label}</span>
              <span className="desc" style={{ display: "block" }}>
                Gérer ou comparer les formules
              </span>
            </span>
            <ArrowRight size={18} />
          </Link>
        </section>

        <InstallCard />

        <section className="card card-pad danger-zone">
          <div className="card-head">
            <span className="card-title">
              <Database /> Suppression des données
            </span>
          </div>
          <p className="faint" style={{ fontSize: 13.5 }}>
            {signedIn
              ? "Vous êtes connecté : la suppression efface vos données sur cet appareil et dans votre sauvegarde en ligne. Pour supprimer aussi le compte lui-même, passez par la page Compte."
              : "Sans compte connecté, toutes vos données sont sur cet appareil. Les supprimer revient à supprimer votre espace."}
          </p>
          <button className="btn btn-danger" style={{ marginTop: 14 }} onClick={() => setDelOpen(true)}>
            <Trash2 /> Supprimer toutes mes données
          </button>
        </section>
      </div>

      <Modal
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Supprimer toutes vos données ?"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setDelOpen(false)}>
              Annuler
            </button>
            <button
              className="btn btn-danger"
              disabled={confirmText.trim().toUpperCase() !== "SUPPRIMER"}
              onClick={() => {
                resetAll();
                setDelOpen(false);
                toast.success(signedIn ? "Vos données ont été supprimées de cet appareil et de votre compte." : "Toutes vos données ont été supprimées de cet appareil.");
                navigate("/", { replace: true });
              }}
            >
              Supprimer définitivement
            </button>
          </>
        }
      >
        <p style={{ marginBottom: 14 }}>
          Missions, conversations, mémoire, agenda, réglages et journal seront effacés de cet appareil{signedIn ? " et de votre sauvegarde en ligne" : ""}. Cette action est irréversible. Pensez à exporter vos données avant.
        </p>
        <Field label="Tapez SUPPRIMER pour confirmer" htmlFor="cf">
          <input id="cf" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </Field>
      </Modal>
    </div>
  );
}
