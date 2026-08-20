import { round2 } from "../model/money";
import type { SeriesPoint } from "./forecast";

/**
 * Détection déterministe (docs/11 §2).
 * Aucune IA générative ici : des statistiques simples, robustes et explicables,
 * chaque détection portant sa preuve (fenêtre, seuil, valeur).
 */

export type Detection = {
  code: "OUTLIER" | "TREND_BREAK" | "DRIFT";
  periodCode: string;
  measure: string;
  value: number;
  expected: number;
  deviation: number;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  evidence: { method: string; window: number; threshold: number };
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Score z robuste fondé sur l'écart absolu médian (insensible aux valeurs extrêmes). */
export function detectOutliers(
  series: SeriesPoint[],
  measure: string,
  threshold = 3,
): Detection[] {
  if (series.length < 5) return [];
  const values = series.map((p) => p.value);
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  const mad = median(deviations);
  if (mad === 0) return [];

  const detections: Detection[] = [];
  for (const point of series) {
    const score = (0.6745 * (point.value - med)) / mad;
    if (Math.abs(score) < threshold) continue;
    detections.push({
      code: "OUTLIER",
      periodCode: point.periodCode,
      measure,
      value: round2(point.value),
      expected: round2(med),
      deviation: round2(score),
      severity: Math.abs(score) > threshold * 1.5 ? "CRITICAL" : "WARNING",
      message: `Valeur atypique sur ${point.periodCode} : ${round2(point.value)} contre une médiane de ${round2(med)}.`,
      evidence: { method: "z-score robuste (MAD)", window: series.length, threshold },
    });
  }
  return detections;
}

/** Comparaison de pentes entre deux fenêtres consécutives. */
export function detectTrendBreak(
  series: SeriesPoint[],
  measure: string,
  window = 3,
  threshold = 0.3,
): Detection[] {
  if (series.length < window * 2) return [];
  const recent = series.slice(-window);
  const previous = series.slice(-window * 2, -window);

  const avg = (points: SeriesPoint[]) => points.reduce((s, p) => s + p.value, 0) / points.length;
  const recentAvg = avg(recent);
  const previousAvg = avg(previous);
  if (previousAvg === 0) return [];

  const change = (recentAvg - previousAvg) / Math.abs(previousAvg);
  if (Math.abs(change) < threshold) return [];

  const last = series[series.length - 1];
  return [
    {
      code: "TREND_BREAK",
      periodCode: last.periodCode,
      measure,
      value: round2(recentAvg),
      expected: round2(previousAvg),
      deviation: round2(change * 100),
      severity: Math.abs(change) > threshold * 2 ? "CRITICAL" : "WARNING",
      message: `Rupture de tendance : moyenne des ${window} dernières périodes ${change > 0 ? "en hausse" : "en baisse"} de ${round2(Math.abs(change) * 100)} % par rapport aux ${window} précédentes.`,
      evidence: { method: "comparaison de moyennes glissantes", window, threshold: threshold * 100 },
    },
  ];
}

/** Dérive : deux mesures qui divergent durablement (par exemple coûts vs activité). */
export function detectDrift(
  driver: SeriesPoint[],
  driven: SeriesPoint[],
  measure: string,
  periods = 2,
  threshold = 10,
): Detection[] {
  if (driver.length < periods + 1 || driven.length < periods + 1) return [];

  const growth = (series: SeriesPoint[], length: number): number | null => {
    const last = series[series.length - 1]?.value;
    const base = series[series.length - 1 - length]?.value;
    if (base === undefined || base === 0 || last === undefined) return null;
    return ((last - base) / Math.abs(base)) * 100;
  };

  const driverGrowth = growth(driver, periods);
  const drivenGrowth = growth(driven, periods);
  if (driverGrowth === null || drivenGrowth === null) return [];

  const gap = drivenGrowth - driverGrowth;
  if (gap < threshold) return [];

  const last = driven[driven.length - 1];
  return [
    {
      code: "DRIFT",
      periodCode: last.periodCode,
      measure,
      value: round2(drivenGrowth),
      expected: round2(driverGrowth),
      deviation: round2(gap),
      severity: gap > threshold * 2 ? "CRITICAL" : "WARNING",
      message: `Les coûts progressent de ${round2(drivenGrowth)} % quand l'activité progresse de ${round2(driverGrowth)} % sur ${periods} périodes.`,
      evidence: { method: "écart de croissance", window: periods, threshold },
    },
  ];
}
