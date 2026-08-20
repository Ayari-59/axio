import { round2, safeDiv, sum } from "../model/money";
import { computeMeasures, memberLabel } from "../model/dataset";
import type { Dataset } from "../model/types";

/**
 * Attribution : passer du « combien » au « qui » (docs/08 §5).
 * Classe les membres d'un axe par contribution à l'écart d'une mesure entre deux périmètres,
 * et produit une synthèse déterministe (aucun modèle de langage n'intervient ici).
 */

export type Contributor = {
  memberCode: string;
  memberLabel: string;
  current: number;
  reference: number;
  delta: number;
  share: number;
  cumulativeShare: number;
};

export type AttributionResult = {
  measure: string;
  dimensionCode: string;
  current: number;
  reference: number;
  delta: number;
  deltaPct: number | null;
  contributors: Contributor[];
  /** Membres expliquant `explainThreshold` % de l'écart. */
  principal: Contributor[];
  headline: string;
};

export type AttributionOptions = {
  measure: string;
  dimensionCode: string;
  currentPeriods: string[];
  referencePeriods: string[];
  explainThreshold?: number;
  maxContributors?: number;
};

export function attribute(dataset: Dataset, options: AttributionOptions): AttributionResult {
  const {
    measure,
    dimensionCode,
    currentPeriods,
    referencePeriods,
    explainThreshold = 80,
    maxContributors = 8,
  } = options;

  const members = dataset.members.filter((m) => m.dimensionCode === dimensionCode);
  const contributors: Contributor[] = [];

  for (const member of members) {
    const filter = {
      dimensionFilters: [{ dimensionCode, memberCodes: [member.code] }],
    };
    const current = computeMeasures(dataset, { periodCodes: currentPeriods, filter })[measure] ?? 0;
    const reference =
      computeMeasures(dataset, { periodCodes: referencePeriods, filter })[measure] ?? 0;
    if (current === 0 && reference === 0) continue;
    contributors.push({
      memberCode: member.code,
      memberLabel: memberLabel(dataset, dimensionCode, member.code),
      current: round2(current),
      reference: round2(reference),
      delta: round2(current - reference),
      share: 0,
      cumulativeShare: 0,
    });
  }

  const totalCurrent = computeMeasures(dataset, { periodCodes: currentPeriods })[measure] ?? 0;
  const totalReference = computeMeasures(dataset, { periodCodes: referencePeriods })[measure] ?? 0;
  const delta = totalCurrent - totalReference;

  contributors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const absTotal = sum(contributors.map((c) => Math.abs(c.delta)));
  let cumulative = 0;
  for (const contributor of contributors) {
    contributor.share = absTotal > 0 ? round2((Math.abs(contributor.delta) / absTotal) * 100) : 0;
    cumulative += contributor.share;
    contributor.cumulativeShare = round2(cumulative);
  }

  const principal: Contributor[] = [];
  for (const contributor of contributors) {
    principal.push(contributor);
    if (contributor.cumulativeShare >= explainThreshold || principal.length >= maxContributors) break;
  }

  const deltaPct = safeDiv(delta, totalReference === 0 ? null : Math.abs(totalReference));

  return {
    measure,
    dimensionCode,
    current: round2(totalCurrent),
    reference: round2(totalReference),
    delta: round2(delta),
    deltaPct: deltaPct === null ? null : round2(deltaPct * 100),
    contributors: contributors.slice(0, maxContributors * 3),
    principal,
    headline: buildHeadline(principal, delta),
  };
}

function buildHeadline(principal: Contributor[], delta: number): string {
  if (principal.length === 0 || delta === 0) return "Aucun contributeur significatif identifié.";
  const share = principal[principal.length - 1]?.cumulativeShare ?? 0;
  const sharePct = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(share);
  const names = principal
    .slice(0, 3)
    .map((c) => `${c.memberLabel} (${formatSigned(c.delta)})`)
    .join(", ");
  const word = principal.length === 1 ? "contributeur explique" : "contributeurs expliquent";
  return `${principal.length} ${word} ${sharePct} % de la variation : ${names}.`;
}

function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} €`;
}
