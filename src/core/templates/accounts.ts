import type { CostBehavior, Traceability } from "../model/enums";

/**
 * Plan de comptes par défaut (sous-ensemble du PCG français, classes 6 et 7).
 *
 * Rôle exact dans le produit : fournir le **classement par défaut** d'une écriture importée
 * quand le fichier ne le précise pas (docs/07 §2). Ce n'est pas de la comptabilité générale :
 * Axio ne tient pas de journal, il lit des exports.
 *
 * C'est de la donnée : un cabinet peut remplacer ce plan par le sien sans toucher au moteur.
 */

export type AccountPreset = {
  number: string;
  label: string;
  type: "REVENUE" | "EXPENSE";
  defaultNatureCode: string | null;
  defaultBehavior: CostBehavior;
  defaultTraceability: Traceability;
};

export const DEFAULT_CHART: AccountPreset[] = [
  // ---------------------------------------------------------------- produits
  { number: "701", label: "Ventes de produits finis", type: "REVENUE", defaultNatureCode: null, defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "706", label: "Prestations de services", type: "REVENUE", defaultNatureCode: null, defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "707", label: "Ventes de marchandises", type: "REVENUE", defaultNatureCode: null, defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "708", label: "Produits des activités annexes", type: "REVENUE", defaultNatureCode: null, defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "709", label: "Rabais, remises et ristournes accordés", type: "REVENUE", defaultNatureCode: null, defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },

  // ------------------------------------------------------ achats consommés
  { number: "601", label: "Achats de matières premières", type: "EXPENSE", defaultNatureCode: "MATERIAL", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "602", label: "Achats d'autres approvisionnements", type: "EXPENSE", defaultNatureCode: "MATERIAL", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "604", label: "Achats d'études et prestations", type: "EXPENSE", defaultNatureCode: "SUBCONTRACTING", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "605", label: "Achats de matériel et travaux", type: "EXPENSE", defaultNatureCode: "MATERIAL", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "606", label: "Achats non stockés (énergie, fournitures)", type: "EXPENSE", defaultNatureCode: "ENERGY", defaultBehavior: "SEMI_VARIABLE", defaultTraceability: "INDIRECT" },
  { number: "607", label: "Achats de marchandises", type: "EXPENSE", defaultNatureCode: "PURCHASE", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },

  // ------------------------------------------------- services extérieurs
  { number: "611", label: "Sous-traitance générale", type: "EXPENSE", defaultNatureCode: "SUBCONTRACTING", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "612", label: "Redevances de crédit-bail", type: "EXPENSE", defaultNatureCode: "EQUIPMENT", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "613", label: "Locations", type: "EXPENSE", defaultNatureCode: "RENT", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "615", label: "Entretien et réparations", type: "EXPENSE", defaultNatureCode: "MAINTENANCE", defaultBehavior: "SEMI_VARIABLE", defaultTraceability: "INDIRECT" },
  { number: "616", label: "Primes d'assurance", type: "EXPENSE", defaultNatureCode: "OVERHEAD", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "618", label: "Documentation et divers", type: "EXPENSE", defaultNatureCode: "OVERHEAD", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "621", label: "Personnel extérieur à l'entreprise", type: "EXPENSE", defaultNatureCode: "SUBCONTRACTING", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "622", label: "Honoraires et commissions", type: "EXPENSE", defaultNatureCode: "EXTERNAL", defaultBehavior: "VARIABLE", defaultTraceability: "INDIRECT" },
  { number: "623", label: "Publicité et communication", type: "EXPENSE", defaultNatureCode: "OVERHEAD", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "625", label: "Déplacements et missions", type: "EXPENSE", defaultNatureCode: "TRAVEL", defaultBehavior: "VARIABLE", defaultTraceability: "DIRECT" },
  { number: "626", label: "Télécommunications et informatique", type: "EXPENSE", defaultNatureCode: "TOOLS", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "628", label: "Services extérieurs divers", type: "EXPENSE", defaultNatureCode: "EXTERNAL", defaultBehavior: "VARIABLE", defaultTraceability: "INDIRECT" },

  // ------------------------------------------------------------- impôts
  { number: "631", label: "Impôts et taxes sur rémunérations", type: "EXPENSE", defaultNatureCode: "PAYROLL", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "635", label: "Autres impôts et taxes", type: "EXPENSE", defaultNatureCode: "OVERHEAD", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },

  // ---------------------------------------------------------- personnel
  { number: "641", label: "Rémunérations du personnel", type: "EXPENSE", defaultNatureCode: "PAYROLL", defaultBehavior: "FIXED", defaultTraceability: "DIRECT" },
  { number: "645", label: "Charges de sécurité sociale et prévoyance", type: "EXPENSE", defaultNatureCode: "PAYROLL", defaultBehavior: "FIXED", defaultTraceability: "DIRECT" },
  { number: "647", label: "Autres charges sociales", type: "EXPENSE", defaultNatureCode: "PAYROLL", defaultBehavior: "FIXED", defaultTraceability: "DIRECT" },

  // ------------------------------------------------- autres charges
  { number: "651", label: "Redevances et licences", type: "EXPENSE", defaultNatureCode: "TOOLS", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "658", label: "Charges diverses de gestion courante", type: "EXPENSE", defaultNatureCode: "OVERHEAD", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "661", label: "Charges d'intérêts", type: "EXPENSE", defaultNatureCode: "OVERHEAD", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
  { number: "681", label: "Dotations aux amortissements", type: "EXPENSE", defaultNatureCode: "EQUIPMENT", defaultBehavior: "FIXED", defaultTraceability: "INDIRECT" },
];

/** Compte le plus spécifique correspondant à un numéro importé (610500 → 611 → 61). */
export function matchAccount(number: string): AccountPreset | undefined {
  const clean = number.trim();
  return [...DEFAULT_CHART]
    .sort((a, b) => b.number.length - a.number.length)
    .find((account) => clean.startsWith(account.number));
}
