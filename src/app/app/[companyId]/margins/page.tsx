import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { concentration } from "@/core/costing/margins";
import { UNASSIGNED } from "@/core/costing/allocate";
import { Badge, Card, Num, PageHeader, Table } from "@/components/ui";
import { BreakEvenChart, CascadeBar } from "@/components/charts";
import { money, percent } from "@/lib/format";
import { PeriodSelector } from "../period-selector";

export default async function MarginsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string; dim?: string }>;
}) {
  const { companyId } = await params;
  const { period, dim } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const snapshot = await buildSnapshot(companyId, period);
  const base = `/app/${companyId}`;
  const dimensions = snapshot.dataset.dimensions.filter((d) => d.isCostObject);
  const active = dim && snapshot.margins[dim] ? dim : (dimensions[0]?.code ?? "");
  const result = snapshot.margins[active];
  const m = snapshot.measures;

  return (
    <div>
      <PageHeader
        title="Marges et rentabilité"
        description="Cascade de marge de l'entreprise, puis rentabilité par objet de coût. La marge contributive répond à « faut-il continuer ? », la marge opérationnelle à « la structure est-elle couverte ? »."
        action={<PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Formation de la marge" subtitle="Toutes activités confondues">
          <CascadeBar
            rows={[
              { label: "Chiffre d'affaires", value: m.revenue ?? 0, emphasis: true },
              { label: "− Coûts variables", value: -(m.variableCost ?? 0) },
              {
                label: "= Marge sur coûts variables",
                value: m.contributionMargin ?? 0,
                emphasis: true,
                hint: percent(m.contributionMarginRate ?? null),
              },
              { label: "− Coûts fixes", value: -(m.fixedCost ?? 0) },
              {
                label: "= Résultat d'exploitation",
                value: m.operatingMargin ?? 0,
                emphasis: true,
                hint: percent(m.operatingMarginRate ?? null),
              },
            ]}
          />
        </Card>

        <Card
          title="Seuil de rentabilité"
          subtitle={`Point mort atteint au jour ${snapshot.breakEven.breakEvenDay ?? "—"} de la période`}
        >
          <BreakEvenChart revenue={m.revenue ?? 0} breakEven={snapshot.breakEven.breakEven} />
          <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div>
              <dt className="muted text-xs">Marge de sécurité</dt>
              <dd className="tabular">{percent(snapshot.breakEven.safetyMarginRate)}</dd>
            </div>
            <div>
              <dt className="muted text-xs">Levier opérationnel</dt>
              <dd className="tabular">{snapshot.breakEven.operatingLeverage ?? "—"}</dd>
            </div>
            <div>
              <dt className="muted text-xs">Charges fixes</dt>
              <dd className="tabular">{money(m.fixedCost ?? 0)}</dd>
            </div>
            <div>
              <dt className="muted text-xs">Taux de marge sur CV</dt>
              <dd className="tabular">{percent(snapshot.breakEven.contributionMarginRate)}</dd>
            </div>
          </dl>
          <p className="muted text-xs mt-3">
            Une baisse d&apos;activité de {percent(snapshot.breakEven.safetyMarginRate)} ramène l&apos;entreprise
            au point mort ; au-delà, le résultat devient négatif.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="muted text-sm">Analyser par</span>
          {dimensions.map((dimension) => (
            <Link
              key={dimension.code}
              href={`${base}/margins?period=${snapshot.periodCode}&dim=${dimension.code}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                dimension.code === active ? "bg-brand-600 text-white" : "border"
              }`}
            >
              {dimension.label}
            </Link>
          ))}
        </div>

        {result ? (
          <Card
            title={`Rentabilité par ${snapshot.dataset.dimensions.find((d) => d.code === active)?.label.toLowerCase()}`}
            subtitle="Coûts directs affectés, indirects répartis selon vos règles d'affectation"
            action={
              <a
                href={`${base}/export?type=margins&dim=${active}&period=${snapshot.periodCode}`}
                className="text-xs text-brand-600"
              >
                Exporter en CSV
              </a>
            }
          >
            <Table
              headers={[
                snapshot.dataset.dimensions.find((d) => d.code === active)?.label ?? "Objet",
                "CA",
                "Coûts variables",
                "Marge sur CV",
                "Taux",
                "Coûts fixes directs",
                "Marge contributive",
                "Indirects affectés",
                "Marge opérationnelle",
              ]}
            >
              {result.lines.map((line) => (
                <tr key={line.memberCode}>
                  <td>
                    {line.memberCode === UNASSIGNED ? (
                      <span className="muted">{line.memberLabel}</span>
                    ) : (
                      <Link href={`${base}/objects/${active}/${line.memberCode}`} className="hover:underline">
                        {line.memberLabel}
                      </Link>
                    )}
                  </td>
                  <td className="text-right"><Num>{money(line.revenue)}</Num></td>
                  <td className="text-right"><Num>{money(line.variableDirectCost)}</Num></td>
                  <td className="text-right"><Num>{money(line.contributionMargin)}</Num></td>
                  <td className="text-right">
                    <Num tone={(line.contributionMarginRate ?? 0) < 0 ? "bad" : undefined}>
                      {percent(line.contributionMarginRate)}
                    </Num>
                  </td>
                  <td className="text-right"><Num>{money(line.fixedDirectCost)}</Num></td>
                  <td className="text-right">
                    <Num tone={line.contributiveMargin < 0 ? "bad" : undefined}>
                      {money(line.contributiveMargin)}
                    </Num>
                  </td>
                  <td className="text-right"><Num tone="muted">{money(line.allocatedIndirect)}</Num></td>
                  <td className="text-right">
                    <Num tone={line.operatingMargin < 0 ? "bad" : "good"}>{money(line.operatingMargin)}</Num>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold">Total</td>
                <td className="text-right font-semibold"><Num>{money(result.total.revenue)}</Num></td>
                <td className="text-right"><Num>{money(result.total.variableDirectCost)}</Num></td>
                <td className="text-right font-semibold"><Num>{money(result.total.contributionMargin)}</Num></td>
                <td className="text-right">{percent(result.total.contributionMarginRate)}</td>
                <td className="text-right"><Num>{money(result.total.fixedDirectCost)}</Num></td>
                <td className="text-right"><Num>{money(result.total.contributiveMargin)}</Num></td>
                <td className="text-right"><Num>{money(result.total.allocatedIndirect)}</Num></td>
                <td className="text-right font-semibold">
                  <Num tone={result.total.operatingMargin < 0 ? "bad" : "good"}>
                    {money(result.total.operatingMargin)}
                  </Num>
                </td>
              </tr>
            </Table>
          </Card>
        ) : (
          <Card title="Aucun objet de coût">
            <p className="muted text-sm">Configurez au moins un objet de pilotage dans les paramètres.</p>
          </Card>
        )}
      </div>

      {result && (
        <div className="grid gap-5 xl:grid-cols-2 mt-5">
          <Card title="Concentration (Pareto)" subtitle="Part cumulée du chiffre d'affaires">
            <Table headers={["Objet", "CA", "Part", "Cumul"]}>
              {concentration(result, "revenue")
                .slice(0, 10)
                .map((line) => (
                  <tr key={line.memberCode}>
                    <td>{line.memberLabel}</td>
                    <td className="text-right"><Num>{money(line.value)}</Num></td>
                    <td className="text-right"><Num>{percent(line.share)}</Num></td>
                    <td className="text-right">
                      <Num tone={line.cumulativeShare >= 80 ? "muted" : undefined}>
                        {percent(line.cumulativeShare)}
                      </Num>
                    </td>
                  </tr>
                ))}
            </Table>
          </Card>

          <Card title="Objets en difficulté" subtitle="Marge contributive négative sur la période">
            {result.lines.filter((l) => l.contributiveMargin < 0 && l.memberCode !== UNASSIGNED).length === 0 ? (
              <p className="muted text-sm">Aucun objet en perte sur cette période.</p>
            ) : (
              <ul className="space-y-3">
                {result.lines
                  .filter((l) => l.contributiveMargin < 0 && l.memberCode !== UNASSIGNED)
                  .map((line) => (
                    <li key={line.memberCode} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{line.memberLabel}</p>
                        <p className="muted text-xs">
                          CA {money(line.revenue)} · coûts directs {money(line.directCost)}
                        </p>
                      </div>
                      <Badge tone="bad">{money(line.contributiveMargin)}</Badge>
                    </li>
                  ))}
              </ul>
            )}
            <p className="muted text-xs mt-4">
              Une marge contributive négative signifie que l&apos;objet ne couvre pas ses propres coûts :
              son arrêt améliorerait le résultat, à charges fixes de structure inchangées.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
