import { round2 } from "../model/money";
import type { Dataset } from "../model/types";

/**
 * Data Quality Engine (docs/14 EPIC 4).
 * Chaque contrôle est une fonction pure qui retourne les lignes concernées : l'utilisateur
 * peut donc toujours voir *quelles* écritures posent problème, jamais un score opaque.
 */

export type QualityIssue = {
  code: string;
  label: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  count: number;
  /** Poids dans le score global (somme des poids = 100). */
  weight: number;
  affectedIds: string[];
  detail: string;
  fix: string;
};

export type QualityReport = {
  score: number;
  issues: QualityIssue[];
  entryCount: number;
  confidence: "high" | "medium" | "low";
};

type CheckContext = {
  dataset: Dataset;
  requiredDrivers?: string[];
};

type Check = {
  code: string;
  label: string;
  severity: QualityIssue["severity"];
  weight: number;
  fix: string;
  run: (context: CheckContext) => { ids: string[]; detail?: string };
};

const CHECKS: Check[] = [
  {
    code: "unallocated_direct_cost",
    label: "Charges directes sans objet de coût",
    severity: "CRITICAL",
    weight: 18,
    fix: "Complétez la colonne d'axe lors de l'import, ou reclassez ces charges en indirectes.",
    run: ({ dataset }) => {
      const objectDims = dataset.dimensions.filter((d) => d.isCostObject).map((d) => d.code);
      if (objectDims.length === 0) return { ids: [] };
      const ids = dataset.entries
        .filter(
          (e) =>
            e.kind === "COST" &&
            e.traceability === "DIRECT" &&
            !objectDims.some((code) => e.dims[code]),
        )
        .map((e) => e.id);
      return { ids };
    },
  },
  {
    code: "cost_without_center",
    label: "Charges indirectes sans centre",
    severity: "WARNING",
    weight: 12,
    fix: "Affectez un centre, ou vérifiez la règle de répartition par défaut.",
    run: ({ dataset }) => ({
      ids: dataset.entries
        .filter((e) => e.kind === "COST" && e.traceability === "INDIRECT" && !e.dims.CENTER)
        .map((e) => e.id),
    }),
  },
  {
    code: "missing_nature",
    label: "Écritures sans nature",
    severity: "WARNING",
    weight: 10,
    fix: "Mappez la colonne de nature, ou complétez les comptes du plan comptable.",
    run: ({ dataset }) => ({
      ids: dataset.entries.filter((e) => e.kind === "COST" && !e.dims.NATURE).map((e) => e.id),
    }),
  },
  {
    code: "duplicate_entry",
    label: "Doublons probables",
    severity: "WARNING",
    weight: 12,
    fix: "Vérifiez les imports successifs : un même fichier importé deux fois crée ces doublons.",
    run: ({ dataset }) => {
      const seen = new Map<string, string[]>();
      for (const entry of dataset.entries) {
        const key = [
          entry.periodCode,
          entry.kind,
          entry.amount.toFixed(2),
          entry.label.trim().toLowerCase(),
          JSON.stringify(entry.dims),
        ].join("|");
        seen.set(key, [...(seen.get(key) ?? []), entry.id]);
      }
      const ids: string[] = [];
      for (const group of seen.values()) if (group.length > 1) ids.push(...group.slice(1));
      return { ids };
    },
  },
  {
    code: "missing_period",
    label: "Périodes manquantes",
    severity: "WARNING",
    weight: 10,
    fix: "Importez les périodes absentes : les tendances et la saisonnalité en dépendent.",
    run: ({ dataset }) => {
      const codes = dataset.periods.map((p) => p.code).sort();
      if (codes.length < 2) return { ids: [] };
      const withEntries = new Set(dataset.entries.map((e) => e.periodCode));
      const missing = codes.filter((code) => !withEntries.has(code));
      return { ids: missing, detail: missing.join(", ") };
    },
  },
  {
    code: "unknown_member",
    label: "Membres inconnus référencés",
    severity: "CRITICAL",
    weight: 10,
    fix: "Créez les membres manquants ou corrigez le mapping d'import.",
    run: ({ dataset }) => {
      const known = new Set(dataset.members.map((m) => `${m.dimensionCode}|${m.code}`));
      const ids: string[] = [];
      for (const entry of dataset.entries) {
        for (const [dimensionCode, memberCode] of Object.entries(entry.dims)) {
          if (!known.has(`${dimensionCode}|${memberCode}`)) {
            ids.push(entry.id);
            break;
          }
        }
      }
      return { ids };
    },
  },
  {
    code: "missing_quantity",
    label: "Ventes sans quantité ni prix unitaire",
    severity: "INFO",
    weight: 8,
    fix: "Sans quantité ni prix, l'écart de marge ne peut pas être décomposé en prix / volume / mix.",
    run: ({ dataset }) => ({
      ids: dataset.entries
        .filter((e) => e.kind === "REVENUE" && (!e.quantity || !e.unitPrice))
        .map((e) => e.id),
    }),
  },
  {
    code: "negative_amount",
    label: "Montants négatifs",
    severity: "INFO",
    weight: 6,
    fix: "Vérifiez le sens des avoirs et des extournes : le sens est porté par le type d'écriture.",
    run: ({ dataset }) => ({
      ids: dataset.entries.filter((e) => e.amount < 0).map((e) => e.id),
    }),
  },
  {
    code: "amount_outlier",
    label: "Montants aberrants",
    severity: "INFO",
    weight: 6,
    fix: "Contrôlez ces écritures : erreur de saisie ou opération exceptionnelle à isoler.",
    run: ({ dataset }) => {
      const costs = dataset.entries.filter((e) => e.kind === "COST");
      if (costs.length < 20) return { ids: [] };
      const values = costs.map((e) => e.amount).sort((a, b) => a - b);
      const med = values[Math.floor(values.length / 2)];
      const deviations = values.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
      const mad = deviations[Math.floor(deviations.length / 2)];
      if (mad === 0) return { ids: [] };
      return {
        ids: costs.filter((e) => Math.abs((0.6745 * (e.amount - med)) / mad) > 6).map((e) => e.id),
      };
    },
  },
  {
    code: "missing_driver",
    label: "Inducteurs attendus non renseignés",
    severity: "WARNING",
    weight: 8,
    fix: "Saisissez ou importez ces données statistiques : plusieurs indicateurs en dépendent.",
    run: ({ dataset, requiredDrivers }) => {
      if (!requiredDrivers || requiredDrivers.length === 0) return { ids: [] };
      const present = new Set(dataset.drivers.map((d) => d.driverCode));
      const missing = requiredDrivers.filter((code) => !present.has(code));
      return { ids: missing, detail: missing.join(", ") };
    },
  },
];

export function runQualityChecks(
  dataset: Dataset,
  options: { requiredDrivers?: string[] } = {},
): QualityReport {
  const issues: QualityIssue[] = [];
  const entryCount = dataset.entries.length;
  let penalty = 0;

  for (const check of CHECKS) {
    const { ids, detail } = check.run({ dataset, requiredDrivers: options.requiredDrivers });
    if (ids.length === 0) continue;

    // Pénalité proportionnelle à la part d'écritures touchées, plafonnée au poids du contrôle.
    const ratio =
      check.code === "missing_period" || check.code === "missing_driver"
        ? Math.min(1, ids.length / 6)
        : entryCount === 0
          ? 0
          : Math.min(1, ids.length / entryCount);
    penalty += check.weight * ratio;

    issues.push({
      code: check.code,
      label: check.label,
      severity: check.severity,
      count: ids.length,
      weight: check.weight,
      affectedIds: ids.slice(0, 200),
      detail: detail ?? `${ids.length} élément(s) concerné(s).`,
      fix: check.fix,
    });
  }

  const score = entryCount === 0 ? 0 : Math.max(0, round2(100 - penalty));
  return {
    score,
    issues: issues.sort((a, b) => b.weight * b.count - a.weight * a.count),
    entryCount,
    confidence: score >= 85 ? "high" : score >= 70 ? "medium" : "low",
  };
}

export const QUALITY_CHECK_CODES = CHECKS.map((c) => c.code);
