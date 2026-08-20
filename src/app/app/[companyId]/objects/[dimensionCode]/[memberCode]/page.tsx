import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { computeMeasures } from "@/core/model/dataset";
import { computeProgress } from "@/core/costing/progress";
import { Badge, Callout, Card, Num, PageHeader, Table } from "@/components/ui";
import { CascadeBar, ProgressBar, TrendChart } from "@/components/charts";
import { dateLabel, money, percent, periodLabel } from "@/lib/format";

export default async function ObjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; dimensionCode: string; memberCode: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId, dimensionCode, memberCode } = await params;
  const { period } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const snapshot = await buildSnapshot(companyId, period);
  const dimension = snapshot.dataset.dimensions.find((d) => d.code === dimensionCode);
  const member = snapshot.dataset.members.find(
    (m) => m.dimensionCode === dimensionCode && m.code === memberCode,
  );
  if (!dimension || !member) notFound();

  const base = `/app/${companyId}`;
  const filter = { dimensionFilters: [{ dimensionCode, memberCodes: [memberCode] }] };
  const measures = computeMeasures(snapshot.dataset, { periodCodes: [snapshot.periodCode], filter });
  const cumulative = computeMeasures(snapshot.dataset, { filter });
  const line = snapshot.margins[dimensionCode]?.lines.find((l) => l.memberCode === memberCode);
  const progress = computeProgress(snapshot.dataset, dimensionCode).find((p) => p.memberCode === memberCode);

  const withData = snapshot.periodCodes.filter((code) =>
    snapshot.dataset.entries.some((e) => e.periodCode === code && e.dims[dimensionCode] === memberCode),
  );
  const series = withData.map((code) => ({
    periodCode: code,
    value: computeMeasures(snapshot.dataset, { periodCodes: [code], filter }).revenue ?? 0,
  }));

  const natures = Object.entries(cumulative)
    .filter(([key]) => key.startsWith("cost_"))
    .map(([key, value]) => ({
      code: key.replace("cost_", ""),
      label: snapshot.dataset.members.find((m) => m.dimensionCode === "NATURE" && m.code === key.replace("cost_", ""))?.label ?? key.replace("cost_", ""),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const entries = snapshot.dataset.entries
    .filter((e) => e.dims[dimensionCode] === memberCode && e.periodCode === snapshot.periodCode)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  return (
    <div>
      <PageHeader
        title={member.label}
        description={
          <>
            {dimension.label} ·{" "}
            <Link href={`${base}/objects/${dimensionCode}`} className="text-brand-600">
              retour à la liste
            </Link>
            {member.attributes.client ? ` · client ${String(member.attributes.client)}` : ""}
          </>
        }
      />

      {progress && (
        <Card
          className="mb-5"
          title="Suivi à terminaison"
          subtitle={
            progress.progressMethod === "physical"
              ? "Avancement physique déclaré"
              : "Avancement estimé par les coûts engagés (cost-to-cost)"
          }
          action={
            progress.status !== "ok" && (
              <Badge tone={progress.status === "critical" ? "bad" : "warn"}>
                {progress.status === "critical" ? "dérive confirmée" : "vigilance"}
              </Badge>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6 mb-4">
            <Metric label="Prix contractuel" value={money(progress.contractValue)} />
            <Metric label="Budget" value={money(progress.budgetTotal)} />
            <Metric label="Coût encouru" value={money(progress.costIncurred)} />
            <Metric label="Coût à terminaison" value={money(progress.estimateAtCompletion)} />
            <Metric label="Reste à engager" value={money(progress.estimateToComplete)} />
            <Metric
              label="Marge à terminaison"
              value={money(progress.marginAtCompletion)}
              hint={percent(progress.marginAtCompletionRate)}
              tone={progress.marginAtCompletion < 0 ? "bad" : "good"}
            />
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs muted mb-1">
                <span>Avancement</span>
                <span className="tabular">{percent(progress.progressPct, 0)}</span>
              </div>
              <ProgressBar value={progress.progressPct} tone="brand" />
            </div>
            <div>
              <div className="flex justify-between text-xs muted mb-1">
                <span>Budget consommé</span>
                <span className="tabular">{percent(progress.consumptionPct, 0)}</span>
              </div>
              <ProgressBar
                value={progress.consumptionPct ?? 0}
                tone={(progress.consumptionGapPts ?? 0) > 15 ? "bad" : (progress.consumptionGapPts ?? 0) > 5 ? "warn" : "good"}
              />
            </div>
          </div>

          <div className="mt-4">
            <Callout tone={progress.drift > 0 ? "bad" : "good"}>
              {progress.drift > 0
                ? `Le coût à terminaison dépasse le budget de ${money(progress.drift)} (${percent(progress.driftPct)}). La marge passe de ${percent(progress.budgetedMarginRate)} à ${percent(progress.marginAtCompletionRate)}.`
                : `Le coût à terminaison reste sous le budget de ${money(Math.abs(progress.drift))}. Marge projetée ${percent(progress.marginAtCompletionRate)} contre ${percent(progress.budgetedMarginRate)} au budget.`}
            </Callout>
          </div>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`Formation de la marge — ${periodLabel(snapshot.periodCode)}`}>
          {line ? (
            <CascadeBar
              rows={[
                { label: "Chiffre d'affaires", value: line.revenue, emphasis: true },
                { label: "− Coûts variables directs", value: -line.variableDirectCost },
                {
                  label: "= Marge sur coûts variables",
                  value: line.contributionMargin,
                  emphasis: true,
                  hint: percent(line.contributionMarginRate),
                },
                { label: "− Coûts fixes directs", value: -line.fixedDirectCost },
                { label: "= Marge contributive", value: line.contributiveMargin, emphasis: true },
                { label: "− Indirects affectés", value: -line.allocatedIndirect },
                {
                  label: "= Marge opérationnelle",
                  value: line.operatingMargin,
                  emphasis: true,
                  hint: percent(line.operatingMarginRate),
                },
              ]}
            />
          ) : (
            <p className="muted text-sm">Aucune donnée sur la période.</p>
          )}
        </Card>

        <Card title="Coûts cumulés par nature" subtitle="Sur l'ensemble des périodes chargées">
          <Table headers={["Nature", "Montant", "Part"]}>
            {natures.map((nature) => (
              <tr key={nature.code}>
                <td>{nature.label}</td>
                <td className="text-right"><Num>{money(nature.value)}</Num></td>
                <td className="text-right">
                  <Num tone="muted">{percent((nature.value / (cumulative.costTotal || 1)) * 100)}</Num>
                </td>
              </tr>
            ))}
            <tr>
              <td className="font-semibold">Total</td>
              <td className="text-right font-semibold"><Num>{money(cumulative.costTotal ?? 0)}</Num></td>
              <td className="text-right">100 %</td>
            </tr>
          </Table>
        </Card>
      </div>

      <Card className="mt-5" title="Historique du chiffre d'affaires">
        <TrendChart points={series} />
      </Card>

      <Card
        className="mt-5"
        title={`Écritures de ${periodLabel(snapshot.periodCode)}`}
        subtitle="Drill-down jusqu'à la donnée source"
        action={
          <a href={`${base}/export?type=entries&period=${snapshot.periodCode}`} className="text-xs text-brand-600">
            Exporter en CSV
          </a>
        }
      >
        {entries.length === 0 ? (
          <p className="muted text-sm">Aucune écriture sur la période.</p>
        ) : (
          <Table headers={["Date", "Libellé", "Type", "Nature", "Classement", "Quantité", "Montant"]}>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="text-xs">{dateLabel(entry.date)}</td>
                <td>{entry.label}</td>
                <td className="text-right text-xs muted">{entry.kind === "REVENUE" ? "produit" : "charge"}</td>
                <td className="text-right text-xs muted">{entry.dims.NATURE ?? "—"}</td>
                <td className="text-right text-xs muted">
                  {entry.kind === "COST" ? `${entry.behavior.toLowerCase()} · ${entry.traceability.toLowerCase()}` : "—"}
                </td>
                <td className="text-right"><Num>{entry.quantity ?? "—"}</Num></td>
                <td className="text-right"><Num>{money(entry.amount)}</Num></td>
              </tr>
            ))}
          </Table>
        )}
        <p className="muted text-xs mt-3">
          Période : {money(measures.revenue ?? 0)} de produits · {money(measures.costTotal ?? 0)} de charges.
          Cumul toutes périodes : {money(cumulative.revenue ?? 0)} / {money(cumulative.costTotal ?? 0)}.
        </p>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <p className="muted text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold tabular mt-0.5 ${tone === "bad" ? "text-bad-500" : tone === "good" ? "text-good-500" : ""}`}>
        {value}
      </p>
      {hint && <p className="muted text-xs">{hint}</p>}
    </div>
  );
}
