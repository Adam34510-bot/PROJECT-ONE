import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Square, Volume2, VolumeX } from "lucide-react";
import { Orb } from "../ui";
import type { useVoice } from "../../lib/voice";

const VOICE_LABEL = { idle: "Prêt", listening: "Je vous écoute…", processing: "Je réfléchis…", speaking: "Je réponds…" } as const;

export function Composer({
  onSend,
  voice,
  busy,
  placeholder = "Votre demande…",
  autoFocus,
  voiceReplies,
  onToggleVoiceReplies,
  large,
}: {
  onSend: (text: string, viaVoice: boolean) => void;
  voice: ReturnType<typeof useVoice>;
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  voiceReplies?: boolean;
  onToggleVoiceReplies?: () => void;
  large?: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t, false);
    setText("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const listening = voice.state === "listening";
  const showVoiceBar = voice.state !== "idle" || Boolean(voice.error);

  return (
    <div className={`composer ${large ? "composer-lg" : ""}`} data-voice={voice.state}>
      {showVoiceBar && (
        <div className="voice-bar" role="status" aria-live="polite">
          <Orb size="xs" state={voice.state} />
          <span className="grow">{voice.error ? voice.error : listening && voice.interim ? `« ${voice.interim} »` : VOICE_LABEL[voice.state]}</span>
          {voice.state === "speaking" && (
            <button className="btn btn-ghost btn-sm" onClick={voice.stopSpeaking}>
              Arrêter la lecture
            </button>
          )}
          {voice.error && (
            <button className="btn btn-ghost btn-sm" onClick={() => voice.setError(null)}>
              OK
            </button>
          )}
        </div>
      )}
      <div className="composer-box">
        <textarea
          ref={ref}
          className="composer-input"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={listening ? "Parlez, je transcris…" : placeholder}
          aria-label="Votre demande"
          autoFocus={autoFocus}
          maxLength={4000}
        />
        <div className="composer-tools">
          {onToggleVoiceReplies && voice.canSpeak && (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onToggleVoiceReplies}
              aria-pressed={voiceReplies}
              title={voiceReplies ? "Lecture audio des réponses activée" : "Lecture audio des réponses désactivée"}
              aria-label="Lecture audio des réponses"
            >
              {voiceReplies ? <Volume2 /> : <VolumeX />}
            </button>
          )}
          <button
            type="button"
            className={`btn btn-icon mic-btn ${listening ? "is-on" : ""}`}
            onClick={() => (listening ? voice.stop() : voice.listen((t) => onSend(t, true)))}
            aria-label={listening ? "Arrêter l'écoute" : "Parler à l'assistant"}
            title={voice.supported ? "Saisie vocale" : "Saisie vocale non prise en charge par ce navigateur"}
            disabled={busy && !listening}
          >
            {listening ? <Square /> : <Mic />}
          </button>
          <button type="button" className="btn btn-primary btn-icon send-btn" onClick={submit} disabled={!text.trim() || busy} aria-label="Envoyer">
            {busy ? <span className="spinner" /> : <ArrowUp />}
          </button>
        </div>
      </div>
    </div>
  );
}
