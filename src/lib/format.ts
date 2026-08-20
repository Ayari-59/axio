/** Formats d'affichage — un seul endroit pour toute l'interface. */

const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const num0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function money(value: number | null | undefined, precise = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return precise ? eur2.format(value) : eur0.format(value);
}

export function moneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${num1.format(value / 1_000_000)} M€`;
  if (abs >= 10_000) return `${num0.format(value / 1000)} k€`;
  return eur0.format(value);
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${digits === 0 ? num0.format(value) : num1.format(value)} %`;
}

export function signedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${num1.format(value)} %`;
}

export function signedMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${eur0.format(value)}`;
}

export function quantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return num2.format(value);
}

export function kpiValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  switch (unit) {
    case "EUR":
      return moneyCompact(value);
    case "PCT":
      return percent(value);
    case "RATIO":
      return num2.format(value);
    case "DAYS":
      return `${num0.format(value)} j`;
    case "HOURS":
      return `${num0.format(value)} h`;
    default:
      return num2.format(value);
  }
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function periodLabel(code: string): string {
  const [year, month] = code.split("-");
  const index = Number(month) - 1;
  if (!Number.isFinite(index) || index < 0 || index > 11) return code;
  return `${MONTHS[index]} ${year}`;
}

export function periodShort(code: string): string {
  const [year, month] = code.split("-");
  const index = Number(month) - 1;
  if (!Number.isFinite(index) || index < 0 || index > 11) return code;
  return `${MONTHS[index].slice(0, 3)} ${year.slice(2)}`;
}

export function dateLabel(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}
