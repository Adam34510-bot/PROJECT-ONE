import { useState } from "react";
import { Brain, Check, Pencil, Plus, Trash2, X, ShieldCheck } from "lucide-react";
import { DemoBadge, EmptyState, Field, Modal, Notice, PageHeader, Switch, toast } from "../components/ui";
import { dateShort } from "../lib/format";
import { useStore } from "../lib/store";
import type { MemoryCategory, Profile } from "../lib/types";

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  communication: "Communication",
  objectifs: "Objectifs",
  criteres: "Critères de comparaison",
  habitudes: "Habitudes",
  voyage: "Voyage",
  organisation: "Organisation",
  autre: "Autre",
};

export const PRIORITIES = ["Gagner du temps", "Économiser de l'argent", "Mieux m'organiser", "Simplifier l'administratif", "Voyager malin", "Réduire ma charge mentale"];

export default function Memory() {
  const memory = useStore((s) => s.memory);
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const updateProfile = useStore((s) => s.updateProfile);
  const updateSettings = useStore((s) => s.updateSettings);
  const addMemory = useStore((s) => s.addMemory);
  const updateMemory = useStore((s) => s.updateMemory);
  const deleteMemory = useStore((s) => s.deleteMemory);
  const clearMemory = useStore((s) => s.clearMemory);

  const [cat, setCat] = useState<MemoryCategory>("habitudes");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  const add = () => {
    const t = text.trim();
    if (t.length < 3) return setErr("Écrivez au moins quelques mots.");
    if (t.length > 300) return setErr("300 caractères maximum.");
    addMemory({ category: cat, text: t, source: "manuel", confirmed: true });
    setText("");
    setErr("");
    toast.success("Ajouté à la mémoire.");
  };

  const groups = (Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((c) => ({ c, items: memory.filter((m) => m.category === c) })).filter((g) => g.items.length);

  return (
    <div>
      <PageHeader
        eyebrow="Mémoire et préférences"
        title={
          <>
            Ce que je sais <span className="serif grad-text">de vous</span>
          </>
        }
        subtitle="Vous voyez tout ce que l'assistant retient, vous le modifiez ou le supprimez quand vous voulez. Rien n'est mémorisé sans votre accord."
        actions={
          memory.length > 0 && (
            <button className="btn btn-danger" onClick={() => setClearOpen(true)}>
              <Trash2 /> Tout effacer
            </button>
          )
        }
      />

      <div className="memory-layout">
        <div className="stack gap-16">
          <section className="card card-pad">
            <div className="setting-row" style={{ borderTop: 0, paddingTop: 0 }}>
              <div>
                <div className="label">Mémoire activée</div>
                <div className="desc">Si désactivée, l'assistant n'utilise ni n'ajoute aucune information mémorisée.</div>
              </div>
              <Switch checked={settings.memoryEnabled} onChange={(v) => updateSettings({ memoryEnabled: v })} label="Mémoire activée" />
            </div>
          </section>

          <section className="card card-pad">
            <div className="card-head">
              <span className="card-title">
                <Plus /> Ajouter une information
              </span>
            </div>
            <div className="memory-add">
              <select className="select" value={cat} onChange={(e) => setCat(e.target.value as MemoryCategory)} aria-label="Catégorie">
                {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Ex. Je préfère les rendez-vous le matin"
                value={text}
                onChange={(e) => (setText(e.target.value), setErr(""))}
                onKeyDown={(e) => e.key === "Enter" && add()}
                aria-invalid={Boolean(err)}
                aria-label="Information à mémoriser"
              />
              <button className="btn btn-primary" onClick={add}>
                Ajouter
              </button>
            </div>
            {err && <p className="field-error" style={{ marginTop: 8 }}>{err}</p>}
          </section>

          {groups.length === 0 ? (
            <div className="card">
              <EmptyState title="Mémoire vide" text="Ajoutez une préférence, ou dites à l'assistant « je préfère… » : il vous proposera de la retenir." />
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.c} className="card card-pad">
                <div className="card-head">
                  <span className="card-title">
                    <Brain /> {CATEGORY_LABELS[g.c]}
                  </span>
                  <span className="faint mono" style={{ fontSize: 12 }}>
                    {g.items.length}
                  </span>
                </div>
                <ul className="memory-list">
                  {g.items.map((m) => (
                    <li key={m.id}>
                      {editing === m.id ? (
                        <>
                          <input className="input grow" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus aria-label="Modifier" />
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            aria-label="Enregistrer"
                            onClick={() => {
                              if (editText.trim().length < 3) return;
                              updateMemory(m.id, { text: editText.trim() });
                              setEditing(null);
                            }}
                          >
                            <Check />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Annuler" onClick={() => setEditing(null)}>
                            <X />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="grow stack gap-4">
                            <span>{m.text}</span>
                            <small className="faint row gap-8 wrap">
                              {m.source === "onboarding" ? "Indiqué à l'inscription" : m.source === "conversation" ? "Validé depuis une conversation" : "Ajouté par vous"} · {dateShort(m.createdAt)}
                              {!m.confirmed && <span className="badge" data-tone="warning">À confirmer</span>}
                              {m.demo && <DemoBadge />}
                            </small>
                          </div>
                          {!m.confirmed && (
                            <button className="btn btn-secondary btn-sm" onClick={() => updateMemory(m.id, { confirmed: true })}>
                              Confirmer
                            </button>
                          )}
                          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Modifier" onClick={() => (setEditing(m.id), setEditText(m.text))}>
                            <Pencil />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            aria-label="Supprimer"
                            onClick={() => {
                              deleteMemory(m.id);
                              toast.success("Information supprimée.");
                            }}
                          >
                            <Trash2 />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="stack gap-16">
          <section className="card card-pad">
            <div className="card-head">
              <span className="card-title">Préférences de communication</span>
            </div>
            <div className="stack gap-16">
              <Field label="Votre prénom">
                <input className="input" value={profile.name} onChange={(e) => updateProfile({ name: e.target.value.slice(0, 40) })} autoComplete="given-name" />
              </Field>
              <Field label="Style de réponse">
                <div className="chips">
                  {(
                    [
                      ["concis", "Concis"],
                      ["detaille", "Détaillé"],
                      ["chaleureux", "Chaleureux"],
                    ] as [Profile["tone"], string][]
                  ).map(([v, l]) => (
                    <button key={v} className="chip" aria-pressed={profile.tone === v} onClick={() => updateProfile({ tone: v })}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Moment préféré pour s'organiser">
                <div className="chips">
                  {(
                    [
                      ["matin", "Le matin"],
                      ["soir", "Le soir"],
                      ["variable", "Variable"],
                    ] as [Profile["rhythm"], string][]
                  ).map(([v, l]) => (
                    <button key={v} className="chip" aria-pressed={profile.rhythm === v} onClick={() => updateProfile({ rhythm: v })}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          <section className="card card-pad">
            <div className="card-head">
              <span className="card-title">Mes objectifs</span>
            </div>
            <div className="chips">
              {PRIORITIES.map((p) => (
                <button key={p} className="chip" aria-pressed={profile.priorities.includes(p)} onClick={() => updateProfile({ priorities: profile.priorities.includes(p) ? profile.priorities.filter((x) => x !== p) : [...profile.priorities, p] })}>
                  {p}
                </button>
              ))}
            </div>
          </section>

          <Notice icon={<ShieldCheck />}>
            <strong>Où sont ces données ?</strong> Sur cet appareil (stockage local du navigateur) et, si vous êtes connecté à un compte, dans votre sauvegarde en ligne, lisible par vous seul. En mode IA connectée, seules les informations confirmées sont transmises au modèle avec votre message, pour personnaliser la réponse.
          </Notice>
        </div>
      </div>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Effacer toute la mémoire ?"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setClearOpen(false)}>
              Annuler
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                clearMemory();
                setClearOpen(false);
                toast.success("Mémoire effacée.");
              }}
            >
              Tout effacer
            </button>
          </>
        }
      >
        Les {memory.length} informations mémorisées seront supprimées définitivement (sur cet appareil et dans votre sauvegarde en ligne si vous êtes connecté). Vos missions et conversations sont conservées.
      </Modal>
    </div>
  );
}
