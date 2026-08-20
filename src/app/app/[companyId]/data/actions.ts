"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { getCompany } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { analyzeImport, cancelImport, commitImport, dryRun, type DryRunReport } from "@/services/import.service";
import type { ImportMapping } from "@/core/import/mapping";

async function ensure(companyId: string) {
  const user = await requireUser();
  assertCan(user.role, "data.import");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  return user;
}

export type UploadState = { error?: string };

export async function uploadAction(
  companyId: string,
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  await ensure(companyId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Sélectionnez un fichier CSV." };
  if (file.size > 8 * 1024 * 1024) return { error: "Fichier trop volumineux (8 Mo maximum)." };

  const content = await file.text();
  const analysis = await analyzeImport(companyId, file.name, content);
  redirect(`/app/${companyId}/data/import/${analysis.batchId}`);
}

export type DryRunState = { report?: DryRunReport; error?: string };

export async function dryRunAction(
  companyId: string,
  batchId: string,
  _prev: DryRunState,
  formData: FormData,
): Promise<DryRunState> {
  await ensure(companyId);
  try {
    const mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as ImportMapping;
    const report = await dryRun(companyId, batchId, mapping);
    return { report };
  } catch {
    return { error: "L'essai à blanc a échoué : vérifiez le mapping." };
  }
}

export async function commitAction(companyId: string, batchId: string, formData: FormData): Promise<void> {
  const user = await ensure(companyId);
  const mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as ImportMapping;
  await commitImport(companyId, batchId, mapping, user.userId);
  revalidatePath(`/app/${companyId}`);
  redirect(`/app/${companyId}/data?imported=1`);
}

export async function cancelImportAction(companyId: string, batchId: string): Promise<void> {
  const user = await ensure(companyId);
  await cancelImport(companyId, batchId, user.userId);
  revalidatePath(`/app/${companyId}/data`);
}

export type DriverState = { error?: string; success?: string };

/** Saisie manuelle d'un inducteur (heures, effectif, surface…) pour une période. */
export async function addDriverAction(
  companyId: string,
  _prev: DriverState,
  formData: FormData,
): Promise<DriverState> {
  await ensure(companyId);
  const driverCode = String(formData.get("driverCode") ?? "").trim().toUpperCase();
  const periodCode = String(formData.get("periodCode") ?? "").trim();
  const value = Number(formData.get("value") ?? 0);
  const dimensionCode = String(formData.get("dimensionCode") ?? "").trim();
  const memberCode = String(formData.get("memberCode") ?? "").trim();

  if (!driverCode || !periodCode) return { error: "Inducteur et période sont obligatoires." };
  if (!Number.isFinite(value)) return { error: "Valeur invalide." };

  const period = await prisma.period.findUnique({ where: { companyId_code: { companyId, code: periodCode } } });
  if (!period) return { error: "Période inconnue." };

  let dimensionId: string | null = null;
  let memberId: string | null = null;
  if (dimensionCode) {
    const dimension = await prisma.dimension.findUnique({
      where: { companyId_code: { companyId, code: dimensionCode } },
    });
    dimensionId = dimension?.id ?? null;
    if (dimension && memberCode) {
      const member = await prisma.dimensionMember.findUnique({
        where: { dimensionId_code: { dimensionId: dimension.id, code: memberCode } },
      });
      memberId = member?.id ?? null;
    }
  }

  await prisma.driverValue.create({
    data: { companyId, periodId: period.id, driverCode, dimensionId, memberId, value },
  });

  revalidatePath(`/app/${companyId}/data`);
  return { success: `${driverCode} = ${value} enregistré sur ${periodCode}.` };
}
