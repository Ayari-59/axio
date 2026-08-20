import { round2 } from "../model/money";
import type { AttributionResult } from "../budget/attribution";
import type { KpiResult } from "../kpi/engine";
import type { PvmResult } from "../budget/variance";

/**
 * Formulation locale (docs/11 §4, mode `AI_PROVIDER=local`).
 * Gabarits déterministes : mêmes chiffres, même phrase. Aucune dépendance externe.
 */

const eur = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatEur(value: number | null): string {
  if (value === null) return "n/d";
  return `${eur.format(round2(value))} €`;
}

export function formatSignedEur(value: number | null): string {
  if (value === null) return "n/d";
  return `${value > 0 ? "+" : ""}${eur.format(round2(value))} €`;
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null) return "n/d";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(round2(value))} %`;
}

export function formatSignedPct(value: number | null): string {
  if (value === null) return "n/d";
  return `${value > 0 ? "+" : ""}${pct.format(round2(value))} %`;
}

/** « −2,4 point » / « +1,1 point » : un écart de taux se lit en points, pas en pourcents. */
export function formatSignedPoints(value: number | null): string {
  if (value === null) return "n/d";
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(round2(value));
  const plural = Math.abs(value) >= 2 ? "points" : "point";
  return `${value > 0 ? "+" : ""}${formatted} ${plural}`;
}

export function narrateAttribution(result: AttributionResult, measureLabel: string): string {
  if (result.delta === 0) {
    return `${measureLabel} est stable par rapport à la période de référence.`;
  }
  const direction = result.delta < 0 ? "recule" : "progresse";
  const first = `${measureLabel} ${direction} de ${formatSignedEur(result.delta)} (${formatSignedPct(result.deltaPct)}), passant de ${formatEur(result.reference)} à ${formatEur(result.current)}.`;
  return `${first} ${result.headline}`;
}

export function narrateDecomposition(pvm: PvmResult, label = "L'écart"): string {
  const parts = [
    { name: "prix", value: pvm.price },
    { name: "volume", value: pvm.volume },
    { name: "composition", value: pvm.mix },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const dominant = parts[0];
  const detail = parts.map((p) => `${p.name} ${formatSignedEur(p.value)}`).join(" · ");
  return `${label} de ${formatSignedEur(pvm.total)} se décompose en ${detail}. La composante dominante est l'effet ${dominant.name}.`;
}

export function narrateKpi(kpi: KpiResult): string {
  if (kpi.status === "missing_data") {
    return `${kpi.name} n'est pas calculable : il manque ${kpi.missingMeasures.join(", ")}.`;
  }
  if (kpi.value === null) return `${kpi.name} n'est pas disponible sur cette période.`;

  const value = kpi.unit === "PCT" ? formatPct(kpi.value) : kpi.unit === "EUR" ? formatEur(kpi.value) : String(kpi.value);
  const evolution =
    kpi.deltaPct === null
      ? ""
      : ` (${formatSignedPct(kpi.deltaPct)} par rapport à la période précédente)`;
  const target =
    kpi.target === null
      ? ""
      : ` La cible est de ${kpi.unit === "PCT" ? formatPct(kpi.target) : formatEur(kpi.target)}.`;
  return `${kpi.name} s'établit à ${value}${evolution}.${target}`;
}

export type CommentaryInput = {
  periodLabel: string;
  revenue: number;
  revenueDeltaPct: number | null;
  marginRate: number | null;
  marginRateDeltaPts: number | null;
  attribution?: AttributionResult | null;
  topAlert?: { title: string; message: string } | null;
  breakEven?: { breakEven: number | null; safetyMarginRate: number | null } | null;
};

/** Commentaire de gestion mensuel — gabarit local (docs/14 story 10.8). */
export function buildCommentary(input: CommentaryInput): string {
  const sentences: string[] = [];

  sentences.push(
    `Sur ${input.periodLabel}, le chiffre d'affaires atteint ${formatEur(input.revenue)}${
      input.revenueDeltaPct === null ? "" : ` (${formatSignedPct(input.revenueDeltaPct)})`
    }.`,
  );

  if (input.marginRate !== null) {
    const move =
      input.marginRateDeltaPts === null
        ? ""
        : ` soit ${formatSignedPoints(input.marginRateDeltaPts)} par rapport à la période précédente`;
    sentences.push(`Le taux de marge sur coûts variables s'établit à ${formatPct(input.marginRate)}${move}.`);
  }

  if (input.attribution && input.attribution.principal.length > 0) {
    sentences.push(input.attribution.headline);
  }

  if (input.breakEven?.breakEven !== null && input.breakEven?.breakEven !== undefined) {
    sentences.push(
      `Le seuil de rentabilité de la période ressort à ${formatEur(input.breakEven.breakEven)}${
        input.breakEven.safetyMarginRate === null
          ? ""
          : `, soit une marge de sécurité de ${formatPct(input.breakEven.safetyMarginRate)}`
      }.`,
    );
  }

  if (input.topAlert) {
    sentences.push(`Point de vigilance : ${input.topAlert.title.toLowerCase()} — ${input.topAlert.message}`);
  }

  return sentences.join(" ");
}

/**
 * Garde-fou anti-hallucination (docs/11 §4).
 * Extrait tous les nombres d'une réponse rédigée et vérifie qu'ils figurent dans le contexte
 * transmis au modèle. Toute réponse contenant un chiffre inventé est rejetée.
 */
export function verifyNumbers(
  answer: string,
  allowed: number[],
  tolerance = 0.05,
): { ok: boolean; offending: number[] } {
  const normalized = answer.replace(/[  ]/g, " ");
  const found = [...normalized.matchAll(/-?\d[\d  ]*(?:[.,]\d+)?/g)]
    .map((m) => Number(m[0].replace(/[\s  ]/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n));

  const allowedSet = allowed.map((a) => Math.abs(a));
  const offending = found.filter((value) => {
    const absolute = Math.abs(value);
    if (absolute <= 100 && Number.isInteger(absolute)) return false; // petits entiers (rangs, comptages)
    return !allowedSet.some((candidate) => {
      if (candidate === 0) return absolute === 0;
      const diff = Math.abs(candidate - absolute);
      return diff <= Math.max(1, Math.abs(candidate) * tolerance);
    });
  });

  return { ok: offending.length === 0, offending };
}

/** Nombres autorisés extraits d'un contexte structuré (récursif). */
export function collectNumbers(value: unknown, acc: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    acc.push(value);
    acc.push(round2(value));
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectNumbers(item, acc);
  }
  return acc;
}
