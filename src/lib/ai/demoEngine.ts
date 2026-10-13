/**
 * Mode démonstration : scénarios prédéfinis, SANS intelligence artificielle.
 * Reconnaît des intentions par mots-clés et renvoie des réponses structurées
 * pour permettre de tester les parcours sans clé API.
 */
import { addDays, isoDay, uid } from "../format";
import type { ChatBlock, MemoryCategory, MissionKind } from "../types";

export interface EngineReply {
  text: string;
  blocks: ChatBlock[];
}

const has = (t: string, ...words: (string | RegExp)[]) => words.some((w) => (typeof w === "string" ? t.includes(w) : w.test(t)));

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function parseReminder(raw: string): { label: string; date: string; time: string } | null {
  const t = norm(raw);
  if (!has(t, "rappelle", "rappel", "n'oublie", "noublie")) return null;
  let date = isoDay();
  if (t.includes("apres-demain") || t.includes("apres demain")) date = isoDay(addDays(new Date(), 2));
  else if (t.includes("demain")) date = isoDay(addDays(new Date(), 1));
  const tm = t.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
  const time = tm ? `${tm[1].padStart(2, "0")}:${tm[2] ?? "00"}` : "09:00";
  let label = raw
    .replace(/^(peux-tu |tu peux )?(me )?rappel(le|er)?(-moi)?\s*(de |d'|que )?/i, "")
    .replace(/(apr[eè]s-?\s?demain|demain|aujourd'hui|ce soir)/gi, "")
    .replace(/[àa]\s*\d{1,2}\s*(h|:)\s*\d{0,2}/gi, "")
    .trim()
    .replace(/[.!?]$/, "");
  if (!label) label = "Rappel";
  label = label.charAt(0).toUpperCase() + label.slice(1);
  return { label, date, time };
}

function memoryCandidate(raw: string): { category: MemoryCategory; text: string } | null {
  const t = norm(raw);
  const m = raw.match(/(?:je pr[ée]f[èe]re|j'aime|je d[ée]teste|je n'aime pas|souviens-toi que|retiens que|n'oublie pas que)\s+(.+)/i);
  if (!m) return null;
  const text = m[0].replace(/^(souviens-toi que|retiens que|n'oublie pas que)\s+/i, "").replace(/[.!]$/, "");
  const category: MemoryCategory = has(t, "train", "avion", "vol", "hotel", "voyage") ? "voyage" : has(t, "matin", "soir", "reunion", "planning") ? "organisation" : has(t, "message", "court", "detaill", "appel", "sms") ? "communication" : "habitudes";
  return { category, text: text.charAt(0).toUpperCase() + text.slice(1) };
}

const MISSION_INTENTS: { kind: MissionKind; test: (t: string) => boolean }[] = [
  { kind: "subscriptions", test: (t) => has(t, "abonnement", "netflix", "spotify", "prelevement") && !has(t, "resili") },
  { kind: "admin", test: (t) => has(t, "resili", "demarche", "courrier", "reclamation", "rembourse", "administratif", "lettre", "changement d'adresse") },
  { kind: "compare", test: (t) => has(t, "compar", "quelle offre", "laquelle", " vs ", "meilleure offre") },
  { kind: "savings", test: (t) => has(t, "econom", "facture", "reduire", "depense", "moins cher", "budget mensuel") },
  { kind: "travel", test: (t) => has(t, "voyage", "week-end", "weekend", "vacances", "sejour", "train", "vol ", "hotel", "partir") },
  { kind: "appointment", test: (t) => has(t, "rendez-vous", "rdv", "medecin", "entretien", "dentiste", "conseiller") },
  { kind: "day", test: (t) => has(t, "journee", "demain", "planning", "agenda", "organise", "priorit", "semaine") },
];

export function demoReply(raw: string): EngineReply {
  const t = norm(raw);

  const reminder = parseReminder(raw);
  if (reminder) {
    const d = new Date(`${reminder.date}T${reminder.time}`);
    return {
      text: `Je peux créer ce rappel dans votre agenda. Il ne sera ajouté qu'après votre validation.`,
      blocks: [
        {
          type: "knowledge",
          known: [`Objet : ${reminder.label}`],
          assumptions: [
            `Date : ${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}${t.match(/\d{1,2}\s*(h|:)/) ? "" : " (heure non précisée : 9 h par défaut)"}`,
          ],
        },
        { type: "reminder", actionId: uid("rm"), label: reminder.label, date: reminder.date, time: reminder.time, state: "awaiting" },
        { type: "limits", items: ["Les notifications ne s'affichent que si l'application est ouverte et que vous les avez autorisées."] },
      ],
    };
  }

  const mem = memoryCandidate(raw);
  if (mem) {
    return {
      text: "C'est noté de mon côté, mais je ne mémorise rien sans votre accord. Voulez-vous que je retienne cette préférence ?",
      blocks: [{ type: "memory", items: [{ id: uid("mc"), category: mem.category, text: mem.text, state: "pending" }] }],
    };
  }

  if (has(t, /^(bonjour|salut|hello|coucou|bonsoir|hey)\b/) && t.length < 40) {
    return {
      text: "Bonjour. Dites-moi ce que vous voulez accomplir : je prépare le travail, vous validez chaque action.",
      blocks: [
        { type: "questions", items: [{ question: "Par quoi commencer ?", options: ["Organise ma journée de demain", "Trouve-moi des économies", "Compare deux offres", "Prépare une résiliation"] }] },
      ],
    };
  }

  for (const intent of MISSION_INTENTS) {
    if (!intent.test(t)) continue;
    return SCENARIOS[intent.kind](raw, t);
  }

  return {
    text: "En mode démonstration, je reconnais uniquement des scénarios prédéfinis. Votre demande n'en fait pas partie, mais je peux l'enregistrer comme mission pour la suivre, ou vous proposer un parcours proche.",
    blocks: [
      { type: "limits", items: ["Aucune IA n'est connectée : configurez une clé API côté serveur pour des réponses libres."] },
      { type: "mission", kind: "other", reason: "Enregistrer la demande dans le centre des missions pour y revenir." },
      { type: "questions", items: [{ question: "Ou essayez :", options: ["Organise un week-end avec un budget de 300 €", "Aide-moi à résilier un abonnement", "Rappelle-moi d'appeler la banque demain à 10h"] }] },
    ],
  };
}

const SCENARIOS: Record<MissionKind, (raw: string, t: string) => EngineReply> = {
  day: () => ({
    text: "Je vais construire un planning réaliste : créneaux fixes d'abord, tâches prioritaires le matin, pauses toutes les 90 minutes.",
    blocks: [
      { type: "knowledge", known: ["Vous voulez organiser une journée."], assumptions: ["Journée de travail entre 8 h 30 et 18 h 30, avec une pause déjeuner."] },
      { type: "steps", items: ["Lister vos tâches et rendez-vous", "Estimer les durées", "Placer les créneaux et les pauses", "Ajouter le planning à votre agenda après validation"] },
      { type: "mission", kind: "day", reason: "Le parcours vous demande vos tâches puis calcule le planning." },
    ],
  }),
  savings: () => ({
    text: "Le plus efficace est de partir de vos dépenses mensuelles réelles. Je les compare à des fourchettes de marché indicatives pour prioriser les pistes.",
    blocks: [
      { type: "knowledge", known: ["Vous voulez réduire vos factures."], assumptions: ["Les postes concernés sont l'énergie, la box, le mobile, les assurances et la banque."] },
      { type: "steps", items: ["Indiquer vos dépenses mensuelles", "Calculer les écarts estimés", "Prioriser les 3 meilleures pistes", "Comparer des offres réelles pour chaque piste"] },
      { type: "mission", kind: "savings", reason: "Le parcours calcule les économies estimées à partir de vos montants." },
      { type: "limits", items: ["Les économies affichées sont des estimations. Elles ne deviennent « confirmées » que lorsque vous les constatez."] },
    ],
  }),
  compare: (raw) => ({
    text: "Pour une comparaison fiable, je calcule le coût total sur 12 ou 24 mois (frais d'ouverture et engagement inclus) puis je pondère selon vos critères.",
    blocks: [
      { type: "knowledge", known: ["Vous voulez comparer des offres."], assumptions: raw.match(/\d/) ? ["Les montants cités sont mensuels."] : ["Il me manque le détail des offres (prix, engagement, services)."] },
      { type: "questions", items: [{ question: "Qu'est-ce qui compte le plus pour vous ?", options: ["Le prix", "Pas d'engagement", "Les services inclus"] }] },
      { type: "mission", kind: "compare", reason: "Le parcours vous permet de saisir 2 à 4 offres et calcule le gagnant." },
    ],
  }),
  admin: (_raw, t) => ({
    text: t.includes("resili")
      ? "Je prépare le courrier de résiliation et la liste des pièces. L'envoi reste de votre côté : je ne peux ni envoyer de recommandé ni me connecter à votre espace client."
      : "Je prépare le courrier et la liste des justificatifs. Vous relisez, puis vous l'envoyez vous-même.",
    blocks: [
      { type: "knowledge", known: ["Vous voulez préparer une démarche administrative."], assumptions: ["Un courrier formel est accepté par l'organisme."] },
      { type: "steps", items: ["Indiquer l'organisme et votre référence", "Générer le courrier", "Vérifier les pièces à joindre", "Envoyer (e-mail ou recommandé) après validation"] },
      { type: "mission", kind: "admin", reason: "Le parcours génère un courrier prêt à copier, télécharger ou envoyer par e-mail." },
      { type: "limits", items: ["Envoi postal en recommandé : non intégré dans cette version."] },
    ],
  }),
  travel: (raw) => {
    const budget = raw.match(/(\d[\d\s]*)\s*(€|euros?)/i)?.[1]?.replace(/\s/g, "");
    return {
      text: budget
        ? `Avec ${budget} €, je vous propose une répartition du budget, un itinéraire et des liens de recherche. Il me manque la destination.`
        : "Je peux répartir votre budget, proposer un itinéraire et ouvrir les bons sites de réservation. La réservation et le paiement restent de votre côté.",
      blocks: [
        { type: "knowledge", known: budget ? [`Budget total : ${budget} €`] : ["Vous voulez organiser un voyage."], assumptions: ["Deux personnes, deux nuits, sauf indication contraire."] },
        { type: "questions", items: [{ question: "Quel type de séjour ?", options: ["Ville et culture", "Nature", "Détente"] }] },
        { type: "mission", kind: "travel", reason: "Le parcours calcule la répartition du budget et prépare les recherches." },
      ],
    };
  },
  subscriptions: () => ({
    text: "Faisons l'inventaire : je calcule votre total mensuel, je repère les abonnements peu utilisés et je prépare les résiliations que vous validez.",
    blocks: [
      { type: "steps", items: ["Lister vos abonnements et leur prix", "Indiquer votre usage réel", "Identifier ceux à résilier", "Préparer les courriers de résiliation"] },
      { type: "mission", kind: "subscriptions", reason: "Le parcours calcule le total et l'économie possible." },
      { type: "limits", items: ["Détection automatique depuis votre banque : en préparation."] },
    ],
  }),
  appointment: () => ({
    text: "Je prépare vos questions, la liste des documents à apporter et un rappel la veille.",
    blocks: [
      { type: "steps", items: ["Indiquer le type, la date et l'heure", "Générer questions et documents", "Créer un rappel après validation"] },
      { type: "mission", kind: "appointment", reason: "Le parcours prépare tout en moins d'une minute." },
    ],
  }),
  other: () => ({ text: "", blocks: [] }),
};
