/**
 * Fonction serverless Vercel : POST /api/chat
 * Toute la logique (sécurité, quota, appel à l'IA) est dans server/http.ts, partagée avec Netlify.
 * La clé de l'IA ne quitte jamais le serveur.
 */
import { handleApi } from "../server/http.js";

export function POST(request: Request): Promise<Response> {
  return handleApi(request, process.env);
}
