import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { Toasts } from "./components/ui";
import { match, navigate, useRoute } from "./lib/router";
import { useStore } from "./lib/store";
import type { MissionKind } from "./lib/types";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Missions from "./pages/Missions";
import MissionDetail from "./pages/MissionDetail";
import MissionFlow from "./pages/MissionFlow";
import Bilan from "./pages/Bilan";
import Memory from "./pages/Memory";
import Connections from "./pages/Connections";
import Subscription from "./pages/Subscription";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import Account from "./pages/Account";
import { initAccount } from "./lib/cloud/account";
import { useNotificationCenter } from "./lib/notify";
import NotFound from "./pages/NotFound";

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const reduced = useStore((s) => s.settings.reducedMotion);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#06070c" : "#f4f3ef");
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "";
  }, [reduced]);
}

const TITLES: [string, string][] = [
  ["/app/assistant", "Assistant"],
  ["/app/missions", "Missions"],
  ["/app/nouvelle", "Nouvelle mission"],
  ["/app/bilan", "Bilan"],
  ["/app/memoire", "Mémoire"],
  ["/app/connexions", "Connexions"],
  ["/app/abonnement", "Abonnement"],
  ["/app/parametres", "Paramètres"],
  ["/app/support", "Support"],
  ["/app/compte", "Compte"],
  ["/app", "Accueil"],
  ["/bienvenue", "Bienvenue"],
];

export default function App() {
  useTheme();
  useNotificationCenter();
  useEffect(initAccount, []);
  const { path } = useRoute();
  const onboarded = useStore((s) => s.profile.onboarded);
  const inApp = path === "/app" || path.startsWith("/app/");
  // La page Compte reste accessible avant l'accueil : on peut se connecter et retrouver ses données sur un nouvel appareil.
  const accountPage = path === "/app/compte";

  useEffect(() => {
    if (inApp && !onboarded && !accountPage) navigate("/bienvenue", { replace: true });
  }, [inApp, onboarded, accountPage]);

  useEffect(() => {
    const t = TITLES.find(([p]) => path === p || path.startsWith(`${p}/`));
    document.title = t ? `${t[1]} · NEXORA` : "NEXORA · Votre assistant personnel";
  }, [path]);

  let page: React.ReactNode;
  let p: Record<string, string> | null;
  if (path === "/") page = <Landing />;
  else if (path === "/bienvenue") page = <Onboarding />;
  else if (!inApp) page = <NotFound />;
  else if (!onboarded && !accountPage) page = null;
  else {
    if (path === "/app") page = <Home />;
    else if (path === "/app/assistant") page = <Chat />;
    else if ((p = match("/app/assistant/:id", path))) page = <Chat key={p.id} id={p.id} />;
    else if (path === "/app/missions") page = <Missions />;
    else if ((p = match("/app/missions/:id", path))) page = <MissionDetail id={p.id} />;
    else if ((p = match("/app/nouvelle/:kind", path))) page = <MissionFlow key={path + location.hash} kind={p.kind as MissionKind} />;
    else if (path === "/app/bilan") page = <Bilan />;
    else if (path === "/app/memoire") page = <Memory />;
    else if (path === "/app/connexions") page = <Connections />;
    else if (path === "/app/abonnement") page = <Subscription />;
    else if (path === "/app/parametres") page = <Settings />;
    else if (path === "/app/support") page = <Support />;
    else if (accountPage) page = <Account />;
    else page = <NotFound inApp />;
    page = <AppShell>{page}</AppShell>;
  }

  return (
    <>
      {page}
      <Toasts />
    </>
  );
}
