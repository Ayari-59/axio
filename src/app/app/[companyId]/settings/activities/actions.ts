"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { getCompany } from "@/lib/repository";
import { applyActivityMap, removeActivityMap, type ActivityInput } from "@/services/abc.service";

async function ensure(companyId: string) {
  const user = await requireUser();
  assertCan(user.role, "rules.edit");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  return user;
}

export type ActivityState = { error?: string; success?: string };

export async function applyActivitiesAction(
  companyId: string,
  _prev: ActivityState,
  formData: FormData,
): Promise<ActivityState> {
  const user = await ensure(companyId);

  let activities: ActivityInput[];
  try {
    activities = JSON.parse(String(formData.get("activities") ?? "[]")) as ActivityInput[];
  } catch {
    return { error: "Carte d'activités illisible." };
  }

  const kept = activities.filter((a) => a.share > 0);
  if (kept.length === 0) return { error: "Renseignez au moins une activité avec une part supérieure à zéro." };

  const total = kept.reduce((sum, a) => sum + a.share, 0);
  if (Math.abs(total - 100) > 0.5) {
    return { error: `La somme des parts doit faire 100 % (actuellement ${Math.round(total)} %).` };
  }
  if (kept.some((a) => !a.driverKey)) {
    return { error: "Chaque activité doit porter un inducteur." };
  }

  try {
    const result = await applyActivityMap(companyId, kept, user.userId);
    revalidatePath(`/app/${companyId}`);
    return {
      success: `${result.activities} activités et ${result.rules} règles générées. Les coûts indirects transitent désormais par les activités.`,
    };
  } catch {
    return { error: "La génération a échoué." };
  }
}

export async function removeActivitiesAction(companyId: string): Promise<void> {
  const user = await ensure(companyId);
  await removeActivityMap(companyId, user.userId);
  revalidatePath(`/app/${companyId}`);
}
