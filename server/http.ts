/**
 * Point d'entrée HTTP commun à tous les hébergeurs (Vercel, Netlify, serveur de dev).
 * Routes : GET /api/health et POST /api/chat.
 *
 * Sécurité de /api/chat :
 * - la clé de l'IA reste côté serveur (variables d'environnement) ;
 * - si Supabase est configuré, une connexion est obligatoire (jeton vérifié auprès de Supabase)
 *   et le nombre de messages par utilisateur et par jour est plafonné en base ;
 * - sans Supabase, une limite par adresse IP s'applique (approximative : elle est remise à zéro
 *   quand l'hébergeur redémarre la fonction). À réserver aux tests privés.
 */
import { aiStatus, dailyLimit, handleChat, HttpError, type ServerEnv } from "./assistant.js";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/** Refuse les appels venant d'un autre site (un navigateur envoie toujours l'en-tête Origin sur un POST). */
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- Supabase */

interface SupabaseUser {
  id: string;
  email?: string;
}

async function verifyUser(env: ServerEnv, token: string): Promise<SupabaseUser> {
  let r: Response;
  try {
    r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, "Le service de comptes est injoignable. Réessayez dans un instant.", "auth_unreachable");
  }
  if (r.status === 401 || r.status === 403) throw new HttpError(401, "Votre session a expiré. Reconnectez-vous.", "auth_required");
  if (!r.ok) throw new HttpError(503, "Le service de comptes ne répond pas correctement.", "auth_unreachable");
  const user = (await r.json()) as SupabaseUser;
  if (!user?.id) throw new HttpError(401, "Session invalide. Reconnectez-vous.", "auth_required");
  return user;
}

async function consumeQuota(env: ServerEnv, token: string) {
  const limit = dailyLimit(env);
  let r: Response;
  try {
    r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/consume_ai_quota`, {
      method: "POST",
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ daily_limit: limit }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, "Le service de comptes est injoignable. Réessayez dans un instant.", "auth_unreachable");
  }
  if (r.status === 404) throw new HttpError(500, "La base de données n'est pas initialisée : exécutez le fichier supabase/schema.sql dans Supabase.", "db_setup");
  if (!r.ok) throw new HttpError(503, "Impossible de vérifier votre quota d'utilisation.", "quota_error");
  const q = (await r.json()) as { allowed: boolean; used: number; limit: number };
  if (!q.allowed) throw new HttpError(429, `Limite quotidienne atteinte (${q.limit} messages). Elle se renouvelle demain.`, "quota");
  return q;
}

/* ------------------------------------------------- Limite par IP (sans Supabase) */

const ipCounters = new Map<string, { day: string; count: number }>();

function consumeIpQuota(env: ServerEnv, request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-nf-client-connection-ip") || "local").split(",")[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const limit = dailyLimit(env);
  const c = ipCounters.get(ip);
  const next = c && c.day === day ? { day, count: c.count + 1 } : { day, count: 1 };
  if (next.count > limit) throw new HttpError(429, `Limite quotidienne atteinte (${limit} messages). Elle se renouvelle demain.`, "quota");
  ipCounters.set(ip, next);
  if (ipCounters.size > 5000) ipCounters.clear();
}

/* ---------------------------------------------------------------- Routes */

export async function handleApi(request: Request, env: ServerEnv): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  try {
    if (path.endsWith("/api/health")) {
      if (request.method !== "GET") throw new HttpError(405, "Méthode non autorisée.");
      return json(aiStatus(env));
    }
    if (path.endsWith("/api/chat")) {
      if (request.method !== "POST") throw new HttpError(405, "Méthode non autorisée.");
      if (!sameOrigin(request)) throw new HttpError(403, "Origine non autorisée.", "origin");
      if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, "Aucune clé API configurée : l'application reste en mode démonstration.", "no_key");
      const body = await request.json().catch(() => null);
      if (aiStatus(env).auth) {
        const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token) throw new HttpError(401, "Connectez-vous pour utiliser l'assistant IA.", "auth_required");
        await verifyUser(env, token);
        await consumeQuota(env, token);
      } else {
        consumeIpQuota(env, request);
      }
      return json(await handleChat(body, env));
    }
    throw new HttpError(404, "Adresse inconnue.");
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
    console.error("[api]", err);
    return json({ error: "Erreur inattendue côté serveur." }, 500);
  }
}
