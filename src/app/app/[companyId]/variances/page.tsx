import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { buildVarianceView } from "@/services/budget.service";
import { attribute } from "@/core/budget/attribution";
import { Badge, Callout, Card, EmptyState, LinkButton, Num, PageHeader, Table } from "@/components/ui";
import { Waterfall } from "@/components/charts";
import { money, percent, periodLabel, signedPercent } from "@/lib/format";
import { PeriodSelector } from "../period-selector";

export default async function VariancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string; dim?: string; measure?: string }>;
}) {
  const { companyId } = await params;
  const { period, dim, measure } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const snapshot = await buildSnapshot(companyId, period);
  const base = `/app/${companyId}`;
  const view = buildVarianceView(snapshot.dataset, snapshot.periodCode, { dimensionCode: dim });

  if (!view.budget) {
    return (
      <div>
        <PageHeader title="Analyse des écarts" />
        <EmptyState
          title="Aucun budget de référence"
          description="Créez un budget pour analyser les écarts."
          action={<LinkButton href={`${base}/budgets`} variant="primary">Construire un budget</LinkButton>}
        />
      </div>
    );
  }

  const analysisMeasure = measure ?? "contributionMargin";
  const costObjects = snapshot.dataset.dimensions.filter((d) => d.isCostObject);
  const attributionDimension = dim ?? costObjects[0]?.code ?? "NATURE";
  const attribution = snapshot.previousPeriodCode
    ? attribute(snapshot.dataset, {
        measure: analysisMeasure,
        dimensionCode: attributionDimension,
        currentPeriods: [snapshot.periodCode],
        referencePeriods: [snapshot.previousPeriodCode],
      })
    : null;

  const result = view.totals.actualRevenue - view.totals.actualCost;
  const budgetResult = view.totals.budgetRevenue - view.totals.budgetCost;

  return (
    <div>
      <PageHeader
        title="Analyse des écarts"
        description="Réel vs budget et décomposition."
        action={<PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
        <Kpi label="CA réel" value={money(view.totals.actualRevenue)} hint={`budget ${money(view.totals.budgetRevenue)}`} delta={pct(view.totals.actualRevenue, view.totals.budgetRevenue)} good />
        <Kpi label="Charges réelles" value={money(view.totals.actualCost)} hint={`budget ${money(view.totals.budgetCost)}`} delta={pct(view.totals.actualCost, view.totals.budgetCost)} good={false} />
        <Kpi label="Résultat réel" value={money(result)} hint={`budget ${money(budgetResult)}`} delta={pct(result, budgetResult)} good />
        <Kpi
          label="Écart de résultat"
          value={money(result - budgetResult)}
          hint={result - budgetResult >= 0 ? "favorable" : "défavorable"}
          delta={null}
          good={result - budgetResult >= 0}
        />
      </div>

      <Card title="Du budget au réel" subtitle="Passage du résultat budgété au résultat constaté">
        <Waterfall
          steps={[
            { label: "Résultat budgété", value: budgetResult, kind: "start" },
            { label: "Effet chiffre d'affaires", value: view.totals.actualRevenue - view.totals.budgetRevenue, kind: "delta" },
            { label: "Effet charges", value: -(view.totals.actualCost - view.totals.budgetCost), kind: "delta" },
            { label: "Résultat réel", value: result, kind: "end" },
          ]}
        />
      </Card>

      {view.pvm && (
        <Card
          className="mt-5"
          title="Décomposition prix / volume / composition"
          subtitle={`Sur l'axe ${snapshot.dataset.dimensions.find((d) => d.code === view.pvmDimension)?.label ?? view.pvmDimension} — la somme des composantes égale l'écart total`}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Waterfall
              steps={[
                { label: "CA budgété", value: view.pvm.budgetTotal, kind: "start" },
                { label: "Effet prix", value: view.pvm.price, kind: "delta" },
                { label: "Effet volume", value: view.pvm.volume, kind: "delta" },
                { label: "Effet composition", value: view.pvm.mix, kind: "delta" },
                { label: "CA réel", value: view.pvm.actualTotal, kind: "end" },
              ]}
            />
            <div>
              <Table headers={["Objet", "Prix", "Volume", "Mix", "Écart"]}>
                {view.pvm.byItem.slice(0, 8).map((item) => (
                  <tr key={item.key}>
                    <td>{item.label}</td>
                    <td className="text-right"><Num tone={item.price < 0 ? "bad" : undefined}>{money(item.price)}</Num></td>
                    <td className="text-right"><Num tone={item.volume < 0 ? "bad" : undefined}>{money(item.volume)}</Num></td>
                    <td className="text-right"><Num tone={item.mix < 0 ? "bad" : undefined}>{money(item.mix)}</Num></td>
                    <td className="text-right font-medium"><Num tone={item.total < 0 ? "bad" : "good"}>{money(item.total)}</Num></td>
                  </tr>
                ))}
              </Table>
              <p className="muted text-xs mt-3">
                Prix = Σ Q<sub>réel</sub>(P<sub>réel</sub> − P<sub>budget</sub>) · Volume = variation quantité · Mix = composition. Prix moyen : {money(view.pvm.averageBudgetPrice)}.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card
        className="mt-5"
        title="Écarts par nature"
        subtitle="Réel, budget, N-1 et sens de l'écart"
        action={
          <a href={`${base}/export?type=variances&period=${snapshot.periodCode}`} className="text-xs text-brand-600">
            Exporter en CSV
          </a>
        }
      >
        <Table headers={["Nature", "Type", "Réel", "Budget", "N-1", "Écart", "%", "Sens", "Part"]}>
          {view.lines.map((line) => (
            <tr key={line.key}>
              <td>{line.label}</td>
              <td className="text-right text-xs muted">{line.kind === "REVENUE" ? "Produit" : "Charge"}</td>
              <td className="text-right"><Num>{money(line.actual)}</Num></td>
              <td className="text-right"><Num>{money(line.budget)}</Num></td>
              <td className="text-right"><Num tone="muted">{line.lastYear === null ? "—" : money(line.lastYear)}</Num></td>
              <td className="text-right"><Num tone={line.sense === "favorable" ? "good" : line.sense === "unfavorable" ? "bad" : undefined}>{money(line.variance)}</Num></td>
              <td className="text-right"><Num>{signedPercent(line.variancePct)}</Num></td>
              <td className="text-right">
                <Badge tone={line.sense === "favorable" ? "good" : line.sense === "unfavorable" ? "bad" : "neutral"}>
                  {line.sense === "favorable" ? "favorable" : line.sense === "unfavorable" ? "défavorable" : "neutre"}
                </Badge>
              </td>
              <td className="text-right"><Num tone="muted">{percent(line.contribution)}</Num></td>
            </tr>
          ))}
        </Table>
      </Card>

      {attribution && (
        <Card
          className="mt-5"
          title="Qui explique la variation ?"
          subtitle={measureLabel(analysisMeasure)}
          action={
            <div className="flex gap-1.5">
              {costObjects.map((dimension) => (
                <Link
                  key={dimension.code}
                  href={`${base}/variances?period=${snapshot.periodCode}&dim=${dimension.code}&measure=${analysisMeasure}`}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    dimension.code === attributionDimension ? "bg-brand-600 text-white" : "border"
                  }`}
                >
                  {dimension.label}
                </Link>
              ))}
            </div>
          }
        >
          <Callout>{attribution.headline}</Callout>
          <div className="mt-4">
            <Table headers={["Objet", "Période", "Référence", "Écart", "Part", "Cumul", ""]}>
              {attribution.contributors.slice(0, 12).map((contributor) => (
                <tr key={contributor.memberCode}>
                  <td>{contributor.memberLabel}</td>
                  <td className="text-right"><Num>{money(contributor.current)}</Num></td>
                  <td className="text-right"><Num tone="muted">{money(contributor.reference)}</Num></td>
                  <td className="text-right">
                    <Num tone={contributor.delta < 0 ? "bad" : "good"}>{money(contributor.delta)}</Num>
                  </td>
                  <td className="text-right"><Num>{percent(contributor.share)}</Num></td>
                  <td className="text-right"><Num tone="muted">{percent(contributor.cumulativeShare)}</Num></td>
                  <td className="text-right">
                    <Link
                      href={`${base}/objects/${attributionDimension}/${contributor.memberCode}`}
                      className="text-xs text-brand-600"
                    >
                      ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {["contributionMargin", "revenue", "costTotal"].map((code) => (
              <Link
                key={code}
                href={`${base}/variances?period=${snapshot.periodCode}&dim=${attributionDimension}&measure=${code}`}
                className={`px-2.5 py-1 rounded-lg text-xs ${
                  code === analysisMeasure ? "bg-brand-600 text-white" : "border"
                }`}
              >
                {measureLabel(code)}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta,
  good,
}: {
  label: string;
  value: string;
  hint: string;
  delta: number | null;
  good: boolean;
}) {
  const tone = delta === null ? "muted" : (delta >= 0) === good ? "text-good-500" : "text-bad-500";
  return (
    <div className="card p-4">
      <p className="muted text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular">{value}</p>
      <p className="text-xs mt-1">
        {delta !== null && <span className={tone}>{signedPercent(delta)} </span>}
        <span className="muted">{hint}</span>
      </p>
    </div>
  );
}

function pct(actual: number, reference: number): number | null {
  if (reference === 0) return null;
  return ((actual - reference) / Math.abs(reference)) * 100;
}

function measureLabel(measure: string): string {
  switch (measure) {
    case "revenue":
      return "Chiffre d'affaires";
    case "costTotal":
      return "Charges";
    case "operatingMargin":
      return "Marge opérationnelle";
    default:
      return "Marge sur coûts variables";
  }
}
