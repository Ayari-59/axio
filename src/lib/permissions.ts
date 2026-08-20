import type { Role } from "@/core/model/enums";

/** Matrice de droits (docs/01 §4). Toute vérification passe par `can()`, jamais par un test ad hoc. */

export const ACTIONS = [
  "organization.manage",
  "company.create",
  "company.configure",
  "data.import",
  "rules.edit",
  "kpi.edit",
  "budget.manage",
  "budget.fill",
  "scenario.run",
  "report.export",
  "view.all",
  "view.scoped",
] as const;
export type Action = (typeof ACTIONS)[number];

const MATRIX: Record<Role, Action[]> = {
  ADMIN: [...ACTIONS],
  EXECUTIVE: [
    "company.configure",
    "budget.manage",
    "scenario.run",
    "report.export",
    "view.all",
  ],
  CONTROLLER: [
    "company.create",
    "company.configure",
    "data.import",
    "rules.edit",
    "kpi.edit",
    "budget.manage",
    "budget.fill",
    "scenario.run",
    "report.export",
    "view.all",
  ],
  CFO: [
    "company.configure",
    "data.import",
    "rules.edit",
    "kpi.edit",
    "budget.manage",
    "budget.fill",
    "scenario.run",
    "report.export",
    "view.all",
  ],
  OPERATIONS: ["budget.fill", "scenario.run", "report.export", "view.scoped"],
  MANAGER: ["budget.fill", "view.scoped"],
  VIEWER: ["view.scoped"],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role]?.includes(action) ?? false;
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) throw new Error(`FORBIDDEN:${action}`);
}

export type Scope = { dimensionCode: string; memberCodes: string[] } | null;

/** Filtre dimensionnel imposé côté serveur pour les rôles restreints. */
export function scopeFilter(role: Role, scope: Scope) {
  if (can(role, "view.all")) return undefined;
  if (!scope) return undefined;
  return { dimensionFilters: [{ dimensionCode: scope.dimensionCode, memberCodes: scope.memberCodes }] };
}
