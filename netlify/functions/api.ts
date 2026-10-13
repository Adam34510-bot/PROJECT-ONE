/**
 * Fonction Netlify : sert /api/health et /api/chat avec exactement la même logique que Vercel.
 * La clé de l'IA reste dans les variables d'environnement de Netlify.
 */
import { handleApi } from "../../server/http.js";

export default (request: Request) => handleApi(request, process.env);

export const config = { path: ["/api/health", "/api/chat"] };
