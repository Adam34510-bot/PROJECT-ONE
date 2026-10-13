/** Modèle de données de l'application. Conçu pour être migré tel quel vers une base de données serveur. */

export type MissionKind = "day" | "savings" | "compare" | "admin" | "travel" | "subscriptions" | "appointment" | "other";

/** Statuts d'une mission, visibles dans le centre des missions. */
export type MissionStatus = "draft" | "running" | "awaiting" | "done" | "blocked";

/**
 * Statuts d'une action. Règle produit : une action n'est "executed" que si elle a été
 * réellement réalisée ET vérifiée par l'application.
 */
export type ActionState =
  | "prepared" // préparée par l'assistant, encore incomplète
  | "awaiting" // prête, attend la validation de l'utilisateur
  | "executed" // exécutée et vérifiée (actions internes à l'application uniquement)
  | "handed_off" // l'utilisateur a été redirigé vers le service : à finaliser de son côté
  | "unavailable" // intégration non disponible dans cette version
  | "declined"; // refusée par l'utilisateur

export type ActionExecutor =
  | "add_to_agenda"
  | "create_reminder"
  | "download_text"
  | "copy_text"
  | "open_mailto"
  | "open_url"
  | "save_memory"
  | "start_mission"
  | "none";

export interface MissionAction {
  id: string;
  label: string;
  description: string;
  executor: ActionExecutor;
  state: ActionState;
  payload?: Record<string, unknown>;
  /** Pourquoi l'action ne peut pas être exécutée ici, et quoi faire à la place. */
  unavailableReason?: string;
  doneAt?: string;
}

export interface MissionStep {
  id: string;
  label: string;
  state: "done" | "todo" | "blocked";
  at?: string;
}

export interface HistoryEvent {
  at: string;
  text: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

export interface Mission {
  id: string;
  kind: MissionKind;
  title: string;
  request: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
  input?: Record<string, unknown>;
  result?: MissionResult;
  steps: MissionStep[];
  actions: MissionAction[];
  blocker?: { reason: string; alternative: string; link?: { label: string; url: string } };
  history: HistoryEvent[];
  /** Économie ANNUELLE estimée (jamais présentée comme obtenue). */
  estimatedSavings?: number;
  /** Économie ANNUELLE constatée et confirmée par l'utilisateur. */
  confirmedSavings?: number;
  conversationId?: string;
}

/** Résultat structuré produit par un parcours de mission. */
export type MissionResult =
  | { type: "day"; blocks: { start: string; end: string; label: string; kind: "task" | "break" | "focus" | "fixed" }[]; overflow: string[] }
  | { type: "compare"; horizon: number; offers: { name: string; total: number; monthly: number; score: number; pros: string[]; cons: string[] }[]; winner: string; reasoning: string[] }
  | { type: "savings"; leads: { category: string; current: number; low: number; high: number; tip: string }[]; totalLow: number; totalHigh: number }
  | { type: "admin"; letter: string; checklist: string[]; recipientEmail?: string; subject: string }
  | { type: "travel"; budget: { label: string; amount: number }[]; itinerary: { day: string; items: string[] }[]; checklist: string[]; links: { label: string; url: string }[] }
  | { type: "subscriptions"; items: { name: string; monthly: number; usage: string; verdict: "garder" | "à revoir" | "résilier" }[]; monthlyTotal: number; potentialYearly: number }
  | { type: "appointment"; questions: string[]; documents: string[]; reminderAt?: string };

export interface AgendaItem {
  id: string;
  date: string; // AAAA-MM-JJ
  start?: string; // HH:MM
  end?: string;
  label: string;
  kind: "task" | "reminder" | "break" | "focus" | "fixed";
  done?: boolean;
  missionId?: string;
  demo?: boolean;
  /** "contract" : échéance de contrat (sujet d'alerte dédié). */
  topic?: "contract";
  /** Date d'envoi de la notification, pour ne pas la répéter. */
  notifiedAt?: string;
}

export type ChatBlock =
  | { type: "steps"; items: string[] }
  | { type: "knowledge"; known: string[]; assumptions: string[] }
  | { type: "questions"; items: { question: string; options: string[] }[] }
  | { type: "mission"; kind: MissionKind; reason: string; prefill?: Record<string, string> }
  | { type: "memory"; items: { id: string; category: MemoryCategory; text: string; state: "pending" | "saved" | "dismissed" }[] }
  | { type: "limits"; items: string[] }
  | { type: "reminder"; actionId: string; label: string; date: string; time: string; state: "awaiting" | "executed" | "declined" };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  mode?: "demo" | "live" | "error";
  /** Code de l'erreur (auth_required, offline, quota…) pour proposer la bonne action. */
  errorCode?: string;
  blocks?: ChatBlock[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  missionId?: string;
  demo?: boolean;
}

export type MemoryCategory = "communication" | "objectifs" | "criteres" | "habitudes" | "voyage" | "organisation" | "autre";

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  text: string;
  source: "onboarding" | "conversation" | "manuel";
  confirmed: boolean;
  createdAt: string;
  demo?: boolean;
}

export interface SupportTicket {
  id: string;
  category: "question" | "bug" | "mission_bloquee" | "facturation" | "autre";
  subject: string;
  message: string;
  email?: string;
  missionId?: string;
  createdAt: string;
  /** enregistree : gardée sur l'appareil ; envoyee : reçue par le support (base en ligne) ; email : confiée à la messagerie. */
  status: "enregistree" | "envoyee" | "email";
}

export type Plan = "free" | "standard" | "premium";

export interface Settings {
  theme: "dark" | "light" | "system";
  language: "fr";
  notifications: { reminders: boolean; validations: boolean; savings: boolean; weekly: boolean };
  quietHours: { enabled: boolean; from: string; to: string };
  alertTopics: string[];
  memoryEnabled: boolean;
  retentionDays: 30 | 90 | 365 | 0; // 0 = conserver
  voiceReplies: boolean;
  reducedMotion: boolean;
}

export interface Profile {
  name: string;
  priorities: string[];
  tone: "concis" | "detaille" | "chaleureux";
  rhythm: "matin" | "soir" | "variable";
  onboarded: boolean;
}
