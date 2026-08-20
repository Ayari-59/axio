"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { audit, getCompany } from "@/lib/repository";
import { prisma } from "@/lib/db";

export type TargetState = { error?: string; success?: string };

export async function setTargetAction(
  companyId: string,
  code: string,
  _prev: TargetState,
  formData: FormData,
): Promise<TargetState> {
  const user = await requireUser();
  assertCan(user.role, "kpi.edit");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) return { error: "Entreprise introuvable." };

  const raw = String(formData.get("target") ?? "").trim();
  const target = raw === "" ? null : Number(raw.replace(",", "."));
  if (target !== null && !Number.isFinite(target)) return { error: "Valeur de cible invalide." };

  await prisma.kpiDefinition.update({
    where: { companyId_code: { companyId, code } },
    data: { target },
  });

  await audit({
    companyId,
    actorId: user.userId,
    action: "kpi.setTarget",
    entity: "KpiDefinition",
    entityId: code,
    diff: { target },
  });

  revalidatePath(`/app/${companyId}/kpis`);
  return { success: "Cible enregistrée." };
}
