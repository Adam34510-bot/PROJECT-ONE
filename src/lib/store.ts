/**
 * État global de l'application, persisté sur l'appareil (localStorage).
 * La couche "storage" est isolée : elle pourra être remplacée par une base de données
 * serveur (ex. Supabase/Postgres) sans changer les composants.
 */
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { nowIso, uid } from "./format";
import { buildDemoData } from "./demoData";
import type {
  ActionState,
  AgendaItem,
  ChatBlock,
  ChatMessage,
  Conversation,
  MemoryItem,
  Mission,
  MissionKind,
  MissionStatus,
  Plan,
  Profile,
  Settings,
  SupportTicket,
} from "./types";
import type { FlowOutput } from "./flows";

const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* stockage indisponible (navigation privée) : l'application fonctionne en mémoire */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export interface AuditEntry {
  id: string;
  at: string;
  text: string;
}

export const PLAN_LIMITS: Record<Plan, { missions: number | null; label: string }> = {
  free: { missions: 10, label: "Gratuit" },
  standard: { missions: 60, label: "Standard" },
  premium: { missions: null, label: "Premium" },
};

const defaultSettings: Settings = {
  theme: "dark",
  language: "fr",
  notifications: { reminders: true, validations: true, savings: true, weekly: false },
  quietHours: { enabled: true, from: "21:30", to: "08:00" },
  alertTopics: ["Validations en attente", "Rappels"],
  memoryEnabled: true,
  retentionDays: 90,
  voiceReplies: false,
  reducedMotion: false,
};

const defaultProfile: Profile = { name: "", priorities: [], tone: "concis", rhythm: "matin", onboarded: false };

interface State {
  profile: Profile;
  settings: Settings;
  plan: Plan;
  missions: Mission[];
  conversations: Conversation[];
  agenda: AgendaItem[];
  memory: MemoryItem[];
  tickets: SupportTicket[];
  audit: AuditEntry[];
  waitlist: string[];
  hasDemo: boolean;

  completeOnboarding: (p: Omit<Profile, "onboarded">, memory: Omit<MemoryItem, "id" | "createdAt">[], loadDemo: boolean) => void;
  updateProfile: (p: Partial<Profile>) => void;
  updateSettings: (p: Partial<Settings>) => void;
  setPlan: (p: Plan) => void;

  createMission: (kind: MissionKind, input: Record<string, unknown> | undefined, out: FlowOutput, conversationId?: string) => string;
  createFreeMission: (request: string, conversationId?: string) => string;
  setActionState: (missionId: string, actionId: string, state: ActionState, note?: string) => void;
  confirmSavings: (missionId: string, yearlyAmount: number) => void;
  blockMission: (missionId: string, reason: string, alternative: string) => void;
  resumeMission: (missionId: string) => void;
  completeMission: (missionId: string) => void;
  deleteMission: (missionId: string) => void;
  addMissionNote: (missionId: string, text: string) => void;

  addAgendaItems: (items: Omit<AgendaItem, "id">[]) => string[];
  toggleAgendaItem: (id: string) => void;
  markAgendaNotified: (id: string) => void;
  removeAgendaItem: (id: string) => void;

  createConversation: (firstMessage?: ChatMessage, missionId?: string) => string;
  addMessage: (conversationId: string, m: ChatMessage) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  updateBlock: (conversationId: string, messageId: string, index: number, block: ChatBlock) => void;
  deleteConversation: (id: string) => void;

  addMemory: (m: Omit<MemoryItem, "id" | "createdAt">) => void;
  updateMemory: (id: string, patch: Partial<MemoryItem>) => void;
  deleteMemory: (id: string) => void;
  clearMemory: () => void;

  addTicket: (t: Omit<SupportTicket, "id" | "createdAt" | "status"> & { status?: SupportTicket["status"] }) => void;
  toggleWaitlist: (serviceId: string) => void;

  log: (text: string) => void;
  clearDemo: () => void;
  resetAll: () => void;
  applyRetention: () => void;
}

const closed: ActionState[] = ["executed", "handed_off", "unavailable", "declined"];

/** Calcule le statut d'une mission à partir de ses actions (sauf blocage explicite). */
export function computeStatus(m: Mission): MissionStatus {
  if (m.status === "blocked") return "blocked";
  if (m.status === "done" && !m.actions.some((a) => a.state === "awaiting")) return "done";
  if (m.actions.some((a) => a.state === "awaiting")) return "awaiting";
  if (m.actions.some((a) => a.state === "prepared")) return "draft";
  if (m.actions.length && m.actions.every((a) => closed.includes(a.state))) return "done";
  return "running";
}

const touch = (m: Mission, patch: Partial<Mission>, event?: Mission["history"][number]): Mission => {
  const next: Mission = { ...m, ...patch, updatedAt: nowIso(), history: event ? [...m.history, event] : m.history };
  return next;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      settings: defaultSettings,
      plan: "free",
      missions: [],
      conversations: [],
      agenda: [],
      memory: [],
      tickets: [],
      audit: [],
      waitlist: [],
      hasDemo: false,

      completeOnboarding: (p, memory, loadDemo) => {
        const items = memory.map((m) => ({ ...m, id: uid("mem"), createdAt: nowIso() }));
        const demo = loadDemo ? buildDemoData() : null;
        set((s) => ({
          profile: { ...p, onboarded: true },
          memory: [...items, ...s.memory],
          missions: demo ? [...demo.missions, ...s.missions] : s.missions,
          agenda: demo ? [...demo.agenda, ...s.agenda] : s.agenda,
          conversations: demo ? [...demo.conversations, ...s.conversations] : s.conversations,
          hasDemo: Boolean(demo) || s.hasDemo,
        }));
        get().log(`Profil créé${loadDemo ? " avec des données de démonstration" : ""}.`);
      },
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      setPlan: (plan) => {
        set({ plan });
        get().log(`Formule changée en mode test : ${PLAN_LIMITS[plan].label}. Aucun paiement.`);
      },

      createMission: (kind, input, out, conversationId) => {
        const id = uid("mis");
        const base: Mission = {
          id,
          kind,
          title: out.title,
          request: out.request,
          status: "running",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          input,
          result: out.result,
          steps: out.steps,
          actions: out.actions,
          blocker: out.blocker,
          estimatedSavings: out.estimatedSavings,
          conversationId,
          history: [
            { at: nowIso(), text: "Mission créée à partir de votre demande." },
            { at: nowIso(), text: `Résultat préparé par l'assistant. ${out.actions.filter((a) => a.state === "awaiting").length} action(s) à valider.` },
          ],
        };
        base.status = computeStatus(base);
        if (base.status === "done") base.steps = base.steps.map((st) => (st.state === "todo" ? { ...st, state: "done" as const, at: nowIso() } : st));
        set((s) => ({ missions: [base, ...s.missions] }));
        get().log(`Mission créée : ${out.title}.`);
        return id;
      },

      createFreeMission: (request, conversationId) => {
        const id = uid("mis");
        const m: Mission = {
          id,
          kind: "other",
          title: request.length > 60 ? `${request.slice(0, 57)}…` : request,
          request,
          status: "running",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          steps: [
            { id: uid("st"), label: "Demande enregistrée", state: "done", at: nowIso() },
            { id: uid("st"), label: "Préciser le besoin avec l'assistant", state: "todo" },
            { id: uid("st"), label: "Valider le résultat", state: "todo" },
          ],
          actions: [],
          conversationId,
          history: [{ at: nowIso(), text: "Mission créée depuis la conversation." }],
        };
        set((s) => ({ missions: [m, ...s.missions] }));
        get().log(`Mission créée : ${m.title}.`);
        return id;
      },

      setActionState: (missionId, actionId, state, note) => {
        set((s) => ({
          missions: s.missions.map((m) => {
            if (m.id !== missionId) return m;
            const a = m.actions.find((x) => x.id === actionId);
            if (!a) return m;
            const actions = m.actions.map((x) => (x.id === actionId ? { ...x, state, doneAt: nowIso() } : x));
            const allClosed = actions.every((x) => closed.includes(x.state));
            const steps = allClosed ? m.steps.map((st) => (st.state === "todo" ? { ...st, state: "done" as const, at: nowIso() } : st)) : m.steps;
            const verb: Record<ActionState, string> = {
              executed: "exécutée et vérifiée",
              handed_off: "transmise : à finaliser de votre côté",
              declined: "refusée",
              awaiting: "remise en attente de validation",
              prepared: "préparée",
              unavailable: "indisponible",
            };
            const tone = state === "executed" ? "success" : state === "declined" ? "neutral" : "neutral";
            const next = touch(m, { actions, steps }, { at: nowIso(), text: `Action « ${a.label} » ${verb[state]}.${note ? ` ${note}` : ""}`, tone });
            next.status = computeStatus({ ...next, status: m.status === "done" ? "running" : m.status });
            return next;
          }),
        }));
        const m = get().missions.find((x) => x.id === missionId);
        const a = m?.actions.find((x) => x.id === actionId);
        if (a) get().log(`Action « ${a.label} » : ${state === "executed" ? "exécutée et vérifiée" : state === "handed_off" ? "transmise à l'utilisateur" : state === "declined" ? "refusée" : state}.`);
      },

      confirmSavings: (missionId, yearlyAmount) => {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? touch(m, { confirmedSavings: yearlyAmount }, { at: nowIso(), text: `Économie confirmée par vous : ${Math.round(yearlyAmount)} € par an.`, tone: "success" })
              : m,
          ),
        }));
        get().log(`Économie confirmée : ${Math.round(yearlyAmount)} €/an.`);
      },

      blockMission: (missionId, reason, alternative) =>
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId ? touch(m, { status: "blocked", blocker: { reason, alternative } }, { at: nowIso(), text: `Mission bloquée : ${reason}`, tone: "danger" }) : m,
          ),
        })),

      resumeMission: (missionId) =>
        set((s) => ({
          missions: s.missions.map((m) => {
            if (m.id !== missionId) return m;
            const next = touch(m, { status: "running", blocker: undefined }, { at: nowIso(), text: "Mission reprise là où elle s'était arrêtée." });
            next.status = computeStatus(next);
            return next;
          }),
        })),

      completeMission: (missionId) =>
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? touch(
                  m,
                  { status: "done", steps: m.steps.map((st) => (st.state === "todo" ? { ...st, state: "done" as const, at: nowIso() } : st)) },
                  { at: nowIso(), text: "Mission marquée comme terminée par vous.", tone: "success" },
                )
              : m,
          ),
        })),

      deleteMission: (missionId) => {
        const m = get().missions.find((x) => x.id === missionId);
        set((s) => ({ missions: s.missions.filter((x) => x.id !== missionId), agenda: s.agenda.filter((a) => a.missionId !== missionId) }));
        if (m) get().log(`Mission supprimée : ${m.title}.`);
      },

      addMissionNote: (missionId, text) =>
        set((s) => ({ missions: s.missions.map((m) => (m.id === missionId ? touch(m, {}, { at: nowIso(), text: `Note : ${text}` }) : m)) })),

      addAgendaItems: (items) => {
        const withIds = items.map((i) => ({ ...i, id: uid("ag") }));
        set((s) => ({ agenda: [...s.agenda, ...withIds] }));
        return withIds.map((i) => i.id);
      },
      toggleAgendaItem: (id) => set((s) => ({ agenda: s.agenda.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) })),
      markAgendaNotified: (id) => set((s) => ({ agenda: s.agenda.map((a) => (a.id === id ? { ...a, notifiedAt: nowIso() } : a)) })),
      removeAgendaItem: (id) => set((s) => ({ agenda: s.agenda.filter((a) => a.id !== id) })),

      createConversation: (firstMessage, missionId) => {
        const id = uid("cv");
        const c: Conversation = {
          id,
          title: firstMessage ? firstMessage.text.slice(0, 48) : "Nouvelle conversation",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          messages: firstMessage ? [firstMessage] : [],
          missionId,
        };
        set((s) => ({ conversations: [c, ...s.conversations] }));
        return id;
      },
      addMessage: (conversationId, m) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  title: c.messages.length === 0 && m.role === "user" ? m.text.slice(0, 48) : c.title,
                  messages: [...c.messages, m],
                  updatedAt: nowIso(),
                }
              : c,
          ),
        })),
      removeMessage: (conversationId, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) } : c)),
        })),
      updateBlock: (conversationId, messageId, index, block) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) => (m.id !== messageId || !m.blocks ? m : { ...m, blocks: m.blocks.map((b, i) => (i === index ? block : b)) })),
                },
          ),
        })),
      deleteConversation: (id) => {
        set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }));
        get().log("Conversation supprimée.");
      },

      addMemory: (m) => {
        set((s) => ({ memory: [{ ...m, id: uid("mem"), createdAt: nowIso() }, ...s.memory] }));
        get().log(`Information mémorisée : « ${m.text} ».`);
      },
      updateMemory: (id, patch) => set((s) => ({ memory: s.memory.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      deleteMemory: (id) => {
        set((s) => ({ memory: s.memory.filter((m) => m.id !== id) }));
        get().log("Une information mémorisée a été supprimée.");
      },
      clearMemory: () => {
        set({ memory: [] });
        get().log("Toute la mémoire de l'assistant a été effacée.");
      },

      addTicket: (t) => {
        set((s) => ({ tickets: [{ ...t, id: uid("tk"), createdAt: nowIso(), status: t.status ?? "enregistree" }, ...s.tickets] }));
        get().log(`Demande de support enregistrée : ${t.subject}.`);
      },
      toggleWaitlist: (serviceId) => set((s) => ({ waitlist: s.waitlist.includes(serviceId) ? s.waitlist.filter((x) => x !== serviceId) : [...s.waitlist, serviceId] })),

      log: (text) => set((s) => ({ audit: [{ id: uid("au"), at: nowIso(), text }, ...s.audit].slice(0, 300) })),

      clearDemo: () => {
        set((s) => ({
          missions: s.missions.filter((m) => !m.demo),
          agenda: s.agenda.filter((a) => !a.demo),
          conversations: s.conversations.filter((c) => !c.demo),
          memory: s.memory.filter((m) => !m.demo),
          hasDemo: false,
        }));
        get().log("Données de démonstration supprimées.");
      },

      resetAll: () => {
        set({
          profile: defaultProfile,
          settings: defaultSettings,
          plan: "free",
          missions: [],
          conversations: [],
          agenda: [],
          memory: [],
          tickets: [],
          audit: [],
          waitlist: [],
          hasDemo: false,
        });
        safeStorage.removeItem(STORAGE_KEY);
      },

      applyRetention: () => {
        const days = get().settings.retentionDays;
        if (!days) return;
        const limit = Date.now() - days * 86400000;
        const before = get().conversations.length;
        const kept = get().conversations.filter((c) => new Date(c.updatedAt).getTime() >= limit);
        if (kept.length !== before) {
          set({ conversations: kept });
          get().log(`${before - kept.length} conversation(s) supprimée(s) automatiquement (conservation : ${days} jours).`);
        }
      },
    }),
    {
      name: "project-one:v1",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      onRehydrateStorage: () => (state) => {
        state?.applyRetention();
      },
    },
  ),
);

export const STORAGE_KEY = "project-one:v1";

/** Nombre de missions créées ce mois-ci (pour les limites de formule). */
export function missionsThisMonth(missions: Mission[]) {
  const now = new Date();
  return missions.filter((m) => !m.demo && new Date(m.createdAt).getMonth() === now.getMonth() && new Date(m.createdAt).getFullYear() === now.getFullYear()).length;
}
