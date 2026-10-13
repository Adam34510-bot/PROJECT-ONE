import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Brain, Gem, Home, LifeBuoy, ListChecks, MessageCircle, MoreHorizontal, Plug, Settings, X, Globe, UserRound } from "lucide-react";
import { Link, useRoute } from "../../lib/router";
import { Logo, Orb } from "../ui";
import { recheckAiMode, useAiMode } from "../../lib/ai/client";
import { useStore, PLAN_LIMITS } from "../../lib/store";

const NAV = [
  { to: "/app", label: "Accueil", icon: Home, exact: true },
  { to: "/app/assistant", label: "Assistant", icon: MessageCircle },
  { to: "/app/missions", label: "Missions", icon: ListChecks },
  { to: "/app/bilan", label: "Bilan", icon: BarChart3 },
];
const NAV_2 = [
  { to: "/app/compte", label: "Compte", icon: UserRound },
  { to: "/app/memoire", label: "Mémoire", icon: Brain },
  { to: "/app/connexions", label: "Connexions", icon: Plug },
  { to: "/app/abonnement", label: "Abonnement", icon: Gem },
  { to: "/app/parametres", label: "Paramètres", icon: Settings },
  { to: "/app/support", label: "Support", icon: LifeBuoy },
];

export function AiModePill() {
  const mode = useAiMode();
  if (mode.status === "checking") return <span className="mode-pill">Vérification…</span>;
  if (mode.status === "offline")
    return (
      <button type="button" className="mode-pill demo" onClick={() => void recheckAiMode()} title="Pas de connexion internet. Toucher pour vérifier à nouveau.">
        <span className="dot" /> Hors ligne
      </button>
    );
  if (mode.status === "live")
    return (
      <span className="mode-pill live" title={`Modèle : ${mode.model}`}>
        <span className="dot" /> IA connectée
      </span>
    );
  return (
    <Link to="/app/connexions" className="mode-pill demo" title="Aucune clé API configurée : réponses issues de scénarios prédéfinis">
      <span className="dot" /> Mode démo
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { path } = useRoute();
  const [more, setMore] = useState(false);
  const profile = useStore((s) => s.profile);
  const plan = useStore((s) => s.plan);
  const awaiting = useStore((s) => s.missions.filter((m) => m.status === "awaiting").length);

  useEffect(() => setMore(false), [path]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(`${to}/`));
  const initial = (profile.name || "Vous").trim().charAt(0).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/app" className="sidebar-logo">
          <Logo />
        </Link>
        <Link to="/app/assistant" className="sidebar-cta">
          <Orb size="sm" />
          <span>
            <strong>Nouvelle demande</strong>
            <small>Écrire ou parler</small>
          </span>
        </Link>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="nav-item" aria-current={isActive(n.to, n.exact) ? "page" : undefined}>
              <n.icon />
              <span>{n.label}</span>
              {n.to === "/app/missions" && awaiting > 0 && <span className="nav-count">{awaiting}</span>}
            </Link>
          ))}
          <div className="nav-sep" />
          {NAV_2.map((n) => (
            <Link key={n.to} to={n.to} className="nav-item" aria-current={isActive(n.to) ? "page" : undefined}>
              <n.icon />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <AiModePill />
          <Link to="/app/compte" className="sidebar-user">
            <span className="avatar">{initial}</span>
            <span className="stack grow">
              <strong className="truncate">{profile.name || "Mon espace"}</strong>
              <small>Formule {PLAN_LIMITS[plan].label}</small>
            </span>
          </Link>
          <Link to="/" className="nav-item subtle">
            <Globe />
            <span>Site public</span>
          </Link>
        </div>
      </aside>

      <header className="topbar">
        <Link to="/app">
          <Logo />
        </Link>
        <div className="row gap-8">
          <AiModePill />
          <Link to="/app/compte" className="avatar" aria-label="Mon compte">
            {initial}
          </Link>
        </div>
      </header>

      <main className="main" id="contenu">
        <div className="content">{children}</div>
      </main>

      <nav className="tabbar" aria-label="Navigation mobile">
        <Link to="/app" className="tab" aria-current={isActive("/app", true) ? "page" : undefined}>
          <Home />
          <span>Accueil</span>
        </Link>
        <Link to="/app/missions" className="tab" aria-current={isActive("/app/missions") ? "page" : undefined}>
          <ListChecks />
          <span>Missions</span>
          {awaiting > 0 && <i className="tab-dot" />}
        </Link>
        <Link to="/app/assistant" className="tab tab-orb" aria-label="Assistant" aria-current={isActive("/app/assistant") ? "page" : undefined}>
          <Orb size="" />
        </Link>
        <Link to="/app/bilan" className="tab" aria-current={isActive("/app/bilan") ? "page" : undefined}>
          <BarChart3 />
          <span>Bilan</span>
        </Link>
        <button className="tab" onClick={() => setMore(true)} aria-expanded={more}>
          <MoreHorizontal />
          <span>Plus</span>
        </button>
      </nav>

      {more && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="sheet" role="dialog" aria-label="Plus de pages">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <strong>Mon espace</strong>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setMore(false)} aria-label="Fermer">
                <X />
              </button>
            </div>
            <div className="sheet-grid">
              {NAV_2.map((n) => (
                <Link key={n.to} to={n.to} className="sheet-item">
                  <n.icon />
                  <span>{n.label}</span>
                </Link>
              ))}
              <Link to="/" className="sheet-item">
                <Globe />
                <span>Site public</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
