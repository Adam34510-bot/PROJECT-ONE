import { useState } from "react";
import { CreditCard, FlaskConical } from "lucide-react";
import { ComparisonTable, PLANS, PricingCards } from "../components/marketing/Pricing";
import { Modal, Notice, PageHeader, toast } from "../components/ui";
import { missionsThisMonth, PLAN_LIMITS, useStore } from "../lib/store";
import type { Plan } from "../lib/types";

export default function Subscription() {
  const plan = useStore((s) => s.plan);
  const setPlan = useStore((s) => s.setPlan);
  const missions = useStore((s) => s.missions);
  const [target, setTarget] = useState<Plan | null>(null);
  const used = missionsThisMonth(missions);
  const limit = PLAN_LIMITS[plan].missions;

  return (
    <div>
      <PageHeader
        eyebrow="Abonnement"
        title={
          <>
            Une formule pour chaque <span className="serif grad-text">rythme</span>
          </>
        }
        subtitle="Les limites exactes seront ajustées selon les coûts réels de l'IA et des intégrations."
      />

      <div className="plan-current card card-pad reveal">
        <div className="stack gap-4">
          <span className="eyebrow">Formule actuelle</span>
          <strong style={{ fontSize: 22 }}>{PLAN_LIMITS[plan].label}</strong>
          <span className="faint" style={{ fontSize: 13.5 }}>{plan === "free" ? "Aucun moyen de paiement enregistré." : "Activée en mode test : aucun paiement n'a été effectué."}</span>
        </div>
        <div className="plan-usage">
          <div className="row-between" style={{ fontSize: 13.5 }}>
            <span className="muted">Missions ce mois-ci</span>
            <span className="mono">
              {used} / {limit ?? "∞"}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 6}%` }} />
          </div>
          <span className="faint" style={{ fontSize: 12 }}>Les missions de démonstration ne sont pas comptées.</span>
        </div>
      </div>

      <Notice tone="demo" icon={<FlaskConical />}>
        <strong>Mode test :</strong> le paiement en ligne n'est pas encore configuré. Changer de formule ici permet de tester les limites, sans aucun prélèvement.
      </Notice>

      <div className="section">
        <PricingCards current={plan} onChoose={(p) => setTarget(p)} cta="Essayer en mode test" />
      </div>

      <div className="section">
        <div className="section-title">Comparatif détaillé</div>
        <ComparisonTable />
        <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>* Sous réserve d'un usage raisonnable, à définir selon les coûts techniques.</p>
      </div>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={`Passer en ${PLANS.find((p) => p.id === target)?.name ?? ""} (mode test)`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setTarget(null)}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (target) setPlan(target);
                toast.success("Formule changée en mode test. Aucun paiement effectué.");
                setTarget(null);
              }}
            >
              <CreditCard /> Activer sans payer
            </button>
          </>
        }
      >
        Il s'agit d'une simulation : aucune carte n'est demandée et rien n'est facturé. Le paiement réel nécessitera la configuration d'un prestataire (par exemple Stripe) et votre autorisation.
      </Modal>
    </div>
  );
}
