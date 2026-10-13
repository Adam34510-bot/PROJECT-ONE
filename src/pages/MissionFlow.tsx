import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Plus, Trash2, Wand2, Lock } from "lucide-react";
import { Field, Notice, PageHeader, Segmented, Switch, toast } from "../components/ui";
import * as F from "../lib/flows";
import { missionMeta } from "../lib/missions";
import { Link, navigate, useRoute } from "../lib/router";
import { missionsThisMonth, PLAN_LIMITS, useStore } from "../lib/store";
import type { MissionKind } from "../lib/types";

type Errors = F.FlowErrors;

export default function MissionFlow({ kind }: { kind: MissionKind }) {
  const { query } = useRoute();
  const missions = useStore((s) => s.missions);
  const plan = useStore((s) => s.plan);
  const createMission = useStore((s) => s.createMission);
  const meta = missionMeta(kind);
  const from = query.get("from");
  const conv = query.get("conv") ?? undefined;
  const source = from ? missions.find((m) => m.id === from) : undefined;
  const prefill = useMemo(() => {
    try {
      return JSON.parse(query.get("prefill") || "null") as Record<string, string> | null;
    } catch {
      return null;
    }
  }, [query]);

  const limit = PLAN_LIMITS[plan].missions;
  const used = missionsThisMonth(missions);
  const blocked = limit !== null && used >= limit;

  const submit = (input: object, out: F.FlowOutput) => {
    if (blocked) return;
    const id = createMission(kind, input as Record<string, unknown>, out, conv);
    toast.success("Mission préparée. Vérifiez les actions proposées.");
    navigate(`/app/missions/${id}`, { replace: true });
  };

  if (!F.FLOW_KINDS.includes(kind)) {
    return (
      <div className="card card-pad">
        <p>Ce parcours n'existe pas.</p>
        <Link to="/app" className="btn btn-secondary" style={{ marginTop: 16 }}>
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const initial = (source?.input ?? null) as never;

  return (
    <div className="flow" style={{ ["--hue" as string]: meta.hue }}>
      <Link to={source ? `/app/missions/${source.id}` : "/app"} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
        <ArrowLeft /> Retour
      </Link>
      <PageHeader
        eyebrow={source ? "Relancer la mission" : "Nouvelle mission"}
        title={
          <span className="row gap-12">
            <span className="icon-tile lg">
              <meta.icon />
            </span>
            {meta.label}
          </span>
        }
        subtitle={meta.description}
      />
      {blocked && (
        <Notice tone="danger" icon={<Lock />}>
          <strong>Limite atteinte :</strong> votre formule {PLAN_LIMITS[plan].label} inclut {limit} missions par mois ({used} utilisées).{" "}
          <Link to="/app/abonnement" style={{ textDecoration: "underline" }}>
            Voir les formules
          </Link>
        </Notice>
      )}
      <div className="flow-card card card-pad reveal">
        {kind === "day" && <DayForm initial={initial} prefill={prefill} onSubmit={submit} disabled={blocked} />}
        {kind === "compare" && <CompareForm initial={initial} prefill={prefill} onSubmit={submit} disabled={blocked} />}
        {kind === "savings" && <SavingsForm initial={initial} prefill={prefill} onSubmit={submit} disabled={blocked} />}
        {kind === "admin" && <AdminForm initial={initial} prefill={prefill} onSubmit={submit} disabled={blocked} />}
        {kind === "travel" && <TravelForm initial={initial} prefill={prefill} onSubmit={submit} disabled={blocked} />}
        {kind === "subscriptions" && <SubscriptionsForm initial={initial} onSubmit={submit} disabled={blocked} />}
        {kind === "appointment" && <AppointmentForm initial={initial} prefill={prefill} onSubmit={submit} disabled={blocked} />}
      </div>
    </div>
  );
}

type Prefill = { prefill: Record<string, string> | null };
type FormProps<T> = { initial: T | null; onSubmit: (input: T, out: F.FlowOutput) => void; disabled?: boolean };

function Submit({ disabled, children = "Préparer la mission" }: { disabled?: boolean; children?: ReactNode }) {
  return (
    <div className="flow-submit">
      <p className="faint">L'assistant prépare un résultat et des actions. Rien n'est exécuté sans votre validation.</p>
      <button className="btn btn-primary btn-lg" type="submit" disabled={disabled}>
        <Wand2 /> {children}
      </button>
    </div>
  );
}

function useForm<T extends object>(initial: T, validate: (v: T) => Errors) {
  const [v, setV] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof T>(k: K, val: T[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k as string];
      delete n.form;
      return n;
    });
  };
  const check = () => {
    const e = validate(v);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Certaines informations sont à corriger.");
      return false;
    }
    return true;
  };
  return { v, setV, set, errors, setErrors, check };
}

/* ---------------------------------------------------------------- Journée */
function DayForm({ initial, prefill, onSubmit, disabled }: FormProps<F.DayInput> & Prefill) {
  const { v, set, errors, check } = useForm(initial ?? F.applyPrefill(F.dayDefaults, prefill), F.validateDay);
  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) onSubmit(v, F.runDay(v));
      }}
    >
      <Segmented
        label="Jour"
        value={v.when}
        onChange={(x) => set("when", x)}
        options={[
          { value: "today", label: "Aujourd'hui" },
          { value: "tomorrow", label: "Demain" },
        ]}
      />
      <div className="grid-2">
        <Field label="Début de journée" htmlFor="ds">
          <input id="ds" type="time" className="input" value={v.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field label="Fin de journée" htmlFor="de" error={errors.end}>
          <input id="de" type="time" className="input" value={v.end} onChange={(e) => set("end", e.target.value)} aria-invalid={Boolean(errors.end)} />
        </Field>
      </div>
      <Field label="Vos tâches, une par ligne" htmlFor="dt" error={errors.tasks} hint="Astuces : « ! » en début de ligne = prioritaire · « (30) » = durée en minutes · « @14:00 » = horaire fixe.">
        <textarea id="dt" className="textarea mono-input" rows={7} value={v.tasks} onChange={(e) => set("tasks", e.target.value)} aria-invalid={Boolean(errors.tasks)} />
      </Field>
      <label className="setting-row" style={{ borderTop: 0, padding: 0 }}>
        <span>
          <span className="label">Pause déjeuner 12 h 30 – 13 h 30</span>
        </span>
        <Switch checked={v.lunch} onChange={(x) => set("lunch", x)} label="Pause déjeuner" />
      </label>
      <Submit disabled={disabled}>Construire mon planning</Submit>
    </form>
  );
}

/* ---------------------------------------------------------------- Comparaison */
function CompareForm({ initial, prefill, onSubmit, disabled }: FormProps<F.CompareInput> & { prefill: Record<string, string> | null }) {
  const start: F.CompareInput =
    initial ??
    (prefill?.currentName
      ? { ...F.compareDefaults, offers: [{ ...F.emptyOffer(), name: prefill.currentName, monthly: prefill.currentMonthly ?? "", current: true }, F.emptyOffer()] }
      : F.compareDefaults);
  const { v, set, errors, check } = useForm(start, F.validateCompare);
  const setOffer = (i: number, patch: Partial<F.OfferInput>) =>
    set(
      "offers",
      v.offers.map((o, idx) => (idx === i ? { ...o, ...patch } : patch.current ? { ...o, current: false } : o)),
    );

  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) onSubmit(v, F.runCompare(v));
      }}
    >
      {errors.offers && <Notice tone="danger">{errors.offers}</Notice>}
      <div className="offers">
        {v.offers.map((o, i) => (
          <div key={i} className="offer-card">
            <div className="row-between">
              <span className="eyebrow">Offre {String.fromCharCode(65 + i)}</span>
              {v.offers.length > 2 && (
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => set("offers", v.offers.filter((_, idx) => idx !== i))} aria-label="Retirer cette offre">
                  <Trash2 />
                </button>
              )}
            </div>
            <Field label="Nom" error={errors[`offer${i}name`]}>
              <input className="input" value={o.name} onChange={(e) => setOffer(i, { name: e.target.value })} placeholder="Ex. Box Fibre XL" aria-invalid={Boolean(errors[`offer${i}name`])} />
            </Field>
            <div className="grid-2">
              <Field label="Prix mensuel" error={errors[`offer${i}monthly`]}>
                <div className="input-affix">
                  <input className="input" inputMode="decimal" value={o.monthly} onChange={(e) => setOffer(i, { monthly: e.target.value })} placeholder="24,99" aria-invalid={Boolean(errors[`offer${i}monthly`])} />
                  <span>€</span>
                </div>
              </Field>
              <Field label="Frais d'ouverture" error={errors[`offer${i}setup`]}>
                <div className="input-affix">
                  <input className="input" inputMode="decimal" value={o.setup} onChange={(e) => setOffer(i, { setup: e.target.value })} placeholder="0" />
                  <span>€</span>
                </div>
              </Field>
            </div>
            <Field label="Engagement">
              <select className="select" value={o.engagement} onChange={(e) => setOffer(i, { engagement: e.target.value })}>
                <option value="0">Sans engagement</option>
                <option value="12">12 mois</option>
                <option value="24">24 mois</option>
              </select>
            </Field>
            <Field label="Services inclus" hint="Séparés par des virgules">
              <input className="input" value={o.features} onChange={(e) => setOffer(i, { features: e.target.value })} placeholder="Fibre, TV, appels illimités" />
            </Field>
            <Field label="Lien vers l'offre (facultatif)" error={errors[`offer${i}url`]}>
              <input className="input" value={o.url} onChange={(e) => setOffer(i, { url: e.target.value })} placeholder="https://" inputMode="url" />
            </Field>
            <label className="row gap-8" style={{ fontSize: 13.5, cursor: "pointer" }}>
              <input type="radio" name="current" checked={o.current} onChange={() => setOffer(i, { current: true })} /> C'est mon offre actuelle
            </label>
          </div>
        ))}
        {v.offers.length < 4 && (
          <button type="button" className="offer-add" onClick={() => set("offers", [...v.offers, F.emptyOffer()])}>
            <Plus /> Ajouter une offre
          </button>
        )}
      </div>
      <div className="weights">
        <Segmented
          label="Durée de comparaison"
          value={v.horizon}
          onChange={(x) => set("horizon", x)}
          options={[
            { value: "12", label: "Sur 12 mois" },
            { value: "24", label: "Sur 24 mois" },
          ]}
        />
        {(
          [
            ["weightPrice", "Importance du prix"],
            ["weightFlex", "Importance de la flexibilité"],
            ["weightFeatures", "Importance des services"],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label} aside={<span className="mono faint">{v[k]}/5</span>}>
            <input type="range" min={0} max={5} className="range" value={v[k]} onChange={(e) => set(k, Number(e.target.value))} />
          </Field>
        ))}
      </div>
      <Submit disabled={disabled}>Comparer</Submit>
    </form>
  );
}

/* ---------------------------------------------------------------- Économies */
function SavingsForm({ initial, prefill, onSubmit, disabled }: FormProps<F.SavingsInput> & Prefill) {
  const { v, set, errors, check } = useForm(initial ?? F.applyPrefill(F.savingsDefaults, prefill), F.validateSavings);
  const fields: [keyof F.SavingsInput, string, string][] = [
    ["energy", "Électricité et gaz", "85"],
    ["mobile", "Forfait(s) mobile", "19,99"],
    ["internet", "Box internet", "39,99"],
    ["insurance", "Assurances (habitation, auto…)", "62"],
    ["bank", "Frais bancaires", "8"],
    ["subscriptions", "Abonnements (streaming, sport…)", "45"],
  ];
  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) onSubmit(v, F.runSavings(v));
      }}
    >
      <p className="muted" style={{ fontSize: 14 }}>
        Indiquez vos dépenses <strong>mensuelles</strong>. Laissez vide ce qui ne vous concerne pas.
      </p>
      {errors.form && <Notice tone="danger">{errors.form}</Notice>}
      <div className="grid-2">
        {fields.map(([k, label, ph]) => (
          <Field key={k} label={label} error={errors[k]}>
            <div className="input-affix">
              <input className="input" inputMode="decimal" value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} aria-invalid={Boolean(errors[k])} />
              <span>€/mois</span>
            </div>
          </Field>
        ))}
      </div>
      <Notice>Les montants restent sur votre appareil. Plus tard, une connexion bancaire autorisée pourra les remplir automatiquement.</Notice>
      <Submit disabled={disabled}>Trouver des pistes</Submit>
    </form>
  );
}

/* ---------------------------------------------------------------- Démarche */
function AdminForm({ initial, prefill, onSubmit, disabled }: FormProps<F.AdminInput> & { prefill: Record<string, string> | null }) {
  const profileName = useStore((s) => s.profile.name);
  const filled = initial ?? F.applyPrefill({ ...F.adminDefaults, fullName: profileName }, prefill);
  const start: F.AdminInput = { ...filled, type: filled.type in F.ADMIN_TYPES ? filled.type : "resiliation" };
  const { v, set, errors, check } = useForm(start, F.validateAdmin);
  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) onSubmit(v, F.runAdmin(v));
      }}
    >
      <Field label="Type de démarche">
        <div className="chips">
          {(Object.keys(F.ADMIN_TYPES) as F.AdminType[]).map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={v.type === t} onClick={() => set("type", t)}>
              {F.ADMIN_TYPES[t].label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Organisme ou entreprise" error={errors.organisme} htmlFor="ao">
          <input id="ao" className="input" value={v.organisme} onChange={(e) => set("organisme", e.target.value)} placeholder="Ex. opérateur, assureur, salle de sport" aria-invalid={Boolean(errors.organisme)} />
        </Field>
        <Field label="Référence client ou contrat" htmlFor="ar" hint="Facultatif, mais souvent exigé">
          <input id="ar" className="input" value={v.reference} onChange={(e) => set("reference", e.target.value)} />
        </Field>
        <Field label="Votre nom complet" error={errors.fullName} htmlFor="an">
          <input id="an" className="input" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" aria-invalid={Boolean(errors.fullName)} />
        </Field>
        <Field label="E-mail de l'organisme" error={errors.recipientEmail} htmlFor="ae" hint="Facultatif : pour préparer l'e-mail">
          <input id="ae" className="input" type="email" value={v.recipientEmail} onChange={(e) => set("recipientEmail", e.target.value)} />
        </Field>
      </div>
      <Field label={v.type === "adresse" ? "Votre nouvelle adresse" : "Votre adresse postale"} error={errors.address} htmlFor="aa">
        <textarea id="aa" className="textarea" rows={2} style={{ minHeight: 70 }} value={v.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" aria-invalid={Boolean(errors.address)} />
      </Field>
      <Field label={v.type === "reclamation" || v.type === "remboursement" ? "Décrivez la situation" : "Précisions (facultatif)"} error={errors.details} htmlFor="ad">
        <textarea id="ad" className="textarea" value={v.details} onChange={(e) => set("details", e.target.value)} aria-invalid={Boolean(errors.details)} />
      </Field>
      <Submit disabled={disabled}>Rédiger le courrier</Submit>
    </form>
  );
}

/* ---------------------------------------------------------------- Voyage */
function TravelForm({ initial, prefill, onSubmit, disabled }: FormProps<F.TravelInput> & Prefill) {
  const start = initial ?? F.applyPrefill(F.travelDefaults, prefill);
  const { v, set, errors, check } = useForm({ ...start, interests: start.interests.filter((x) => F.TRAVEL_INTERESTS.includes(x)) }, F.validateTravel);
  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) onSubmit(v, F.runTravel(v));
      }}
    >
      <div className="grid-2">
        <Field label="Destination" error={errors.destination} htmlFor="td">
          <input id="td" className="input" value={v.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Ex. Bordeaux, Lisbonne" aria-invalid={Boolean(errors.destination)} />
        </Field>
        <Field label="Départ de" htmlFor="to" hint="Facultatif">
          <input id="to" className="input" value={v.origin} onChange={(e) => set("origin", e.target.value)} placeholder="Ex. Paris" />
        </Field>
        <Field label="Date de départ" error={errors.departure} htmlFor="tdd" hint="Facultatif">
          <input id="tdd" type="date" className="input" value={v.departure} onChange={(e) => set("departure", e.target.value)} />
        </Field>
        <Field label="Budget total" error={errors.budget} htmlFor="tb">
          <div className="input-affix">
            <input id="tb" className="input" inputMode="decimal" value={v.budget} onChange={(e) => set("budget", e.target.value)} aria-invalid={Boolean(errors.budget)} />
            <span>€</span>
          </div>
        </Field>
        <Field label="Nuits" error={errors.nights} htmlFor="tn">
          <input id="tn" type="number" min={1} max={30} className="input" value={v.nights} onChange={(e) => set("nights", e.target.value)} />
        </Field>
        <Field label="Voyageurs" error={errors.people} htmlFor="tp">
          <input id="tp" type="number" min={1} max={12} className="input" value={v.people} onChange={(e) => set("people", e.target.value)} />
        </Field>
      </div>
      <Field label="Transport">
        <Segmented
          label="Moyen de transport"
          value={v.transport ?? "avion"}
          onChange={(x) => set("transport", x)}
          options={[
            { value: "avion", label: "Avion" },
            { value: "train", label: "Train" },
            { value: "voiture", label: "Voiture" },
          ]}
        />
      </Field>
      <Field label="Style">
        <Segmented
          label="Style de voyage"
          value={v.style}
          onChange={(x) => set("style", x)}
          options={[
            { value: "eco", label: "Économique" },
            { value: "confort", label: "Confort" },
          ]}
        />
      </Field>
      <Field label="Envies">
        <div className="chips">
          {F.TRAVEL_INTERESTS.map((it) => (
            <button key={it} type="button" className="chip" aria-pressed={v.interests.includes(it)} onClick={() => set("interests", v.interests.includes(it) ? v.interests.filter((x) => x !== it) : [...v.interests, it])}>
              {it}
            </button>
          ))}
        </div>
      </Field>
      <Submit disabled={disabled}>Préparer le voyage</Submit>
    </form>
  );
}

/* ---------------------------------------------------------------- Abonnements */
function SubscriptionsForm({ initial, onSubmit, disabled }: FormProps<F.SubscriptionsInput>) {
  const { v, set, errors, check } = useForm(initial ?? F.subscriptionsDefaults, F.validateSubscriptions);
  const setRow = (i: number, patch: Partial<F.SubRow>) => set("rows", v.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) onSubmit(v, F.runSubscriptions(v));
      }}
    >
      {errors.rows && <Notice tone="danger">{errors.rows}</Notice>}
      <div className="sub-rows">
        {v.rows.map((r, i) => (
          <div key={i} className="sub-edit">
            <input className="input" placeholder="Nom" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label="Nom de l'abonnement" aria-invalid={Boolean(errors[`row${i}name`])} />
            <div className="input-affix">
              <input className="input" inputMode="decimal" placeholder="Prix" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} aria-label="Prix" aria-invalid={Boolean(errors[`row${i}price`])} />
              <span>€</span>
            </div>
            <select className="select" value={r.period} onChange={(e) => setRow(i, { period: e.target.value as F.SubRow["period"] })} aria-label="Fréquence">
              <option value="mois">par mois</option>
              <option value="an">par an</option>
            </select>
            <select className="select" value={r.usage} onChange={(e) => setRow(i, { usage: e.target.value as F.SubRow["usage"] })} aria-label="Usage">
              <option value="souvent">Utilisé souvent</option>
              <option value="parfois">Parfois</option>
              <option value="rarement">Rarement</option>
            </select>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => set("rows", v.rows.filter((_, idx) => idx !== i))} aria-label="Retirer">
              <Trash2 />
            </button>
            <label className="sub-renewal">
              <span>Échéance (facultatif)</span>
              <input type="date" className="input" value={r.renewal ?? ""} onChange={(e) => setRow(i, { renewal: e.target.value || undefined })} aria-label={`Date d'échéance de ${r.name || "l'abonnement"}`} />
            </label>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => set("rows", [...v.rows, { name: "", price: "", period: "mois", usage: "souvent" }])}>
        <Plus /> Ajouter un abonnement
      </button>
      <Submit disabled={disabled}>Analyser</Submit>
    </form>
  );
}

/* ---------------------------------------------------------------- Rendez-vous */
function AppointmentForm({ initial, prefill, onSubmit, disabled }: FormProps<F.AppointmentInput> & Prefill) {
  const start = initial ?? F.applyPrefill(F.appointmentDefaults, prefill);
  const { v, set, errors, check } = useForm({ ...start, type: start.type in F.APPOINTMENT_TYPES ? start.type : "autre" }, F.validateAppointment);
  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) onSubmit(v, F.runAppointment(v));
      }}
    >
      <Field label="Type de rendez-vous">
        <div className="chips">
          {(Object.keys(F.APPOINTMENT_TYPES) as F.AppointmentType[]).map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={v.type === t} onClick={() => set("type", t)}>
              {F.APPOINTMENT_TYPES[t]}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Avec qui ?" error={errors.with} htmlFor="pw">
          <input id="pw" className="input" value={v.with} onChange={(e) => set("with", e.target.value)} placeholder="Ex. Dr Lefèvre" aria-invalid={Boolean(errors.with)} />
        </Field>
        <Field label="Objectif" htmlFor="pg" hint="Facultatif">
          <input id="pg" className="input" value={v.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Ex. renouveler une ordonnance" />
        </Field>
        <Field label="Date" error={errors.date} htmlFor="pd">
          <input id="pd" type="date" className="input" value={v.date} onChange={(e) => set("date", e.target.value)} aria-invalid={Boolean(errors.date)} />
        </Field>
        <Field label="Heure" error={errors.time} htmlFor="pt">
          <input id="pt" type="time" className="input" value={v.time} onChange={(e) => set("time", e.target.value)} aria-invalid={Boolean(errors.time)} />
        </Field>
      </div>
      <Submit disabled={disabled}>Préparer le rendez-vous</Submit>
    </form>
  );
}
