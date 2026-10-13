/**
 * Comptes et sauvegarde en ligne (Supabase).
 *
 * - Activé seulement si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont configurées.
 *   Sans elles, l'application fonctionne entièrement sur l'appareil, comme avant.
 * - Les données restent aussi sur l'appareil : l'application marche hors ligne et
 *   envoie les changements dès que la connexion revient.
 * - Chaque utilisateur ne peut lire et modifier que sa propre ligne (règles d'accès
 *   définies dans supabase/schema.sql).
 */
import { create } from "zustand";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useStore } from "../store";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudConfigured = Boolean(URL_ && ANON);

let clientPromise: Promise<SupabaseClient> | null = null;
/** Le client Supabase n'est chargé que si les comptes sont configurés (application plus légère sinon). */
export function getClient(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error("Comptes non configurés."));
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_!, ANON!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }),
  );
  return clientPromise;
}

export type SyncState = "idle" | "syncing" | "synced" | "offline" | "error";

interface AccountState {
  status: "disabled" | "loading" | "signedOut" | "signedIn";
  email: string | null;
  userId: string | null;
  sync: SyncState;
  syncError: string | null;
  lastSyncedAt: string | null;
  /** Données du compte et de l'appareil différentes à la première connexion : l'utilisateur choisit. */
  conflict: { remoteUpdatedAt: string } | null;
  /** Ouverture depuis le lien « mot de passe oublié » : l'utilisateur choisit un nouveau mot de passe. */
  recovery: boolean;
}

export const useAccount = create<AccountState>(() => ({
  status: cloudConfigured ? "loading" : "disabled",
  email: null,
  userId: null,
  sync: "idle",
  syncError: null,
  lastSyncedAt: null,
  conflict: null,
  recovery: false,
}));

let session: Session | null = null;

/** Jeton à joindre aux appels /api/chat (vérifié côté serveur). */
export async function getAccessToken(): Promise<string | null> {
  if (!cloudConfigured) return null;
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  session = data.session;
  return data.session?.access_token ?? null;
}

/* ------------------------------------------------------------ Messages d'erreur */

export function authErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const m = raw.toLowerCase();
  if (!navigator.onLine) return "Connexion internet indisponible. Réessayez une fois en ligne.";
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("fetch")) return "Le service de comptes est injoignable. Réessayez dans un instant.";
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Adresse e-mail pas encore confirmée : ouvrez le lien reçu par e-mail.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet e-mail. Connectez-vous.";
  if (m.includes("password should be") || m.includes("weak password")) return "Mot de passe trop faible : au moins 8 caractères, avec lettres et chiffres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Patientez quelques minutes.";
  if (m.includes("signups not allowed")) return "Les inscriptions sont fermées pour le moment.";
  return "L'opération n'a pas abouti. Réessayez dans un instant.";
}

/* ------------------------------------------------------------ Authentification */

// Retour des liens reçus par e-mail (confirmation, mot de passe oublié) : Supabase ajoute « ?code=… » à cette adresse.
const redirectTo = () => `${location.origin}/`;

export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
  // Supabase renvoie un utilisateur sans identités si l'e-mail est déjà inscrit.
  if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error("User already registered");
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string) {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const sb = await getClient();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const sb = await getClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
  useAccount.setState({ recovery: false });
}

export async function signOut() {
  const sb = await getClient();
  await flushSync();
  await sb.auth.signOut();
}

/** Supprime le compte et toutes les données en ligne (fonction delete_my_account de schema.sql). */
export async function deleteAccount() {
  const sb = await getClient();
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw error;
  await sb.auth.signOut();
}

/* ------------------------------------------------------------ Synchronisation */

/** Données synchronisées : tout l'état enregistré, sans les fonctions. */
function snapshot() {
  const s = useStore.getState();
  return {
    profile: s.profile,
    settings: s.settings,
    plan: s.plan,
    missions: s.missions,
    conversations: s.conversations,
    agenda: s.agenda,
    memory: s.memory,
    tickets: s.tickets,
    audit: s.audit,
    waitlist: s.waitlist,
    hasDemo: s.hasDemo,
  };
}
type Snapshot = ReturnType<typeof snapshot>;

const metaKey = (uid: string) => `project-one:sync:${uid}`;
interface SyncMeta {
  remoteUpdatedAt: string | null;
  dirty: boolean;
}
function readMeta(uid: string): SyncMeta {
  try {
    return { remoteUpdatedAt: null, dirty: false, ...JSON.parse(localStorage.getItem(metaKey(uid)) || "{}") };
  } catch {
    return { remoteUpdatedAt: null, dirty: false };
  }
}
function writeMeta(uid: string, m: SyncMeta) {
  try {
    localStorage.setItem(metaKey(uid), JSON.stringify(m));
  } catch {
    /* stockage indisponible */
  }
}

const hasLocalContent = () => {
  const s = useStore.getState();
  return s.missions.some((m) => !m.demo) || s.conversations.some((c) => !c.demo) || s.memory.some((m) => !m.demo) || s.agenda.some((a) => !a.demo) || s.tickets.length > 0;
};

let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function applyRemote(data: Snapshot) {
  applyingRemote = true;
  useStore.setState({ ...data });
  applyingRemote = false;
}

async function fetchRemote(uid: string): Promise<{ data: Snapshot; updated_at: string } | null> {
  const sb = await getClient();
  const { data, error } = await sb.from("user_state").select("data, updated_at").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return (data as { data: Snapshot; updated_at: string } | null) ?? null;
}

async function push(uid: string) {
  const sb = await getClient();
  const updated_at = new Date().toISOString();
  const { error } = await sb.from("user_state").upsert({ user_id: uid, data: snapshot(), updated_at });
  if (error) throw error;
  writeMeta(uid, { remoteUpdatedAt: updated_at, dirty: false });
  useAccount.setState({ sync: "synced", syncError: null, lastSyncedAt: updated_at });
}

function syncFailed(e: unknown) {
  const offline = !navigator.onLine;
  const msg = e instanceof Error ? e.message : "";
  const setup = /relation .*user_state.* does not exist|could not find the table/i.test(msg);
  useAccount.setState({
    sync: offline ? "offline" : "error",
    syncError: offline
      ? "Hors ligne : vos changements sont gardés sur l'appareil et seront envoyés au retour de la connexion."
      : setup
        ? "La base de données n'est pas initialisée : exécutez supabase/schema.sql dans Supabase."
        : "La sauvegarde en ligne a échoué. Nouvel essai automatique.",
  });
}

/** Compare l'appareil et le compte, puis récupère ou envoie selon le plus récent. */
export async function syncNow(): Promise<void> {
  const { userId, conflict } = useAccount.getState();
  if (!userId || conflict) return;
  useAccount.setState({ sync: "syncing" });
  try {
    const meta = readMeta(userId);
    const remote = await fetchRemote(userId);
    if (!remote) return await push(userId);
    const remoteNewer = remote.updated_at !== meta.remoteUpdatedAt;
    if (!meta.remoteUpdatedAt) {
      // Première connexion sur cet appareil.
      if (!hasLocalContent()) {
        applyRemote(remote.data);
        writeMeta(userId, { remoteUpdatedAt: remote.updated_at, dirty: false });
        useAccount.setState({ sync: "synced", lastSyncedAt: remote.updated_at, syncError: null });
      } else {
        useAccount.setState({ sync: "idle", conflict: { remoteUpdatedAt: remote.updated_at } });
      }
      return;
    }
    if (remoteNewer && meta.dirty) {
      useAccount.setState({ sync: "idle", conflict: { remoteUpdatedAt: remote.updated_at } });
      return;
    }
    if (remoteNewer) {
      applyRemote(remote.data);
      writeMeta(userId, { remoteUpdatedAt: remote.updated_at, dirty: false });
      useAccount.setState({ sync: "synced", lastSyncedAt: remote.updated_at, syncError: null });
      return;
    }
    if (meta.dirty) return await push(userId);
    useAccount.setState({ sync: "synced", lastSyncedAt: meta.remoteUpdatedAt, syncError: null });
  } catch (e) {
    syncFailed(e);
  }
}

/** Résout un désaccord entre l'appareil et le compte. */
export async function resolveConflict(keep: "account" | "device") {
  const { userId } = useAccount.getState();
  if (!userId) return;
  useAccount.setState({ conflict: null, sync: "syncing" });
  try {
    if (keep === "account") {
      const remote = await fetchRemote(userId);
      if (remote) {
        applyRemote(remote.data);
        writeMeta(userId, { remoteUpdatedAt: remote.updated_at, dirty: false });
        useAccount.setState({ sync: "synced", lastSyncedAt: remote.updated_at, syncError: null });
      }
    } else await push(userId);
  } catch (e) {
    syncFailed(e);
  }
}

async function flushSync() {
  const { userId } = useAccount.getState();
  if (!userId || !pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  await push(userId).catch(syncFailed);
}

function schedulePush() {
  const { userId, conflict } = useAccount.getState();
  if (!userId) return;
  writeMeta(userId, { ...readMeta(userId), dirty: true });
  if (conflict) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!navigator.onLine) return useAccount.setState({ sync: "offline", syncError: "Hors ligne : vos changements seront envoyés au retour de la connexion." });
    useAccount.setState({ sync: "syncing" });
    push(userId).catch(syncFailed);
  }, 1500);
}

let started = false;
/** À appeler une fois au démarrage de l'application. */
export function initAccount() {
  if (!cloudConfigured || started) return;
  started = true;
  getClient()
    .then(async (sb) => {
      const onSession = (s: Session | null) => {
        const prevId = useAccount.getState().userId;
        session = s;
        if (s?.user) {
          useAccount.setState({ status: "signedIn", email: s.user.email ?? null, userId: s.user.id });
          if (prevId !== s.user.id) void syncNow();
        } else {
          useAccount.setState({ status: "signedOut", email: null, userId: null, sync: "idle", conflict: null, lastSyncedAt: null });
        }
      };
      const fromEmailLink = /[?&](code|error_description)=/.test(location.search);
      const { data } = await sb.auth.getSession();
      onSession(data.session);
      sb.auth.onAuthStateChange((event, s) => {
        if (event === "PASSWORD_RECOVERY") useAccount.setState({ recovery: true });
        onSession(s);
      });
      if (fromEmailLink) {
        const err = new URLSearchParams(location.search).get("error_description");
        history.replaceState(null, "", "/#/app/compte" + (err ? `?erreur=${encodeURIComponent(err)}` : ""));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    })
    .catch(() => useAccount.setState({ status: "signedOut", sync: "error", syncError: "Le service de comptes est injoignable." }));

  // Chaque modification locale est envoyée au compte (regroupée toutes les 1,5 s).
  useStore.subscribe((s, prev) => {
    if (applyingRemote || !session) return;
    const keys: (keyof Snapshot)[] = ["profile", "settings", "plan", "missions", "conversations", "agenda", "memory", "tickets", "audit", "waitlist", "hasDemo"];
    if (keys.some((k) => s[k] !== prev[k])) schedulePush();
  });
  window.addEventListener("online", () => void syncNow());
  // En revenant sur l'application (téléphone ↔ ordinateur), récupère les derniers changements.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
    else void flushSync();
  });
}

/* ------------------------------------------------------------ Support */

export async function sendTicketOnline(t: { category: string; subject: string; message: string; email?: string; missionId?: string }) {
  const sb = await getClient();
  const { error } = await sb.from("support_tickets").insert({ category: t.category, subject: t.subject, message: t.message, email: t.email ?? null, mission_id: t.missionId ?? null });
  if (error) throw error;
}
