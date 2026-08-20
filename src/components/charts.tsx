import { moneyCompact, percent, periodShort } from "@/lib/format";

/**
 * Graphiques en SVG, sans dépendance externe (docs/02 §2) :
 * maîtrise totale du rendu, du thème clair/sombre et de la taille du bundle.
 */

const BRAND = "var(--color-brand-500)";
const GOOD = "var(--color-good-500)";
const BAD = "var(--color-bad-500)";
const MUTED = "var(--text-muted)";

export function Sparkline({
  points,
  height = 48,
  showAxis = true,
}: {
  points: { periodCode: string; value: number | null }[];
  height?: number;
  showAxis?: boolean;
}) {
  const usable = points.filter((p) => p.value !== null) as { periodCode: string; value: number }[];
  if (usable.length < 2) return <p className="muted text-xs">Historique insuffisant.</p>;

  const width = 100;
  const values = usable.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = usable.map((point, index) => ({
    x: (index / (usable.length - 1)) * width,
    y: height - ((point.value - min) / span) * (height - 6) - 3,
  }));

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];
  const rising = values[values.length - 1] >= values[0];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <path d={area} fill={rising ? "var(--color-good-100)" : "var(--color-bad-100)"} opacity="0.55" />
      <path d={path} fill="none" stroke={rising ? GOOD : BAD} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r="1.8" fill={rising ? GOOD : BAD} />
      {showAxis && <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke={MUTED} strokeWidth="0.4" opacity="0.4" />}
    </svg>
  );
}

export function TrendChart({
  points,
  label,
  format = "money",
}: {
  points: { periodCode: string; value: number | null }[];
  label?: string;
  format?: "money" | "percent";
}) {
  const usable = points.filter((p) => p.value !== null) as { periodCode: string; value: number }[];
  if (usable.length < 2) return <p className="muted text-sm">Historique insuffisant pour tracer une tendance.</p>;

  const values = usable.map((p) => p.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  return (
    <div>
      {label && <p className="muted text-xs mb-2">{label}</p>}
      <div className="flex items-end gap-1 h-32">
        {usable.map((point) => {
          const heightPct = ((point.value - min) / span) * 100;
          return (
            <div key={point.periodCode} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <span className="text-[10px] muted tabular">
                {format === "money" ? moneyCompact(point.value) : percent(point.value, 0)}
              </span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(2, heightPct)}%`,
                  background: point.value >= 0 ? BRAND : BAD,
                  opacity: 0.85,
                }}
              />
              <span className="text-[10px] muted whitespace-nowrap">{periodShort(point.periodCode)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BarList({
  items,
  format = "money",
  emptyLabel = "Aucune donnée.",
}: {
  items: { label: string; value: number; secondary?: string; href?: string }[];
  format?: "money" | "percent";
  emptyLabel?: string;
}) {
  if (items.length === 0) return <p className="muted text-sm">{emptyLabel}</p>;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const width = (Math.abs(item.value) / max) * 100;
        const negative = item.value < 0;
        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className={`tabular ${negative ? "text-bad-500" : ""}`}>
                {format === "money" ? moneyCompact(item.value) : percent(item.value)}
                {item.secondary && <span className="muted ml-2 text-xs">{item.secondary}</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full" style={{ background: "var(--surface-muted)" }}>
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${width}%`, background: negative ? BAD : BRAND }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type WaterfallStep = { label: string; value: number; kind: "start" | "delta" | "end" };

export function Waterfall({ steps }: { steps: WaterfallStep[] }) {
  if (steps.length === 0) return <p className="muted text-sm">Aucune décomposition disponible.</p>;

  let running = 0;
  const bars = steps.map((step) => {
    if (step.kind === "start") {
      running = step.value;
      return { ...step, from: 0, to: step.value };
    }
    if (step.kind === "end") return { ...step, from: 0, to: step.value };
    const from = running;
    running += step.value;
    return { ...step, from, to: running };
  });

  const maxValue = Math.max(...bars.map((b) => Math.max(b.from, b.to)), 1);

  return (
    <div className="space-y-2">
      {bars.map((bar) => {
        const low = Math.min(bar.from, bar.to);
        const high = Math.max(bar.from, bar.to);
        const left = (low / maxValue) * 100;
        const width = Math.max(0.8, ((high - low) / maxValue) * 100);
        const isTotal = bar.kind !== "delta";
        const color = isTotal ? BRAND : bar.value >= 0 ? GOOD : BAD;
        return (
          <div key={bar.label} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3">
            <span className={`text-sm truncate ${isTotal ? "font-medium" : ""}`}>{bar.label}</span>
            <div className="h-5 relative rounded" style={{ background: "var(--surface-muted)" }}>
              <div
                className="absolute top-0 h-5 rounded"
                style={{ left: `${isTotal ? 0 : left}%`, width: `${isTotal ? (bar.to / maxValue) * 100 : width}%`, background: color, opacity: isTotal ? 0.9 : 0.8 }}
              />
            </div>
            <span className={`text-sm tabular text-right ${bar.value < 0 && !isTotal ? "text-bad-500" : ""}`}>
              {bar.kind === "delta" && bar.value > 0 ? "+" : ""}
              {moneyCompact(bar.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CascadeBar({
  rows,
}: {
  rows: { label: string; value: number; emphasis?: boolean; hint?: string }[];
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[12rem_1fr_7rem] items-center gap-3">
          <span className={`text-sm ${row.emphasis ? "font-semibold" : "muted"}`}>{row.label}</span>
          <div className="h-4 rounded" style={{ background: "var(--surface-muted)" }}>
            <div
              className="h-4 rounded"
              style={{
                width: `${(Math.abs(row.value) / max) * 100}%`,
                background: row.value < 0 ? BAD : row.emphasis ? BRAND : "var(--color-brand-300)",
              }}
            />
          </div>
          <div className="text-right">
            <span className={`text-sm tabular ${row.value < 0 ? "text-bad-500" : ""}`}>{moneyCompact(row.value)}</span>
            {row.hint && <span className="muted block text-[11px]">{row.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "good" | "warn" | "bad" }) {
  const color = tone === "good" ? GOOD : tone === "bad" ? BAD : tone === "warn" ? "var(--color-warn-500)" : BRAND;
  return (
    <div className="h-2 rounded-full w-full" style={{ background: "var(--surface-muted)" }}>
      <div
        className="h-2 rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function BreakEvenChart({
  revenue,
  breakEven,
}: {
  revenue: number;
  breakEven: number | null;
}) {
  if (breakEven === null || breakEven <= 0) {
    return <p className="muted text-sm">Seuil non calculable : la marge sur coûts variables est nulle ou négative.</p>;
  }
  const max = Math.max(revenue, breakEven) * 1.15;
  const revenueWidth = (revenue / max) * 100;
  const breakEvenPosition = (breakEven / max) * 100;
  const reached = revenue >= breakEven;

  return (
    <div>
      <div className="relative h-10 rounded" style={{ background: "var(--surface-muted)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{ width: `${revenueWidth}%`, background: reached ? GOOD : BAD, opacity: 0.85 }}
        />
        <div className="absolute inset-y-0" style={{ left: `${breakEvenPosition}%`, borderLeft: `2px dashed ${MUTED}` }} />
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="muted">
          Activité <span className="tabular">{moneyCompact(revenue)}</span>
        </span>
        <span className="muted">
          Seuil <span className="tabular">{moneyCompact(breakEven)}</span>
        </span>
      </div>
    </div>
  );
}
