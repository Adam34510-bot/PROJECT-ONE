/**
 * Voix : reconnaissance vocale (Web Speech API) et lecture audio (speechSynthesis).
 * Disponibles selon le navigateur. Aucune écoute permanente : le micro s'active
 * uniquement lorsque l'utilisateur appuie sur le bouton, et s'arrête à la fin de la phrase.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

// Types minimaux : l'API n'est pas encore standardisée dans les définitions TypeScript.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const getRecognition = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
};

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/.test(navigator.userAgent);

/** Marche à suivre pour réautoriser le micro, selon l'appareil. */
export function micHelp(): string {
  if (isIos()) return "Accès au micro refusé. Sur iPhone : Réglages > Safari > Micro > Autoriser (et Réglages > Confidentialité > Reconnaissance vocale), puis rouvrez l'application.";
  if (isAndroid()) return "Accès au micro refusé. Sur Android : touchez le cadenas à gauche de l'adresse > Autorisations > Micro > Autoriser. Application installée : Paramètres > Applications > Chrome > Autorisations > Micro.";
  return "Accès au micro refusé. Cliquez sur l'icône à gauche de l'adresse du site, autorisez le micro, puis réessayez.";
}

const ERRORS: Record<string, string> = {
  "not-allowed": "",
  "service-not-allowed": "La reconnaissance vocale est désactivée sur cet appareil. Sur iPhone, activez Siri ou la Dictée (Réglages > Général > Clavier > Dictée).",
  "no-speech": "Je n'ai rien entendu. Réessayez en parlant près du micro.",
  "audio-capture": "Aucun micro détecté sur cet appareil.",
  network: "La reconnaissance vocale nécessite une connexion internet.",
  aborted: "",
};

export const speechInputSupported = () => typeof window !== "undefined" && Boolean(getRecognition());
export const speechOutputSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function useVoice() {
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  useEffect(
    () => () => {
      recRef.current?.abort();
      if (speechOutputSupported()) window.speechSynthesis.cancel();
    },
    [],
  );

  const listen = useCallback((onFinal: (text: string) => void) => {
    const Rec = getRecognition();
    setError(null);
    if (!Rec) {
      setError("La saisie vocale n'est pas prise en charge par ce navigateur. Essayez Chrome, Edge ou Safari récent. Vous pouvez aussi utiliser la dictée de votre clavier.");
      return;
    }
    if (speechOutputSupported()) window.speechSynthesis.cancel();
    const rec = new Rec();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInterim(text);
      const last = e.results[e.results.length - 1];
      if (last?.isFinal) finalRef.current = text;
    };
    rec.onerror = (e) => {
      const msg = e.error === "not-allowed" ? micHelp() : (ERRORS[e.error] ?? "La saisie vocale a rencontré un problème.");
      if (msg) setError(msg);
      setState("idle");
    };
    rec.onend = () => {
      const text = (finalRef.current || "").trim();
      recRef.current = null;
      setInterim("");
      if (text) {
        setState("processing");
        onFinal(text);
      } else setState((s) => (s === "listening" ? "idle" : s));
    };
    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      setError("Impossible de démarrer le micro.");
      setState("idle");
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const speak = useCallback((text: string) => {
    if (!speechOutputSupported()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ""));
    u.lang = "fr-FR";
    const fr = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
    if (fr) u.voice = fr;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    setState("speaking");
    window.speechSynthesis.speak(u);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (speechOutputSupported()) window.speechSynthesis.cancel();
    setState("idle");
  }, []);

  return { state, setState, interim, error, setError, listen, stop, speak, stopSpeaking, supported: speechInputSupported(), canSpeak: speechOutputSupported() };
}
