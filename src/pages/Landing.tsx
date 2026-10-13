import { useEffect, useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Check,
  Lock,
  Smartphone,
  Sparkles,
  Plug,
  Eye,
  Ban,
  Hand,
  Wand2,
  MessageCircle,
  Mic,
  Database,
  Puzzle,
  Code2,
  Menu,
  X,
} from "lucide-react";
import { Logo, Orb } from "../components/ui";
import { PricingCards } from "../components/marketing/Pricing";
import { MISSIONS } from "../lib/missions";
import { Link, navigate } from "../lib/router";
import { useStore } from "../lib/store";

const DEMO_SCRIPT = [
  { who: "user", text: "Organise un week-end à Bordeaux, budget 300 € à deux." },
  { who: "ai", text: "Voici une répartition du budget et un itinéraire. Il me manque vos dates." },
  { who: "card", text: "budget" },
  { who: "action", text: "Rechercher un train · en attente de votre validation" },
] as const;

const FAQ = [
  ["Est-ce un simple chatbot ?", "Non. Chaque demande devient une mission suivie, avec des étapes, un résultat concret (planning, courrier, comparatif, budget) et des actions que vous validez une par une."],
  ["L'assistant peut-il agir à ma place ?", "Il prépare tout, puis attend votre accord. Les actions internes (agenda, rappels, documents) s'exécutent et se vérifient dans l'application. Pour les services externes, il ouvre le bon site au bon endroit : vous finalisez."],
  ["Mes données sont-elles revendues ?", "Jamais. Dans cette version, elles restent sur votre appareil. Vous pouvez tout consulter, exporter et supprimer."],
  ["Faut-il connecter mes comptes pour commencer ?", "Non. Toutes les missions fonctionnent sans connexion. Les intégrations (agenda, e-mail, banque) arriveront progressivement, via des API officielles."],
  ["Comment sont calculées les économies ?", "Une économie n'est comptée que lorsque vous l'avez constatée et confirmée. Les estimations sont affichées à part, clairement signalées."],
  ["Ça fonctionne sur téléphone ?", "Oui. L'application s'installe sur l'écran d'accueil de votre iPhone ou Android, et fonctionne aussi sur ordinateur et tablette."],
];

export default function Landing() {
  const onboarded = useStore((s) => s.profile.onboarded);
  const start = () => navigate(onboarded ? "/app" : "/bienvenue");
  const [step, setStep] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1) % (DEMO_SCRIPT.length + 2)), step === DEMO_SCRIPT.length + 1 ? 2600 : 1300);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="landing">
      <header className="pub-nav">
        <div className="pub-inner">
          <Link to="/">
            <Logo />
          </Link>
          <nav className={`pub-links ${menu ? "open" : ""}`} onClick={() => setMenu(false)}>
            <a href="#comment">Fonctionnement</a>
            <a href="#missions">Missions</a>
            <a href="#confiance">Confidentialité</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="row gap-8">
            <button className="btn btn-primary btn-sm" onClick={start}>
              {onboarded ? "Ouvrir l'app" : "Essayer"} <ArrowRight />
            </button>
            <button className="btn btn-ghost btn-icon btn-sm pub-burger" onClick={() => setMenu((v) => !v)} aria-label="Menu" aria-expanded={menu}>
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ HERO */}
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="pub-inner hero-inner">
          <div className="hero-copy">
            <span className="hero-pill reveal">
              <span className="dot" /> Assistant personnel · prototype ouvert
            </span>
            <h1 className="hero-title reveal reveal-1">
              Vous demandez.
              <br />
              Il prépare.
              <br />
              <span className="serif grad-text">Vous validez.</span>
            </h1>
            <p className="hero-sub reveal reveal-2">L'assistant qui transforme vos demandes du quotidien en choses faites : agenda, factures, démarches, voyages. Rien ne part sans votre accord.</p>
            <div className="hero-ctas reveal reveal-3">
              <button className="btn btn-primary btn-lg" onClick={start}>
                Essayer gratuitement <ArrowRight />
              </button>
              <a href="#comment" className="btn btn-secondary btn-lg">
                Voir comment ça marche
              </a>
            </div>
            <ul className="hero-proof reveal reveal-4">
              <li>
                <Check /> Sans carte bancaire
              </li>
              <li>
                <Check /> Sans connecter vos comptes
              </li>
              <li>
                <Check /> iPhone, Android, ordinateur
              </li>
            </ul>
          </div>

          <div className="hero-visual reveal reveal-2" aria-label="Illustration du produit">
            <div className="phone">
              <div className="phone-notch" />
              <div className="phone-screen">
                <div className="phone-head">
                  <Orb size="sm" state={step === 1 ? "processing" : "idle"} />
                  <div>
                    <strong>Assistant</strong>
                    <small>Aperçu illustratif</small>
                  </div>
                </div>
                <div className="phone-msgs">
                  {step >= 1 && <div className="pm pm-user">{DEMO_SCRIPT[0].text}</div>}
                  {step === 1 && (
                    <div className="pm pm-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {step >= 2 && <div className="pm pm-ai">{DEMO_SCRIPT[1].text}</div>}
                  {step >= 3 && (
                    <div className="pm pm-card">
                      <div className="pm-bar">
                        <span style={{ width: "35%", background: "var(--hue-violet)" }} />
                        <span style={{ width: "33%", background: "var(--hue-blue)" }} />
                        <span style={{ width: "22%", background: "var(--hue-cyan)" }} />
                        <span style={{ width: "10%", background: "var(--hue-pink)" }} />
                      </div>
                      <div className="pm-legend">
                        <span>Transport 105 €</span>
                        <span>Logement 99 €</span>
                        <span>Repas 66 €</span>
                        <span>Activités 30 €</span>
                      </div>
                    </div>
                  )}
                  {step >= 4 && (
                    <div className="pm pm-action">
                      <ShieldCheck size={15} />
                      <span>
                        <strong>Rechercher un train</strong>
                        <small>En attente de votre validation</small>
                      </span>
                      <span className="pm-btn">Valider</span>
                    </div>
                  )}
                </div>
                <div className="phone-composer">
                  <span>Demandez-moi quelque chose…</span>
                  <Mic size={16} />
                </div>
              </div>
            </div>
            <div className="float-card fc-1">
              <span className="fc-ico" style={{ ["--hue" as string]: "var(--hue-green)" }}>
                <Check size={14} />
              </span>
              <span>
                <strong>Économie confirmée</strong>
                <small>Box internet · exemple</small>
              </span>
              <b className="fc-val">+180 €/an</b>
            </div>
            <div className="float-card fc-2">
              <span className="fc-ico" style={{ ["--hue" as string]: "var(--hue-amber)" }}>
                <Hand size={14} />
              </span>
              <span>
                <strong>3 actions à valider</strong>
                <small>Rien ne part sans vous</small>
              </span>
            </div>
            <div className="hero-orb">
              <Orb size="xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="pub-inner trust-inner">
          <span>
            <ShieldCheck /> Validation à chaque action
          </span>
          <span>
            <Smartphone /> Données sur votre appareil
          </span>
          <span>
            <Plug /> API officielles uniquement
          </span>
          <span>
            <Ban /> Aucune revente de données
          </span>
        </div>
      </section>

      {/* ------------------------------------------------ COMMENT */}
      <section className="pub-section" id="comment">
        <div className="pub-inner">
          <div className="pub-head">
            <span className="eyebrow">Fonctionnement</span>
            <h2>
              Pas un chatbot. Un assistant qui <span className="serif grad-text">termine</span> les choses.
            </h2>
          </div>
          <div className="how-grid">
            {[
              { n: "01", icon: MessageCircle, t: "Vous demandez", d: "À l'écrit ou à la voix, avec vos mots. « Réduis mes factures », « organise demain »." },
              { n: "02", icon: Wand2, t: "Il prépare", d: "Planning, comparatif chiffré, courrier prêt à envoyer, budget de voyage : un résultat concret, pas un pavé de texte." },
              { n: "03", icon: Hand, t: "Vous validez", d: "Chaque action attend votre accord. Ce qui est fait est vérifié ; ce qui ne peut pas l'être est expliqué." },
            ].map((s) => (
              <div key={s.n} className="how-card card">
                <span className="how-n mono">{s.n}</span>
                <span className="icon-tile">
                  <s.icon />
                </span>
                <h3>{s.t}</h3>
                <p className="muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ MISSIONS */}
      <section className="pub-section" id="missions">
        <div className="pub-inner">
          <div className="pub-head">
            <span className="eyebrow">Missions</span>
            <h2>
              Huit parcours prêts à l'emploi, <span className="serif grad-text">dès le premier jour</span>.
            </h2>
          </div>
          <div className="mission-showcase">
            {MISSIONS.filter((m) => m.kind !== "other").map((m) => (
              <div key={m.kind} className="ms-card card card-hover" style={{ ["--hue" as string]: m.hue }}>
                <span className="icon-tile">
                  <m.icon />
                </span>
                <strong>{m.label}</strong>
                <p className="faint">« {m.example} »</p>
                <span className="ms-result">{m.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ BÉNÉFICES (bento) */}
      <section className="pub-section">
        <div className="pub-inner">
          <div className="pub-head">
            <span className="eyebrow">Bénéfices</span>
            <h2>
              Du temps et de l'argent, <span className="serif grad-text">mesurés honnêtement</span>.
            </h2>
          </div>
          <div className="bento">
            <div className="bento-a card card-glow">
              <span className="eyebrow">Bilan personnel · exemple</span>
              <strong className="bento-big tnum">635 €</strong>
              <span className="muted">d'économies confirmées par an</span>
              <div className="bento-bars" aria-hidden="true">
                {[22, 35, 28, 52, 44, 70].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <small className="faint">Une économie n'est comptée que lorsque vous l'avez constatée.</small>
            </div>
            <div className="bento-b card">
              <Eye />
              <h3>Ce qu'il sait, ce qu'il suppose</h3>
              <p className="muted">L'assistant distingue les faits de ses hypothèses, et pose une question quand il manque une information.</p>
            </div>
            <div className="bento-c card">
              <Sparkles />
              <h3>Tout au même endroit</h3>
              <p className="muted">Demandes, résultats, historiques et rappels réunis dans un centre de missions.</p>
            </div>
            <div className="bento-d card">
              <Mic />
              <h3>Parlez-lui</h3>
              <p className="muted">Saisie vocale et lecture des réponses, selon votre navigateur.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ CONFIANCE */}
      <section className="pub-section" id="confiance">
        <div className="pub-inner">
          <div className="privacy-panel card">
            <div className="privacy-copy">
              <span className="eyebrow">Confidentialité</span>
              <h2>
                La confiance est <span className="serif grad-text">la fonctionnalité</span>.
              </h2>
              <p className="muted">Vous voyez tout ce que l'assistant retient. Vous décidez de chaque action. Vous pouvez tout exporter ou tout supprimer, à tout moment.</p>
              <button className="btn btn-secondary" onClick={start}>
                Essayer sans rien connecter <ArrowRight />
              </button>
            </div>
            <ul className="privacy-list">
              {[
                [Hand, "Validation explicite", "Aucune action externe sans votre accord."],
                [Database, "Mémoire contrôlée", "Consultable, modifiable, effaçable."],
                [Lock, "Secrets protégés", "Les clés d'API restent côté serveur."],
                [Ban, "Pas de faux succès", "Une action non aboutie n'est jamais affichée comme faite."],
              ].map(([I, t, d]) => {
                const Icon = I as typeof Hand;
                return (
                  <li key={t as string}>
                    <span className="icon-tile sm">
                      <Icon />
                    </span>
                    <span>
                      <strong>{t as string}</strong>
                      <small className="faint">{d as string}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ TARIFS */}
      <section className="pub-section" id="tarifs">
        <div className="pub-inner">
          <div className="pub-head">
            <span className="eyebrow">Tarifs</span>
            <h2>
              Commencez gratuitement. <span className="serif grad-text">Évoluez si besoin.</span>
            </h2>
          </div>
          <PricingCards onChoose={() => start()} cta="Commencer" />
          <p className="faint center" style={{ fontSize: 12.5, marginTop: 14 }}>Prototype : aucun paiement n'est encore activé. Les limites seront ajustées selon les coûts techniques.</p>
        </div>
      </section>

      {/* ------------------------------------------------ PLATEFORME */}
      <section className="pub-section">
        <div className="pub-inner">
          <div className="platform card">
            <div className="row gap-12">
              <span className="icon-tile">
                <Puzzle />
              </span>
              <span className="icon-tile" style={{ ["--hue" as string]: "var(--hue-cyan)" }}>
                <Code2 />
              </span>
            </div>
            <div className="grow">
              <span className="eyebrow">Vision</span>
              <h3>Demain, une plateforme ouverte aux développeurs.</h3>
              <p className="muted">Des intégrations créées par des développeurs externes, soumises aux mêmes règles d'autorisation et de validation. Bientôt une boutique d'intégrations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ FAQ */}
      <section className="pub-section" id="faq">
        <div className="pub-inner narrow">
          <div className="pub-head">
            <span className="eyebrow">FAQ</span>
            <h2>Questions fréquentes</h2>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-inner">
          <div className="final-cta card card-glow">
            <Orb size="lg" />
            <h2>
              Qu'est-ce que vous aimeriez <span className="serif grad-text">ne plus faire</span> ?
            </h2>
            <button className="btn btn-primary btn-lg" onClick={start}>
              Confier ma première mission <ArrowRight />
            </button>
          </div>
        </div>
      </section>

      <footer className="pub-footer">
        <div className="pub-inner row-between wrap" style={{ gap: 16 }}>
          <Logo />
          <span className="faint" style={{ fontSize: 13 }}>
            © {new Date().getFullYear()} NEXORA · Assistant personnel.
          </span>
        </div>
      </footer>
    </div>
  );
}
