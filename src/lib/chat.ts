import { create } from "zustand";
import { useStore } from "./store";
import { ask, AiError, type AiMode } from "./ai/client";
import { nowIso, uid } from "./format";
import type { ChatMessage } from "./types";

/** Conversations en attente de réponse (pour afficher l'indicateur de progression). */
export const usePending = create<{ ids: string[]; set: (id: string, on: boolean) => void }>((set) => ({
  ids: [],
  set: (id, on) => set((s) => ({ ids: on ? [...new Set([...s.ids, id])] : s.ids.filter((x) => x !== id) })),
}));

/**
 * Envoie un message : crée la conversation si besoin, ajoute le message utilisateur,
 * obtient la réponse (IA réelle ou démonstration) et l'ajoute. Renvoie l'id de conversation
 * immédiatement et la réponse via la promesse `done`.
 */
export function sendMessage(mode: AiMode, text: string, conversationId?: string): { conversationId: string; done: Promise<ChatMessage> } {
  const store = useStore.getState();
  const userMsg: ChatMessage = { id: uid("m"), role: "user", text, at: nowIso() };
  let cid = conversationId;
  const prior = cid ? (store.conversations.find((c) => c.id === cid)?.messages ?? []) : [];
  if (!cid) cid = store.createConversation(userMsg);
  else store.addMessage(cid, userMsg);

  return { conversationId: cid, done: respond(mode, cid, text, prior) };
}

/** Obtient la réponse (IA réelle ou démonstration) et l'ajoute à la conversation. */
function respond(mode: AiMode, cid: string, text: string, prior: ChatMessage[]): Promise<ChatMessage> {
  usePending.getState().set(cid, true);
  const s = useStore.getState();
  const memory = s.settings.memoryEnabled ? s.memory.filter((m) => m.confirmed).map((m) => m.text) : [];

  return ask(mode, text, { history: prior.filter((m) => m.mode !== "error"), memory, profile: { name: s.profile.name || undefined, priorities: s.profile.priorities } })
    .then(({ reply, mode: m }) => {
      const msg: ChatMessage = { id: uid("m"), role: "assistant", text: reply.text, blocks: reply.blocks, at: nowIso(), mode: m };
      useStore.getState().addMessage(cid, msg);
      return msg;
    })
    .catch((e: unknown) => {
      const msg: ChatMessage = {
        id: uid("m"),
        role: "assistant",
        mode: "error",
        errorCode: e instanceof AiError ? e.code : undefined,
        at: nowIso(),
        text: e instanceof AiError ? e.message : "Je n'ai pas pu obtenir de réponse. Votre message est conservé : vous pouvez réessayer.",
      };
      useStore.getState().addMessage(cid, msg);
      return msg;
    })
    .finally(() => usePending.getState().set(cid, false));
}

/** Réessaie la dernière demande restée sans réponse (sans dupliquer le message de l'utilisateur). */
export function retryLast(mode: AiMode, conversationId: string): Promise<ChatMessage> | null {
  const conv = useStore.getState().conversations.find((c) => c.id === conversationId);
  if (!conv) return null;
  const msgs = conv.messages;
  const last = msgs[msgs.length - 1];
  if (!last || last.mode !== "error") return null;
  const userIdx = msgs.length - 2;
  const user = msgs[userIdx];
  if (!user || user.role !== "user") return null;
  useStore.getState().removeMessage(conversationId, last.id);
  return respond(mode, conversationId, user.text, msgs.slice(0, userIdx));
}
