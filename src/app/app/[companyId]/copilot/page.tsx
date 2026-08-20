import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { aiProviderLabel } from "@/lib/ai";
import { PageHeader } from "@/components/ui";
import { periodLabel } from "@/lib/format";
import { CopilotChat } from "./chat";

export default async function CopilotPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId } = await params;
  const { period } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const snapshot = await buildSnapshot(companyId, period);
  const costObject = snapshot.dataset.dimensions.find((d) => d.isCostObject);

  const suggestions = [
    "Quelle est ma marge ce mois-ci ?",
    "Pourquoi ma marge baisse ?",
    costObject ? `Quels sont mes 5 ${costObject.label.toLowerCase()}s les moins rentables ?` : "Quels clients sont les moins rentables ?",
    "Quel département dépasse son budget ?",
    "Que se passe-t-il si j'augmente mes prix de 5 % ?",
    "Prépare-moi l'analyse mensuelle.",
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Copilote"
        description={`Les réponses sont calculées par le moteur, jamais inventées. Période analysée : ${periodLabel(snapshot.periodCode)}. Mode de rédaction : ${aiProviderLabel()}.`}
      />
      <CopilotChat companyId={companyId} periodCode={snapshot.periodCode} suggestions={suggestions} />
    </div>
  );
}
