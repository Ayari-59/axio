"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { getCompany } from "@/lib/repository";
import { approveBudget, createBudgetFromHistory, deleteBudget } from "@/services/budget.service";

async function ensure(companyId: string) {
  const user = await requireUser();
  assertCan(user.role, "budget.manage");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  return user;
}

export type BudgetState = { error?: string; success?: string };

export async function createBudgetAction(
  companyId: string,
  _prev: BudgetState,
  formData: FormData,
): Promise<BudgetState> {
  const user = await ensure(companyId);
  const fiscalYear = Number(formData.get("fiscalYear") ?? 0);
  const sourceFiscalYear = Number(formData.get("sourceFiscalYear") ?? 0);
  const growthPct = Number(formData.get("growthPct") ?? 0);
  const costGrowthPct = Number(formData.get("costGrowthPct") ?? 0);
  const name = String(formData.get("name") ?? "").trim() || `Budget ${fiscalYear}`;

  try {
    const { lines } = await createBudgetFromHistory({
      companyId,
      name,
      fiscalYear,
      sourceFiscalYear,
      growthPct,
      costGrowthPct,
      actorId: user.userId,
    });
    revalidatePath(`/app/${companyId}/budgets`);
    return { success: `Budget créé : ${lines} lignes générées depuis ${sourceFiscalYear}.` };
  } catch (error) {
    if (error instanceof Error && error.message === "NO_SOURCE_DATA") {
      return { error: `Aucune donnée réelle sur l'exercice ${sourceFiscalYear}.` };
    }
    return { error: "La construction du budget a échoué." };
  }
}

export async function approveBudgetAction(companyId: string, budgetId: string): Promise<void> {
  const user = await ensure(companyId);
  await approveBudget(companyId, budgetId, user.userId);
  revalidatePath(`/app/${companyId}/budgets`);
}

export async function deleteBudgetAction(companyId: string, budgetId: string): Promise<void> {
  const user = await ensure(companyId);
  await deleteBudget(companyId, budgetId, user.userId);
  revalidatePath(`/app/${companyId}/budgets`);
}
