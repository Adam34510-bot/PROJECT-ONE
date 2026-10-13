/**
 * Moteurs des parcours de mission.
 * Chaque parcours transforme les informations saisies par l'utilisateur en résultat structuré,
 * en étapes et en actions à valider. Ces calculs sont réels (ils s'exécutent dans le navigateur) :
 * ils ne dépendent pas de l'IA et fonctionnent donc aussi en mode démonstration.
 */
import { addDays, euro, isoDay, nowIso, parseNumber, toHHMM, toMinutes, uid } from "../format";
import type { MissionAction, MissionKind, MissionResult, MissionStep } from "../types";

export interface FlowOutput {
  title: string;
  request: string;
  result: MissionResult;
  steps: MissionStep[];
  actions: MissionAction[];
  estimatedSavings?: number;
  blocker?: { reason: string; alternative: string; link?: { label: string; url: string } };
}

export type FlowErrors = Record<string, string>;

const step = (label: string, state: MissionStep["state"] = "done"): MissionStep => ({
  id: uid("st"),
  label,
  state,
  at: state === "done" ? nowIso() : undefined,
});

const action = (a: Omit<MissionAction, "id" | "state"> & { state?: MissionAction["state"] }): MissionAction => ({
  id: uid("ac"),
  state: a.state ?? "awaiting",
  ...a,
});

/* ------------------------------------------------------------------ Journée */

export interface DayInput {
  when: "today" | "tomorrow";
  start: string;
  end: string;
  tasks: string;
  lunch: boolean;
}

export const dayDefaults: DayInput = {
  when: "tomorrow",
  start: "08:30",
  end: "18:30",
  lunch: true,
  tasks: "! Finaliser la proposition client (90)\nAppeler la banque (15)\nRéunion d'équipe @14:00 (60)\nRépondre aux e-mails (30)\nSport (45)",
};

interface ParsedTask {
  label: string;
  duration: number;
  priority: boolean;
  fixed?: number;
}

export function parseTasks(text: string): ParsedTask[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      let label = line;
      const priority = label.startsWith("!");
      if (priority) label = label.slice(1).trim();
      let duration = 45;
      const dur = label.match(/\((\d{1,3})\s*(?:min)?\)/i);
      if (dur) {
        duration = Math.min(480, Math.max(5, parseInt(dur[1], 10)));
        label = label.replace(dur[0], "").trim();
      }
      let fixed: number | undefined;
      const at = label.match(/@\s*(\d{1,2})[:h](\d{2})?/i);
      if (at) {
        fixed = parseInt(at[1], 10) * 60 + (at[2] ? parseInt(at[2], 10) : 0);
        label = label.replace(at[0], "").trim();
      }
      return { label, duration, priority, fixed };
    });
}

export function validateDay(i: DayInput): FlowErrors {
  const e: FlowErrors = {};
  if (!i.tasks.trim()) e.tasks = "Ajoutez au moins une tâche, une par ligne.";
  if (toMinutes(i.end) - toMinutes(i.start) < 60) e.end = "La journée doit durer au moins une heure.";
  return e;
}

export function runDay(i: DayInput): FlowOutput {
  const tasks = parseTasks(i.tasks);
  const dayStart = toMinutes(i.start);
  const dayEnd = toMinutes(i.end);
  type Block = { start: number; end: number; label: string; kind: "task" | "break" | "focus" | "fixed" };
  const occupied: Block[] = [];

  tasks.filter((t) => t.fixed !== undefined).forEach((t) => {
    occupied.push({ start: t.fixed!, end: t.fixed! + t.duration, label: t.label, kind: "fixed" });
  });
  if (i.lunch && dayStart < 12 * 60 + 30 && dayEnd > 13 * 60 + 30) {
    occupied.push({ start: 12 * 60 + 30, end: 13 * 60 + 30, label: "Déjeuner", kind: "break" });
  }

  const flexible = tasks
    .filter((t) => t.fixed === undefined)
    .sort((a, b) => Number(b.priority) - Number(a.priority) || b.duration - a.duration);

  const blocks: Block[] = [...occupied];
  const overflow: string[] = [];
  let workedSinceBreak = 0;

  const isFree = (s: number, e: number) => s >= dayStart && e <= dayEnd && !blocks.some((b) => s < b.end && e > b.start);

  for (const t of flexible) {
    let placed = false;
    for (let s = dayStart; s + t.duration <= dayEnd; s += 5) {
      if (isFree(s, s + t.duration)) {
        blocks.push({ start: s, end: s + t.duration, label: t.label, kind: t.priority ? "focus" : "task" });
        workedSinceBreak += t.duration;
        placed = true;
        if (workedSinceBreak >= 90 && isFree(s + t.duration, s + t.duration + 10)) {
          blocks.push({ start: s + t.duration, end: s + t.duration + 10, label: "Pause", kind: "break" });
          workedSinceBreak = 0;
        }
        break;
      }
    }
    if (!placed) overflow.push(t.label);
  }

  blocks.sort((a, b) => a.start - b.start);
  const date = isoDay(i.when === "today" ? new Date() : addDays(new Date(), 1));
  const dayLabel = i.when === "today" ? "aujourd'hui" : "demain";
  const items = blocks.map((b) => ({ start: toHHMM(b.start), end: toHHMM(b.end), label: b.label, kind: b.kind }));

  return {
    title: `Planning de ${dayLabel}`,
    request: `Organise ma journée de ${dayLabel} (${tasks.length} tâche${tasks.length > 1 ? "s" : ""}).`,
    result: { type: "day", blocks: items, overflow },
    steps: [
      step("Tâches collectées et durées estimées"),
      step("Créneaux fixes et pauses positionnés"),
      step(overflow.length ? `Planning construit, ${overflow.length} tâche(s) à reporter` : "Planning construit sans dépassement"),
      step("Ajout à votre agenda", "todo"),
    ],
    actions: [
      action({
        label: `Ajouter ce planning à mon agenda (${dayLabel})`,
        description: `${items.length} créneaux seront ajoutés à l'agenda de l'application. Rien n'est envoyé à un service externe.`,
        executor: "add_to_agenda",
        payload: { date, items },
      }),
      action({
        label: "Synchroniser avec Google Agenda",
        description: "Nécessite une connexion autorisée à Google Agenda.",
        executor: "none",
        state: "unavailable",
        unavailableReason: "La connexion Google Agenda est en préparation. En attendant, le planning reste dans l'agenda de l'application.",
      }),
    ],
  };
}

/* ------------------------------------------------------------------ Comparaison */

export interface OfferInput {
  name: string;
  monthly: string;
  setup: string;
  engagement: string;
  features: string;
  url: string;
  current: boolean;
}

export interface CompareInput {
  horizon: "12" | "24";
  weightPrice: number;
  weightFlex: number;
  weightFeatures: number;
  offers: OfferInput[];
}

export const emptyOffer = (): OfferInput => ({ name: "", monthly: "", setup: "", engagement: "0", features: "", url: "", current: false });

export const compareDefaults: CompareInput = {
  horizon: "12",
  weightPrice: 3,
  weightFlex: 2,
  weightFeatures: 2,
  offers: [
    { name: "Offre actuelle", monthly: "39,99", setup: "0", engagement: "0", features: "Fibre 1 Gb/s, TV, appels fixes", url: "", current: true },
    { name: "Nouvelle offre", monthly: "24,99", setup: "48", engagement: "12", features: "Fibre 2 Gb/s, TV, appels fixes, Wi-Fi 7", url: "", current: false },
  ],
};

export function validateCompare(i: CompareInput): FlowErrors {
  const e: FlowErrors = {};
  const filled = i.offers.filter((o) => o.name.trim() || o.monthly.trim());
  if (filled.length < 2) e.offers = "Renseignez au moins deux offres.";
  i.offers.forEach((o, idx) => {
    if (!o.name.trim() && !o.monthly.trim()) return;
    if (!o.name.trim()) e[`offer${idx}name`] = "Nom requis.";
    const m = parseNumber(o.monthly);
    if (!(m >= 0)) e[`offer${idx}monthly`] = "Prix mensuel invalide.";
    if (o.setup && !(parseNumber(o.setup) >= 0)) e[`offer${idx}setup`] = "Montant invalide.";
    if (o.url && !/^https?:\/\//i.test(o.url)) e[`offer${idx}url`] = "Lien commençant par https://";
  });
  return e;
}

export function runCompare(i: CompareInput): FlowOutput {
  const horizon = Number(i.horizon);
  const offers = i.offers
    .filter((o) => o.name.trim())
    .map((o) => {
      const monthly = parseNumber(o.monthly) || 0;
      const setup = parseNumber(o.setup) || 0;
      const engagement = Math.max(0, parseInt(o.engagement || "0", 10) || 0);
      const billedMonths = Math.max(horizon, engagement);
      const total = setup + monthly * billedMonths;
      const features = o.features.split(/[,;\n]/).map((f) => f.trim()).filter(Boolean);
      return { ...o, monthly, setup, engagement, total, featuresList: features };
    });

  const minTotal = Math.min(...offers.map((o) => o.total));
  const maxFeatures = Math.max(1, ...offers.map((o) => o.featuresList.length));
  const wSum = i.weightPrice + i.weightFlex + i.weightFeatures || 1;

  const scored = offers.map((o) => {
    const price = o.total > 0 ? minTotal / o.total : 1;
    const flex = o.engagement === 0 ? 1 : o.engagement <= 12 ? 0.5 : 0.15;
    const feat = o.featuresList.length / maxFeatures;
    const score = Math.round(((price * i.weightPrice + flex * i.weightFlex + feat * i.weightFeatures) / wSum) * 100);
    const pros: string[] = [];
    const cons: string[] = [];
    if (o.total === minTotal) pros.push(`Coût le plus bas sur ${horizon} mois`);
    if (o.engagement === 0) pros.push("Sans engagement");
    else cons.push(`Engagement de ${o.engagement} mois`);
    if (o.setup > 0) cons.push(`Frais d'ouverture : ${euro(o.setup, true)}`);
    if (o.featuresList.length === maxFeatures && maxFeatures > 1) pros.push("Le plus de services inclus");
    return { name: o.name, total: Math.round(o.total * 100) / 100, monthly: o.monthly, score, pros, cons, url: o.url, current: o.current };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const current = scored.find((s) => s.current);
  const reasoning = [
    `Coût total calculé sur ${horizon} mois, frais d'ouverture et engagement inclus.`,
    `Pondération : prix ${i.weightPrice}/5, flexibilité ${i.weightFlex}/5, services ${i.weightFeatures}/5.`,
    current && current.name !== winner.name
      ? `Passer de « ${current.name} » à « ${winner.name} » représente une différence de ${euro(current.total - winner.total)} sur ${horizon} mois (estimation, hors promotions temporaires).`
      : current
        ? `Votre offre actuelle reste la plus adaptée selon vos critères.`
        : `« ${winner.name} » obtient le meilleur score selon vos critères.`,
  ];

  const estimatedSavings = current && current.name !== winner.name && current.total > winner.total ? Math.round(((current.total - winner.total) / horizon) * 12) : undefined;

  const actions: MissionAction[] = [];
  if (winner.url) {
    actions.push(
      action({
        label: `Ouvrir la page de « ${winner.name} »`,
        description: "Vous serez redirigé vers le site du fournisseur pour vérifier l'offre et souscrire vous-même.",
        executor: "open_url",
        payload: { url: winner.url },
      }),
    );
  }
  actions.push(
    action({
      label: `Souscrire à « ${winner.name} »`,
      description: "La souscription automatique n'est pas disponible.",
      executor: "none",
      state: "unavailable",
      unavailableReason: "Aucune intégration officielle avec ce fournisseur. La souscription se fait sur son site, après vérification des conditions.",
    }),
  );
  if (current && current.name !== winner.name) {
    actions.push(
      action({
        label: `Préparer la résiliation de « ${current.name} »`,
        description: "Crée une mission « Préparer une démarche » pré-remplie.",
        executor: "start_mission",
        payload: { kind: "admin", prefill: { type: "resiliation", organisme: current.name } },
      }),
    );
  }

  return {
    title: `Comparaison : ${scored.map((s) => s.name).join(" vs ")}`,
    request: `Compare ${scored.length} offres sur ${horizon} mois selon mes critères.`,
    result: { type: "compare", horizon, offers: scored, winner: winner.name, reasoning },
    steps: [step("Offres saisies et normalisées"), step(`Coût total calculé sur ${horizon} mois`), step("Score pondéré selon vos critères"), step("Décision à prendre", "todo")],
    actions,
    estimatedSavings,
  };
}

/* ------------------------------------------------------------------ Économies */

export interface SavingsInput {
  energy: string;
  mobile: string;
  internet: string;
  insurance: string;
  bank: string;
  subscriptions: string;
}

export const savingsDefaults: SavingsInput = { energy: "", mobile: "", internet: "", insurance: "", bank: "", subscriptions: "" };

const SAVINGS_RULES: Record<keyof SavingsInput, { label: string; threshold: number; low: number; high: number; tip: string; compare: boolean }> = {
  mobile: { label: "Forfait mobile", threshold: 12, low: 0.3, high: 0.6, tip: "Les forfaits sans engagement avec beaucoup de données coûtent souvent moins de 15 € par mois.", compare: true },
  internet: { label: "Box internet", threshold: 25, low: 0.15, high: 0.35, tip: "Les offres de bienvenue et la renégociation auprès du service fidélisation sont les leviers principaux.", compare: true },
  energy: { label: "Énergie", threshold: 40, low: 0.05, high: 0.15, tip: "Comparez le prix du kWh et l'abonnement sur le comparateur public de l'énergie.", compare: true },
  insurance: { label: "Assurances", threshold: 20, low: 0.1, high: 0.25, tip: "Regrouper ou remettre en concurrence chaque année vos contrats d'assurance.", compare: true },
  bank: { label: "Frais bancaires", threshold: 4, low: 0.5, high: 1, tip: "Une banque en ligne peut supprimer la majorité des frais de tenue de compte et de carte.", compare: true },
  subscriptions: { label: "Abonnements", threshold: 15, low: 0.1, high: 0.3, tip: "Les abonnements peu utilisés sont souvent la piste la plus rapide.", compare: false },
};

export function validateSavings(i: SavingsInput): FlowErrors {
  const e: FlowErrors = {};
  let any = false;
  (Object.keys(i) as (keyof SavingsInput)[]).forEach((k) => {
    if (!i[k].trim()) return;
    const n = parseNumber(i[k]);
    if (!(n >= 0) || n > 5000) e[k] = "Montant mensuel invalide.";
    else any = true;
  });
  if (!any && !Object.keys(e).length) e.form = "Indiquez au moins une dépense mensuelle.";
  return e;
}

export function runSavings(i: SavingsInput): FlowOutput {
  const leads = (Object.keys(SAVINGS_RULES) as (keyof SavingsInput)[])
    .map((k) => ({ key: k, rule: SAVINGS_RULES[k], amount: parseNumber(i[k]) }))
    .filter((x) => x.amount > 0)
    .map((x) => {
      const yearly = x.amount * 12;
      const above = x.amount > x.rule.threshold;
      return {
        key: x.key,
        category: x.rule.label,
        current: Math.round(yearly),
        low: above ? Math.round(yearly * x.rule.low) : 0,
        high: above ? Math.round(yearly * x.rule.high) : Math.round(yearly * x.rule.low),
        tip: above ? x.rule.tip : "Montant déjà bas : piste secondaire.",
        compare: x.rule.compare,
      };
    })
    .sort((a, b) => b.high - a.high);

  const totalLow = leads.reduce((s, l) => s + l.low, 0);
  const totalHigh = leads.reduce((s, l) => s + l.high, 0);
  const top = leads.filter((l) => l.high > 0).slice(0, 3);

  const actions: MissionAction[] = top.map((l) =>
    l.key === "subscriptions"
      ? action({ label: "Faire le point sur mes abonnements", description: "Crée une mission « Gérer mes abonnements ».", executor: "start_mission", payload: { kind: "subscriptions" } })
      : action({
          label: `Comparer des offres : ${l.category.toLowerCase()}`,
          description: "Crée une mission « Comparer des offres » avec votre offre actuelle pré-remplie.",
          executor: "start_mission",
          payload: { kind: "compare", prefill: { currentName: `${l.category} actuel`, currentMonthly: String(Math.round((l.current / 12) * 100) / 100) } },
        }),
  );
  actions.push(
    action({
      label: "Analyser automatiquement mes relevés bancaires",
      description: "Détection automatique des dépenses récurrentes.",
      executor: "none",
      state: "unavailable",
      unavailableReason: "La connexion bancaire (via un agrégateur agréé DSP2) est en préparation. Saisie manuelle en attendant.",
    }),
  );

  return {
    title: "Pistes d'économies sur mes factures",
    request: "Trouve-moi un moyen de réduire mes factures.",
    result: { type: "savings", leads: leads.map(({ category, current, low, high, tip }) => ({ category, current, low, high, tip })), totalLow, totalHigh },
    steps: [step("Dépenses mensuelles collectées"), step("Comparaison avec des fourchettes de marché indicatives"), step(`${top.length} piste(s) prioritaire(s) identifiée(s)`), step("Vérifier chaque piste avec une comparaison réelle", "todo")],
    actions,
    estimatedSavings: Math.round((totalLow + totalHigh) / 2),
  };
}

/* ------------------------------------------------------------------ Démarche */

export type AdminType = "resiliation" | "reclamation" | "remboursement" | "adresse";

export interface AdminInput {
  type: AdminType;
  organisme: string;
  reference: string;
  fullName: string;
  address: string;
  details: string;
  recipientEmail: string;
}

export const adminDefaults: AdminInput = { type: "resiliation", organisme: "", reference: "", fullName: "", address: "", details: "", recipientEmail: "" };

export const ADMIN_TYPES: Record<AdminType, { label: string; subject: (o: string) => string }> = {
  resiliation: { label: "Résilier un contrat ou un abonnement", subject: (o) => `Résiliation de mon contrat ${o}` },
  reclamation: { label: "Faire une réclamation", subject: (o) => `Réclamation auprès de ${o}` },
  remboursement: { label: "Demander un remboursement", subject: (o) => `Demande de remboursement auprès de ${o}` },
  adresse: { label: "Signaler un changement d'adresse", subject: (o) => `Changement d'adresse auprès de ${o}` },
};

export function validateAdmin(i: AdminInput): FlowErrors {
  const e: FlowErrors = {};
  if (!i.organisme.trim()) e.organisme = "Indiquez l'organisme ou l'entreprise.";
  if (!i.fullName.trim()) e.fullName = "Votre nom figure sur le courrier.";
  if (!i.address.trim()) e.address = "Votre adresse figure sur le courrier.";
  if ((i.type === "reclamation" || i.type === "remboursement") && i.details.trim().length < 15) e.details = "Décrivez la situation en une ou deux phrases.";
  if (i.recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.recipientEmail)) e.recipientEmail = "Adresse e-mail invalide.";
  return e;
}

export function runAdmin(i: AdminInput): FlowOutput {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const subject = ADMIN_TYPES[i.type].subject(i.organisme);
  const ref = i.reference ? `\nRéférence client / contrat : ${i.reference}` : "";
  const bodies: Record<AdminType, string> = {
    resiliation: `Par la présente, je vous informe de ma volonté de résilier le contrat référencé ci-dessus, dans le respect des conditions générales et du préavis applicables.\n\nJe vous remercie de bien vouloir prendre en compte cette résiliation à la date la plus proche possible, de m'adresser une confirmation écrite ainsi que, le cas échéant, le solde de tout compte.${i.details ? `\n\nPrécisions : ${i.details}` : ""}`,
    reclamation: `Je me permets de vous adresser une réclamation concernant la situation suivante :\n\n${i.details}\n\nJe vous remercie de bien vouloir examiner ma demande et de m'indiquer, dans les meilleurs délais, les mesures que vous comptez prendre pour y remédier.`,
    remboursement: `Je sollicite le remboursement de la somme concernée par la situation suivante :\n\n${i.details}\n\nJe vous remercie de bien vouloir procéder à ce remboursement ou de m'indiquer les justificatifs complémentaires nécessaires.`,
    adresse: `Je vous informe de mon changement d'adresse. Ma nouvelle adresse est la suivante :\n\n${i.address}\n\nJe vous remercie de mettre à jour mon dossier et d'y adresser désormais l'ensemble de vos correspondances.${i.details ? `\n\nPrécisions : ${i.details}` : ""}`,
  };
  const letter = `${i.fullName}\n${i.address}\n\n${i.organisme}\nService clients\n\nLe ${today}\n\nObjet : ${subject}${ref}\n\nMadame, Monsieur,\n\n${bodies[i.type]}\n\nJe vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n${i.fullName}`;

  const checklist: Record<AdminType, string[]> = {
    resiliation: ["Numéro de contrat ou de client", "Vérifier la durée d'engagement restante et le préavis", "Copie d'une pièce d'identité si demandée", "Envoi en recommandé avec accusé de réception conseillé"],
    reclamation: ["Factures ou preuves de paiement", "Échanges précédents (e-mails, numéros de dossier)", "Photos ou captures si utile", "Conserver une copie du courrier"],
    remboursement: ["Justificatif de paiement", "RIB pour le versement", "Preuve du motif (annulation, défaut…)", "Conserver une copie du courrier"],
    adresse: ["Justificatif de domicile récent", "Numéro de client", "Date effective du changement"],
  };

  const filename = `${i.type}-${i.organisme.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "courrier"}.txt`;
  const actions: MissionAction[] = [
    action({ label: "Copier le courrier", description: "Copie le texte dans le presse-papiers.", executor: "copy_text", payload: { text: letter } }),
    action({ label: "Télécharger le courrier", description: `Fichier texte « ${filename} » enregistré sur votre appareil.`, executor: "download_text", payload: { text: letter, filename } }),
  ];
  if (i.recipientEmail) {
    actions.push(
      action({
        label: `Préparer l'e-mail à ${i.recipientEmail}`,
        description: "Ouvre votre messagerie avec le courrier pré-rempli. C'est vous qui l'envoyez.",
        executor: "open_mailto",
        payload: { to: i.recipientEmail, subject, body: letter },
      }),
    );
  }
  actions.push(
    action({
      label: "Envoyer en lettre recommandée",
      description: "Envoi postal automatique.",
      executor: "none",
      state: "unavailable",
      unavailableReason: "L'envoi postal n'est pas intégré. Alternative : la lettre recommandée en ligne de La Poste, avec le fichier téléchargé.",
    }),
  );

  return {
    title: `${ADMIN_TYPES[i.type].label.split(" ")[0]} : ${i.organisme}`,
    request: `${ADMIN_TYPES[i.type].label} auprès de ${i.organisme}.`,
    result: { type: "admin", letter, checklist: checklist[i.type], recipientEmail: i.recipientEmail || undefined, subject },
    steps: [step("Informations collectées"), step("Courrier rédigé"), step("Liste des pièces à fournir préparée"), step("Relire et envoyer le courrier", "todo")],
    actions,
    blocker:
      i.type === "resiliation" && !i.reference
        ? { reason: "Numéro de contrat manquant : certains organismes refusent une résiliation sans référence.", alternative: "Retrouvez-le sur une facture ou votre espace client, puis relancez le parcours pour l'ajouter." }
        : undefined,
  };
}

/* ------------------------------------------------------------------ Voyage */

export interface TravelInput {
  destination: string;
  origin: string;
  departure: string;
  nights: string;
  people: string;
  budget: string;
  style: "eco" | "confort";
  interests: string[];
}

export const travelDefaults: TravelInput = { destination: "", origin: "", departure: "", nights: "2", people: "2", budget: "300", style: "eco", interests: ["Culture", "Gastronomie"] };

export const TRAVEL_INTERESTS = ["Culture", "Gastronomie", "Nature", "Détente", "Vie nocturne", "Sport"];

export function validateTravel(i: TravelInput): FlowErrors {
  const e: FlowErrors = {};
  if (!i.destination.trim()) e.destination = "Indiquez une destination (ville ou région).";
  const b = parseNumber(i.budget);
  if (!(b >= 50)) e.budget = "Budget minimum : 50 €.";
  const n = parseInt(i.nights, 10);
  if (!(n >= 1 && n <= 30)) e.nights = "Entre 1 et 30 nuits.";
  const p = parseInt(i.people, 10);
  if (!(p >= 1 && p <= 12)) e.people = "Entre 1 et 12 personnes.";
  if (i.departure && new Date(i.departure) < new Date(isoDay())) e.departure = "La date est passée.";
  return e;
}

const IDEAS: Record<string, string[]> = {
  Culture: ["Musée ou monument incontournable", "Quartier historique à pied"],
  Gastronomie: ["Marché local le matin", "Restaurant de spécialités régionales"],
  Nature: ["Balade ou randonnée à proximité", "Parc ou point de vue"],
  Détente: ["Matinée libre", "Spa ou baignade"],
  "Vie nocturne": ["Bar avec vue", "Concert ou spectacle"],
  Sport: ["Location de vélos", "Activité de plein air"],
};

export function runTravel(i: TravelInput): FlowOutput {
  const budget = parseNumber(i.budget);
  const nights = parseInt(i.nights, 10);
  const people = parseInt(i.people, 10);
  const split = i.style === "eco" ? [0.35, 0.33, 0.22, 0.1] : [0.3, 0.42, 0.18, 0.1];
  const labels = ["Transport", "Hébergement", "Repas", "Activités"];
  const parts = labels.map((label, k) => ({ label, amount: Math.round(budget * split[k]) }));
  const perNight = parts[1].amount / nights;

  const pool = (i.interests.length ? i.interests : ["Culture", "Détente"]).flatMap((k) => IDEAS[k] ?? []);
  const itinerary = Array.from({ length: nights + 1 }, (_, d) => {
    const items: string[] = [];
    if (d === 0) items.push(`Arrivée à ${i.destination}, installation`);
    items.push(pool[(d * 2) % pool.length], pool[(d * 2 + 1) % pool.length]);
    if (d === nights) items.push("Retour");
    return { day: d === 0 ? "Jour 1" : `Jour ${d + 1}`, items: Array.from(new Set(items)) };
  });

  const q = encodeURIComponent(i.destination);
  const links = [
    { label: "Trains sur SNCF Connect", url: "https://www.sncf-connect.com/" },
    { label: `Vols vers ${i.destination} (Google Flights)`, url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`vols ${i.origin ? `de ${i.origin} ` : ""}vers ${i.destination}`)}` },
    { label: `Hébergements à ${i.destination}`, url: `https://www.booking.com/searchresults.fr.html?ss=${q}&group_adults=${people}` },
  ];

  const warn = perNight / people < 20;
  const actions: MissionAction[] = [
    action({ label: "Rechercher un transport", description: "Ouvre SNCF Connect dans un nouvel onglet. La réservation se fait sur le site.", executor: "open_url", payload: { url: links[0].url } }),
    action({ label: "Rechercher un hébergement", description: `Ouvre une recherche pour ${people} personne(s) à ${i.destination}.`, executor: "open_url", payload: { url: links[2].url } }),
  ];
  if (i.departure) {
    actions.push(
      action({
        label: "Ajouter le départ à mon agenda",
        description: `Ajoute « Départ pour ${i.destination} » le ${new Date(i.departure).toLocaleDateString("fr-FR")} dans l'agenda de l'application.`,
        executor: "add_to_agenda",
        payload: { date: i.departure, items: [{ start: "08:00", end: "09:00", label: `Départ pour ${i.destination}`, kind: "fixed" }] },
      }),
    );
  }
  actions.push(
    action({
      label: "Réserver automatiquement",
      description: "Réservation et paiement en votre nom.",
      executor: "none",
      state: "unavailable",
      unavailableReason: "Aucune réservation ni paiement n'est effectué par l'application. Utilisez les liens ci-dessus pour réserver vous-même.",
    }),
  );

  return {
    title: `Séjour à ${i.destination}`,
    request: `Organise ${nights} nuit(s) à ${i.destination} pour ${people} personne(s), budget ${euro(budget)}.`,
    result: {
      type: "travel",
      budget: parts,
      itinerary,
      checklist: ["Pièce d'identité", "Réservations imprimées ou sur téléphone", "Chargeur et batterie externe", "Carte bancaire acceptée à l'étranger si besoin", warn ? `Budget serré : environ ${euro(perNight / people)} par personne et par nuit pour l'hébergement` : "Assurance annulation (facultative)"],
      links,
    },
    steps: [step("Critères du séjour collectés"), step("Budget réparti par poste"), step("Itinéraire proposé selon vos envies"), step("Réserver transport et hébergement", "todo")],
    actions,
  };
}

/* ------------------------------------------------------------------ Abonnements */

export interface SubRow {
  name: string;
  price: string;
  period: "mois" | "an";
  usage: "souvent" | "parfois" | "rarement";
  /** Date d'échéance ou de renouvellement (AAAA-MM-JJ), facultative. */
  renewal?: string;
}

export interface SubscriptionsInput {
  rows: SubRow[];
}

export const subscriptionsDefaults: SubscriptionsInput = {
  rows: [
    { name: "Streaming vidéo", price: "13,49", period: "mois", usage: "souvent" },
    { name: "Musique", price: "11,99", period: "mois", usage: "souvent" },
    { name: "Salle de sport", price: "29,90", period: "mois", usage: "rarement" },
    { name: "Stockage en ligne", price: "99,99", period: "an", usage: "parfois" },
  ],
};

export function validateSubscriptions(i: SubscriptionsInput): FlowErrors {
  const e: FlowErrors = {};
  const rows = i.rows.filter((r) => r.name.trim() || r.price.trim());
  if (!rows.length) e.rows = "Ajoutez au moins un abonnement.";
  i.rows.forEach((r, idx) => {
    if (!r.name.trim() && !r.price.trim()) return;
    if (!r.name.trim()) e[`row${idx}name`] = "Nom requis.";
    if (!(parseNumber(r.price) >= 0)) e[`row${idx}price`] = "Prix invalide.";
  });
  return e;
}

export function runSubscriptions(i: SubscriptionsInput): FlowOutput {
  const items = i.rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const p = parseNumber(r.price) || 0;
      const monthly = r.period === "an" ? p / 12 : p;
      const verdict: "garder" | "à revoir" | "résilier" = r.usage === "rarement" ? "résilier" : r.usage === "parfois" ? "à revoir" : "garder";
      return { name: r.name.trim(), monthly: Math.round(monthly * 100) / 100, usage: r.usage, verdict, renewal: r.renewal || undefined };
    })
    .sort((a, b) => b.monthly - a.monthly);
  const monthlyTotal = Math.round(items.reduce((s, x) => s + x.monthly, 0) * 100) / 100;
  const potentialYearly = Math.round(items.filter((x) => x.verdict === "résilier").reduce((s, x) => s + x.monthly * 12, 0));

  const actions = items
    .filter((x) => x.verdict === "résilier")
    .map((x) =>
      action({
        label: `Préparer la résiliation : ${x.name}`,
        description: "Crée une mission « Préparer une démarche » pré-remplie.",
        executor: "start_mission",
        payload: { kind: "admin", prefill: { type: "resiliation", organisme: x.name } },
      }),
    );
  // Échéances : un rappel 30 jours avant (ou demain si l'échéance est proche) pour décider à temps.
  const today = isoDay();
  items
    .filter((x) => x.renewal && x.renewal >= today)
    .forEach((x) => {
      const target = isoDay(addDays(new Date(`${x.renewal}T12:00:00`), -30));
      const date = target > today ? target : isoDay(addDays(new Date(), 1));
      const when = new Date(`${x.renewal}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      actions.push(
        action({
          label: `Me rappeler l'échéance : ${x.name}`,
          description: `Rappel le ${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à 9 h pour décider avant le ${when}.`,
          executor: "create_reminder",
          payload: { date, time: "09:00", label: `Échéance ${x.name} le ${when} : garder, renégocier ou résilier`, topic: "contract" },
        }),
      );
    });
  actions.push(
    action({
      label: "Détecter mes abonnements automatiquement",
      description: "Lecture des prélèvements récurrents.",
      executor: "none",
      state: "unavailable",
      unavailableReason: "Nécessite une connexion bancaire, en préparation. Saisie manuelle en attendant.",
    }),
  );

  return {
    title: "Point sur mes abonnements",
    request: `Fais le point sur mes ${items.length} abonnements.`,
    result: { type: "subscriptions", items, monthlyTotal, potentialYearly },
    steps: [step("Abonnements recensés"), step(`Total calculé : ${euro(monthlyTotal, true)} par mois`), step("Usage analysé"), step("Décider quoi résilier", "todo")],
    actions,
    estimatedSavings: potentialYearly || undefined,
  };
}

/* ------------------------------------------------------------------ Rendez-vous */

export type AppointmentType = "medecin" | "banque" | "administration" | "entretien" | "autre";

export interface AppointmentInput {
  type: AppointmentType;
  with: string;
  date: string;
  time: string;
  goal: string;
}

export const appointmentDefaults: AppointmentInput = { type: "medecin", with: "", date: "", time: "", goal: "" };

export const APPOINTMENT_TYPES: Record<AppointmentType, string> = {
  medecin: "Médecin ou santé",
  banque: "Banque ou conseiller",
  administration: "Administration",
  entretien: "Entretien professionnel",
  autre: "Autre",
};

export function validateAppointment(i: AppointmentInput): FlowErrors {
  const e: FlowErrors = {};
  if (!i.with.trim()) e.with = "Avec qui avez-vous rendez-vous ?";
  if (!i.date) e.date = "Date requise.";
  else if (new Date(i.date) < new Date(isoDay())) e.date = "La date est passée.";
  if (!i.time) e.time = "Heure requise.";
  return e;
}

export function runAppointment(i: AppointmentInput): FlowOutput {
  const Q: Record<AppointmentType, string[]> = {
    medecin: ["Depuis quand les symptômes sont-ils apparus ?", "Quels traitements suivez-vous actuellement ?", "Quels examens complémentaires sont nécessaires ?", "Quand faut-il reconsulter ?"],
    banque: ["Quels frais s'appliquent exactement ?", "Existe-t-il une offre plus adaptée à mon usage ?", "Quelles sont les conditions de renégociation ?", "Pouvez-vous me remettre une simulation écrite ?"],
    administration: ["Quelles pièces manquent à mon dossier ?", "Quel est le délai de traitement ?", "Comment suivre l'avancement ?", "Qui contacter en cas de problème ?"],
    entretien: ["Quelles sont les priorités du poste à 6 mois ?", "Comment l'équipe est-elle organisée ?", "Comment la réussite est-elle mesurée ?", "Quelles sont les prochaines étapes ?"],
    autre: ["Quel résultat j'attends de ce rendez-vous ?", "Quelles informations dois-je obtenir ?", "Quelle est la prochaine étape ?"],
  };
  const D: Record<AppointmentType, string[]> = {
    medecin: ["Carte Vitale", "Ordonnances en cours", "Résultats d'examens récents", "Carte de mutuelle"],
    banque: ["Pièce d'identité", "Derniers relevés", "Justificatifs de revenus"],
    administration: ["Pièce d'identité", "Justificatif de domicile", "Courrier de convocation", "Numéro de dossier"],
    entretien: ["CV imprimé", "Exemples de réalisations", "Questions préparées"],
    autre: ["Pièce d'identité", "Documents liés au sujet"],
  };
  const questions = i.goal.trim() ? [`Objectif : ${i.goal.trim()}`, ...Q[i.type]] : Q[i.type];
  const dt = new Date(`${i.date}T${i.time}`);
  const remind = new Date(dt.getTime() - 24 * 3600 * 1000);
  const remindLabel = remind > new Date() ? "la veille" : "le jour même";
  const remindDate = remind > new Date() ? isoDay(remind) : i.date;
  const remindTime = remind > new Date() ? i.time : toHHMM(Math.max(0, toMinutes(i.time) - 60));

  return {
    title: `Rendez-vous : ${i.with}`,
    request: `Prépare mon rendez-vous (${APPOINTMENT_TYPES[i.type].toLowerCase()}) avec ${i.with}.`,
    result: { type: "appointment", questions, documents: D[i.type], reminderAt: `${remindDate}T${remindTime}` },
    steps: [step("Rendez-vous enregistré"), step("Questions préparées"), step("Documents à apporter listés"), step("Programmer le rappel", "todo")],
    actions: [
      action({
        label: `Créer un rappel ${remindLabel} à ${remindTime}`,
        description: "Ajoute un rappel dans l'agenda de l'application.",
        executor: "create_reminder",
        payload: { date: remindDate, time: remindTime, label: `Rendez-vous ${i.with} à ${i.time} : documents prêts ?` },
      }),
      action({
        label: "Ajouter le rendez-vous à mon agenda",
        description: `${new Date(i.date).toLocaleDateString("fr-FR")} à ${i.time}, dans l'agenda de l'application.`,
        executor: "add_to_agenda",
        payload: { date: i.date, items: [{ start: i.time, end: toHHMM(toMinutes(i.time) + 60), label: `Rendez-vous : ${i.with}`, kind: "fixed" }] },
      }),
      action({
        label: "Prendre le rendez-vous en ligne",
        description: "Réservation d'un créneau sur une plateforme externe.",
        executor: "none",
        state: "unavailable",
        unavailableReason: "Aucune plateforme de prise de rendez-vous n'est connectée. Réservez le créneau directement auprès du professionnel.",
      }),
    ],
  };
}

/* ------------------------------------------------------------------ Registre */

export const FLOW_KINDS: MissionKind[] = ["day", "savings", "compare", "admin", "travel", "subscriptions", "appointment"];
