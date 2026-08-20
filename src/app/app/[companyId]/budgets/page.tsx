import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { listBudgets } from "@/services/budget.service";
import { prisma } from "@/lib/db";
import { Badge, Card, Num, PageHeader, Table } from "@/components/ui";
import { money, periodLabel } from "@/lib/format";
import { approveBudgetAction, deleteBudgetAction } from "./actions";
import { NewBudgetForm } from "./new-budget-form";

export default async function BudgetsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const [budgets, periods] = await Promise.all([
    listBudgets(companyId),
    prisma.period.findMany({ where: { companyId }, orderBy: { code: "asc" } }),
  ]);

  const years = [...new Set(periods.map((p) => p.fiscalYear))].sort();
  const totals = new Map<string, { revenue: number; cost: number }>();
  for (const budget of budgets) {
    const lines = await prisma.budgetLine.findMany({ where: { budgetId: budget.id } });
    totals.set(budget.id, {
      revenue: lines.filter((l) => l.kind === "REVENUE").reduce((s, l) => s + l.amount, 0),
      cost: lines.filter((l) => l.kind === "COST").reduce((s, l) => s + l.amount, 0),
    });
  }

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Un budget approuvé est immuable : toute modification crée une nouvelle version, et l'historique reste consultable."
      />

      <Card title="Construire un budget depuis l'historique" subtitle="Le réel de l'exercice source est projeté mois par mois, saisonnalité conservée">
        <NewBudgetForm companyId={companyId} years={years} />
      </Card>

      <Card className="mt-5" title={`Budgets existants (${budgets.length})`}>
        {budgets.length === 0 ? (
          <p className="muted text-sm">Aucun budget pour le moment.</p>
        ) : (
          <Table headers={["Budget", "Exercice", "Type", "Version", "Statut", "CA budgété", "Charges", "Résultat", "Lignes", ""]}>
            {budgets.map((budget) => {
              const total = totals.get(budget.id) ?? { revenue: 0, cost: 0 };
              return (
                <tr key={budget.id}>
                  <td>{budget.name}</td>
                  <td className="text-right">{budget.fiscalYear}</td>
                  <td className="text-right text-xs muted">{budget.kind}</td>
                  <td className="text-right">v{budget.version}</td>
                  <td className="text-right">
                    <Badge tone={budget.status === "APPROVED" ? "good" : "neutral"}>
                      {budget.status === "APPROVED" ? "approuvé" : "brouillon"}
                    </Badge>
                  </td>
                  <td className="text-right"><Num>{money(total.revenue)}</Num></td>
                  <td className="text-right"><Num>{money(total.cost)}</Num></td>
                  <td className="text-right">
                    <Num tone={total.revenue - total.cost < 0 ? "bad" : "good"}>
                      {money(total.revenue - total.cost)}
                    </Num>
                  </td>
                  <td className="text-right">{budget._count.lines}</td>
                  <td className="text-right">
                    <div className="flex gap-2 justify-end">
                      {budget.status !== "APPROVED" && (
                        <>
                          <form action={approveBudgetAction.bind(null, companyId, budget.id)}>
                            <button className="text-xs text-brand-600">approuver</button>
                          </form>
                          <form action={deleteBudgetAction.bind(null, companyId, budget.id)}>
                            <button className="text-xs text-bad-500">supprimer</button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card className="mt-5" title="Ce que le budget débloque">
        <ul className="text-sm space-y-2 muted">
          <li>
            <strong className="text-current">Écarts</strong> — comparaison réel / budget / N-1 avec sens
            favorable ou défavorable par nature.
          </li>
          <li>
            <strong className="text-current">Décomposition prix / volume / composition</strong> — possible dès
            que les lignes budgétaires portent une quantité et un prix unitaire.
          </li>
          <li>
            <strong className="text-current">Budget flexible</strong> — le budget est ramené au niveau
            d&apos;activité réel pour distinguer un écart de dépense d&apos;un écart de volume.
          </li>
          <li>
            <strong className="text-current">Alertes budgétaires</strong> — dépassement constaté et
            consommation plus rapide que l&apos;avancement.
          </li>
        </ul>
        <p className="muted text-xs mt-4">
          Périodes disponibles : {periods.length > 0 ? `${periodLabel(periods[0].code)} → ${periodLabel(periods[periods.length - 1].code)}` : "aucune"}.
        </p>
      </Card>
    </div>
  );
}
