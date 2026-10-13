/**
 * Exécution des actions validées par l'utilisateur.
 * - Les actions internes (agenda, rappel, copie, téléchargement) sont exécutées puis VÉRIFIÉES.
 * - Les actions qui ouvrent un service externe sont marquées « transmises » : l'utilisateur finalise lui-même.
 * - Aucune action n'est exécutée sans clic explicite de l'utilisateur.
 */
import { useStore } from "./store";
import { copyText, downloadText } from "./format";
import { navigate } from "./router";
import { toast } from "../components/ui";
import type { AgendaItem, MissionAction, MissionKind } from "./types";

export function useActionRunner() {
  const setActionState = useStore((s) => s.setActionState);
  const addAgendaItems = useStore((s) => s.addAgendaItems);

  return async function run(missionId: string, a: MissionAction) {
    const p = (a.payload ?? {}) as Record<string, unknown>;
    try {
      switch (a.executor) {
        case "add_to_agenda": {
          const date = String(p.date);
          const items = (p.items as { start: string; end?: string; label: string; kind: AgendaItem["kind"] }[]) ?? [];
          const ids = addAgendaItems(items.map((it) => ({ date, start: it.start, end: it.end, label: it.label, kind: it.kind, missionId })));
          // Vérification : les éléments sont bien présents dans l'agenda.
          const ok = ids.every((id) => useStore.getState().agenda.some((x) => x.id === id));
          if (!ok) throw new Error("Vérification échouée : l'agenda n'a pas été mis à jour.");
          setActionState(missionId, a.id, "executed", `${ids.length} élément(s) ajouté(s) à l'agenda.`);
          toast.success(`${ids.length} élément(s) ajouté(s) à votre agenda.`);
          break;
        }
        case "create_reminder": {
          const ids = addAgendaItems([{ date: String(p.date), start: String(p.time), label: String(p.label), kind: "reminder", missionId, topic: p.topic === "contract" ? "contract" : undefined }]);
          const ok = useStore.getState().agenda.some((x) => x.id === ids[0]);
          if (!ok) throw new Error("Vérification échouée : le rappel n'a pas été créé.");
          setActionState(missionId, a.id, "executed", "Rappel visible dans l'agenda.");
          toast.success("Rappel créé dans votre agenda.");
          break;
        }
        case "copy_text": {
          const ok = await copyText(String(p.text ?? ""));
          if (!ok) throw new Error("Le navigateur a refusé l'accès au presse-papiers.");
          setActionState(missionId, a.id, "executed", "Texte copié dans le presse-papiers.");
          toast.success("Courrier copié dans le presse-papiers.");
          break;
        }
        case "download_text": {
          downloadText(String(p.filename ?? "document.txt"), String(p.text ?? ""));
          setActionState(missionId, a.id, "executed", "Fichier généré et téléchargé.");
          toast.success("Fichier téléchargé.");
          break;
        }
        case "open_mailto": {
          const href = `mailto:${encodeURIComponent(String(p.to))}?subject=${encodeURIComponent(String(p.subject ?? ""))}&body=${encodeURIComponent(String(p.body ?? ""))}`;
          window.location.href = href;
          setActionState(missionId, a.id, "handed_off", "Votre messagerie a été ouverte : l'envoi reste à faire de votre côté.");
          toast.info("Messagerie ouverte. Vérifiez puis envoyez l'e-mail vous-même.");
          break;
        }
        case "open_url": {
          window.open(String(p.url), "_blank", "noopener,noreferrer");
          setActionState(missionId, a.id, "handed_off", "Service externe ouvert : à finaliser de votre côté.");
          toast.info("Service ouvert dans un nouvel onglet.");
          break;
        }
        case "start_mission": {
          const kind = String(p.kind) as MissionKind;
          const prefill = p.prefill ? `?prefill=${encodeURIComponent(JSON.stringify(p.prefill))}` : "";
          setActionState(missionId, a.id, "executed", "Nouveau parcours ouvert.");
          navigate(`/app/nouvelle/${kind}${prefill}`);
          break;
        }
        default:
          toast.error("Cette action n'est pas disponible dans cette version.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'action a échoué.");
    }
  };
}
