import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { DashboardBlockView } from "@/components/blocks";
import { Badge, Callout, EmptyState, LinkButton } from "@/components/ui";
import { periodLabel } from "@/lib/format";
import { PeriodSelector } from "./period-selector";

export default async function CockpitPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string; configured?: string }>;
}) {
  const { companyId } = await params;
  const { period, configured } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();
  if (!company.configuredAt) redirect(`/app/${companyId}/onboarding`);

  const snapshot = await buildSnapshot(companyId, period);
  const base = `/app/${companyId}`;
  const sections = snapshot.configuration.dashboard.sections;

  if (snapshot.dataset.entries.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">Cockpit de {company.name}</h1>
        <p className="muted text-sm mt-1 mb-6">
          Votre système de pilotage est configuré : {snapshot.configuration.dimensions.length} axes,{" "}
          {snapshot.configuration.kpiCodes.length} indicateurs, {snapshot.configuration.capabilities.length}{" "}
          capacités actives.
        </p>
        <EmptyState
          title="Il manque vos données"
          description="Importez des données (CSV ou démo) pour voir le cockpit."
          action={<LinkButton href={`${base}/data`} variant="primary">Importer des données</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {company.name} · {periodLabel(snapshot.periodCode)}
          </h1>
          <p className="muted text-sm mt-1">Composé par le moteur de règles d'après votre modèle.</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge tone={snapshot.quality.confidence === "high" ? "good" : snapshot.quality.confidence === "medium" ? "warn" : "bad"}>
            Qualité des données {snapshot.quality.score} %
          </Badge>
          <PeriodSelector periods={snapshot.periodCodes} current={snapshot.periodCode} />
        </div>
      </div>

      {configured && (
        <div className="mb-5">
          <Callout tone="good">Configuration appliquée. Affichage adapté à votre modèle.</Callout>
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.id}>
            <h2 className="text-sm font-semibold uppercase tracking-wide muted mb-3">{section.title}</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {section.blocks.map((block, index) => {
                const full = block.type === "kpi-row" || block.type === "progress-table";
                return (
                  <div key={`${section.id}-${index}`} className={full ? "xl:col-span-2" : ""}>
                    <DashboardBlockView block={block} snapshot={snapshot} base={base} />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="muted text-xs mt-10">
        <Link href={`${base}/copilot`} className="text-brand-600">
          Copilote
        </Link>{" "}
        ·{" "}
        <Link href={`${base}/settings`} className="text-brand-600">
          Paramètres
        </Link>
      </p>
    </div>
  );
}
