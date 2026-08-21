import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany, loadConfiguration, loadDataset, loadProfile } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { getSector } from "@/core/templates";
import {
  BILLING_UNIT_LABELS,
  OBJECTIVE_LABELS,
  REVENUE_MODEL_LABELS,
} from "@/core/templates/vocabulary";
import { Badge, Card, LinkButton, PageHeader, Table } from "@/components/ui";
import { dateLabel } from "@/lib/format";

export default async function SettingsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const [configuration, profile, dataset, versions, audits] = await Promise.all([
    loadConfiguration(companyId),
    loadProfile(companyId),
    loadDataset(companyId),
    prisma.configurationVersion.findMany({ where: { companyId }, orderBy: { version: "desc" }, take: 5 }),
    prisma.auditLog.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const base = `/app/${companyId}`;
  const sector = getSector(company.industry);
  const memberCounts = new Map<string, number>();
  for (const member of dataset.members) {
    memberCounts.set(member.dimensionCode, (memberCounts.get(member.dimensionCode) ?? 0) + 1);
  }

  const groupedTrace = new Map<string, { effect: string; targets: string[]; because: string; ruleId: string }>();
  for (const entry of configuration?.ruleTrace ?? []) {
    const key = `${entry.ruleId}|${entry.effect}`;
    const existing = groupedTrace.get(key);
    if (existing) existing.targets.push(entry.target);
    else groupedTrace.set(key, { effect: entry.effect, targets: [entry.target], because: entry.because, ruleId: entry.ruleId });
  }

  return (
    <div>
      <PageHeader
        title="Paramètres"
        description="Profil économique, axes d'analyse, configuration versionnée et journal d'audit."
        action={<LinkButton href={`${base}/onboarding`} variant="primary">Modifier le profil</LinkButton>}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Profil économique" subtitle={`Secteur : ${sector.label}`}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="muted text-xs">Activité</dt>
              <dd>{profile.identity.activity || company.activity || "—"}</dd>
            </div>
            <div>
              <dt className="muted text-xs">Effectif déclaré</dt>
              <dd>{profile.identity.headcount}</dd>
            </div>
            <div className="col-span-2">
              <dt className="muted text-xs">Modèles de revenu</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1">
                {profile.revenue.models.map((model) => (
                  <Badge key={model}>{REVENUE_MODEL_LABELS[model]}</Badge>
                ))}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="muted text-xs">Unités de facturation</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1">
                {profile.revenue.billingUnits.map((unit) => (
                  <Badge key={unit}>{BILLING_UNIT_LABELS[unit]}</Badge>
                ))}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="muted text-xs">Objectifs prioritaires</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1">
                {profile.objectives.map((objective) => (
                  <Badge key={objective} tone="brand">
                    {OBJECTIVE_LABELS[objective]}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="muted text-xs">Maturité</dt>
              <dd>{profile.maturity}</dd>
            </div>
            <div>
              <dt className="muted text-xs">Structure de coûts</dt>
              <dd className="text-xs muted">
                salaires {profile.costs.payrollSharePct} % · achats {profile.costs.purchasesSharePct} % ·
                sous-traitance {profile.costs.subcontractingSharePct} % · structure{" "}
                {profile.costs.overheadSharePct} %
              </dd>
            </div>
          </dl>
        </Card>

        <Card
          title="Axes d'analyse"
          subtitle="Le vocabulaire est le vôtre : « chantier », « mission » ou « produit » ne sont que des libellés"
          action={
            <div className="flex gap-3">
              <Link href={`${base}/settings/rules`} className="text-xs text-brand-600">
                Règles d&apos;affectation
              </Link>
              <Link href={`${base}/settings/activities`} className="text-xs text-brand-600">
                Activités (ABC)
              </Link>
            </div>
          }
        >
          <Table headers={["Axe", "Code", "Rôle", "Objet de coût", "Membres"]}>
            {dataset.dimensions.map((dimension) => (
              <tr key={dimension.code}>
                <td>{dimension.label}</td>
                <td className="text-right text-xs muted">{dimension.code}</td>
                <td className="text-right text-xs muted">{dimension.kind}</td>
                <td className="text-right">{dimension.isCostObject ? "oui" : "—"}</td>
                <td className="text-right">{memberCounts.get(dimension.code) ?? 0}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card
        className="mt-5"
        title="Pourquoi ce système de pilotage ?"
        subtitle="Trace complète : chaque élément de configuration est relié à la règle qui l'a produit"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium mb-2">Capacités actives</p>
            <div className="flex flex-wrap gap-1.5">
              {(configuration?.capabilities ?? []).map((capability) => (
                <Badge key={capability} tone="good">
                  {capability}
                </Badge>
              ))}
            </div>
            <p className="text-sm font-medium mt-4 mb-2">Données attendues</p>
            <div className="flex flex-wrap gap-1.5">
              {(configuration?.requiredDrivers ?? []).map((driver) => (
                <Badge key={driver} tone="warn">
                  {driver}
                </Badge>
              ))}
              {(configuration?.requiredDrivers ?? []).length === 0 && <span className="muted text-sm">—</span>}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Décisions du moteur de règles</p>
            <ul className="space-y-2 text-xs">
              {[...groupedTrace.values()].slice(0, 12).map((entry) => (
                <li key={`${entry.ruleId}-${entry.effect}`}>
                  <span className="font-medium">
                    {entry.effect} : {entry.targets.slice(0, 4).join(", ")}
                    {entry.targets.length > 4 ? "…" : ""}
                  </span>
                  <span className="muted"> — {entry.because}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2 mt-5">
        <Card title="Versions de configuration" subtitle="Immuables : une reconfiguration crée une version, elle n'écrase rien">
          <Table headers={["Version", "Date", "Note"]}>
            {versions.map((version) => (
              <tr key={version.id}>
                <td>v{version.version}</td>
                <td className="text-right">{dateLabel(version.createdAt)}</td>
                <td className="text-right text-xs muted">{version.note}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Journal d'audit" subtitle="Toute mutation sensible est tracée">
          <Table headers={["Action", "Entité", "Date"]}>
            {audits.map((entry) => (
              <tr key={entry.id}>
                <td className="text-xs">{entry.action}</td>
                <td className="text-right text-xs muted">{entry.entity}</td>
                <td className="text-right text-xs">{dateLabel(entry.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}
