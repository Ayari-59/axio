import type { CostBehavior, Traceability } from "../model/enums";
import type { Rule, RulePack } from "../rules/types";
import { alertPack } from "./alerts";
import { basePack } from "./base";
import { constructionPack } from "./construction";
import { consultingPack } from "./consulting";
import { manufacturingPack } from "./manufacturing";
import { retailPack } from "./retail";
import { saasPack } from "./saas";

/**
 * Registre des packs et des présélections sectorielles.
 * Tout ce fichier est de la DONNÉE : c'est le seul endroit du cœur où un nom de secteur
 * a le droit d'apparaître (cf. garde-fou tests/architecture.test.ts).
 */

export const PACKS: RulePack[] = [
  basePack,
  consultingPack,
  constructionPack,
  manufacturingPack,
  retailPack,
  saasPack,
  alertPack,
];

export type NaturePreset = {
  code: string;
  label: string;
  behavior: CostBehavior;
  traceability: Traceability;
};

export type SectorTemplate = {
  code: string;
  label: string;
  description: string;
  /** Packs appliqués en plus du socle (les packs se déclenchent aussi par leurs propres conditions). */
  packs: string[];
  natures: NaturePreset[];
  centers: { code: string; label: string }[];
  objectLabels: Record<string, string>;
};

const COMMON_NATURES: NaturePreset[] = [
  { code: "PAYROLL", label: "Masse salariale", behavior: "FIXED", traceability: "DIRECT" },
  { code: "OVERHEAD", label: "Frais de structure", behavior: "FIXED", traceability: "INDIRECT" },
  { code: "EXTERNAL", label: "Services extérieurs", behavior: "VARIABLE", traceability: "INDIRECT" },
  { code: "TRAVEL", label: "Déplacements", behavior: "VARIABLE", traceability: "DIRECT" },
];

export const SECTORS: SectorTemplate[] = [
  {
    code: "consulting",
    label: "Conseil et services intellectuels",
    description: "Cabinets, ESN, ingénierie, agences, professions libérales.",
    packs: ["consulting"],
    natures: [
      ...COMMON_NATURES,
      { code: "SUBCONTRACTING", label: "Sous-traitance", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "TOOLS", label: "Licences et outils", behavior: "FIXED", traceability: "INDIRECT" },
    ],
    centers: [
      { code: "DELIVERY", label: "Production / delivery" },
      { code: "SALES", label: "Commercial" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { PROJECT: "Mission", EMPLOYEE: "Consultant", CENTER: "Pôle" },
  },
  {
    code: "construction",
    label: "BTP et travaux",
    description: "Gros œuvre, second œuvre, travaux publics, installation.",
    packs: ["construction"],
    natures: [
      ...COMMON_NATURES,
      { code: "MATERIAL", label: "Matériaux", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "SUBCONTRACTING", label: "Sous-traitance", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "EQUIPMENT", label: "Matériel et engins", behavior: "SEMI_VARIABLE", traceability: "INDIRECT" },
    ],
    centers: [
      { code: "WORKS", label: "Conduite de travaux" },
      { code: "DEPOT", label: "Dépôt et matériel" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { PROJECT: "Chantier", EMPLOYEE: "Compagnon", CENTER: "Centre" },
  },
  {
    code: "manufacturing",
    label: "Industrie et production",
    description: "Transformation, mécanique, agroalimentaire, façonnage.",
    packs: ["manufacturing"],
    natures: [
      ...COMMON_NATURES,
      { code: "MATERIAL", label: "Matières premières", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "ENERGY", label: "Énergie", behavior: "SEMI_VARIABLE", traceability: "INDIRECT" },
      { code: "MAINTENANCE", label: "Maintenance", behavior: "SEMI_VARIABLE", traceability: "INDIRECT" },
      { code: "QUALITY", label: "Qualité", behavior: "FIXED", traceability: "INDIRECT" },
    ],
    centers: [
      { code: "MACHINING", label: "Atelier usinage" },
      { code: "ASSEMBLY", label: "Atelier assemblage" },
      { code: "LOGISTICS", label: "Logistique" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { PRODUCT: "Produit", CENTER: "Atelier", EMPLOYEE: "Opérateur" },
  },
  {
    code: "retail",
    label: "Commerce et distribution",
    description: "Magasins, e-commerce, grossistes.",
    packs: ["retail"],
    natures: [
      ...COMMON_NATURES,
      { code: "PURCHASE", label: "Achats de marchandises", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "RENT", label: "Loyers", behavior: "FIXED", traceability: "INDIRECT" },
      { code: "LOGISTICS", label: "Logistique", behavior: "SEMI_VARIABLE", traceability: "INDIRECT" },
    ],
    centers: [
      { code: "STORES", label: "Points de vente" },
      { code: "SUPPLY", label: "Achats et logistique" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { PRODUCT: "Famille", SITE: "Magasin", EMPLOYEE: "Vendeur" },
  },
  {
    code: "restaurant",
    label: "Restauration et hôtellerie",
    description: "Restaurants, traiteurs, hôtels.",
    packs: ["retail"],
    natures: [
      ...COMMON_NATURES,
      { code: "PURCHASE", label: "Achats alimentaires", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "RENT", label: "Loyers", behavior: "FIXED", traceability: "INDIRECT" },
    ],
    centers: [
      { code: "KITCHEN", label: "Cuisine" },
      { code: "ROOM", label: "Salle" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { PRODUCT: "Carte", SITE: "Établissement" },
  },
  {
    code: "saas",
    label: "Logiciel et abonnement",
    description: "SaaS, éditeurs, services managés, maintenance.",
    packs: ["saas"],
    natures: [
      ...COMMON_NATURES,
      { code: "HOSTING", label: "Hébergement et infrastructure", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "SUPPORT", label: "Support client", behavior: "FIXED", traceability: "DIRECT" },
    ],
    centers: [
      { code: "PRODUCT", label: "Produit et technique" },
      { code: "SALES", label: "Commercial" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { CONTRACT: "Contrat", PRODUCT: "Offre" },
  },
  {
    code: "transport",
    label: "Transport et logistique",
    description: "Transport de marchandises, messagerie, logistique.",
    packs: [],
    natures: [
      ...COMMON_NATURES,
      { code: "FUEL", label: "Carburant", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "FLEET", label: "Flotte et entretien", behavior: "SEMI_VARIABLE", traceability: "DIRECT" },
      { code: "SUBCONTRACTING", label: "Affrètement", behavior: "VARIABLE", traceability: "DIRECT" },
    ],
    centers: [
      { code: "OPERATIONS", label: "Exploitation" },
      { code: "FLEET", label: "Parc" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { PROJECT: "Tournée", CLIENT: "Donneur d'ordre" },
  },
  {
    code: "association",
    label: "Association et secteur non marchand",
    description: "Associations, fondations, structures subventionnées.",
    packs: [],
    natures: [
      ...COMMON_NATURES,
      { code: "GRANT_EXPENSE", label: "Dépenses de projet", behavior: "VARIABLE", traceability: "DIRECT" },
    ],
    centers: [
      { code: "PROGRAMS", label: "Programmes" },
      { code: "SUPPORT", label: "Fonctions support" },
    ],
    objectLabels: { PROJECT: "Programme", CLIENT: "Financeur" },
  },
  {
    code: "realestate",
    label: "Immobilier",
    description: "Promotion, gestion, administration de biens.",
    packs: ["construction"],
    natures: [
      ...COMMON_NATURES,
      { code: "WORKS", label: "Travaux", behavior: "VARIABLE", traceability: "DIRECT" },
      { code: "FEES", label: "Honoraires externes", behavior: "VARIABLE", traceability: "DIRECT" },
    ],
    centers: [
      { code: "OPERATIONS", label: "Opérations" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: { PROJECT: "Opération", SITE: "Immeuble" },
  },
  {
    code: "other",
    label: "Autre activité",
    description: "Le moteur déduit la configuration du seul modèle économique déclaré.",
    packs: [],
    natures: COMMON_NATURES,
    centers: [
      { code: "OPERATIONS", label: "Opérations" },
      { code: "ADMIN", label: "Administration" },
    ],
    objectLabels: {},
  },
];

export function getSector(code: string): SectorTemplate {
  return SECTORS.find((s) => s.code === code) ?? SECTORS[SECTORS.length - 1];
}

/**
 * Sélection des règles applicables : socle + alertes + packs du secteur + packs additionnels.
 * Les packs additionnels sont toujours inclus car leurs propres conditions décident au final :
 * une entreprise industrielle qui facture aussi au temps reçoit les deux jeux de règles.
 */
export function selectRules(options?: { includeAllPacks?: boolean; sectorCode?: string }): Rule[] {
  const includeAll = options?.includeAllPacks ?? true;
  if (includeAll) return PACKS.flatMap((p) => p.rules);

  const sector = options?.sectorCode ? getSector(options.sectorCode) : null;
  const codes = new Set(["base", "alerts", ...(sector?.packs ?? [])]);
  return PACKS.filter((p) => codes.has(p.code)).flatMap((p) => p.rules);
}

export function allRules(): Rule[] {
  return selectRules({ includeAllPacks: true });
}
