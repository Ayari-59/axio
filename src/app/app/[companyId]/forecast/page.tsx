import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { computeMeasures } from "@/core/model/dataset";
import {
  FORECAST_METHOD_LABELS,
  forecast,
  type ForecastMethod,
} from "@/core/analytics/forecast";
import { Badge, Card, Num, PageHeader, Table } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { money, percent, periodLabel } from "@/lib/format";

const MEASURES = [
  { code: "revenue", label: "Chiffre d'affaires" },
  { code: "costTotal", label: "Charges" },
  { code: "contributionMargin", label: "Marge sur coûts variables" },
];

export default async function ForecastPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ measure?: string; method?: string; horizon?: string }>;
}) {
  const { companyId } = await params;
  const { measure, method, horizon } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const snapshot = await buildSnapshot(companyId);
  const base = `/app/${companyId}`;
  const activeMeasure = MEASURES.find((m) => m.code === measure)?.code ?? "revenue";
  const horizonMonths = Number(horizon ?? 6) || 6;

  const withData = new Set(snapshot.dataset.entries.map((e) => e.periodCode));
  const series = snapshot.periodCodes
    .filter((code) => withData.has(code))
    .map((code) => ({
      periodCode: code,
      value: computeMeasures(snapshot.dataset, { periodCodes: [code] })[activeMeasure] ?? 0,
    }));

  const requested = method as ForecastMethod | undefined;
  const result = forecast(series, horizonMonths, requested);

  const historyTotal = series.slice(-12).reduce((s, p) => s + p.value, 0);
  const forecastTotal = result.points.reduce((s, p) => s + p.value, 0);

  return (
    <div>
      <PageHeader
        title="Prévisions"
        description="Six méthodes testées ; la plus fiable retenue, vous pouvez en choisir une autre."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {MEASURES.map((item) => (
          <Link
            key={item.code}
            href={`${base}/forecast?measure=${item.code}&horizon=${horizonMonths}${method ? `&method=${method}` : ""}`}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              item.code === activeMeasure ? "bg-brand-600 text-white" : "border"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Card
        title={`Historique et projection — ${MEASURES.find((m) => m.code === activeMeasure)?.label}`}
        subtitle={result.reason}
      >
        <TrendChart
          points={[
            ...series.slice(-12).map((p) => ({ periodCode: p.periodCode, value: p.value })),
            ...result.points.map((p) => ({ periodCode: p.periodCode, value: p.value })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <span className="muted text-sm">Méthode :</span>
          {(Object.keys(FORECAST_METHOD_LABELS) as ForecastMethod[])
            .filter((m) => m !== "budget")
            .map((candidate) => {
              const evaluation = result.candidates.find((c) => c.method === candidate);
              return (
                <Link
                  key={candidate}
                  href={`${base}/forecast?measure=${activeMeasure}&horizon=${horizonMonths}&method=${candidate}`}
                  className={`px-3 py-1.5 rounded-lg text-xs ${
                    candidate === result.method ? "bg-brand-600 text-white" : "border"
                  }`}
                >
                  {FORECAST_METHOD_LABELS[candidate]}
                  {evaluation?.mape !== null && evaluation?.mape !== undefined && (
                    <span className="opacity-70"> · {evaluation.mape} %</span>
                  )}
                </Link>
              );
            })}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2 mt-5">
        <Card title="Projection détaillée" subtitle={`Horizon ${horizonMonths} mois`}>
          <Table headers={["Période", "Valeur projetée"]}>
            {result.points.map((point) => (
              <tr key={point.periodCode}>
                <td>{periodLabel(point.periodCode)}</td>
                <td className="text-right"><Num>{money(point.value)}</Num></td>
              </tr>
            ))}
          </Table>
          <p className="muted text-xs mt-3">
            Cumul projeté : {money(forecastTotal)} · 12 derniers mois observés : {money(historyTotal)} (
            {percent(historyTotal === 0 ? null : ((forecastTotal / (historyTotal * (horizonMonths / 12))) - 1) * 100)} d&apos;écart
            de rythme).
          </p>
        </Card>

        <Card title="Fiabilité des méthodes" subtitle="Erreur moyenne (MAPE) en backtest">
          <Table headers={["Méthode", "MAPE", "Statut"]}>
            {result.candidates.map((candidate) => (
              <tr key={candidate.method}>
                <td>{FORECAST_METHOD_LABELS[candidate.method]}</td>
                <td className="text-right"><Num>{candidate.mape === null ? "—" : `${candidate.mape} %`}</Num></td>
                <td className="text-right">
                  {candidate.method === result.method ? (
                    <Badge tone="brand">retenue</Badge>
                  ) : candidate.mape === null ? (
                    <Badge>non évaluable</Badge>
                  ) : (
                    <Badge>évaluée</Badge>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <p className="muted text-xs mt-3">
            Backtest : dernier historique retiré, prévision comparée aux données réelles. Moins de 6 périodes : retour à la dernière valeur.
          </p>
        </Card>
      </div>
    </div>
  );
}
