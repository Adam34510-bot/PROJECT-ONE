/**
 * Installation de l'application sur l'écran d'accueil (PWA).
 * - Android / Chrome / Edge : le navigateur propose un vrai bouton d'installation (beforeinstallprompt).
 * - iPhone / iPad : Safari n'a pas de bouton programmable ; on affiche la marche à suivre.
 */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Safari sur iPhone est le seul navigateur iOS qui sait ajouter une PWA (iOS 16.4+ : aussi Chrome/Edge). */
export const isIosSafari = () => detectPlatform() === "ios" && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", l);
    return () => {
      listeners.delete(l);
      mq?.removeEventListener?.("change", l);
    };
  }, []);
  return {
    platform: detectPlatform(),
    installed: isStandalone(),
    canPrompt: Boolean(deferred),
    /** Ouvre la fenêtre d'installation du navigateur. Renvoie true si l'utilisateur a accepté. */
    prompt: async () => {
      if (!deferred) return false;
      const e = deferred;
      await e.prompt();
      const { outcome } = await e.userChoice;
      deferred = null;
      notify();
      return outcome === "accepted";
    },
  };
}
