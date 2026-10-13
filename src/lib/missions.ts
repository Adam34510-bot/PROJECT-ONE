import {
  CalendarClock,
  PiggyBank,
  Scale,
  FileSignature,
  Plane,
  Repeat,
  Stethoscope,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ActionState, MissionKind, MissionStatus } from "./types";

export interface MissionMeta {
  kind: MissionKind;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** Teinte d'accent (variable CSS) propre à la mission. */
  hue: string;
  /** Temps gagné estimé (minutes) lorsqu'une mission de ce type est terminée. */
  timeSaved: number;
  example: string;
}

export const MISSIONS: MissionMeta[] = [
  { kind: "day", label: "Organiser ma journée", short: "Journée", description: "Un planning réaliste, avec pauses et priorités.", icon: CalendarClock, hue: "var(--hue-blue)", timeSaved: 20, example: "Organise ma journée de demain." },
  { kind: "savings", label: "Trouver des économies", short: "Économies", description: "Repérer les factures à renégocier.", icon: PiggyBank, hue: "var(--hue-green)", timeSaved: 60, example: "Trouve-moi un moyen de réduire mes factures." },
  { kind: "compare", label: "Comparer des offres", short: "Comparer", description: "Coût réel sur la durée, selon vos critères.", icon: Scale, hue: "var(--hue-violet)", timeSaved: 45, example: "Compare ces deux offres et dis-moi laquelle me correspond." },
  { kind: "admin", label: "Préparer une démarche", short: "Démarche", description: "Courrier prêt à envoyer et pièces à fournir.", icon: FileSignature, hue: "var(--hue-amber)", timeSaved: 40, example: "Aide-moi à préparer la résiliation de cet abonnement." },
  { kind: "travel", label: "Organiser un voyage", short: "Voyage", description: "Budget réparti, itinéraire et liens utiles.", icon: Plane, hue: "var(--hue-cyan)", timeSaved: 90, example: "Organise un week-end avec un budget de 300 €." },
  { kind: "subscriptions", label: "Gérer mes abonnements", short: "Abonnements", description: "Tout ce que vous payez chaque mois, au même endroit.", icon: Repeat, hue: "var(--hue-pink)", timeSaved: 30, example: "Fais le point sur mes abonnements." },
  { kind: "appointment", label: "Préparer un rendez-vous", short: "Rendez-vous", description: "Questions, documents et rappel.", icon: Stethoscope, hue: "var(--hue-teal)", timeSaved: 15, example: "Prépare mon rendez-vous chez le médecin." },
  { kind: "other", label: "Autre demande", short: "Autre", description: "Décrivez librement ce dont vous avez besoin.", icon: Sparkles, hue: "var(--hue-violet)", timeSaved: 15, example: "J'ai besoin d'aide pour…" },
];

export const missionMeta = (kind: MissionKind) => MISSIONS.find((m) => m.kind === kind) ?? MISSIONS[MISSIONS.length - 1];

export const STATUS_META: Record<MissionStatus, { label: string; tone: string; description: string }> = {
  draft: { label: "À préparer", tone: "neutral", description: "Il manque des informations pour avancer." },
  running: { label: "En cours", tone: "info", description: "L'assistant travaille sur la mission." },
  awaiting: { label: "À valider", tone: "warning", description: "Une ou plusieurs actions attendent votre accord." },
  done: { label: "Terminée", tone: "success", description: "Toutes les actions sont closes." },
  blocked: { label: "Bloquée", tone: "danger", description: "Un obstacle empêche d'avancer. Une alternative est proposée." },
};

export const ACTION_META: Record<ActionState, { label: string; tone: string }> = {
  prepared: { label: "Préparée", tone: "neutral" },
  awaiting: { label: "En attente de votre validation", tone: "warning" },
  executed: { label: "Exécutée et vérifiée", tone: "success" },
  handed_off: { label: "Transmise, à finaliser par vous", tone: "info" },
  unavailable: { label: "Indisponible dans cette version", tone: "muted" },
  declined: { label: "Refusée", tone: "muted" },
};

export const STATUS_ORDER: MissionStatus[] = ["awaiting", "running", "draft", "blocked", "done"];
