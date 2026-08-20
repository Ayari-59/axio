import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { buildSnapshot } from "@/services/analysis.service";
import { parseJsonLoose } from "@/lib/json";
import { Card, Num, PageHeader, Table } from "@/components/ui";
import { money, dateLabel, periodLabel } from "@/lib/format";
import { PeriodSelector } from "../period-selector";
import { Simulator } from "./simulator";
import { deleteScenarioAction } from "./actions";
import type { SimulationResult } from "@/core/analytics/simulation";

export default async function ScenariosPage({
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
  const scenarios = await prisma.scenario.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <PageHeader
        title="Scénarios what-if"
        description={`Simulation multi-leviers sur ${periodLabel(snapshot.periodCode)}. Le même moteur de calcul tourne dans le navigateur pour l'aperçu et sur le serveur à l'enregistrement.`}
        action={<PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />}
      />

      <Simulator companyId={companyId} periodCode={snapshot.periodCode} model={snapshot.economicModel} />

      <Card className="mt-5" title="Scénarios enregistrés">
        {scenarios.length === 0 ? (
          <p className="muted text-sm">Aucun scénario enregistré.</p>
        ) : (
          <Table headers={["Scénario", "Date", "CA simulé", "Résultat simulé", "Seuil simulé", ""]}>
            {scenarios.map((scenario) => {
              const result = parseJsonLoose<SimulationResult | null>(scenario.result, null);
              return (
                <tr key={scenario.id}>
                  <td>{scenario.name}</td>
                  <td className="text-right">{dateLabel(scenario.createdAt)}</td>
                  <td className="text-right"><Num>{money(result?.after.revenue ?? null)}</Num></td>
                  <td className="text-right">
                    <Num tone={(result?.after.result ?? 0) < 0 ? "bad" : "good"}>
                      {money(result?.after.result ?? null)}
                    </Num>
                  </td>
                  <td className="text-right"><Num>{money(result?.after.breakEven ?? null)}</Num></td>
                  <td className="text-right">
                    <form action={deleteScenarioAction.bind(null, companyId, scenario.id)}>
                      <button className="text-xs text-bad-500">supprimer</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
