/**
 * Centre de notifications.
 *
 * Règles (réglables dans Paramètres) :
 * - chaque type peut être coupé (Rappels, Actions à valider, Économies, Bilan hebdomadaire) ;
 * - application ouverte et visible : message dans l'application ;
 * - application en arrière-plan : notification du téléphone, seulement pour les « sujets d'alerte »
 *   choisis, hors plage « Ne pas déranger », et si l'autorisation a été donnée ;
 * - sinon, le message est gardé et affiché au retour dans l'application.
 * Limite assumée : sans serveur de notifications (push), rien n'arrive quand l'application est fermée.
 */
import { useEffect } from "react";
import { toast } from "../components/ui";
import { addDays, euro, isoDay, toMinutes } from "./format";
import { computeStats } from "./stats";
import { useStore } from "./store";

export type Topic = "reminders" | "validations" | "savings" | "weekly" | "blocked" | "contracts";

/** Correspondance avec les « Sujets d'alerte » des Paramètres. */
export const TOPIC_LABEL: Record<Topic, string> = {
  validations: "Validations en attente",
  reminders: "Rappels",
  savings: "Économies détectées",
  blocked: "Missions bloquées",
  weekly: "Bilan hebdomadaire",
  contracts: "Échéances de contrats",
};

const TOGGLE: Partial<Record<Topic, "reminders" | "validations" | "savings" | "weekly">> = {
  reminders: "reminders",
  validations: "validations",
  savings: "savings",
  weekly: "weekly",
  contracts: "reminders",
};

export function inQuietHours(from: string, to: string, now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  const f = toMinutes(from);
  const t = toMinutes(to);
  return f <= t ? m >= f && m < t : m >= f || m < t;
}

const queued: { title: string; body: string }[] = [];

/** Affiche une notification système (via le service worker si possible : obligatoire sur Android). */
export async function showSystemNotification(title: string, body: string, url = "/#/app"): Promise<boolean> {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const options: NotificationOptions = { body, icon: "/icon-192.png", badge: "/icon-maskable-192.png", data: { url }, tag: `${title}:${body}`.slice(0, 64) };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export async function notify(topic: Topic, title: string, body: string, url?: string) {
  const { settings } = useStore.getState();
  const toggle = TOGGLE[topic];
  if (toggle && !settings.notifications[toggle]) return;
  if (document.visibilityState === "visible") {
    toast.info(`${title} : ${body}`);
    return;
  }
  const allowed = settings.alertTopics.includes(TOPIC_LABEL[topic]) && !(settings.quietHours.enabled && inQuietHours(settings.quietHours.from, settings.quietHours.to));
  if (allowed && (await showSystemNotification(title, body, url))) return;
  queued.push({ title, body });
}

/* ---------------------------------------------------------------- Vérifications */

const META_KEY = "project-one:notify";
type Meta = { validations?: string; blocked?: string; savings?: Record<string, string>; weekly?: string };
const readMeta = (): Meta => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeMeta = (m: Meta) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* stockage indisponible */
  }
};
const hoursSince = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : Infinity);

/** Lundi (AAAA-MM-JJ) de la semaine d'une date. */
const mondayOf = (d: Date) => isoDay(addDays(d, -((d.getDay() + 6) % 7)));

function dailyChecks() {
  const { missions, profile } = useStore.getState();
  if (!profile.onboarded) return;
  const meta = readMeta();
  const real = missions.filter((m) => !m.demo);

  const awaiting = real.filter((m) => m.status === "awaiting").length;
  if (awaiting && hoursSince(meta.validations) > 20) {
    void notify("validations", "Actions à valider", `${awaiting} mission${awaiting > 1 ? "s attendent" : " attend"} votre accord.`, "/#/app/missions");
    meta.validations = new Date().toISOString();
  }

  const blocked = real.filter((m) => m.status === "blocked").length;
  if (blocked && hoursSince(meta.blocked) > 20) {
    void notify("blocked", "Missions bloquées", `${blocked} mission${blocked > 1 ? "s sont bloquées" : " est bloquée"} : une alternative vous attend.`, "/#/app/missions");
    meta.blocked = new Date().toISOString();
  }

  // Économies estimées non confirmées depuis 7 jours : proposer de les vérifier.
  meta.savings ??= {};
  for (const m of real) {
    if (!m.estimatedSavings || m.confirmedSavings || meta.savings[m.id]) continue;
    if (hoursSince(m.createdAt) < 24 * 7) continue;
    void notify("savings", "Économie à vérifier", `${m.title} : ${euro(m.estimatedSavings)} par an estimés. Obtenus ? Confirmez-les pour votre bilan.`, `/#/app/missions/${m.id}`);
    meta.savings[m.id] = new Date().toISOString();
    break; // une à la fois
  }

  // Bilan de la semaine précédente, une fois par semaine.
  const week = mondayOf(new Date());
  if (meta.weekly !== week) {
    const start = addDays(new Date(`${week}T00:00:00`), -7).getTime();
    const end = new Date(`${week}T00:00:00`).getTime();
    const lastWeek = real.filter((m) => {
      const t = new Date(m.updatedAt).getTime();
      return t >= start && t < end;
    });
    if (meta.weekly && lastWeek.length) {
      const st = computeStats(lastWeek, { includeDemo: false });
      void notify(
        "weekly",
        "Votre semaine",
        `${st.done} mission${st.done > 1 ? "s" : ""} terminée${st.done > 1 ? "s" : ""}, ${euro(st.confirmed)} d'économies confirmées, ${st.awaiting} à valider.`,
        "/#/app/bilan",
      );
      useStore.getState().log(`Bilan hebdomadaire : ${st.done} mission(s) terminée(s), ${euro(st.confirmed)} confirmés.`);
    }
    meta.weekly = week;
  }
  writeMeta(meta);
}

/** Rappels de l'agenda arrivés à échéance (fenêtre de 15 minutes), une seule fois chacun. */
function reminderChecks() {
  const { agenda, markAgendaNotified } = useStore.getState();
  const now = new Date();
  const today = isoDay(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  agenda
    .filter((a) => a.kind === "reminder" && !a.done && !a.demo && !a.notifiedAt && a.date === today && a.start && toMinutes(a.start) <= mins && mins - toMinutes(a.start) < 15)
    .forEach((a) => {
      markAgendaNotified(a.id);
      void notify(a.topic === "contract" ? "contracts" : "reminders", "Rappel", a.label, "/#/app");
    });
}

/** À monter une fois : vérifie rappels (chaque minute) et résumés (à l'ouverture, puis toutes les 30 min). */
export function useNotificationCenter() {
  useEffect(() => {
    reminderChecks();
    const first = setTimeout(dailyChecks, 4000);
    const r = setInterval(reminderChecks, 60_000);
    const d = setInterval(dailyChecks, 30 * 60_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      reminderChecks();
      while (queued.length) {
        const q = queued.shift()!;
        toast.info(`${q.title} : ${q.body}`);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(r);
      clearInterval(d);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
