import { missionMeta } from "./missions";
import type { Mission } from "./types";

/** Définitions des indicateurs : affichées dans l'interface pour éviter toute ambiguïté. */
export const KPI_DEFINITIONS = {
  confirmed: "Somme des économies annuelles que vous avez constatées et confirmées vous-même sur une mission. Aucune estimation n'est incluse.",
  estimated: "Fourchette médiane calculée par les parcours (comparaisons, abonnements, factures). Ce n'est pas un gain obtenu tant que vous ne l'avez pas confirmé.",
  time: "Estimation du temps de recherche et de rédaction évité, selon un barème fixe par type de mission terminée (ex. démarche : 40 min, voyage : 1 h 30).",
  done: "Missions dont toutes les actions sont closes ou que vous avez marquées comme terminées.",
  awaiting: "Missions comportant au moins une action prête qui attend votre accord.",
};

export function computeStats(missions: Mission[], opts: { includeDemo: boolean; sinceDays?: number }) {
  const since = opts.sinceDays ? Date.now() - opts.sinceDays * 86400000 : 0;
  const list = missions.filter((m) => (opts.includeDemo || !m.demo) && new Date(m.createdAt).getTime() >= since);
  const done = list.filter((m) => m.status === "done");
  return {
    list,
    confirmed: list.reduce((s, m) => s + (m.confirmedSavings ?? 0), 0),
    estimated: list.filter((m) => !m.confirmedSavings).reduce((s, m) => s + (m.estimatedSavings ?? 0), 0),
    timeSaved: done.reduce((s, m) => s + missionMeta(m.kind).timeSaved, 0),
    done: done.length,
    awaiting: list.filter((m) => m.status === "awaiting").length,
    running: list.filter((m) => m.status === "running" || m.status === "draft").length,
    blocked: list.filter((m) => m.status === "blocked").length,
    hasDemo: list.some((m) => m.demo),
  };
}

/** Série mensuelle sur N mois (économies confirmées au mois de la mission, temps gagné, missions terminées). */
export function monthlySeries(missions: Mission[], months: number, includeDemo: boolean) {
  const now = new Date();
  const out = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""), confirmed: 0, time: 0, done: 0, created: 0 };
  });
  missions
    .filter((m) => includeDemo || !m.demo)
    .forEach((m) => {
      const d = new Date(m.updatedAt);
      const c = new Date(m.createdAt);
      const slotDone = out.find((o) => o.key === `${d.getFullYear()}-${d.getMonth()}`);
      const slotCreated = out.find((o) => o.key === `${c.getFullYear()}-${c.getMonth()}`);
      if (slotCreated) slotCreated.created += 1;
      if (m.status === "done" && slotDone) {
        slotDone.done += 1;
        slotDone.time += missionMeta(m.kind).timeSaved;
        slotDone.confirmed += m.confirmedSavings ?? 0;
      }
    });
  return out;
}
