import { DIMENSION_SYNONYMS } from "../templates/vocabulary";

/**
 * Détection d'intention du copilote (docs/11 §5).
 * Purement lexicale et déterministe : elle fonctionne sans aucune clé d'API.
 * Le modèle de langage, quand il est activé, n'intervient qu'à l'étape de rédaction.
 */

export const INTENTS = [
  "measure_value",
  "explain_variance",
  "rank_objects",
  "check_budget",
  "list_risks",
  "simulate",
  "build_report",
  "explain_kpi",
  "unknown",
] as const;
export type Intent = (typeof INTENTS)[number];

export type IntentDetection = {
  intent: Intent;
  confidence: number;
  measure?: string;
  dimensionHint?: string;
  order?: "asc" | "desc";
  topN?: number;
  kpiCode?: string;
  levers?: { target: string; value: number }[];
  matchedOn: string[];
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9%+\-. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MEASURE_WORDS: { measure: string; words: string[] }[] = [
  { measure: "contributionMargin", words: ["marge", "marge sur couts variables", "mcv", "rentabilite"] },
  { measure: "operatingMargin", words: ["resultat", "marge operationnelle", "benefice"] },
  { measure: "revenue", words: ["chiffre d affaires", "chiffre affaires", "ca", "facturation", "ventes"] },
  { measure: "costTotal", words: ["couts", "cout", "charges", "depenses"] },
  { measure: "cashNet", words: ["tresorerie", "cash", "flux"] },
  { measure: "fixedCost", words: ["charges fixes", "couts fixes"] },
  { measure: "variableCost", words: ["charges variables", "couts variables"] },
];

const DIMENSION_WORDS = Object.entries(DIMENSION_SYNONYMS).map(([dimension, words]) => ({
  dimension,
  words,
}));


const WHY_WORDS = ["pourquoi", "explique", "expliquer", "cause", "causes", "raison", "d ou vient"];
const RANK_WORDS = ["quels", "quelles", "top", "classement", "meilleurs", "pires", "moins", "plus"];
const BUDGET_WORDS = ["budget", "budgetaire", "depassement", "depasse", "ecart"];
const RISK_WORDS = ["risque", "risques", "alerte", "alertes", "attention", "danger", "derive"];
const SIMULATE_WORDS = ["si j", "que se passe", "simule", "simuler", "scenario", "et si", "impact si"];
const REPORT_WORDS = ["rapport", "analyse mensuelle", "reporting", "synthese", "prepare"];
const KPI_WORDS = ["comment calcules", "comment est calcule", "definition", "c est quoi", "que signifie"];

function hits(text: string, words: string[]): string[] {
  return words.filter((word) => text.includes(word));
}

export function detectIntent(question: string): IntentDetection {
  const text = normalize(question);
  const matchedOn: string[] = [];

  const measure = MEASURE_WORDS.find((m) => hits(text, m.words).length > 0);
  if (measure) matchedOn.push(measure.measure);

  const dimension = DIMENSION_WORDS.find((d) => hits(text, d.words).length > 0);
  if (dimension) matchedOn.push(dimension.dimension);

  const base: IntentDetection = {
    intent: "unknown",
    confidence: 0,
    measure: measure?.measure,
    dimensionHint: dimension?.dimension,
    matchedOn,
  };

  if (hits(text, KPI_WORDS).length > 0) {
    return { ...base, intent: "explain_kpi", confidence: 80 };
  }
  if (hits(text, SIMULATE_WORDS).length > 0) {
    return { ...base, intent: "simulate", confidence: 85, levers: extractLevers(text) };
  }
  if (hits(text, REPORT_WORDS).length > 0) {
    return { ...base, intent: "build_report", confidence: 85 };
  }
  if (hits(text, WHY_WORDS).length > 0) {
    return { ...base, intent: "explain_variance", confidence: 90, measure: measure?.measure ?? "contributionMargin" };
  }
  if (hits(text, RISK_WORDS).length > 0) {
    return { ...base, intent: "list_risks", confidence: 85 };
  }
  if (hits(text, BUDGET_WORDS).length > 0) {
    return { ...base, intent: "check_budget", confidence: 85, dimensionHint: dimension?.dimension };
  }
  if (dimension && (hits(text, RANK_WORDS).length > 0 || /\d+/.test(text))) {
    const worst = /moins rentable|pires|perte|negative|moins bon/.test(text);
    return {
      ...base,
      intent: "rank_objects",
      confidence: 85,
      order: worst ? "asc" : "desc",
      topN: extractCount(text) ?? 5,
      measure: measure?.measure ?? "contributionMargin",
    };
  }
  if (measure) {
    return { ...base, intent: "measure_value", confidence: 75 };
  }
  return base;
}

function extractCount(text: string): number | null {
  const digits = /\b(\d{1,2})\b/.exec(text);
  if (digits) return Number(digits[1]);
  const words: Record<string, number> = {
    deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  };
  for (const [word, value] of Object.entries(words)) if (text.includes(word)) return value;
  return null;
}

function extractLevers(text: string): { target: string; value: number }[] {
  const levers: { target: string; value: number }[] = [];
  const percent = /([+-]?\d+(?:[.,]\d+)?)\s*%/g;
  const matches = [...text.matchAll(percent)].map((m) => Number(m[1].replace(",", ".")));

  const push = (target: string, value: number) => levers.push({ target, value });

  if (/prix|tarif|tjm/.test(text) && matches.length > 0) push("price", signed(text, "prix", matches[0]));
  if (/volume|ventes|quantite/.test(text) && matches.length > 0) {
    push("volume", signed(text, "volume", matches[matches.length - 1]));
  }
  if (/salaire|masse salariale/.test(text) && matches.length > 0) push("payroll", matches[0]);

  const headcount = /(?:embauche|recrute|recruter|embaucher)\w*\s+(\d+)/.exec(text);
  if (headcount) push("headcount", Number(headcount[1]));

  return levers;
}

/**
 * Sens d'un levier exprimé en langage naturel.
 * On ne s'appuie QUE sur des verbes de diminution : un tiret isolé ne suffit pas
 * (« que se passe-t-il » contient un tiret sans exprimer une baisse).
 */
function signed(text: string, keyword: string, value: number): number {
  if (value < 0) return value;
  const index = text.indexOf(keyword);
  const window = text.slice(Math.max(0, index - 30), index + 40);
  const decrease = /baisse|baissent|diminue|diminuent|reduit|reduis|recule|reculent|perd|perdent|moins de/.test(window);
  return decrease ? -value : value;
}
