import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Hand, ShieldCheck, Wand2, FlaskConical } from "lucide-react";
import { Field, Logo, Orb, Switch } from "../components/ui";
import { MISSIONS, missionMeta } from "../lib/missions";
import { Link, navigate } from "../lib/router";
import { cloudConfigured } from "../lib/cloud/account";
import { useStore } from "../lib/store";
import type { MissionKind, Profile } from "../lib/types";
import { PRIORITIES } from "./Memory";

const PRIORITY_TO_MISSIONS: Record<string, MissionKind[]> = {
  "Gagner du temps": ["day", "appointment"],
  "Économiser de l'argent": ["savings", "subscriptions", "compare"],
  "Mieux m'organiser": ["day", "appointment"],
  "Simplifier l'administratif": ["admin", "subscriptions"],
  "Voyager malin": ["travel"],
  "Réduire ma charge mentale": ["day", "admin"],
};

const TONES: [Profile["tone"], string, string][] = [
  ["concis", "Concis", "L'essentiel, rapidement"],
  ["detaille", "Détaillé", "Avec les explications"],
  ["chaleureux", "Chaleureux", "Un ton plus humain"],
];
const RHYTHMS: [Profile["rhythm"], string][] = [
  ["matin", "Plutôt le matin"],
  ["soir", "Plutôt le soir"],
  ["variable", "Ça dépend"],
];

export default function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding);
  const existing = useStore((s) => s.profile);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing.name);
  const [tone, setTone] = useState<Profile["tone"]>("concis");
  const [rhythm, setRhythm] = useState<Profile["rhythm"]>("matin");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [first, setFirst] = useState<MissionKind | null>(null);
  const [demo, setDemo] = useState(true);
  const [nameErr, setNameErr] = useState("");

  const suggestions = Array.from(new Set(priorities.flatMap((p) => PRIORITY_TO_MISSIONS[p] ?? []))).slice(0, 3);
  const starters: MissionKind[] = suggestions.length ? suggestions : ["day", "savings", "admin"];
  const total = 4;

  const next = () => {
    if (step === 1 && name.trim().length > 40) return setNameErr("40 caractères maximum.");
    setStep((s) => Math.min(total, s + 1));
  };

  const finish = (goTo: "mission" | "home") => {
    const toneLabel = TONES.find((t) => t[0] === tone)![1].toLowerCase();
    const rhythmLabel = RHYTHMS.find((r) => r[0] === rhythm)![1].toLowerCase();
    complete(
      { name: name.trim(), tone, rhythm, priorities },
      [
        { category: "communication", text: `Préfère des réponses au style ${toneLabel}`, source: "onboarding", confirmed: true },
        { category: "organisation", text: `S'organise ${rhythmLabel}`, source: "onboarding", confirmed: true },
        ...priorities.map((p) => ({ category: "objectifs" as const, text: p, source: "onboarding" as const, confirmed: true })),
      ],
      demo,
    );
    navigate(goTo === "mission" && first ? `/app/nouvelle/${first}` : "/app", { replace: true });
  };

  return (
    <div className="onboarding">
      <div className="ob-top">
        <Logo />
        <div className="ob-progress" aria-label={`Étape ${step + 1} sur ${total + 1}`}>
          {Array.from({ length: total + 1 }, (_, i) => (
            <span key={i} data-on={i <= step} />
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => finish("home")}>
          Passer
        </button>
      </div>

      <div className="ob-stage" key={step}>
        {step === 0 && (
          <div className="ob-step center">
            <Orb size="xl" />
            <h1>
              Bonjour. Je suis votre <span className="serif grad-text">assistant</span>.
            </h1>
            <p className="muted ob-lead">Je transforme vos demandes en missions concrètes, et je ne fais rien sans votre accord.</p>
            <div className="ob-pillars">
              {[
                [Wand2, "Je prépare", "Plannings, comparatifs, courriers, budgets."],
                [Hand, "Vous validez", "Chaque action attend votre feu vert."],
                [ShieldCheck, "Vous contrôlez", "Mémoire visible, modifiable, effaçable."],
              ].map(([I, t, d]) => {
                const Icon = I as typeof Wand2;
                return (
                  <div key={t as string} className="ob-pillar card">
                    <span className="icon-tile">
                      <Icon />
                    </span>
                    <strong>{t as string}</strong>
                    <small className="faint">{d as string}</small>
                  </div>
                );
              })}
            </div>
            {cloudConfigured && (
              <p className="faint" style={{ fontSize: 13.5 }}>
                Déjà un compte ?{" "}
                <Link to="/app/compte" style={{ textDecoration: "underline" }}>
                  Connectez-vous pour retrouver vos données
                </Link>
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="ob-step">
            <span className="eyebrow">Faisons connaissance</span>
            <h1>Comment préférez-vous que je vous parle ?</h1>
            <div className="stack gap-24" style={{ marginTop: 24 }}>
              <Field label="Votre prénom" hint="Facultatif" error={nameErr} htmlFor="obn">
                <input id="obn" className="input" value={name} onChange={(e) => (setName(e.target.value), setNameErr(""))} placeholder="Ex. Adam" autoComplete="given-name" autoFocus />
              </Field>
              <Field label="Style de réponse">
                <div className="ob-options">
                  {TONES.map(([v, l, d]) => (
                    <button key={v} className="ob-option" aria-pressed={tone === v} onClick={() => setTone(v)}>
                      <strong>{l}</strong>
                      <small>{d}</small>
                      {tone === v && <Check className="ob-check" />}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Quand préférez-vous vous organiser ?">
                <div className="chips">
                  {RHYTHMS.map(([v, l]) => (
                    <button key={v} className="chip" aria-pressed={rhythm === v} onClick={() => setRhythm(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="ob-step">
            <span className="eyebrow">Vos priorités</span>
            <h1>Qu'est-ce qui compte le plus pour vous ?</h1>
            <p className="muted">Choisissez-en une ou plusieurs. Vous pourrez changer d'avis à tout moment.</p>
            <div className="ob-priorities">
              {PRIORITIES.map((p) => (
                <button key={p} className="ob-option" aria-pressed={priorities.includes(p)} onClick={() => setPriorities((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}>
                  <strong>{p}</strong>
                  {priorities.includes(p) && <Check className="ob-check" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="ob-step">
            <span className="eyebrow">Missions de départ</span>
            <h1>Par quoi voulez-vous commencer ?</h1>
            <p className="muted">Aucune connexion de compte n'est nécessaire pour tester.</p>
            <div className="ob-missions">
              {starters.map((k) => {
                const m = missionMeta(k);
                return (
                  <button key={k} className="ob-mission card" aria-pressed={first === k} onClick={() => setFirst(k)} style={{ ["--hue" as string]: m.hue }}>
                    <span className="icon-tile">
                      <m.icon />
                    </span>
                    <span className="grow" style={{ textAlign: "left" }}>
                      <strong>{m.label}</strong>
                      <small>« {m.example} »</small>
                    </span>
                    {first === k && <Check className="ob-check" />}
                  </button>
                );
              })}
            </div>
            <details className="ob-more">
              <summary>Voir toutes les missions</summary>
              <div className="chips" style={{ marginTop: 12 }}>
                {MISSIONS.filter((m) => m.kind !== "other" && !starters.includes(m.kind)).map((m) => (
                  <button key={m.kind} className="chip" aria-pressed={first === m.kind} onClick={() => setFirst(m.kind)}>
                    <m.icon /> {m.label}
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}

        {step === 4 && (
          <div className="ob-step center">
            <Orb size="lg" />
            <h1>
              Tout est prêt{name.trim() ? `, ${name.trim()}` : ""}.
            </h1>
            <p className="muted ob-lead">Vos préférences sont enregistrées dans votre mémoire, que vous pouvez consulter et modifier.</p>
            <label className="ob-demo card">
              <FlaskConical />
              <span className="grow" style={{ textAlign: "left" }}>
                <strong>Ajouter des exemples de démonstration</strong>
                <small className="faint">Missions et bilan fictifs, signalés « Démo », pour explorer l'application. Supprimables à tout moment.</small>
              </span>
              <Switch checked={demo} onChange={setDemo} label="Ajouter des exemples de démonstration" />
            </label>
            <div className="row gap-12 wrap" style={{ justifyContent: "center", marginTop: 8 }}>
              {first && (
                <button className="btn btn-primary btn-lg" onClick={() => finish("mission")}>
                  Tester : {missionMeta(first).label} <ArrowRight />
                </button>
              )}
              <button className={`btn btn-lg ${first ? "btn-secondary" : "btn-primary"}`} onClick={() => finish("home")}>
                Aller à l'accueil
              </button>
            </div>
          </div>
        )}
      </div>

      {step < total && (
        <div className="ob-nav">
          <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft /> Retour
          </button>
          <button className="btn btn-primary" onClick={next} disabled={step === 2 && priorities.length === 0}>
            {step === 0 ? "Commencer" : step === 3 && !first ? "Plus tard" : "Continuer"} <ArrowRight />
          </button>
        </div>
      )}
    </div>
  );
}
