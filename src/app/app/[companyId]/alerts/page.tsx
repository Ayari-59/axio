import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { computeMeasures } from "@/core/model/dataset";
import { detectOutliers, detectTrendBreak, detectDrift } from "@/core/analytics/anomaly";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { periodLabel } from "@/lib/format";
import { PeriodSelector } from "../period-selector";

export default async function AlertsPage({
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

  const withData = new Set(snapshot.dataset.entries.map((e) => e.periodCode));
  const periods = snapshot.periodCodes.filter((code) => withData.has(code) && code <= snapshot.periodCode);
  const revenueSeries = periods.map((code) => ({
    periodCode: code,
    value: computeMeasures(snapshot.dataset, { periodCodes: [code] }).revenue ?? 0,
  }));
  const costSeries = periods.map((code) => ({
    periodCode: code,
    value: computeMeasures(snapshot.dataset, { periodCodes: [code] }).costTotal ?? 0,
  }));

  const detections = [
    ...detectOutliers(revenueSeries, "revenue"),
    ...detectTrendBreak(revenueSeries, "revenue"),
    ...detectDrift(revenueSeries, costSeries, "costTotal"),
  ];

  return (
    <div>
      <PageHeader
        title="Alertes et signaux"
        description="Les alertes sont produites par le moteur de règles à partir des mesures calculées ; les signaux statistiques viennent de détecteurs déterministes, chacun portant sa preuve."
        action={<PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />}
      />

      {snapshot.alerts.length === 0 && detections.length === 0 && snapshot.recommendations.length === 0 ? (
        <EmptyState
          title="Aucune alerte sur la période"
          description="Les seuils configurés ne sont pas franchis et aucune anomalie statistique n'est détectée."
        />
      ) : (
        <div className="space-y-5">
          <Card title={`Alertes de gestion (${snapshot.alerts.length})`} subtitle="Déclenchées par les règles, avec la valeur et le seuil">
            {snapshot.alerts.length === 0 ? (
              <p className="muted text-sm">Aucune alerte.</p>
            ) : (
              <ul className="space-y-4">
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
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <Badge tone={alert.severity === "CRITICAL" ? "bad" : alert.severity === "WARNING" ? "warn" : "neutral"}>
                          {alert.severity.toLowerCase()}
                        </Badge>
                        <span className="muted text-xs">règle {alert.ruleId}</span>
                      </div>
                      <p className="muted text-sm mt-1">{alert.message}</p>
                      {alert.value !== null && (
                        <p className="muted text-xs mt-1 tabular">
                          valeur mesurée {alert.value} · seuil {alert.threshold ?? "—"}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Signaux statistiques (${detections.length})`} subtitle="Valeurs atypiques, ruptures de tendance et dérives">
            {detections.length === 0 ? (
              <p className="muted text-sm">Aucun signal statistique.</p>
            ) : (
              <ul className="space-y-3">
                {detections.map((detection, index) => (
                  <li key={`${detection.code}-${index}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={detection.severity === "CRITICAL" ? "bad" : "warn"}>{detection.code}</Badge>
                      <span className="text-sm">{detection.message}</span>
                    </div>
                    <p className="muted text-xs mt-0.5">
                      {periodLabel(detection.periodCode)} · méthode : {detection.evidence.method} · fenêtre{" "}
                      {detection.evidence.window} · seuil {detection.evidence.threshold}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {snapshot.recommendations.length > 0 && (
            <Card title="Recommandations" subtitle="Produites par les mêmes règles, jamais par un modèle de langage">
              <ul className="space-y-4">
                {snapshot.recommendations.map((recommendation) => (
                  <li key={recommendation.code}>
                    <p className="text-sm font-medium">{recommendation.title}</p>
                    <p className="muted text-sm mt-0.5">{recommendation.detail}</p>
                    {recommendation.expectedImpact && (
                      <p className="text-xs text-brand-600 mt-1">Impact attendu : {recommendation.expectedImpact}</p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="muted text-xs mt-4">
                Chiffrez l&apos;impact d&apos;une action dans les{" "}
                <Link href={`${base}/scenarios`} className="text-brand-600">
                  scénarios what-if
                </Link>
                .
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
