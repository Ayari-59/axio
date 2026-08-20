"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { getCompany } from "@/lib/repository";
import { businessModelProfileSchema } from "@/core/model/profile";
import { applyConfiguration, buildConfigurationPlan, saveProfile } from "@/services/configuration.service";

async function ensureAccess(companyId: string) {
  const user = await requireUser();
  assertCan(user.role, "company.configure");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  return user;
}

export async function saveProfileAction(companyId: string, payload: string): Promise<void> {
  const user = await ensureAccess(companyId);
  const parsed = businessModelProfileSchema.safeParse(JSON.parse(payload));
  if (!parsed.success) throw new Error("PROFILE_INVALID");

  await saveProfile(companyId, parsed.data, user.userId);
  revalidatePath(`/app/${companyId}/onboarding`);
  redirect(`/app/${companyId}/onboarding/plan`);
}

export async function applyPlanAction(companyId: string): Promise<void> {
  const user = await ensureAccess(companyId);
  const { plan } = await buildConfigurationPlan(companyId);
  await applyConfiguration(companyId, plan, user.userId);
  revalidatePath(`/app/${companyId}`);
  redirect(`/app/${companyId}?configured=1`);
}
