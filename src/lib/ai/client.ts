/**
 * Point d'entrée unique de l'IA côté navigateur.
 * - Si le serveur indique qu'une clé API est configurée (/api/health), les messages passent par /api/chat.
 * - Sinon, le mode démonstration (scénarios prédéfinis, sans IA) prend le relais.
 * Le navigateur ne voit jamais la clé API.
 */
import { useEffect, useState } from "react";
import { uid } from "../format";
import type { ChatBlock, ChatMessage, MemoryCategory, MissionKind } from "../types";
import { demoReply, type EngineReply } from "./demoEngine";
import { getAccessToken } from "../cloud/account";

/**
 * - live : une clé est configurée sur le serveur ; `auth` indique qu'une connexion est exigée.
 * - demo : aucune clé configurée (scénarios prédéfinis, signalés comme tels).
 * - offline : le serveur n'a pas pu être joint (pas de connexion) : rien n'est simulé.
 */
export type AiMode =
  | { status: "checking" }
  | { status: "demo" }
  | { status: "offline" }
  | { status: "live"; model: string; auth: boolean; dailyLimit?: number };

let cached: AiMode | null = null;
const listeners = new Set<(m: AiMode) => void>();

async function detect(): Promise<AiMode> {
  if (location.protocol === "file:") return { status: "demo" };
  if (!navigator.onLine) return { status: "offline" };
  try {
    const r = await fetch("/api/health", { signal: AbortSignal.timeout(6000), cache: "no-store" });
    const ct = r.headers.get("content-type") || "";
    // Pas de fonction serveur (hébergement statique, aperçu) : mode démonstration.
    if (!r.ok || !ct.includes("json")) return { status: "demo" };
    const j = (await r.json()) as { ai?: boolean; model?: string; auth?: boolean; dailyLimit?: number };
    return j.ai && j.model ? { status: "live", model: j.model, auth: Boolean(j.auth), dailyLimit: j.dailyLimit } : { status: "demo" };
  } catch {
    return navigator.onLine ? { status: "demo" } : { status: "offline" };
  }
}

function publish(m: AiMode) {
  cached = m;
  listeners.forEach((l) => l(m));
}

/** Relance la détection (retour de connexion, bouton « Réessayer »). */
export function recheckAiMode() {
  return detect().then((m) => {
    publish(m);
    return m;
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void recheckAiMode());
  window.addEventListener("offline", () => publish({ status: "offline" }));
}

export function useAiMode(): AiMode {
  const [mode, setMode] = useState<AiMode>(cached ?? { status: "checking" });
  useEffect(() => {
    listeners.add(setMode);
    if (!cached) {
      cached = { status: "checking" };
      void recheckAiMode();
    } else setMode(cached);
    return () => {
      listeners.delete(setMode);
    };
  }, []);
  return mode;
}

/** Erreur lisible renvoyée par /api/chat (code : auth_required, quota, ai_timeout…). */
export class AiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

interface LiveReply {
  reply: string;
  known: string[];
  assumptions: string[];
  questions: { question: string; options: string[] }[];
  steps: string[];
  suggestedMission: MissionKind | "none";
  missionPrefill?: { field: string; value: string }[];
  memoryCandidates: { category: string; text: string }[];
  cannotDo: string[];
}

const CATEGORIES: MemoryCategory[] = ["communication", "objectifs", "criteres", "habitudes", "voyage", "organisation", "autre"];

function liveToBlocks(r: LiveReply): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  if (r.known.length || r.assumptions.length) blocks.push({ type: "knowledge", known: r.known, assumptions: r.assumptions });
  if (r.steps.length) blocks.push({ type: "steps", items: r.steps });
  if (r.suggestedMission !== "none") {
    const prefill = Object.fromEntries((r.missionPrefill ?? []).filter((f) => f.field && f.value?.trim()).map((f) => [f.field, f.value.trim()]));
    blocks.push({
      type: "mission",
      kind: r.suggestedMission,
      reason: Object.keys(prefill).length ? "Le formulaire est pré-rempli avec ce que vous avez déjà dit." : "Parcours guidé suggéré par l'assistant.",
      ...(Object.keys(prefill).length ? { prefill } : {}),
    });
  }
  if (r.questions.length) blocks.push({ type: "questions", items: r.questions.slice(0, 2) });
  if (r.memoryCandidates.length)
    blocks.push({
      type: "memory",
      items: r.memoryCandidates.map((m) => ({
        id: uid("mc"),
        category: (CATEGORIES as string[]).includes(m.category) ? (m.category as MemoryCategory) : "autre",
        text: m.text,
        state: "pending" as const,
      })),
    });
  if (r.cannotDo.length) blocks.push({ type: "limits", items: r.cannotDo });
  return blocks;
}

export interface AskContext {
  history: ChatMessage[];
  memory: string[];
  profile: { name?: string; priorities?: string[] };
}

export async function ask(mode: AiMode, text: string, ctx: AskContext): Promise<{ reply: EngineReply; mode: "demo" | "live" }> {
  if (mode.status === "checking") mode = await recheckAiMode();
  if (mode.status === "offline") {
    // Nouvel essai : la connexion est peut-être revenue.
    mode = await recheckAiMode();
    if (mode.status === "offline") throw new AiError("Pas de connexion internet. Votre message est conservé : réessayez une fois en ligne.", "offline");
  }
  if (mode.status !== "live") {
    // Petit délai pour rendre visibles les états de traitement, sans prétendre à une IA.
    await new Promise((r) => setTimeout(r, 650));
    return { reply: demoReply(text), mode: "demo" };
  }
  const messages = [...ctx.history, { role: "user" as const, text }]
    .filter((m) => m.text.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mode.auth) {
    const token = await getAccessToken().catch(() => null);
    if (!token) throw new AiError("Connectez-vous pour utiliser l'assistant IA.", "auth_required");
    headers.Authorization = `Bearer ${token}`;
  }
  let r: Response;
  try {
    r = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, memory: ctx.memory.slice(0, 40), profile: ctx.profile }),
      signal: AbortSignal.timeout(70_000),
    });
  } catch (e) {
    if (!navigator.onLine) throw new AiError("Pas de connexion internet. Votre message est conservé : réessayez une fois en ligne.", "offline");
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AiError("L'IA n'a pas répondu à temps. Réessayez dans un instant.", "timeout");
    throw new AiError("Le serveur est injoignable. Réessayez dans un instant.", "unreachable");
  }
  const j = await r.json().catch(() => ({ error: r.status >= 500 ? "Le serveur a rencontré un problème." : "Réponse illisible du serveur." }));
  if (!r.ok) throw new AiError(j.error || `Erreur ${r.status}`, j.code);
  const live = j as LiveReply;
  return { reply: { text: live.reply, blocks: liveToBlocks(live) }, mode: "live" };
}
