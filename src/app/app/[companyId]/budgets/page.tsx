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
        description="Un budget approuvé est immuable ; les modifications créent une version."
      />

      <Card title="Construire un budget depuis l'historique" subtitle="Projection mensuelle du réel conservant saisonnalité">
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
            <strong className="text-current">Écarts</strong> — réel / budget / N-1 avec sens favorable/défavorable.
          </li>
          <li>
            <strong className="text-current">Décomposition prix / volume / mix</strong> — si quantité et prix unitaire.
          </li>
          <li>
            <strong className="text-current">Budget flexible</strong> — ramené au niveau d&apos;activité réel.
          </li>
          <li>
            <strong className="text-current">Alertes</strong> — dépassement et consommation vs avancement.
          </li>
        </ul>
        <p className="muted text-xs mt-4">
          Périodes disponibles : {periods.length > 0 ? `${periodLabel(periods[0].code)} → ${periodLabel(periods[periods.length - 1].code)}` : "aucune"}.
        </p>
      </Card>
    </div>
  );
}
