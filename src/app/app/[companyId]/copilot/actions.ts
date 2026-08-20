"use server";

import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { ask, type CopilotAnswer } from "@/services/copilot.service";

export type CopilotState = { answers: CopilotAnswer[]; error?: string };

export async function askAction(
  companyId: string,
  periodCode: string | undefined,
  prev: CopilotState,
  formData: FormData,
): Promise<CopilotState> {
  const user = await requireUser();
  const company = await getCompany(companyId, user.organizationId);
  if (!company) return { ...prev, error: "Entreprise introuvable." };

  const question = String(formData.get("question") ?? "").trim();
  if (question.length < 3) return { ...prev, error: "Posez une question." };

  try {
    const answer = await ask(companyId, question, periodCode);
    return { answers: [...prev.answers, answer] };
  } catch {
    return { ...prev, error: "Le copilote n'a pas pu répondre." };
  }
}
