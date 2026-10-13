import { useEffect, useId, type ReactNode } from "react";
import { create } from "zustand";
import { AlertCircle, CheckCircle2, Info, X, FlaskConical } from "lucide-react";
import { ACTION_META, STATUS_META } from "../../lib/missions";
import type { ActionState, MissionStatus } from "../../lib/types";
import type { VoiceState } from "../../lib/voice";

/* ------------------------------------------------------------------ Logo */
/**
 * Symbole provisoire : un anneau ouvert (« le cercle qui se complète ») et un point
 * lumineux dans l'ouverture, qui figure l'assistant qui termine les choses pour vous.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`lg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a58bff" />
          <stop offset="0.55" stopColor="#5d7fff" />
          <stop offset="1" stopColor="#45cff0" />
        </linearGradient>
        <radialGradient id={`rg${id}`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#bfe9ff" />
        </radialGradient>
      </defs>
      <path d="M22.9 6.6A11 11 0 1 0 27 15" fill="none" stroke={`url(#lg${id})`} strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="25.6" cy="9.3" r="3.1" fill={`url(#rg${id})`} />
      <circle cx="25.6" cy="9.3" r="5.5" fill="#7fd6ff" opacity="0.18" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo" aria-label="NEXORA">
      <LogoMark />
      {!compact && (
        <span className="logo-word">
          <span className="n">NEXORA</span>
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ Orbe */
export function Orb({ state = "idle", size = "", label }: { state?: VoiceState | "idle"; size?: "" | "xs" | "sm" | "lg" | "xl"; label?: string }) {
  return (
    <span className={`orb ${size ? `orb-${size}` : ""}`} data-state={state} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="orb-core" />
      <span className="orb-sheen" />
      <span className="orb-ring" />
      <span className="orb-ring" />
    </span>
  );
}

/* ------------------------------------------------------------------ Badges */
export function Badge({ tone, children, dot }: { tone?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className="badge" data-tone={tone}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function DemoBadge({ label = "Démo" }: { label?: string }) {
  return (
    <span className="badge badge-demo" title="Donnée de démonstration, fictive">
      <FlaskConical />
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: MissionStatus }) {
  const m = STATUS_META[status];
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}

export function ActionBadge({ state }: { state: ActionState }) {
  const m = ACTION_META[state];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/* ------------------------------------------------------------------ Contrôles */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor, aside }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        <span>{label}</span>
        {aside}
      </label>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          <AlertCircle size={13} />
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Modale */
export function Modal({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fermer">
            <X />
          </button>
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          {children}
        </div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Toasts */
interface Toast {
  id: number;
  text: string;
  tone: "success" | "danger" | "info";
}
const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, "id">) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 4200);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (text: string) => useToasts.getState().push({ text, tone: "success" }),
  error: (text: string) => useToasts.getState().push({ text, tone: "danger" }),
  info: (text: string) => useToasts.getState().push({ text, tone: "info" }),
};

export function Toasts() {
  const items = useToasts((s) => s.items);
  const remove = useToasts((s) => s.remove);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone} onClick={() => remove(t.id)}>
          {t.tone === "success" ? <CheckCircle2 /> : t.tone === "danger" ? <AlertCircle /> : <Info />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ État vide */
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg className="empty-art" viewBox="0 0 120 90" aria-hidden="true">
        <defs>
          <linearGradient id="eg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--hue-violet)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--hue-cyan)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <rect x="18" y="22" width="84" height="56" rx="12" fill="var(--surface-2)" stroke="var(--line-2)" />
        <rect x="28" y="34" width="38" height="6" rx="3" fill="var(--line-2)" />
        <rect x="28" y="46" width="58" height="6" rx="3" fill="var(--line)" />
        <rect x="28" y="58" width="28" height="6" rx="3" fill="var(--line)" />
        <circle cx="94" cy="20" r="11" fill="url(#eg)" />
        <circle cx="90" cy="16" r="3" fill="#fff" opacity="0.8" />
      </svg>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Notice({ tone, icon, children }: { tone?: "demo" | "danger" | "success"; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="notice" data-tone={tone}>
      {icon ?? <Info />}
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header reveal">
      <div className="stack gap-8 grow">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
