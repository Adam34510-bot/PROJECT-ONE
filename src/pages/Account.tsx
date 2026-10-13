import { useState, type FormEvent } from "react";
import { CloudOff, Cloud, KeyRound, LogOut, RefreshCw, ShieldCheck, Trash2, UserRound, AlertTriangle, CheckCircle2, Smartphone, Laptop } from "lucide-react";
import { Badge, Field, Modal, Notice, PageHeader, Segmented, toast } from "../components/ui";
import { InstallCard } from "../components/InstallCard";
import {
  authErrorMessage,
  cloudConfigured,
  deleteAccount,
  resolveConflict,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  syncNow,
  updatePassword,
  useAccount,
} from "../lib/cloud/account";
import { dateTime, relativeTime } from "../lib/format";
import { Link, useRoute } from "../lib/router";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordProblem = (p: string) => (p.length < 8 ? "Au moins 8 caractères." : !/[a-zA-Z]/.test(p) || !/\d/.test(p) ? "Mélangez lettres et chiffres." : "");

export default function Account() {
  const acc = useAccount();
  const { query } = useRoute();
  const linkError = query.get("erreur");

  return (
    <div>
      <PageHeader
        eyebrow="Compte"
        title={
          <>
            Mon <span className="serif grad-text">compte</span>
          </>
        }
        subtitle={
          cloudConfigured
            ? "Connectez-vous pour retrouver vos missions, votre mémoire et votre bilan sur tous vos appareils."
            : "Vos données sont enregistrées sur cet appareil."
        }
      />
      {linkError && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="danger" icon={<AlertTriangle />}>
            Le lien reçu par e-mail n'a pas fonctionné (il a peut-être expiré). Demandez-en un nouveau ci-dessous.
          </Notice>
        </div>
      )}
      <div className="settings-grid">
        {!cloudConfigured && <LocalOnlyCard />}
        {cloudConfigured && acc.status === "loading" && (
          <section className="card card-pad row gap-12">
            <span className="spinner" /> Vérification de votre session…
          </section>
        )}
        {cloudConfigured && acc.status === "signedOut" && <AuthCard />}
        {cloudConfigured && acc.status === "signedIn" && <SignedInCards />}
        <InstallCard />
      </div>
    </div>
  );
}

function LocalOnlyCard() {
  return (
    <section className="card card-pad">
      <div className="card-head">
        <span className="card-title">
          <CloudOff /> Mode local
        </span>
        <Badge tone="muted">Sans compte</Badge>
      </div>
      <div className="stack gap-12">
        <p className="muted" style={{ fontSize: 14 }}>
          Tout fonctionne sur cet appareil, et vos données restent après une actualisation ou un redémarrage. Elles ne sont pas encore sauvegardées en ligne : si vous changez de téléphone, exportez-les depuis les{" "}
          <Link to="/app/parametres" style={{ textDecoration: "underline" }}>
            Paramètres
          </Link>
          .
        </p>
        <Notice>Les comptes et la sauvegarde en ligne s'activent dès que le propriétaire du site configure Supabase (voir le guide de mise en ligne, étape « Comptes »).</Notice>
      </div>
    </section>
  );
}

type Tab = "signin" | "signup" | "reset";

function AuthCard() {
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = "Adresse e-mail invalide.";
    if (tab === "signup" && passwordProblem(password)) errs.password = passwordProblem(password);
    if (tab === "signin" && !password) errs.password = "Saisissez votre mot de passe.";
    setErrors(errs);
    setDone(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (tab === "signin") {
        await signIn(email.trim(), password);
        toast.success("Connexion réussie. Synchronisation de vos données…");
      } else if (tab === "signup") {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setDone(`Compte créé. Ouvrez le lien envoyé à ${email.trim()} pour confirmer votre adresse, puis connectez-vous.`);
        else toast.success("Compte créé et connecté.");
      } else {
        await sendPasswordReset(email.trim());
        setDone(`Si un compte existe pour ${email.trim()}, un lien de réinitialisation vient d'être envoyé.`);
      }
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad">
      <div className="card-head">
        <span className="card-title">
          <UserRound /> {tab === "signup" ? "Créer un compte" : tab === "reset" ? "Mot de passe oublié" : "Se connecter"}
        </span>
      </div>
      <form className="stack gap-16" onSubmit={submit} noValidate>
        <Segmented<Tab>
          label="Choix"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setErrors({});
            setDone(null);
          }}
          options={[
            { value: "signin", label: "Connexion" },
            { value: "signup", label: "Inscription" },
            { value: "reset", label: "Oubli" },
          ]}
        />
        <Field label="E-mail" error={errors.email} htmlFor="acc-email">
          <input id="acc-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" aria-invalid={Boolean(errors.email)} />
        </Field>
        {tab !== "reset" && (
          <Field label="Mot de passe" hint={tab === "signup" ? "8 caractères minimum, lettres et chiffres." : undefined} error={errors.password} htmlFor="acc-pw">
            <input
              id="acc-pw"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>
        )}
        {errors.form && (
          <Notice tone="danger" icon={<AlertTriangle />}>
            {errors.form}
          </Notice>
        )}
        {done && (
          <Notice tone="success" icon={<CheckCircle2 />}>
            {done}
          </Notice>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>
          {busy ? <span className="spinner" /> : <KeyRound />}
          {tab === "signup" ? "Créer mon compte" : tab === "reset" ? "Recevoir le lien" : "Se connecter"}
        </button>
        <p className="faint" style={{ fontSize: 12.5 }}>
          Vos données sont stockées chez Supabase (hébergement européen possible) et ne sont jamais vendues. Seul votre compte peut les lire.
        </p>
      </form>
    </section>
  );
}

const SYNC_LABEL = {
  idle: ["muted", "En attente"],
  syncing: ["info", "Synchronisation…"],
  synced: ["success", "Synchronisé"],
  offline: ["warning", "Hors ligne"],
  error: ["danger", "Erreur"],
} as const;

function SignedInCards() {
  const acc = useAccount();
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [tone, label] = SYNC_LABEL[acc.sync];

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(pw);
    setPwError(p);
    if (p) return;
    setBusy(true);
    try {
      await updatePassword(pw);
      setPw("");
      toast.success("Mot de passe modifié.");
    } catch (err) {
      setPwError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {acc.conflict && (
        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <AlertTriangle /> Deux versions de vos données
            </span>
          </div>
          <div className="stack gap-12">
            <p className="muted" style={{ fontSize: 14 }}>
              Votre compte contient des données (modifiées {relativeTime(acc.conflict.remoteUpdatedAt)}) et cet appareil aussi. Laquelle garder ? L'autre sera remplacée.
            </p>
            <div className="row gap-8 wrap">
              <button className="btn btn-primary" onClick={() => void resolveConflict("account")}>
                <Laptop /> Garder celles du compte
              </button>
              <button className="btn btn-secondary" onClick={() => void resolveConflict("device")}>
                <Smartphone /> Garder celles de cet appareil
              </button>
            </div>
          </div>
        </section>
      )}

      {acc.recovery && (
        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <KeyRound /> Choisissez un nouveau mot de passe
            </span>
          </div>
          <PasswordForm pw={pw} setPw={setPw} error={pwError} busy={busy} onSubmit={changePassword} />
        </section>
      )}

      <section className="card card-pad">
        <div className="card-head">
          <span className="card-title">
            <Cloud /> Sauvegarde en ligne
          </span>
          <Badge tone={tone} dot>
            {label}
          </Badge>
        </div>
        <div className="stack gap-12">
          <div className="setting-row">
            <div>
              <div className="label">{acc.email}</div>
              <div className="desc">{acc.lastSyncedAt ? `Dernière sauvegarde : ${dateTime(acc.lastSyncedAt)}` : "Première synchronisation en cours."}</div>
            </div>
          </div>
          {acc.syncError && (
            <Notice tone={acc.sync === "offline" ? undefined : "danger"} icon={acc.sync === "offline" ? <CloudOff /> : <AlertTriangle />}>
              {acc.syncError}
            </Notice>
          )}
          <p className="faint" style={{ fontSize: 13 }}>
            Chaque modification est enregistrée sur l'appareil puis envoyée à votre compte. Ouvrez l'application sur un autre appareil avec le même compte pour tout retrouver.
          </p>
          <div className="row gap-8 wrap">
            <button className="btn btn-secondary btn-sm" onClick={() => void syncNow()} disabled={acc.sync === "syncing" || Boolean(acc.conflict)}>
              <RefreshCw /> Synchroniser maintenant
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await signOut();
                toast.success("Déconnecté. Une copie de vos données reste sur cet appareil.");
              }}
            >
              <LogOut /> Se déconnecter
            </button>
          </div>
        </div>
      </section>

      {!acc.recovery && (
        <section className="card card-pad">
          <div className="card-head">
            <span className="card-title">
              <ShieldCheck /> Sécurité
            </span>
          </div>
          <PasswordForm pw={pw} setPw={setPw} error={pwError} busy={busy} onSubmit={changePassword} />
          <div className="setting-row" style={{ marginTop: 16 }}>
            <div>
              <div className="label">Supprimer mon compte</div>
              <div className="desc">Efface le compte et toutes les données en ligne. La copie sur cet appareil reste, effaçable dans Paramètres.</div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => setDelOpen(true)}>
              <Trash2 /> Supprimer
            </button>
          </div>
        </section>
      )}

      <Modal
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Supprimer définitivement le compte ?"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setDelOpen(false)}>
              Annuler
            </button>
            <button
              className="btn btn-danger"
              disabled={confirmText.trim().toUpperCase() !== "SUPPRIMER"}
              onClick={async () => {
                try {
                  await deleteAccount();
                  setDelOpen(false);
                  setConfirmText("");
                  toast.success("Compte et données en ligne supprimés.");
                } catch (err) {
                  toast.error(authErrorMessage(err));
                }
              }}
            >
              Supprimer le compte
            </button>
          </>
        }
      >
        <div className="stack gap-12">
          <p>Cette action est irréversible. Tapez SUPPRIMER pour confirmer.</p>
          <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Confirmation" />
        </div>
      </Modal>
    </>
  );
}

function PasswordForm({ pw, setPw, error, busy, onSubmit }: { pw: string; setPw: (v: string) => void; error: string; busy: boolean; onSubmit: (e: FormEvent) => void }) {
  return (
    <form className="stack gap-12" onSubmit={onSubmit} noValidate>
      <Field label="Nouveau mot de passe" hint="8 caractères minimum, lettres et chiffres." error={error} htmlFor="acc-newpw">
        <input id="acc-newpw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-invalid={Boolean(error)} />
      </Field>
      <button className="btn btn-secondary btn-sm" type="submit" disabled={busy || !pw} style={{ alignSelf: "flex-start" }}>
        {busy ? <span className="spinner" /> : <KeyRound />} Modifier le mot de passe
      </button>
    </form>
  );
}
