import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { devApi } from "./server/devApi.js";

/** Génère le service worker avec la liste exacte des fichiers à mettre en cache pour le hors-ligne. */
function serviceWorker(): Plugin {
  return {
    name: "project-one-sw",
    apply: "build",
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith(".map") && f !== "index.html");
      const statics = ["manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png"];
      const precache = ["/", "/index.html", ...statics.map((f) => `/${f}`), ...files.map((f) => `/${f}`)];
      const source = readFileSync("pwa/sw.template.js", "utf8")
        .replace("__VERSION__", Date.now().toString(36))
        .replace("__PRECACHE__", JSON.stringify(precache));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Le préfixe "" charge toutes les variables pour le serveur de dev uniquement (côté Node).
  // Seules les variables préfixées VITE_ atteignent le navigateur : l'adresse Supabase et sa clé
  // publique « anon » (conçue pour être publique, protégée par les règles d'accès de la base).
  const env = loadEnv(mode, process.cwd(), "");
  const singleFile = mode === "singlefile";
  return {
    plugins: [
      react(),
      devApi({
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        AI_MODEL: env.AI_MODEL,
        AI_TIMEOUT_MS: env.AI_TIMEOUT_MS,
        AI_DAILY_LIMIT: env.AI_DAILY_LIMIT,
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
      }),
      ...(singleFile ? [viteSingleFile()] : [serviceWorker()]),
    ],
    build: { outDir: singleFile ? "dist-demo" : "dist" },
    server: { host: true },
  };
});
