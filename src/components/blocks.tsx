import Link from "next/link";
import type { DashboardBlock } from "@/core/model/types";
import type { AnalysisSnapshot } from "@/services/analysis.service";
import { kpiValue, money, moneyCompact, percent, signedPercent } from "@/lib/format";
import { Badge, Card, Num, Table } from "./ui";
import { BarList, BreakEvenChart, CascadeBar, Sparkline, TrendChart, Waterfall } from "./charts";
import { UNASSIGNED } from "@/core/costing/allocate";

/**
 * Rendu des blocs de cockpit.
 * Le cockpit est composé par le moteur de règles : ce fichier ne décide de rien,
 * il sait seulement dessiner chaque type de bloc.
 */

export function DashboardBlockView({
  block,
  snapshot,
  base,
}: {
  block: DashboardBlock;
  snapshot: AnalysisSnapshot;
  base: string;
}) {
  switch (block.type) {
    case "kpi":
    case "kpi-row": {
      const codes = block.type === "kpi" ? [block.code] : block.codes;
      const kpis = codes
        .map((code) => snapshot.kpis.find((k) => k.code === code))
        .filter((k): k is NonNullable<typeof k> => Boolean(k));
      if (kpis.length === 0) return null;
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.code} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="muted text-xs font-medium uppercase tracking-wide">{kpi.name}</p>
                {kpi.health !== "neutral" && (
                  <Badge tone={kpi.health === "ok" ? "good" : kpi.health === "warning" ? "warn" : "bad"}>
                    {kpi.health === "ok" ? "cible" : kpi.health === "warning" ? "vigilance" : "alerte"}
                  </Badge>
                )}
              </div>
              {kpi.status === "computed" ? (
                <>
                  <p className="text-2xl font-semibold mt-1 tabular">{kpiValue(kpi.value, kpi.unit)}</p>
                  <p className="text-xs mt-1">
                    <span className={deltaClass(kpi.deltaPct)}>{signedPercent(kpi.deltaPct)}</span>{" "}
                    <span className="muted">vs période précédente</span>
                  </p>
                  {kpi.trend.length > 2 && (
                    <div className="mt-3">
                      <Sparkline points={kpi.trend} height={36} showAxis={false} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold mt-1 muted">—</p>
                  <p className="muted text-xs mt-1">
                    {kpi.status === "missing_data"
                      ? `Donnée manquante : ${kpi.missingMeasures.join(", ")}`
                      : "Non applicable à votre modèle"}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      );
    }

    case "trend": {
      const points = snapshot.periodCodes
        .filter((code) => code <= snapshot.periodCode)
        .slice(-12)
        .map((code) => ({
          periodCode: code,
          value: sumMeasure(snapshot, code, block.measure),
        }));
      return (
        <Card title={block.title ?? "Tendance"}>
          <TrendChart points={points} />
        </Card>
      );
    }

    case "margin-cascade": {
      const m = snapshot.measures;
      const rows = [
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
      ];
      return (
        <Card
          title={block.title ?? "Formation de la marge"}
          subtitle="Cascade calculée sur les écritures de la période"
        >
          <CascadeBar rows={rows} />
        </Card>
      );
    }

    case "ranking": {
      const result = snapshot.margins[block.dimensionCode];
      if (!result) return null;
      const dimensionLabel =
        snapshot.dataset.dimensions.find((d) => d.code === block.dimensionCode)?.label ?? block.dimensionCode;
      const measure = block.measure as "contributionMargin" | "operatingMargin" | "revenue" | "totalCost";
      const items = [...result.lines]
        .filter((line) => line.memberCode !== UNASSIGNED)
        .sort((a, b) => (b[measure] ?? 0) - (a[measure] ?? 0))
        .slice(0, 8)
        .map((line) => ({
          label: line.memberLabel,
          value: line[measure] ?? 0,
          secondary: line.contributionMarginRate === null ? undefined : percent(line.contributionMarginRate),
        }));

      return (
        <Card
          title={block.title ?? `${MEASURE_TITLES[measure] ?? "Rentabilité"} par ${dimensionLabel.toLowerCase()}`}
          action={
            <Link href={`${base}/margins?dim=${block.dimensionCode}`} className="text-xs text-brand-600">
              Détail
            </Link>
          }
        >
          <BarList items={items} />
        </Card>
      );
    }

    case "variance-bridge": {
      const budget = snapshot.dataset.budgets.find((b) => b.kind === "BUDGET");
      if (!budget) {
        return (
          <Card title={block.title ?? "Budget"}>
            <p className="muted text-sm">
              Aucun budget disponible.{" "}
              <Link href={`${base}/budgets`} className="text-brand-600">
                Construire un budget depuis l&apos;historique
              </Link>
              .
            </p>
          </Card>
        );
      }
      const budgetRevenue = budget.lines
        .filter((l) => l.periodCode === snapshot.periodCode && l.kind === "REVENUE")
        .reduce((s, l) => s + l.amount, 0);
      const budgetCost = budget.lines
        .filter((l) => l.periodCode === snapshot.periodCode && l.kind === "COST")
        .reduce((s, l) => s + l.amount, 0);
      const actualRevenue = snapshot.measures.revenue ?? 0;
      const actualCost = snapshot.measures.costTotal ?? 0;

      const steps = [
        { label: "Résultat budgété", value: budgetRevenue - budgetCost, kind: "start" as const },
        { label: "Effet chiffre d'affaires", value: actualRevenue - budgetRevenue, kind: "delta" as const },
        { label: "Effet charges", value: -(actualCost - budgetCost), kind: "delta" as const },
        { label: "Résultat réel", value: actualRevenue - actualCost, kind: "end" as const },
      ];

      return (
        <Card
          title={block.title ?? "Du budget au réel"}
          action={
            <Link href={`${base}/variances`} className="text-xs text-brand-600">
              Analyser les écarts
            </Link>
          }
        >
          <Waterfall steps={steps} />
        </Card>
      );
    }

    case "breakeven":
      return (
        <Card
          title={block.title ?? "Seuil de rentabilité"}
          subtitle={`Levier opérationnel ${snapshot.breakEven.operatingLeverage ?? "—"}`}
        >
          <BreakEvenChart revenue={snapshot.measures.revenue ?? 0} breakEven={snapshot.breakEven.breakEven} />
          <p className="muted text-xs mt-3">
            Marge de sécurité {percent(snapshot.breakEven.safetyMarginRate)} · charges fixes{" "}
            {money(snapshot.measures.fixedCost ?? 0)} · taux de marge sur coûts variables{" "}
            {percent(snapshot.breakEven.contributionMarginRate)}
          </p>
        </Card>
      );

    case "progress-table": {
      const lines = snapshot.progress.slice(0, 6);
      const dimensionLabel =
        snapshot.dataset.dimensions.find((d) => d.code === block.dimensionCode)?.label ?? "Affaire";
      if (lines.length === 0) {
        return (
          <Card title={block.title ?? "Suivi des affaires"}>
            <p className="muted text-sm">
              Aucune affaire ne porte de budget. Renseignez un budget et un avancement par affaire dans
              Paramètres → axes pour activer le suivi à terminaison.
            </p>
          </Card>
        );
      }
      return (
        <Card
          title={block.title ?? "Suivi des affaires"}
          action={
            <Link href={`${base}/objects/${block.dimensionCode}`} className="text-xs text-brand-600">
              Tout voir
            </Link>
          }
        >
          <Table headers={[dimensionLabel, "Avancement", "Encouru", "À terminaison", "Marge à term.", "Dérive"]}>
            {lines.map((line) => (
              <tr key={line.memberCode}>
                <td>
                  <Link href={`${base}/objects/${block.dimensionCode}/${line.memberCode}`} className="hover:underline">
                    {line.memberLabel}
                  </Link>
                </td>
                <td className="text-right">
                  <Num>{percent(line.progressPct, 0)}</Num>
                </td>
                <td className="text-right">
                  <Num>{moneyCompact(line.costIncurred)}</Num>
                </td>
                <td className="text-right">
                  <Num>{moneyCompact(line.estimateAtCompletion)}</Num>
                </td>
                <td className="text-right">
                  <Num tone={line.marginAtCompletion < 0 ? "bad" : undefined}>
                    {moneyCompact(line.marginAtCompletion)}
                  </Num>
                </td>
                <td className="text-right">
                  <Num tone={line.drift > 0 ? "bad" : "good"}>{moneyCompact(line.drift)}</Num>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      );
    }

    case "alerts": {
      if (snapshot.alerts.length === 0) {
        return (
          <Card title={block.title ?? "Points d'attention"}>
            <p className="muted text-sm">Aucune alerte sur la période.</p>
          </Card>
        );
      }
      return (
        <Card title={block.title ?? "Points d'attention"}>
          <ul className="space-y-3">
            {snapshot.alerts.map((alert) => (
              <li key={alert.code} className="flex gap-3">
                <span
                  className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                  style={{
                    background:
                      alert.severity === "CRITICAL"
                        ? "var(--color-bad-500)"
                        : alert.severity === "WARNING"
                          ? "var(--color-warn-500)"
                          : "var(--color-brand-500)",
                  }}
                />
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="muted text-xs mt-0.5">{alert.message}</p>
                  {alert.value !== null && alert.threshold !== undefined && (
                    <p className="muted text-xs mt-0.5 tabular">
                      valeur {alert.value} · seuil {alert.threshold}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      );
    }

    case "missing-data": {
      const missing = snapshot.kpis.filter((k) => k.status === "missing_data");
      const issues = snapshot.quality.issues.slice(0, 3);
      if (missing.length === 0 && issues.length === 0) return null;
      return (
        <Card title={block.title ?? "Ce qui vous manque"} subtitle={`Qualité des données ${snapshot.quality.score} %`}>
          <ul className="space-y-2 text-sm">
            {missing.slice(0, 5).map((kpi) => (
              <li key={kpi.code}>
                <span className="font-medium">{kpi.name}</span>{" "}
                <span className="muted">— nécessite {kpi.missingMeasures.join(", ")}</span>
              </li>
            ))}
            {issues.map((issue) => (
              <li key={issue.code}>
                <span className="font-medium">{issue.label}</span>{" "}
                <span className="muted">— {issue.count} élément(s). {issue.fix}</span>
              </li>
            ))}
          </ul>
          <Link href={`${base}/data`} className="text-xs text-brand-600 mt-3 inline-block">
            Compléter les données
          </Link>
        </Card>
      );
    }

    default:
      return null;
  }
}

/** Le titre d'un classement se déduit de la mesure et du libellé de l'axe, jamais du secteur. */
const MEASURE_TITLES: Record<string, string> = {
  contributionMargin: "Rentabilité",
  operatingMargin: "Résultat",
  revenue: "Chiffre d'affaires",
  totalCost: "Coûts",
};

function deltaClass(delta: number | null): string {
  if (delta === null) return "muted";
  return delta > 0 ? "text-good-500" : delta < 0 ? "text-bad-500" : "muted";
}

function sumMeasure(snapshot: AnalysisSnapshot, periodCode: string, measure: string): number {
  let total = 0;
  for (const entry of snapshot.dataset.entries) {
    if (entry.periodCode !== periodCode) continue;
    if (measure === "revenue" && entry.kind === "REVENUE") total += entry.amount;
    if (measure === "costTotal" && entry.kind === "COST") total += entry.amount;
  }
  return total;
}
