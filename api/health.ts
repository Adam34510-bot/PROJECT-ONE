/** Fonction Vercel : GET /api/health indique si l'IA et les comptes sont configurés (sans jamais exposer de clé). */
import { handleApi } from "../server/http.js";

export function GET(request: Request): Promise<Response> {
  return handleApi(request, process.env);
}
