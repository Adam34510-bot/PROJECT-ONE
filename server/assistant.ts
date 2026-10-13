/**
 * Logique serveur de l'assistant IA.
 * Ce fichier ne s'exécute QUE côté serveur (fonction Vercel ou serveur de dev Vite).
 * La clé API est lue dans les variables d'environnement et n'est jamais envoyée au navigateur.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

export const DEFAULT_MODEL = "claude-opus-5-5";

const MISSION_KINDS = [
  "day",
  "savings",
  "compare",
  "admin",
  "travel",
  "subscriptions",
  "appointment",
  "none",
] as const;

/** Format de réponse imposé au modèle (sortie structurée validée). */
export const AssistantReplySchema = z.object({
  reply: z.string().describe("Réponse principale, en français, concise et chaleureuse. Markdown léger autorisé (gras, listes)."),
  known: z.array(z.string()).describe("Ce que l'assistant sait avec certitude d'après la demande ou la mémoire."),
  assumptions: z.array(z.string()).describe("Ce que l'assistant suppose sans en être sûr."),
  questions: z
    .array(z.object({ question: z.string(), options: z.array(z.string()) }))
    .describe("Questions à poser si une information manque. 0 à 2 questions, options courtes."),
  steps: z.array(z.string()).describe("Étapes proposées pour accomplir la demande (vide si inutile)."),
  suggestedMission: z.enum(MISSION_KINDS).describe("Parcours de mission à proposer, ou 'none'."),
  memoryCandidates: z
    .array(z.object({ category: z.string(), text: z.string() }))
    .describe("Préférences durables détectées, à faire confirmer par l'utilisateur. Vide si rien de clair."),
  cannotDo: z.array(z.string()).describe("Ce que l'assistant ne peut PAS faire lui-même dans cette version (ex. payer, envoyer un courrier, réserver)."),
});

export type AssistantReply = z.infer<typeof AssistantReplySchema>;

const SYSTEM_PROMPT = `Tu es NEXORA, un assistant personnel. Tu aides l'utilisateur à gagner du temps et de l'argent : organisation, économies, comparaisons, démarches administratives, voyages, abonnements, rendez-vous.

Règles fondamentales :
- Tu prépares le travail ; tu n'exécutes JAMAIS d'action externe toi-même. Toute action (envoyer, payer, réserver, résilier) doit être validée par l'utilisateur puis réalisée par lui ou par une intégration officielle. Dans cette version, aucune intégration externe n'est connectée : liste dans "cannotDo" ce que tu ne peux pas faire.
- Ne présente jamais une estimation comme un résultat obtenu. Une économie n'est "confirmée" que si l'utilisateur l'a constatée.
- Distingue ce que tu sais ("known") de ce que tu supposes ("assumptions").
- S'il manque une information indispensable, pose au plus deux questions courtes avec des options.
- Si la demande correspond à un parcours guidé, indique-le dans "suggestedMission" : day (organiser la journée), savings (trouver des économies), compare (comparer des offres), admin (préparer une démarche), travel (voyage), subscriptions (abonnements), appointment (rendez-vous).
- Ne propose une préférence à mémoriser ("memoryCandidates") que si l'utilisateur l'exprime clairement ; elle sera soumise à sa confirmation.
- Réponds en français, avec un ton direct, chaleureux et précis. Pas d'emojis.`;

const IncomingSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .min(1)
    .max(30),
  memory: z.array(z.string().max(300)).max(40).optional(),
  profile: z.object({ name: z.string().max(60).optional(), priorities: z.array(z.string().max(60)).max(10).optional() }).optional(),
});

export interface ServerEnv {
  ANTHROPIC_API_KEY?: string;
  AI_MODEL?: string;
  /** Délai maximal d'attente de l'IA, en millisecondes (défaut : 55 000). */
  AI_TIMEOUT_MS?: string;
  /** Nombre de messages IA autorisés par utilisateur et par jour (défaut : 50). */
  AI_DAILY_LIMIT?: string;
  /** Supabase (comptes, sauvegarde en ligne, limite d'usage). Clé publique « anon » uniquement. */
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export function aiStatus(env: ServerEnv) {
  return {
    ai: Boolean(env.ANTHROPIC_API_KEY),
    model: env.ANTHROPIC_API_KEY ? env.AI_MODEL || DEFAULT_MODEL : null,
    auth: Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY),
    dailyLimit: dailyLimit(env),
  };
}

export const dailyLimit = (env: ServerEnv) => Math.max(1, parseInt(env.AI_DAILY_LIMIT || "50", 10) || 50);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function handleChat(body: unknown, env: ServerEnv): Promise<AssistantReply & { model: string }> {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, "Aucune clé API configurée : l'application reste en mode démonstration.", "no_key");
  const parsed = IncomingSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Requête invalide (message trop long ou format incorrect).", "bad_request");
  const { messages, memory, profile } = parsed.data;

  // Le premier message doit venir de l'utilisateur.
  const firstUser = messages.findIndex((m) => m.role === "user");
  const history = messages.slice(firstUser);

  const context = [
    profile?.name ? `Prénom de l'utilisateur : ${profile.name}.` : "",
    profile?.priorities?.length ? `Priorités choisies : ${profile.priorities.join(", ")}.` : "",
    memory?.length ? `Mémoire autorisée par l'utilisateur :\n- ${memory.join("\n- ")}` : "Aucune mémoire enregistrée.",
  ]
    .filter(Boolean)
    .join("\n");

  const model = env.AI_MODEL || DEFAULT_MODEL;
  const timeout = Math.max(5000, parseInt(env.AI_TIMEOUT_MS || "55000", 10) || 55000);
  // Un seul nouvel essai et un délai borné : la fonction répond avant la limite de l'hébergeur.
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout, maxRetries: 1 });

  try {
    // Repli automatique côté serveur si le modèle principal décline une demande.
    const response = await client.beta.messages.parse({
      model,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 16000,
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: context },
      ],
      messages: history.map((m) => ({ role: m.role, content: m.text })),
      output_config: { effort: "low", format: betaZodOutputFormat(AssistantReplySchema) },
    });
    if (response.stop_reason === "refusal") {
      throw new HttpError(422, "L'assistant ne peut pas répondre à cette demande.");
    }
    if (!response.parsed_output) throw new HttpError(502, "Réponse de l'IA illisible. Réessayez.");
    return { ...response.parsed_output, model };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // Journal serveur (visible dans les logs de l'hébergeur), sans jamais la clé.
    console.error("[api/chat]", err instanceof Error ? `${err.name}: ${err.message}` : err);
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(500, "Clé API refusée par le fournisseur. Vérifiez ANTHROPIC_API_KEY.", "ai_auth");
    if (err instanceof Anthropic.PermissionDeniedError) throw new HttpError(500, "La clé API n'a pas accès à ce modèle. Vérifiez AI_MODEL et votre compte Anthropic.", "ai_auth");
    if (err instanceof Anthropic.NotFoundError) throw new HttpError(500, "Modèle d'IA introuvable. Vérifiez AI_MODEL.", "ai_model");
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, "Trop de demandes en même temps chez le fournisseur d'IA. Réessayez dans un instant.", "ai_rate");
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new HttpError(504, "L'IA met trop de temps à répondre. Réessayez, ou reformulez plus brièvement.", "ai_timeout");
    if (err instanceof Anthropic.APIConnectionError) throw new HttpError(502, "Le fournisseur d'IA est injoignable pour le moment.", "ai_unreachable");
    if (err instanceof Anthropic.APIError && err.status === 400 && /credit|billing/i.test(err.message)) throw new HttpError(402, "Crédit IA épuisé sur le compte Anthropic. Ajoutez du crédit dans la console Anthropic.", "ai_credit");
    if (err instanceof Anthropic.APIError) throw new HttpError(502, "Le fournisseur d'IA a renvoyé une erreur. Réessayez dans un instant.", "ai_error");
    throw new HttpError(500, "Erreur inattendue côté serveur.");
  }
}
