import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { buildVarianceView } from "@/services/budget.service";
import { attribute } from "@/core/budget/attribution";
import { buildCommentary, narrateDecomposition } from "@/core/copilot/answer";
import { UNASSIGNED } from "@/core/costing/allocate";
import { Callout, Card, Num, PageHeader, Table } from "@/components/ui";
import { CascadeBar } from "@/components/charts";
import { money, percent, periodLabel, signedPercent } from "@/lib/format";
import { PeriodSelector } from "../period-selector";

export default async function ReportsPage({
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
  const view = buildVarianceView(snapshot.dataset, snapshot.periodCode);
  const costObject = snapshot.dataset.dimensions.find((d) => d.isCostObject);

  const attribution =
    snapshot.previousPeriodCode && costObject
      ? attribute(snapshot.dataset, {
          measure: "contributionMargin",
          dimensionCode: costObject.code,
          currentPeriods: [snapshot.periodCode],
          referencePeriods: [snapshot.previousPeriodCode],
        })
      : null;

  const commentary = buildCommentary({
    periodLabel: periodLabel(snapshot.periodCode),
    revenue: snapshot.measures.revenue ?? 0,
    revenueDeltaPct: snapshot.metrics.revenueGrowthPct ?? null,
    marginRate: snapshot.measures.contributionMarginRate ?? null,
    marginRateDeltaPts: snapshot.metrics.marginRateDeltaPts ?? null,
    attribution,
    topAlert: snapshot.alerts[0] ? { title: snapshot.alerts[0].title, message: snapshot.alerts[0].message } : null,
    breakEven: snapshot.breakEven,
  });

  const m = snapshot.measures;
  const marginResult = costObject ? snapshot.margins[costObject.code] : null;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Rapport de gestion"
        description={`${company.name} — ${periodLabel(snapshot.periodCode)}. Généré à partir du snapshot de calcul : les chiffres sont identiques à ceux du cockpit.`}
        action={<PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />}
      />

      <Card title="1. Commentaire de gestion" subtitle="Texte produit par gabarit déterministe à partir des chiffres calculés">
        <Callout>{commentary}</Callout>
        {view.pvm && <p className="text-sm mt-4">{narrateDecomposition(view.pvm, "L'écart de chiffre d'affaires")}</p>}
      </Card>

      <Card className="mt-5" title="2. Formation du résultat">
        <CascadeBar
          rows={[
            { label: "Chiffre d'affaires", value: m.revenue ?? 0, emphasis: true },
            { label: "− Coûts variables", value: -(m.variableCost ?? 0) },
            { label: "= Marge sur coûts variables", value: m.contributionMargin ?? 0, emphasis: true, hint: percent(m.contributionMarginRate ?? null) },
            { label: "− Coûts fixes", value: -(m.fixedCost ?? 0) },
            { label: "= Résultat d'exploitation", value: m.operatingMargin ?? 0, emphasis: true, hint: percent(m.operatingMarginRate ?? null) },
          ]}
        />
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
          <div>
            <dt className="muted text-xs">Seuil de rentabilité</dt>
            <dd className="tabular">{money(snapshot.breakEven.breakEven)}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Marge de sécurité</dt>
            <dd className="tabular">{percent(snapshot.breakEven.safetyMarginRate)}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Levier opérationnel</dt>
            <dd className="tabular">{snapshot.breakEven.operatingLeverage ?? "—"}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Qualité des données</dt>
            <dd className="tabular">{snapshot.quality.score} %</dd>
          </div>
        </dl>
      </Card>

      {view.budget && (
        <Card className="mt-5" title="3. Écarts budgétaires" subtitle={`Référence : ${view.budget.name}`}>
          <Table headers={["Nature", "Réel", "Budget", "Écart", "%", "Sens"]}>
            {view.lines.slice(0, 12).map((line) => (
              <tr key={line.key}>
                <td>{line.label}</td>
                <td className="text-right"><Num>{money(line.actual)}</Num></td>
                <td className="text-right"><Num>{money(line.budget)}</Num></td>
                <td className="text-right">
                  <Num tone={line.sense === "favorable" ? "good" : line.sense === "unfavorable" ? "bad" : undefined}>
                    {money(line.variance)}
                  </Num>
                </td>
                <td className="text-right"><Num>{signedPercent(line.variancePct)}</Num></td>
                <td className="text-right text-xs muted">{line.sense === "favorable" ? "favorable" : line.sense === "unfavorable" ? "défavorable" : "neutre"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {marginResult && (
        <Card className="mt-5" title={`4. Rentabilité par ${costObject?.label.toLowerCase()}`}>
          <Table headers={[costObject?.label ?? "Objet", "CA", "Marge sur CV", "Taux", "Marge opérationnelle"]}>
            {marginResult.lines
              .filter((line) => line.memberCode !== UNASSIGNED)
              .slice(0, 12)
              .map((line) => (
                <tr key={line.memberCode}>
                  <td>{line.memberLabel}</td>
                  <td className="text-right"><Num>{money(line.revenue)}</Num></td>
                  <td className="text-right"><Num>{money(line.contributionMargin)}</Num></td>
                  <td className="text-right"><Num>{percent(line.contributionMarginRate)}</Num></td>
                  <td className="text-right">
                    <Num tone={line.operatingMargin < 0 ? "bad" : "good"}>{money(line.operatingMargin)}</Num>
                  </td>
                </tr>
              ))}
          </Table>
        </Card>
      )}

      {snapshot.progress.length > 0 && (
        <Card className="mt-5" title="5. Affaires à l'avancement">
          <Table headers={["Affaire", "Avancement", "Encouru", "À terminaison", "Marge à terminaison", "Dérive"]}>
            {snapshot.progress.map((line) => (
              <tr key={line.memberCode}>
                <td>{line.memberLabel}</td>
                <td className="text-right"><Num>{percent(line.progressPct, 0)}</Num></td>
                <td className="text-right"><Num>{money(line.costIncurred)}</Num></td>
                <td className="text-right"><Num>{money(line.estimateAtCompletion)}</Num></td>
                <td className="text-right">
                  <Num tone={line.marginAtCompletion < 0 ? "bad" : "good"}>{money(line.marginAtCompletion)}</Num>
                </td>
                <td className="text-right">
                  <Num tone={line.drift > 0 ? "bad" : "good"}>{money(line.drift)}</Num>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card className="mt-5" title="6. Points d'attention">
        {snapshot.alerts.length === 0 ? (
          <p className="muted text-sm">Aucune alerte sur la période.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {snapshot.alerts.map((alert) => (
              <li key={alert.code}>
                <strong>{alert.title}</strong> — {alert.message}
              </li>
            ))}
          </ul>
        )}
        <p className="muted text-xs mt-4">
          Rapport généré le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date())} ·
          configuration v{snapshot.configuration.ruleTrace.length > 0 ? "courante" : "initiale"} · indice de
          confiance {snapshot.quality.confidence}. Utilisez l&apos;impression du navigateur pour produire un PDF.
        </p>
      </Card>
    </div>
  );
}
