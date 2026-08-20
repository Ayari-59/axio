"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { getCompany, audit } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { buildSnapshot } from "@/services/analysis.service";
import { simulate, type Lever } from "@/core/analytics/simulation";

export type ScenarioState = { error?: string; success?: string };

export async function saveScenarioAction(
  companyId: string,
  _prev: ScenarioState,
  formData: FormData,
): Promise<ScenarioState> {
  const user = await requireUser();
  assertCan(user.role, "scenario.run");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) return { error: "Entreprise introuvable." };

  const name = String(formData.get("name") ?? "").trim() || "Scénario sans nom";
  const levers = JSON.parse(String(formData.get("levers") ?? "[]")) as Lever[];
  const periodCode = String(formData.get("periodCode") ?? "") || undefined;

  // Le scénario est recalculé côté serveur : l'aperçu client ne fait jamais foi.
  const snapshot = await buildSnapshot(companyId, periodCode);
  const result = simulate(snapshot.economicModel, levers);

  await prisma.scenario.create({
    data: {
      companyId,
      name,
      definition: JSON.stringify({ base: { periodIds: [snapshot.periodCode] }, levers }),
      result: JSON.stringify(result),
    },
  });

  await audit({ companyId, actorId: user.userId, action: "scenario.save", entity: "Scenario", diff: { name, levers } });
  revalidatePath(`/app/${companyId}/scenarios`);
  return { success: `Scénario « ${name} » enregistré (résultat recalculé côté serveur).` };
}

export async function deleteScenarioAction(companyId: string, scenarioId: string): Promise<void> {
  const user = await requireUser();
  assertCan(user.role, "scenario.run");
  await prisma.scenario.deleteMany({ where: { id: scenarioId, companyId } });
  revalidatePath(`/app/${companyId}/scenarios`);
}
