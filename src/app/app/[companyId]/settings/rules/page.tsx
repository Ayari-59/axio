import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany, loadAllocationRules, loadDataset } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { Badge, Card, Num, PageHeader, Table } from "@/components/ui";
import { money } from "@/lib/format";
import { toggleRuleAction, updateDriverAction } from "./actions";

const STAGE_LABELS: Record<number, string> = {
  1: "Étape 1 — charges → centres",
  2: "Étape 2 — centres → centres et activités",
  3: "Étape 3 — centres, activités et charges directes → objets de coûts",
};

const METHOD_LABELS: Record<string, string> = {
  DIRECT: "Affectation directe",
  DRIVER: "Clé de répartition",
  PERCENT: "Pourcentages",
  EQUAL: "Répartition égale",
  ABC: "Activités (ABC)",
};

export default async function RulesPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const [rules, dataset, snapshot] = await Promise.all([
    loadAllocationRules(companyId),
    loadDataset(companyId),
    buildSnapshot(companyId),
  ]);

  const dimensionLabel = (code: string) =>
    code === "AUTO_COST_OBJECT"
      ? "tous les objets de coûts"
      : (dataset.dimensions.find((d) => d.code === code)?.label ?? code);

  const availableDrivers = [...new Set(dataset.drivers.map((d) => d.driverCode))];
  const impact = new Map<string, number>();
  for (const allocation of snapshot.costing.allocations) {
    impact.set(allocation.ruleId, (impact.get(allocation.ruleId) ?? 0) + Math.abs(allocation.amount));
  }

  const stages = [1, 2, 3];

  return (
    <div>
      <PageHeader
        title="Règles d'affectation"
        description="Le cheminement des charges est entièrement paramétrable : source, méthode, inducteur et ordre. Chaque modification est immédiatement reflétée dans les coûts et les marges."
        action={
          <a href={`/app/${companyId}/settings/activities`} className="text-sm text-brand-600">
            Comptabilité par activités →
          </a>
        }
      />

      <div className="space-y-5">
        {stages.map((stage) => {
          const stageRules = rules.filter((rule) => rule.stage === stage);
          return (
            <Card key={stage} title={STAGE_LABELS[stage]} subtitle={`${stageRules.length} règle(s)`}>
              {stageRules.length === 0 ? (
                <p className="muted text-sm">Aucune règle à cette étape.</p>
              ) : (
                <Table headers={["Règle", "Source", "Méthode", "Vers", "Inducteur", "Montant affecté", "Active"]}>
                  {stageRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <span className="font-medium">{rule.name}</span>
                      </td>
                      <td className="text-right text-xs muted">
                        {[
                          rule.source.kinds?.join("/"),
                          rule.source.traceabilities?.join("/"),
                          rule.source.requiresDimensions?.length ? `avec ${rule.source.requiresDimensions.join(",")}` : null,
                          rule.source.missingDimensions?.length ? `sans ${rule.source.missingDimensions.join(",")}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "toutes charges"}
                      </td>
                      <td className="text-right text-xs">{METHOD_LABELS[rule.method] ?? rule.method}</td>
                      <td className="text-right text-xs">{dimensionLabel(rule.targetDimensionCode)}</td>
                      <td className="text-right">
                        {rule.method === "DRIVER" ? (
                          <form action={updateDriverAction.bind(null, companyId, rule.id)} className="flex justify-end gap-1">
                            <select name="driverKey" defaultValue={rule.driver?.key ?? ""} className="w-auto text-xs">
                              <optgroup label="Inducteurs saisis">
                                {availableDrivers.map((code) => (
                                  <option key={code} value={`driver:${code}`}>
                                    {code}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Mesures calculées">
                                <option value="measure:revenue">chiffre d&apos;affaires</option>
                                <option value="measure:directCost">coût direct engagé</option>
                                <option value="measure:totalCost">coût total</option>
                                <option value="measure:quantity">quantité</option>
                              </optgroup>
                              <optgroup label="Attributs de membre">
                                <option value="attribute:m2">surface (m²)</option>
                                <option value="attribute:headcount">effectif</option>
                                <option value="attribute:capacity">capacité</option>
                              </optgroup>
                            </select>
                            <button className="text-xs text-brand-600">appliquer</button>
                          </form>
                        ) : (
                          <span className="muted text-xs">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <Num>{money(impact.get(rule.id) ?? 0)}</Num>
                      </td>
                      <td className="text-right">
                        <form action={toggleRuleAction.bind(null, companyId, rule.id)}>
                          <button className="text-xs">
                            <Badge tone={rule.active ? "good" : "neutral"}>{rule.active ? "active" : "inactive"}</Badge>
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-5" title="Effet du paramétrage" subtitle="Période analysée : le total affecté doit toujours égaler le total des charges">
        <dl className="grid gap-4 sm:grid-cols-4 text-sm">
          <div>
            <dt className="muted text-xs">Charges de la période</dt>
            <dd className="tabular">{money(snapshot.costing.totals.cost)}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Dont indirectes</dt>
            <dd className="tabular">{money(snapshot.costing.totals.indirectCost)}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Réparties aux objets</dt>
            <dd className="tabular">{money(snapshot.costing.totals.allocatedIndirect)}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Non affectées</dt>
            <dd className={`tabular ${snapshot.costing.totals.unallocatedIndirect > 0 ? "text-bad-500" : ""}`}>
              {money(snapshot.costing.totals.unallocatedIndirect)}
            </dd>
          </div>
        </dl>
        {snapshot.costing.warnings.length > 0 && (
          <ul className="mt-4 text-sm text-warn-500 space-y-1">
            {snapshot.costing.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
