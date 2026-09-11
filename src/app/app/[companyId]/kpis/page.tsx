import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { KPI_CATALOG } from "@/core/kpi/catalog";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { kpiValue, signedPercent } from "@/lib/format";
import { PeriodSelector } from "../period-selector";
import { TargetForm } from "./target-form";

const CATEGORY_LABELS: Record<string, string> = {
  growth: "Croissance",
  profitability: "Rentabilité",
  cost: "Coûts",
  productivity: "Productivité",
  activity: "Activité",
  commercial: "Commercial",
  budget: "Budget",
  cash: "Trésorerie",
  hr: "Ressources humaines",
  project: "Projets",
};

export default async function KpisPage({
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
  const active = new Set(snapshot.kpis.map((k) => k.code));
  const notSelected = KPI_CATALOG.filter((spec) => !active.has(spec.code));

  const byCategory = new Map<string, typeof snapshot.kpis>();
  for (const kpi of snapshot.kpis) {
    byCategory.set(kpi.category, [...(byCategory.get(kpi.category) ?? []), kpi]);
  }

  return (
    <div>
      <PageHeader
        title="Indicateurs"
        description="Des données, pas du code : formule, calcul, interprétation et limites expliqués."
        action={
          <div className="flex items-center gap-4">
            <a
              href={`/app/${companyId}/export?type=kpis&period=${snapshot.periodCode}`}
              className="text-xs text-brand-600"
            >
              Exporter en CSV
            </a>
            <PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />
          </div>
        }
      />

      <div className="space-y-6">
        {[...byCategory.entries()].map(([category, kpis]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold uppercase tracking-wide muted mb-3">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {kpis.map((kpi) => (
                <div key={kpi.code} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{kpi.name}</p>
                      <p className="muted text-xs mt-0.5">{kpi.definition}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-semibold tabular">{kpiValue(kpi.value, kpi.unit)}</p>
                      {kpi.status === "computed" ? (
                        <p className="text-xs muted">{signedPercent(kpi.deltaPct)}</p>
                      ) : (
                        <Badge tone={kpi.status === "missing_data" ? "warn" : "neutral"}>
                          {kpi.status === "missing_data" ? "donnée manquante" : "non applicable"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {kpi.trend.filter((t) => t.value !== null).length > 2 && (
                    <div className="mt-3">
                      <Sparkline points={kpi.trend} height={40} />
                    </div>
                  )}

                  {kpi.status === "missing_data" && (
                    <p className="text-xs text-warn-500 mt-2">
                      Manque : {kpi.missingMeasures.join(", ")}.
                    </p>
                  )}

                  <details className="mt-3">
                    <summary className="text-xs muted cursor-pointer">Comprendre cet indicateur</summary>
                    <dl className="mt-2 space-y-2 text-xs">
                      <div>
                        <dt className="font-semibold">Formule</dt>
                        <dd className="muted font-mono">{kpi.formula}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold">Données utilisées</dt>
                        <dd className="muted">
                          {kpi.usedMeasures.length === 0
                            ? "—"
                            : kpi.usedMeasures
                                .map((m) => `${m.name} = ${m.value === null ? "indisponible" : Math.round(m.value * 100) / 100}`)
                                .join(" · ")}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold">Interprétation</dt>
                        <dd className="muted">{kpi.interpretation}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold">Limites</dt>
                        <dd className="muted">{kpi.limits}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <TargetForm companyId={companyId} code={kpi.code} target={kpi.target} unit={kpi.unit} />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Card
        className="mt-8"
        title="Indicateurs non retenus"
        subtitle="Proposés si votre profil change"
      >
        <div className="flex flex-wrap gap-2">
          {notSelected.map((spec) => (
            <span key={spec.code} className="text-xs border rounded-full px-3 py-1 muted">
              {spec.name}
            </span>
          ))}
          {notSelected.length === 0 && <p className="muted text-sm">Tous les indicateurs du catalogue sont actifs.</p>}
        </div>
      </Card>
    </div>
  );
}
