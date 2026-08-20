import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { computeMeasures, memberLabel } from "@/core/model/dataset";
import { Badge, Callout, Card, Num, PageHeader, Table } from "@/components/ui";
import { BarList } from "@/components/charts";
import { money, percent } from "@/lib/format";
import { PeriodSelector } from "../period-selector";

export default async function CostsPage({
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
  const base = `/app/${companyId}`;
  const m = snapshot.measures;

  // Coûts par nature, lus directement dans les mesures dynamiques (aucune table dédiée).
  const natures = Object.entries(m)
    .filter(([key]) => key.startsWith("cost_"))
    .map(([key, value]) => ({
      code: key.replace("cost_", ""),
      label: memberLabel(snapshot.dataset, "NATURE", key.replace("cost_", "")),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const centerLabels = new Map(
    snapshot.dataset.members.filter((x) => x.dimensionCode === "CENTER").map((x) => [x.code, x.label]),
  );

  const behaviourSplit = [
    { label: "Coûts variables", value: m.variableCost ?? 0 },
    { label: "Coûts fixes", value: m.fixedCost ?? 0 },
  ];
  const traceabilitySplit = [
    { label: "Coûts directs", value: m.directCost ?? 0 },
    { label: "Coûts indirects", value: m.indirectCost ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Coûts"
        description="Classement, cheminement d'affectation et coût par objet. Chaque euro affecté conserve sa trace : le drill-down n'est pas une estimation."
        action={<PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
        {[
          { label: "Coûts totaux", value: money(m.costTotal ?? 0), hint: `${snapshot.costing.allocations.length} affectations` },
          { label: "Coûts directs", value: money(m.directCost ?? 0), hint: percent(((m.directCost ?? 0) / (m.costTotal || 1)) * 100) },
          { label: "Coûts indirects", value: money(m.indirectCost ?? 0), hint: percent(((m.indirectCost ?? 0) / (m.costTotal || 1)) * 100) },
          {
            label: "Non affecté",
            value: money(snapshot.costing.totals.unallocatedIndirect),
            hint: snapshot.costing.totals.unallocatedIndirect > 0 ? "à corriger" : "conservation vérifiée",
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="muted text-xs font-medium uppercase tracking-wide">{stat.label}</p>
            <p className="text-2xl font-semibold mt-1 tabular">{stat.value}</p>
            <p className="muted text-xs mt-1">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Coûts par nature" subtitle="Les natures viennent des données, pas d'une liste figée">
          <BarList
            items={natures.map((n) => ({
              label: n.label,
              value: n.value,
              secondary: percent((n.value / (m.costTotal || 1)) * 100),
            }))}
          />
        </Card>

        <Card title="Classement des charges">
          <p className="text-sm font-medium mb-2">Fixe / variable</p>
          <BarList items={behaviourSplit} />
          <p className="text-sm font-medium mt-5 mb-2">Direct / indirect</p>
          <BarList items={traceabilitySplit} />
          {(m.semiVariableCost ?? 0) > 0 && (
            <p className="muted text-xs mt-4">
              {money(m.semiVariableCost ?? 0)} de charges semi-variables ont été décomposées par la méthode
              des points extrêmes avant d&apos;être classées.
            </p>
          )}
        </Card>
      </div>

      <Card
        className="mt-5"
        title="Centres de responsabilité"
        subtitle="Charges indirectes rattachées puis redistribuées aux objets de coûts"
        action={
          <Link href={`${base}/settings/rules`} className="text-xs text-brand-600">
            Règles d&apos;affectation
          </Link>
        }
      >
        {snapshot.costing.centerTotals.length === 0 ? (
          <p className="muted text-sm">Aucune charge indirecte rattachée à un centre sur la période.</p>
        ) : (
          <Table headers={["Centre", "Charges rattachées", "Reçu (étape 2)", "Cédé (étape 2)", "À répartir"]}>
            {snapshot.costing.centerTotals
              .sort((a, b) => b.total - a.total)
              .map((center) => (
                <tr key={center.memberCode}>
                  <td>{centerLabels.get(center.memberCode) ?? center.memberCode}</td>
                  <td className="text-right"><Num>{money(center.directIndirect)}</Num></td>
                  <td className="text-right"><Num tone="muted">{money(center.received)}</Num></td>
                  <td className="text-right"><Num tone="muted">{money(center.given)}</Num></td>
                  <td className="text-right font-medium"><Num>{money(center.total)}</Num></td>
                </tr>
              ))}
          </Table>
        )}
      </Card>

      <Card
        className="mt-5"
        title="Traces d'affectation"
        subtitle="Piste d'audit : chaque montant affecté porte sa règle et sa base de répartition"
        action={
          <a href={`${base}/export?type=allocations&period=${snapshot.periodCode}`} className="text-xs text-brand-600">
            Exporter en CSV
          </a>
        }
      >
        <Table headers={["Étape", "Règle", "Source", "Vers", "Inducteur", "Base", "Montant"]}>
          {snapshot.costing.allocations
            .filter((a) => a.sourceKind === "center")
            .slice(0, 25)
            .map((allocation, index) => (
              <tr key={`${allocation.ruleId}-${index}`}>
                <td>{allocation.stage}</td>
                <td className="text-xs">{allocation.ruleName}</td>
                <td className="text-right text-xs">
                  {centerLabels.get(allocation.sourceRef) ?? allocation.sourceRef}
                </td>
                <td className="text-right text-xs">
                  {memberLabel(snapshot.dataset, allocation.targetDimension, allocation.targetMemberCode)}
                </td>
                <td className="text-right text-xs">{allocation.driverKey ?? "—"}</td>
                <td className="text-right text-xs tabular">
                  {allocation.driverValue !== undefined && allocation.driverTotal
                    ? `${Math.round(allocation.driverValue)} / ${Math.round(allocation.driverTotal)}`
                    : "—"}
                </td>
                <td className="text-right"><Num>{money(allocation.amount)}</Num></td>
              </tr>
            ))}
        </Table>
        <p className="muted text-xs mt-3">
          25 premières lignes de l&apos;étape 3 (centres → objets). Total des affectations :{" "}
          {snapshot.costing.allocations.length} lignes, masse conservée à moins d&apos;un centime près.
        </p>
      </Card>

      {snapshot.costing.warnings.length > 0 && (
        <div className="mt-5">
          <Callout tone="warn">
            <ul className="space-y-1">
              {snapshot.costing.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      <Card className="mt-5" title="Méthodes de coûts actives">
        <div className="flex flex-wrap gap-2">
          {snapshot.configuration.costMethods.map((method) => (
            <Badge key={method} tone="brand">
              {METHOD_LABELS[method] ?? method}
            </Badge>
          ))}
        </div>
        <p className="muted text-xs mt-3">
          Les méthodes sont choisies par le moteur de règles selon votre modèle économique et votre maturité.
          Elles se combinent : le même jeu d&apos;écritures alimente le coût variable et le coût complet.
        </p>
      </Card>
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = {
  full: "Coût complet",
  variable: "Coût variable (direct costing)",
  direct: "Coût spécifique",
  abc: "Coûts par activités (ABC)",
  standard: "Coûts standards / préétablis",
  marginal: "Coût marginal",
};
