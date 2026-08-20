import Link from "next/link";
import type { ReactNode } from "react";

/** Primitives d'interface partagées. Aucune logique métier ici. */

export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle && <p className="muted text-xs mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="muted text-sm mt-1 max-w-3xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
  good: "bg-good-100 text-good-500",
  warn: "bg-warn-100 text-warn-500",
  bad: "bg-bad-100 text-bad-500",
  brand: "bg-brand-100 text-brand-700",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  delta,
  hint,
  tone = "neutral",
  footer,
}: {
  label: string;
  value: string;
  delta?: string | null;
  hint?: string;
  tone?: Tone;
  footer?: ReactNode;
}) {
  const deltaTone =
    delta === null || delta === undefined
      ? "muted"
      : delta.startsWith("+")
        ? "text-good-500"
        : delta.startsWith("-")
          ? "text-bad-500"
          : "muted";

  return (
    <div className="card p-4">
      <p className="muted text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular">{value}</p>
      <div className="flex items-center gap-2 mt-1 text-xs">
        {delta && <span className={deltaTone}>{delta}</span>}
        {hint && <span className="muted">{hint}</span>}
        {tone !== "neutral" && (
          <Badge tone={tone}>{tone === "good" ? "objectif atteint" : tone === "warn" ? "vigilance" : "alerte"}</Badge>
        )}
      </div>
      {footer}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "submit",
  disabled,
  name,
  value,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "submit" | "button" | "reset";
  disabled?: boolean;
  name?: string;
  value?: string;
  className?: string;
}) {
  return (
    <button type={type} disabled={disabled} name={name} value={value} className={`${buttonClass(variant)} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "secondary",
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

function buttonClass(variant: "primary" | "secondary" | "ghost" | "danger"): string {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap";
  switch (variant) {
    case "primary":
      return `${base} bg-brand-600 text-white hover:bg-brand-700`;
    case "danger":
      return `${base} bg-bad-500 text-white hover:opacity-90`;
    case "ghost":
      return `${base} hover:bg-ink-100 dark:hover:bg-ink-800`;
    default:
      return `${base} border hover:bg-ink-50 dark:hover:bg-ink-800`;
  }
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="muted block text-xs mt-1">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="muted text-sm mt-1 max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Table({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} className={index === 0 ? "" : "text-right"}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Num({ children, tone }: { children: ReactNode; tone?: "good" | "bad" | "muted" }) {
  const cls = tone === "good" ? "text-good-500" : tone === "bad" ? "text-bad-500" : tone === "muted" ? "muted" : "";
  return <span className={`tabular ${cls}`}>{children}</span>;
}

export function Callout({ children, tone = "brand" }: { children: ReactNode; tone?: Tone }) {
  const bg =
    tone === "bad"
      ? "bg-bad-100 text-bad-500"
      : tone === "warn"
        ? "bg-warn-100 text-warn-500"
        : tone === "good"
          ? "bg-good-100 text-good-500"
          : "bg-brand-50 text-brand-800";
  return <div className={`rounded-lg px-4 py-3 text-sm ${bg}`}>{children}</div>;
}

export function Explain({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term}>
          <dt className="text-xs font-semibold uppercase tracking-wide muted">{item.term}</dt>
          <dd className="text-sm mt-0.5">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
