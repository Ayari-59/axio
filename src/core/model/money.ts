/**
 * Arithmétique monétaire.
 *
 * Règle du produit : on n'arrondit JAMAIS en cours de calcul (l'arrondi intermédiaire
 * fausse les répartitions), uniquement en sortie — et toute répartition conserve la masse
 * en affectant le résidu d'arrondi au dernier bénéficiaire.
 */

export const EPSILON = 0.005;

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundN(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Division protégée : retourne null au lieu de NaN/Infinity. */
export function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

/** Variation relative en %, null si la base est nulle. */
export function pctChange(current: number | null, previous: number | null): number | null {
  const r = safeDiv((current ?? 0) - (previous ?? 0), previous === null ? null : Math.abs(previous));
  return r === null ? null : r * 100;
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export type Weighted<T> = { key: T; weight: number };

/**
 * Répartit `amount` entre des bénéficiaires pondérés.
 * Garantit `Σ résultats === round2(amount)` : le résidu d'arrondi va au plus gros bénéficiaire.
 * Si la somme des poids est nulle, retourne une liste vide (le montant reste non affecté :
 * c'est un cas signalé par le contrôle qualité, jamais masqué).
 */
export function allocateProportional<T>(
  amount: number,
  weights: readonly Weighted<T>[],
): { key: T; amount: number; weight: number; weightTotal: number }[] {
  const positive = weights.filter((w) => Number.isFinite(w.weight) && w.weight > 0);
  const total = sum(positive.map((w) => w.weight));
  if (positive.length === 0 || total <= 0) return [];

  const raw = positive.map((w) => ({
    key: w.key,
    weight: w.weight,
    weightTotal: total,
    amount: round2((amount * w.weight) / total),
  }));

  const residual = round2(amount) - round2(sum(raw.map((r) => r.amount)));
  if (Math.abs(residual) >= 0.01) {
    let biggest = 0;
    for (let i = 1; i < raw.length; i += 1) {
      if (Math.abs(raw[i].amount) > Math.abs(raw[biggest].amount)) biggest = i;
    }
    raw[biggest].amount = round2(raw[biggest].amount + residual);
  }
  return raw;
}

/** Égalité monétaire à 1 centime près. */
export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
