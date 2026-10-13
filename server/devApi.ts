/**
 * Branche /api/health et /api/chat sur le serveur de développement Vite,
 * avec exactement la même logique que les fonctions Vercel et Netlify (server/http.ts).
 */
import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";
import { handleApi } from "./http.js";
import type { ServerEnv } from "./assistant.js";

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const method = req.method || "GET";
  return new Request(`http://${req.headers.host || "localhost"}${req.url}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
  });
}

export function devApi(env: ServerEnv): Plugin {
  return {
    name: "project-one-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/")) return next();
        const response = await handleApi(await toRequest(req), env);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}
