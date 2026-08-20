"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { createCompany } from "@/services/company.service";
import { audit } from "@/lib/repository";

export type CompanyState = { error?: string };

export async function createCompanyAction(_prev: CompanyState, formData: FormData): Promise<CompanyState> {
  const user = await requireUser();
  assertCan(user.role, "company.create");

  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "other");
  const activity = String(formData.get("activity") ?? "").trim();
  const fiscalYearStartMonth = Number(formData.get("fiscalYearStartMonth") ?? 1);
  const currency = String(formData.get("currency") ?? "EUR");

  if (name.length < 2) return { error: "Indiquez le nom de l'entreprise." };

  const company = await createCompany({
    organizationId: user.organizationId,
    name,
    industry,
    activity,
    currency,
    fiscalYearStartMonth: Number.isFinite(fiscalYearStartMonth) ? fiscalYearStartMonth : 1,
  });

  await audit({
    companyId: company.id,
    actorId: user.userId,
    action: "company.create",
    entity: "Company",
    entityId: company.id,
    diff: { name, industry },
  });

  revalidatePath("/app");
  redirect(`/app/${company.id}/onboarding`);
}
