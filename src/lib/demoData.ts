/**
 * Données de démonstration. Toutes portent `demo: true` et sont signalées par un badge « Démo »
 * dans l'interface. Elles peuvent être supprimées à tout moment (Paramètres > Données).
 */
import { addDays, isoDay, uid } from "./format";
import {
  runAdmin,
  runAppointment,
  runCompare,
  runDay,
  runSubscriptions,
  runTravel,
  compareDefaults,
  dayDefaults,
  subscriptionsDefaults,
  type FlowOutput,
} from "./flows";
import type { AgendaItem, Conversation, Mission, MissionKind, MissionStatus } from "./types";

const daysAgo = (n: number, hour = 10) => {
  const d = addDays(new Date(), -n);
  d.setHours(hour, 12, 0, 0);
  return d.toISOString();
};

function make(kind: MissionKind, out: FlowOutput, status: MissionStatus, ago: number, extra: Partial<Mission> = {}): Mission {
  const at = daysAgo(ago);
  const closeAll = status === "done";
  return {
    id: uid("mis"),
    kind,
    title: out.title,
    request: out.request,
    status,
    createdAt: at,
    updatedAt: closeAll ? daysAgo(Math.max(0, ago - 1), 16) : at,
    demo: true,
    result: out.result,
    steps: closeAll ? out.steps.map((s) => ({ ...s, state: "done" as const, at })) : out.steps.map((s) => (s.at ? { ...s, at } : s)),
    actions: closeAll ? out.actions.map((a) => ({ ...a, state: a.state === "awaiting" ? ("handed_off" as const) : a.state, doneAt: at })) : out.actions,
    blocker: out.blocker,
    estimatedSavings: out.estimatedSavings,
    history: [
      { at, text: "Mission créée à partir de votre demande." },
      { at, text: "Résultat préparé par l'assistant." },
      ...(closeAll ? [{ at: daysAgo(Math.max(0, ago - 1), 16), text: "Toutes les actions sont closes.", tone: "success" as const }] : []),
    ],
    ...extra,
  };
}

export function buildDemoData(): { missions: Mission[]; agenda: AgendaItem[]; conversations: Conversation[] } {
  const box = runCompare(compareDefaults);
  const sub = runSubscriptions(subscriptionsDefaults);
  const day = runDay({ ...dayDefaults, when: "tomorrow" });
  const lisbon = runTravel({
    destination: "Lisbonne",
    origin: "Paris",
    departure: isoDay(addDays(new Date(), 24)),
    nights: "3",
    people: "2",
    budget: "900",
    style: "confort",
    interests: ["Culture", "Gastronomie", "Détente"],
  });
  const gym = runAdmin({
    type: "resiliation",
    organisme: "Salle de sport",
    reference: "AB-20931",
    fullName: "Camille Martin",
    address: "12 rue des Lilas, 69003 Lyon",
    details: "",
    recipientEmail: "",
  });
  const train = runAdmin({
    type: "remboursement",
    organisme: "Compagnie ferroviaire",
    reference: "",
    fullName: "Camille Martin",
    address: "12 rue des Lilas, 69003 Lyon",
    details: "Train du 3 annulé, billet de 74 € non utilisé et non remboursé automatiquement.",
    recipientEmail: "",
  });
  const rdv = runAppointment({ type: "banque", with: "Conseiller bancaire", date: isoDay(addDays(new Date(), 6)), time: "10:30", goal: "Réduire les frais de carte" });

  const missions: Mission[] = [
    make("day", day, "awaiting", 0),
    make("travel", lisbon, "awaiting", 2),
    make("admin", train, "blocked", 5, {
      title: "Remboursement : billet de train annulé",
      blocker: {
        reason: "Le formulaire en ligne de la compagnie exige le numéro de dossier à 6 lettres, absent de votre demande.",
        alternative: "Retrouvez-le dans l'e-mail de confirmation de réservation, ou utilisez le courrier préparé qui accepte la date et le trajet.",
      },
    }),
    make("subscriptions", sub, "draft", 1, {
      actions: sub.actions.map((a, i) => (i === 0 ? { ...a, state: "prepared" as const } : a)),
    }),
    make("appointment", rdv, "awaiting", 3),
    make("compare", box, "done", 48, { confirmedSavings: 180, title: "Comparaison : box internet" }),
    make("admin", gym, "done", 33, { confirmedSavings: 359, title: "Résiliation : salle de sport" }),
    make("day", day, "done", 9, { title: "Planning du lundi" }),
    make("day", day, "done", 16, { title: "Planning du jeudi" }),
    make("appointment", rdv, "done", 71, { title: "Rendez-vous : médecin traitant" }),
    make("day", day, "done", 77, { title: "Planning du mardi" }),
    make("compare", box, "done", 104, { title: "Comparaison : forfait mobile", confirmedSavings: 96 }),
    make("travel", lisbon, "done", 130, { title: "Week-end à Annecy" }),
    make("admin", gym, "done", 152, { title: "Changement d'adresse : énergie" }),
  ];

  const today = isoDay();
  const agenda: AgendaItem[] = [
    { id: uid("ag"), date: today, start: "09:00", end: "10:30", label: "Bloc concentration : dossier client", kind: "focus", demo: true },
    { id: uid("ag"), date: today, start: "12:30", end: "13:30", label: "Déjeuner", kind: "break", demo: true },
    { id: uid("ag"), date: today, start: "14:00", end: "15:00", label: "Réunion d'équipe", kind: "fixed", demo: true },
    { id: uid("ag"), date: today, start: "18:00", label: "Rappel : vérifier la facture d'électricité", kind: "reminder", demo: true },
  ];

  const at = daysAgo(1, 19);
  const conversations: Conversation[] = [
    {
      id: uid("cv"),
      title: "Réduire mes factures",
      createdAt: at,
      updatedAt: at,
      demo: true,
      messages: [
        { id: uid("m"), role: "user", text: "Trouve-moi un moyen de réduire mes factures.", at },
        {
          id: uid("m"),
          role: "assistant",
          mode: "demo",
          at,
          text: "Je peux vous aider à repérer les factures où l'écart avec le marché est le plus grand. Le plus rapide : indiquer vos dépenses mensuelles, puis je calcule des pistes chiffrées.",
          blocks: [
            { type: "knowledge", known: ["Vous voulez réduire vos factures récurrentes."], assumptions: ["Il s'agit de dépenses mensuelles du foyer (énergie, box, mobile, assurances)."] },
            { type: "steps", items: ["Recenser vos dépenses mensuelles", "Comparer à des fourchettes de marché", "Prioriser les pistes", "Lancer une comparaison réelle pour chaque piste"] },
            { type: "mission", kind: "savings", reason: "Le parcours « Trouver des économies » calcule les pistes à partir de vos montants." },
          ],
        },
      ],
    },
  ];

  return { missions, agenda, conversations };
}
