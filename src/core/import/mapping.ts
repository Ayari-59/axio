import { detectColumnType, parseDate, parseNumber, periodCodeFromDate } from "./csv";
import type { CostBehavior, Traceability } from "../model/enums";
import type { CoreDimension } from "../model/types";
import { DIMENSION_SYNONYMS } from "../templates/vocabulary";

/**
 * Profilage des colonnes et mapping assisté (docs/12 P4, docs/13 W3).
 * Le score de confiance est affiché à l'utilisateur : l'outil propose, l'utilisateur valide.
 */

export type ColumnProfile = {
  name: string;
  index: number;
  type: "date" | "number" | "text" | "empty";
  fillRate: number;
  distinctCount: number;
  samples: string[];
};

export type MappingTarget =
  | "ignore"
  | "date"
  | "amount"
  | "quantity"
  | "unitPrice"
  | "label"
  | "account"
  | "kind"
  | "behavior"
  | "traceability"
  | `dimension:${string}`;

export type MappingSuggestion = {
  column: string;
  index: number;
  target: MappingTarget;
  confidence: number;
  reason: string;
};

export type ImportMapping = {
  columns: { column: string; index: number; target: MappingTarget }[];
  defaults: {
    kind?: "REVENUE" | "COST";
    behavior?: "FIXED" | "VARIABLE" | "SEMI_VARIABLE";
    traceability?: "DIRECT" | "INDIRECT";
  };
  createMissingMembers: boolean;
};

export function profileColumns(headers: string[], rows: string[][]): ColumnProfile[] {
  return headers.map((name, index) => {
    const values = rows.map((row) => row[index] ?? "");
    const filled = values.filter((v) => String(v).trim() !== "");
    return {
      name,
      index,
      type: detectColumnType(values.slice(0, 200)),
      fillRate: values.length === 0 ? 0 : Math.round((filled.length / values.length) * 100),
      distinctCount: new Set(filled.map((v) => v.trim())).size,
      samples: [...new Set(filled.map((v) => v.trim()))].slice(0, 5),
    };
  });
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim();

/** Dictionnaire de reconnaissance : purement lexical, extensible sans redéploiement. */
const KEYWORDS: { target: MappingTarget; words: string[]; type?: ColumnProfile["type"] }[] = [
  { target: "date", words: ["date", "date facture", "date piece", "jour", "periode"], type: "date" },
  {
    target: "amount",
    words: ["montant", "montant ht", "debit", "solde", "valeur", "total", "ca", "chiffre affaires"],
    type: "number",
  },
  { target: "quantity", words: ["quantite", "qte", "nombre", "volume", "unites"], type: "number" },
  { target: "unitPrice", words: ["prix unitaire", "pu", "prix", "tarif", "taux"], type: "number" },
  { target: "label", words: ["libelle", "description", "intitule", "objet", "commentaire"] },
  { target: "account", words: ["compte", "num compte", "compte general", "numero de compte"] },
  { target: "kind", words: ["sens", "type", "nature ecriture", "flux"] },
  { target: "behavior", words: ["comportement", "fixe variable", "variabilite", "type de cout"] },
  { target: "traceability", words: ["tracabilite", "direct indirect", "affectation", "imputation"] },
];


export function suggestMapping(
  profiles: ColumnProfile[],
  dimensions: CoreDimension[],
): MappingSuggestion[] {
  const used = new Set<MappingTarget>();
  const suggestions: MappingSuggestion[] = [];

  for (const profile of profiles) {
    const normalized = normalize(profile.name);
    let best: MappingSuggestion = {
      column: profile.name,
      index: profile.index,
      target: "ignore",
      confidence: 0,
      reason: "Aucune correspondance trouvée.",
    };

    // Axes d'analyse configurés pour l'entreprise
    for (const dimension of dimensions) {
      const words = [normalize(dimension.label), ...(DIMENSION_SYNONYMS[dimension.code] ?? [])];
      const score = lexicalScore(normalized, words);
      if (score > best.confidence && profile.type !== "number") {
        best = {
          column: profile.name,
          index: profile.index,
          target: `dimension:${dimension.code}`,
          confidence: score,
          reason: `Intitulé proche de l'axe « ${dimension.label} », ${profile.distinctCount} valeurs distinctes.`,
        };
      }
    }

    // Champs standards
    for (const keyword of KEYWORDS) {
      if (used.has(keyword.target)) continue;
      let score = lexicalScore(normalized, keyword.words);
      if (score === 0) continue;
      if (keyword.type && profile.type === keyword.type) score = Math.min(99, score + 15);
      if (keyword.type && profile.type !== keyword.type) score = Math.max(0, score - 40);
      if (score > best.confidence) {
        best = {
          column: profile.name,
          index: profile.index,
          target: keyword.target,
          confidence: score,
          reason: `Intitulé et type de données cohérents avec « ${keyword.target} ».`,
        };
      }
    }

    if (best.target !== "ignore" && !String(best.target).startsWith("dimension:")) {
      used.add(best.target);
    }
    suggestions.push(best);
  }

  return suggestions;
}

function lexicalScore(normalizedHeader: string, words: string[]): number {
  let best = 0;
  for (const word of words) {
    const target = normalize(word);
    if (!target) continue;
    if (normalizedHeader === target) best = Math.max(best, 98);
    else if (normalizedHeader.startsWith(target) || target.startsWith(normalizedHeader))
      best = Math.max(best, 88);
    else if (normalizedHeader.includes(target)) best = Math.max(best, 80);
  }
  return best;
}

export type ImportRowResult = {
  ok: boolean;
  error?: string;
  entry?: {
    date: string;
    periodCode: string;
    kind: "REVENUE" | "COST";
    amount: number;
    quantity: number | null;
    unitPrice: number | null;
    label: string;
    accountNumber: string | null;
    behavior: "FIXED" | "VARIABLE" | "SEMI_VARIABLE";
    traceability: "DIRECT" | "INDIRECT";
    dims: Record<string, string>;
  };
};

export type AccountDefaults = {
  kind?: "REVENUE" | "COST";
  behavior?: "FIXED" | "VARIABLE" | "SEMI_VARIABLE";
  traceability?: "DIRECT" | "INDIRECT";
  natureCode?: string;
};

export type TransformOptions = {
  mapping: ImportMapping;
  /**
   * Rapprochement d'une valeur de colonne avec un membre existant.
   * Sans lui, « Refonte SI Delta » créerait un doublon du membre dont le code est SI_DELTA :
   * les exports contiennent des libellés, pas des codes.
   */
  resolveMember?: (dimensionCode: string, rawValue: string) => string;
  /**
   * Classement par défaut issu du plan de comptes.
   * C'est une FONCTION et non une table : un export contient « 611000 » là où le plan
   * connaît « 611 ». La résolution se fait donc par préfixe le plus spécifique.
   */
  accountDefaults?: (accountNumber: string) => AccountDefaults | undefined;
};

export function transformRow(row: string[], options: TransformOptions): ImportRowResult {
  const { mapping, accountDefaults, resolveMember } = options;
  const get = (target: MappingTarget): string | undefined => {
    const column = mapping.columns.find((c) => c.target === target);
    return column ? row[column.index] : undefined;
  };

  const rawDate = get("date");
  const date = rawDate ? parseDate(rawDate) : null;
  if (!date) return { ok: false, error: "Date absente ou illisible" };

  const rawAmount = get("amount");
  const amount = rawAmount ? parseNumber(rawAmount) : null;
  if (amount === null) return { ok: false, error: "Montant absent ou illisible" };

  const accountNumber = get("account")?.trim() || null;
  const defaults = accountNumber ? accountDefaults?.(accountNumber) : undefined;

  const rawKind = get("kind")?.trim().toUpperCase();
  const kind: "REVENUE" | "COST" =
    rawKind === "REVENUE" || rawKind === "PRODUIT" || rawKind === "VENTE" || rawKind === "CREDIT"
      ? "REVENUE"
      : rawKind === "COST" || rawKind === "CHARGE" || rawKind === "ACHAT" || rawKind === "DEBIT"
        ? "COST"
        : (defaults?.kind ?? mapping.defaults.kind ?? inferKindFromAccount(accountNumber));

  const dims: Record<string, string> = {};
  for (const column of mapping.columns) {
    if (!String(column.target).startsWith("dimension:")) continue;
    const dimensionCode = String(column.target).split(":")[1];
    const value = row[column.index]?.trim();
    if (value) dims[dimensionCode] = resolveMember ? resolveMember(dimensionCode, value) : memberCodeFrom(value);
  }
  if (!dims.NATURE && defaults?.natureCode) dims.NATURE = defaults.natureCode;

  const quantity = parseOptionalNumber(get("quantity"));
  const unitPrice = parseOptionalNumber(get("unitPrice"));

  return {
    ok: true,
    entry: {
      date,
      periodCode: periodCodeFromDate(date),
      kind,
      amount: Math.abs(amount),
      quantity,
      unitPrice: unitPrice ?? (quantity && quantity !== 0 ? Math.abs(amount) / quantity : null),
      label: get("label")?.trim() ?? "",
      accountNumber,
      behavior:
        readBehavior(get("behavior")) ??
        defaults?.behavior ??
        mapping.defaults.behavior ??
        (quantity ? "VARIABLE" : "FIXED"),
      traceability:
        readTraceability(get("traceability")) ??
        defaults?.traceability ??
        mapping.defaults.traceability ??
        (Object.keys(dims).some((code) => code !== "NATURE" && code !== "CENTER")
          ? "DIRECT"
          : "INDIRECT"),
      dims,
    },
  };
}

/**
 * Lecture des colonnes de classement.
 * Une valeur non reconnue retourne `undefined` — jamais une valeur inventée écrite en base :
 * on retombe alors sur le plan de comptes, puis sur le repli documenté (docs/07 §2).
 */
const BEHAVIOR_ALIASES: Record<string, CostBehavior> = {
  FIXED: "FIXED",
  FIXE: "FIXED",
  F: "FIXED",
  "COUT FIXE": "FIXED",
  STRUCTURE: "FIXED",
  VARIABLE: "VARIABLE",
  V: "VARIABLE",
  "COUT VARIABLE": "VARIABLE",
  PROPORTIONNEL: "VARIABLE",
  SEMI_VARIABLE: "SEMI_VARIABLE",
  "SEMI VARIABLE": "SEMI_VARIABLE",
  SEMIVARIABLE: "SEMI_VARIABLE",
  MIXTE: "SEMI_VARIABLE",
  SV: "SEMI_VARIABLE",
};

const TRACEABILITY_ALIASES: Record<string, Traceability> = {
  DIRECT: "DIRECT",
  DIRECTE: "DIRECT",
  D: "DIRECT",
  AFFECTABLE: "DIRECT",
  INDIRECT: "INDIRECT",
  INDIRECTE: "INDIRECT",
  I: "INDIRECT",
  REPARTI: "INDIRECT",
};

function normalizeValue(raw: string | undefined): string | null {
  if (!raw || raw.trim() === "") return null;
  return raw
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function readBehavior(raw: string | undefined): CostBehavior | undefined {
  const value = normalizeValue(raw);
  if (!value) return undefined;
  return BEHAVIOR_ALIASES[value] ?? BEHAVIOR_ALIASES[value.replace(/ /g, "_")];
}

export function readTraceability(raw: string | undefined): Traceability | undefined {
  const value = normalizeValue(raw);
  if (!value) return undefined;
  return TRACEABILITY_ALIASES[value];
}

function parseOptionalNumber(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  return parseNumber(raw);
}

function inferKindFromAccount(accountNumber: string | null): "REVENUE" | "COST" {
  if (!accountNumber) return "COST";
  return accountNumber.startsWith("7") ? "REVENUE" : "COST";
}

/** Normalise une valeur texte en code de membre stable. */
export function memberCodeFrom(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}
