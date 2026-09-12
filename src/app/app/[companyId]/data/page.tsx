import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany, loadConfiguration, loadDataset } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { runQualityChecks } from "@/core/quality/checks";
import { Badge, Callout, Card, Num, PageHeader, Table } from "@/components/ui";
import { dateLabel, money, periodLabel } from "@/lib/format";
import { cancelImportAction } from "./actions";
import { UploadForm } from "./upload-form";
import { DriverForm } from "./driver-form";

export default async function DataPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ imported?: string }>;
}) {
  const { companyId } = await params;
  const { imported } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const [dataset, configuration, batches] = await Promise.all([
    loadDataset(companyId),
    loadConfiguration(companyId),
    prisma.importBatch.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const quality = runQualityChecks(dataset, { requiredDrivers: configuration?.requiredDrivers });

  const driverSummary = new Map<string, { count: number; total: number }>();
  for (const driver of dataset.drivers) {
    const current = driverSummary.get(driver.driverCode) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += driver.value;
    driverSummary.set(driver.driverCode, current);
  }

  const missingDrivers = (configuration?.requiredDrivers ?? []).filter((code) => !driverSummary.has(code));
  const periodsWithData = new Set(dataset.entries.map((e) => e.periodCode));

  return (
    <div>
      <PageHeader
        title="Données"
        description="Import, qualité et statistiques. Annulable à tout moment."
      />

      {imported && (
        <div className="mb-5">
          <Callout tone="good">Import effectué. Les calculs ont été rafraîchis.</Callout>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Importer un fichier" subtitle="CSV, auto-détection séparateur et encodage">
          <UploadForm companyId={companyId} />
          <p className="muted text-xs mt-4">
            Formats reconnus : séparateurs <code>;</code> <code>,</code> tabulation <code>|</code> · montants
            « 1 234,56 » ou « 1234.56 » · dates JJ/MM/AAAA, AAAA-MM-JJ, JJ.MM.AAAA · parenthèses pour les
            montants négatifs.
          </p>
        </Card>

        <Card title="Qualité des données" subtitle={`Confiance : ${quality.confidence === "high" ? "élevée" : quality.confidence === "medium" ? "moyenne" : "faible"}`}>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold tabular">{quality.score}</span>
            <span className="muted text-sm">/ 100</span>
          </div>
          <p className="muted text-xs mt-1">{dataset.entries.length} écritures analysées</p>
          <ul className="mt-4 space-y-2.5">
            {quality.issues.length === 0 && <li className="muted text-sm">Aucun défaut détecté.</li>}
            {quality.issues.map((issue) => (
              <li key={issue.code}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{issue.label}</span>
                  <Badge tone={issue.severity === "CRITICAL" ? "bad" : issue.severity === "WARNING" ? "warn" : "neutral"}>
                    {issue.count}
                  </Badge>
                </div>
                <p className="muted text-xs mt-0.5">{issue.fix}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5" title="Lots d'import" subtitle="Annulation sélective des écritures">
        {batches.length === 0 ? (
          <p className="muted text-sm">Aucun import pour le moment.</p>
        ) : (
          <Table headers={["Fichier", "Date", "Lignes", "Statut", ""]}>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.filename}</td>
                <td className="text-right">{dateLabel(batch.createdAt)}</td>
                <td className="text-right">{batch.rowCount}</td>
                <td className="text-right">
                  <Badge tone={batch.status === "COMMITTED" ? "good" : batch.status === "CANCELLED" ? "bad" : "neutral"}>
                    {batch.status.toLowerCase()}
                  </Badge>
                </td>
                <td className="text-right">
                  {batch.status === "COMMITTED" && (
                    <form action={cancelImportAction.bind(null, companyId, batch.id)}>
                      <button className="text-xs text-bad-500">annuler le lot</button>
                    </form>
                  )}
                  {batch.status === "DRAFT" && (
                    <a href={`/app/${companyId}/data/import/${batch.id}`} className="text-xs text-brand-600">
                      reprendre le mapping
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2 mt-5">
        <Card
          title="Données statistiques (inducteurs)"
          subtitle="Heures, effectifs, unités produites, surfaces — base des clés de répartition et des ratios"
        >
          {missingDrivers.length > 0 && (
            <div className="mb-4">
              <Callout tone="warn">
                Inducteurs attendus par votre configuration et absents : {missingDrivers.join(", ")}.
              </Callout>
            </div>
          )}
          {driverSummary.size === 0 ? (
            <p className="muted text-sm">Aucun inducteur enregistré.</p>
          ) : (
            <Table headers={["Inducteur", "Lignes", "Total"]}>
              {[...driverSummary.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([code, summary]) => (
                  <tr key={code}>
                    <td>{code}</td>
                    <td className="text-right">{summary.count}</td>
                    <td className="text-right"><Num>{Math.round(summary.total).toLocaleString("fr-FR")}</Num></td>
                  </tr>
                ))}
            </Table>
          )}
        </Card>

        <Card title="Saisir un inducteur" subtitle="Utile quand la donnée ne vient pas d'un fichier">
          <DriverForm
            companyId={companyId}
            periods={dataset.periods.map((p) => p.code)}
            dimensions={dataset.dimensions.map((d) => ({ code: d.code, label: d.label }))}
            members={dataset.members.map((m) => ({
              dimensionCode: m.dimensionCode,
              code: m.code,
              label: m.label,
            }))}
            requiredDrivers={configuration?.requiredDrivers ?? []}
          />
        </Card>
      </div>

      <Card className="mt-5" title="Couverture des périodes">
        <div className="flex flex-wrap gap-1.5">
          {dataset.periods.map((p) => (
            <span
              key={p.code}
              className={`px-2 py-1 rounded text-xs ${
                periodsWithData.has(p.code) ? "bg-good-100 text-good-500" : "bg-ink-100 muted"
              }`}
              title={periodsWithData.has(p.code) ? "données présentes" : "aucune écriture"}
            >
              {periodLabel(p.code)}
            </span>
          ))}
        </div>
        <p className="muted text-xs mt-3">
          Total des écritures : {dataset.entries.length} · chiffre d&apos;affaires cumulé{" "}
          {money(dataset.entries.filter((e) => e.kind === "REVENUE").reduce((s, e) => s + e.amount, 0))}
        </p>
      </Card>
    </div>
  );
}
