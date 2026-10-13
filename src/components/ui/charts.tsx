/** Graphiques SVG légers, intégrés au design (pas de bibliothèque externe). */
import { useId, useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
  secondary?: number;
  demo?: boolean;
}

export function BarChart({
  data,
  format,
  color = "var(--hue-violet)",
  secondaryColor = "var(--hue-green)",
  secondaryLabel,
  primaryLabel,
  height = 200,
}: {
  data: BarDatum[];
  format: (n: number) => string;
  color?: string;
  secondaryColor?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)));
  const W = 100;
  const gap = 100 / data.length;
  const bw = Math.min(gap * 0.5, 9);
  const ticks = [0, 0.5, 1];

  return (
    <div className="chart" style={{ height }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" className="chart-svg" style={{ height: height - 28 }} role="img" aria-label={`${primaryLabel} par mois`}>
        <defs>
          <linearGradient id={`b${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="1" />
            <stop offset="1" stopColor={color} stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id={`s${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={secondaryColor} stopOpacity="1" />
            <stop offset="1" stopColor={secondaryColor} stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <line key={t} x1="0" x2={W} y1={92 - t * 84} y2={92 - t * 84} stroke="var(--line)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const cx = gap * i + gap / 2;
          const h = (d.value / max) * 84;
          const h2 = ((d.secondary ?? 0) / max) * 84;
          const dim = hover !== null && hover !== i;
          return (
            <g key={d.label} opacity={dim ? 0.4 : 1} style={{ transition: "opacity .2s" }}>
              {secondaryLabel ? (
                <>
                  <rect x={cx - bw - 0.4} y={92 - h} width={bw} height={Math.max(h, 0.6)} rx="1.2" fill={`url(#b${id})`} />
                  <rect x={cx + 0.4} y={92 - h2} width={bw} height={Math.max(h2, 0.6)} rx="1.2" fill={`url(#s${id})`} />
                </>
              ) : (
                <rect x={cx - bw / 2} y={92 - h} width={bw} height={Math.max(h, 0.6)} rx="1.2" fill={`url(#b${id})`} />
              )}
              <rect x={gap * i} y="0" width={gap} height="100" fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      <div className="chart-x">
        {data.map((d, i) => (
          <span key={d.label} data-active={hover === i}>
            {d.label}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${Math.min(80, Math.max(20, gap * hover + gap / 2))}%` }}>
          <strong>{data[hover].label}</strong>
          <span>
            <i style={{ background: color }} /> {primaryLabel} : {format(data[hover].value)}
          </span>
          {secondaryLabel && (
            <span>
              <i style={{ background: secondaryColor }} /> {secondaryLabel} : {format(data[hover].secondary ?? 0)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, color = "var(--hue-violet)", height = 36 }: { values: number[]; color?: string; height?: number }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 34 - (v / max) * 30] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ width: "100%", height }} aria-hidden="true">
      <defs>
        <linearGradient id={`sp${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,36 L0,36 Z`} fill={`url(#sp${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Ring({ value, max, size = 64, stroke = 7, color = "var(--hue-violet)", children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .8s var(--ease-out)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}
