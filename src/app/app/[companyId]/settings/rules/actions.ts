"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { audit, getCompany } from "@/lib/repository";
import { parseJsonLoose } from "@/lib/json";
import { prisma } from "@/lib/db";
import type { AllocationRuleSpec } from "@/core/model/types";

async function ensure(companyId: string) {
  const user = await requireUser();
  assertCan(user.role, "rules.edit");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  return user;
}

export async function toggleRuleAction(companyId: string, ruleId: string): Promise<void> {
  const user = await ensure(companyId);
  const rule = await prisma.allocationRule.findFirst({ where: { id: ruleId, companyId } });
  if (!rule) return;
  await prisma.allocationRule.update({ where: { id: ruleId }, data: { active: !rule.active } });
  await audit({
    companyId,
    actorId: user.userId,
    action: "rule.toggle",
    entity: "AllocationRule",
    entityId: ruleId,
    diff: { active: !rule.active },
  });
  revalidatePath(`/app/${companyId}/settings/rules`);
  revalidatePath(`/app/${companyId}`);
}

/** L'inducteur est saisi sous la forme `type:clé` (driver:HOURS, measure:revenue, attribute:m2). */
export async function updateDriverAction(
  companyId: string,
  ruleId: string,
  formData: FormData,
): Promise<void> {
  const user = await ensure(companyId);
  const raw = String(formData.get("driverKey") ?? "");
  const [type, key] = raw.split(":");
  if (!type || !key) return;
  if (type !== "driver" && type !== "measure" && type !== "attribute") return;

  const rule = await prisma.allocationRule.findFirst({ where: { id: ruleId, companyId } });
  if (!rule) return;

  const definition = parseJsonLoose<Partial<AllocationRuleSpec>>(rule.definition, {});
  definition.driver = { type, key };

  await prisma.allocationRule.update({
    where: { id: ruleId },
    data: { definition: JSON.stringify(definition), suggested: false },
  });

  await audit({
    companyId,
    actorId: user.userId,
    action: "rule.setDriver",
    entity: "AllocationRule",
    entityId: ruleId,
    diff: { driver: definition.driver },
  });

  revalidatePath(`/app/${companyId}/settings/rules`);
  revalidatePath(`/app/${companyId}`);
}
