import { round2 } from "../model/money";

/**
 * Moteur de prévision (docs/09 backlog EPIC 9).
 * Six méthodes, sélection automatique par backtest (MAPE) et méthode imposable par l'utilisateur.
 * Fonctions pures : aucune dépendance à l'horloge système.
 */

export type SeriesPoint = { periodCode: string; value: number };

export const FORECAST_METHODS = [
  "naive",
  "moving_average",
  "linear_trend",
  "growth",
  "seasonal",
  "budget",
] as const;
export type ForecastMethod = (typeof FORECAST_METHODS)[number];

export const FORECAST_METHOD_LABELS: Record<ForecastMethod, string> = {
  naive: "Dernière valeur connue",
  moving_average: "Moyenne mobile (3 périodes)",
  linear_trend: "Tendance linéaire",
  growth: "Croissance moyenne",
  seasonal: "Tendance + saisonnalité",
  budget: "Budget",
};

export type ForecastResult = {
  method: ForecastMethod;
  points: SeriesPoint[];
  mape: number | null;
  candidates: { method: ForecastMethod; mape: number | null }[];
  reason: string;
};

export function nextPeriodCode(periodCode: string, step = 1): string {
  const [yearRaw, monthRaw] = periodCode.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return periodCode;
  const total = year * 12 + (month - 1) + step;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function project(series: SeriesPoint[], horizon: number, method: ForecastMethod): number[] {
  const values = series.map((p) => p.value);
  const n = values.length;
  if (n === 0) return Array.from({ length: horizon }, () => 0);

  switch (method) {
    case "naive": {
      const last = values[n - 1];
      return Array.from({ length: horizon }, () => last);
    }
    case "moving_average": {
      const window = Math.min(3, n);
      const avg = values.slice(n - window).reduce((s, v) => s + v, 0) / window;
      return Array.from({ length: horizon }, () => avg);
    }
    case "linear_trend": {
      const { slope, intercept } = ols(values);
      return Array.from({ length: horizon }, (_, i) => intercept + slope * (n + i));
    }
    case "growth": {
      const rates: number[] = [];
      for (let i = 1; i < n; i += 1) {
        if (values[i - 1] !== 0) rates.push(values[i] / values[i - 1] - 1);
      }
      const rate = rates.length ? rates.reduce((s, v) => s + v, 0) / rates.length : 0;
      const out: number[] = [];
      let current = values[n - 1];
      for (let i = 0; i < horizon; i += 1) {
        current = current * (1 + rate);
        out.push(current);
      }
      return out;
    }
    case "seasonal": {
      const cycle = 12;
      if (n < cycle + 2) return project(series, horizon, "linear_trend");
      const { slope, intercept } = ols(values);
      const indices = new Array(cycle).fill(0).map((_, position) => {
        const ratios: number[] = [];
        for (let i = position; i < n; i += cycle) {
          const trend = intercept + slope * i;
          if (trend !== 0) ratios.push(values[i] / trend);
        }
        return ratios.length ? ratios.reduce((s, v) => s + v, 0) / ratios.length : 1;
      });
      return Array.from({ length: horizon }, (_, i) => {
        const position = (n + i) % cycle;
        return (intercept + slope * (n + i)) * indices[position];
      });
    }
    case "budget":
      return Array.from({ length: horizon }, () => values[n - 1]);
  }
}

function ols(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

/** Erreur absolue moyenne en pourcentage, calculée sur un échantillon de validation. */
export function mape(actual: number[], predicted: number[]): number | null {
  const pairs = actual
    .map((value, i) => ({ value, predicted: predicted[i] }))
    .filter((p) => p.value !== 0 && Number.isFinite(p.predicted));
  if (pairs.length === 0) return null;
  const total = pairs.reduce((s, p) => s + Math.abs((p.value - p.predicted) / p.value), 0);
  return round2((total / pairs.length) * 100);
}

export function backtest(series: SeriesPoint[], method: ForecastMethod): number | null {
  const holdout = Math.min(3, Math.floor(series.length / 3));
  if (holdout < 1 || series.length - holdout < 2) return null;
  const train = series.slice(0, series.length - holdout);
  const test = series.slice(series.length - holdout);
  const predicted = project(train, holdout, method);
  return mape(
    test.map((p) => p.value),
    predicted,
  );
}

export function forecast(
  series: SeriesPoint[],
  horizon: number,
  requested?: ForecastMethod,
): ForecastResult {
  const usable = series.filter((p) => Number.isFinite(p.value));
  const candidates = (["naive", "moving_average", "linear_trend", "growth", "seasonal"] as ForecastMethod[])
    .map((method) => ({ method, mape: backtest(usable, method) }))
    .sort((a, b) => (a.mape ?? Number.POSITIVE_INFINITY) - (b.mape ?? Number.POSITIVE_INFINITY));

  const best = candidates.find((c) => c.mape !== null)?.method ?? "naive";
  const method = requested ?? best;
  const values = project(usable, horizon, method);
  const lastPeriod = usable.length > 0 ? usable[usable.length - 1].periodCode : "";

  const points = values.map((value, i) => ({
    periodCode: nextPeriodCode(lastPeriod, i + 1),
    value: round2(value),
  }));

  const selected = candidates.find((c) => c.method === method);

  return {
    method,
    points,
    mape: selected?.mape ?? null,
    candidates,
    reason: requested
      ? "Méthode imposée par l'utilisateur."
      : selected?.mape === null || selected?.mape === undefined
        ? "Historique trop court pour départager les méthodes : repli sur la dernière valeur connue."
        : `Méthode retenue automatiquement : erreur de backtest la plus faible (${selected.mape} %).`,
  };
}
