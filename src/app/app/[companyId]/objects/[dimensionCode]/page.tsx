import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { computeProgress } from "@/core/costing/progress";
import { UNASSIGNED } from "@/core/costing/allocate";
import { Badge, Card, EmptyState, Num, PageHeader, Table } from "@/components/ui";
import { ProgressBar } from "@/components/charts";
import { money, percent } from "@/lib/format";
import { PeriodSelector } from "../../period-selector";

export default async function ObjectListPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; dimensionCode: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId, dimensionCode } = await params;
  const { period } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const snapshot = await buildSnapshot(companyId, period);
  const dimension = snapshot.dataset.dimensions.find((d) => d.code === dimensionCode);
  if (!dimension) notFound();

  const base = `/app/${companyId}`;
  const margins = snapshot.margins[dimensionCode];
  const progress = computeProgress(snapshot.dataset, dimensionCode);
  const progressByMember = new Map(progress.map((p) => [p.memberCode, p]));

  if (!margins) {
    return (
      <div>
        <PageHeader title={dimension.label} />
        <EmptyState
          title="Cet axe n'est pas un objet de coût"
          description="Seuls les axes marqués comme objets de coûts portent une rentabilité complète."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${dimension.label}s`}
        description="Rentabilité de la période et, lorsque l'affaire porte un budget, suivi à terminaison."
        action={<PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />}
      />

      <Card title={`${margins.lines.length} ${dimension.label.toLowerCase()}s`}>
        <Table
          headers={[
            dimension.label,
            "CA période",
            "Marge sur CV",
            "Taux",
            "Marge opérationnelle",
            "Avancement",
            "Dérive à terminaison",
            "",
          ]}
        >
          {margins.lines.map((line) => {
            const progressLine = progressByMember.get(line.memberCode);
            return (
              <tr key={line.memberCode}>
                <td>
                  {line.memberCode === UNASSIGNED ? (
                    <span className="muted">{line.memberLabel}</span>
                  ) : (
                    <Link href={`${base}/objects/${dimensionCode}/${line.memberCode}`} className="hover:underline">
                      {line.memberLabel}
                    </Link>
                  )}
                </td>
                <td className="text-right"><Num>{money(line.revenue)}</Num></td>
                <td className="text-right"><Num>{money(line.contributionMargin)}</Num></td>
                <td className="text-right">
                  <Num tone={(line.contributionMarginRate ?? 0) < 0 ? "bad" : undefined}>
                    {percent(line.contributionMarginRate)}
                  </Num>
                </td>
                <td className="text-right">
                  <Num tone={line.operatingMargin < 0 ? "bad" : "good"}>{money(line.operatingMargin)}</Num>
                </td>
                <td className="text-right w-32">
                  {progressLine ? (
                    <div>
                      <ProgressBar
                        value={progressLine.progressPct}
                        tone={progressLine.status === "critical" ? "bad" : progressLine.status === "watch" ? "warn" : "good"}
                      />
                      <span className="text-xs muted tabular">{percent(progressLine.progressPct, 0)}</span>
                    </div>
                  ) : (
                    <span className="muted text-xs">—</span>
                  )}
                </td>
                <td className="text-right">
                  {progressLine ? (
                    <Num tone={progressLine.drift > 0 ? "bad" : "good"}>{money(progressLine.drift)}</Num>
                  ) : (
                    <span className="muted text-xs">—</span>
                  )}
                </td>
                <td className="text-right">
                  {progressLine && progressLine.status !== "ok" && (
                    <Badge tone={progressLine.status === "critical" ? "bad" : "warn"}>
                      {progressLine.status === "critical" ? "dérive" : "vigilance"}
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
