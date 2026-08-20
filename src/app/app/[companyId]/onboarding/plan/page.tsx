import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildConfigurationPlan } from "@/services/configuration.service";
import { getKpiSpec } from "@/core/kpi/catalog";
import { Badge, Callout, Card, PageHeader } from "@/components/ui";
import { applyPlanAction } from "../actions";

export default async function PlanPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const { plan, diff, current } = await buildConfigurationPlan(companyId);

  const groupedTrace = new Map<string, { effect: string; targets: string[]; because: string; ruleId: string }>();
  for (const entry of plan.ruleTrace) {
    const key = `${entry.ruleId}|${entry.effect}`;
    const existing = groupedTrace.get(key);
    if (existing) existing.targets.push(entry.target);
    else
      groupedTrace.set(key, {
        effect: entry.effect,
        targets: [entry.target],
        because: entry.because,
        ruleId: entry.ruleId,
      });
  }

  const apply = applyPlanAction.bind(null, companyId);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Voici le système de pilotage proposé"
        description="Rien n'est encore créé. Chaque élément est justifié par la règle et la réponse qui l'ont déclenché."
        action={
          <form action={apply}>
            <button className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium">
              {current ? "Appliquer les changements" : "Appliquer la configuration"}
            </button>
          </form>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Ce qui va être créé">
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">Axes d&apos;analyse ({plan.dimensions.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.dimensions.map((dimension) => (
                  <Badge key={dimension.code} tone={dimension.isCostObject ? "brand" : "neutral"}>
                    {dimension.label}
                    {dimension.isCostObject ? " · objet de coût" : ""}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">Capacités activées ({plan.capabilities.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.capabilities.map((capability) => (
                  <Badge key={capability} tone="good">
                    {capability}
                  </Badge>
                ))}
                {plan.capabilities.length === 0 && <span className="muted">Aucune capacité spécifique.</span>}
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">Méthodes de coûts</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.costMethods.map((method) => (
                  <Badge key={method}>{method}</Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">Indicateurs ({plan.kpiCodes.length})</p>
              <ul className="muted space-y-0.5">
                {plan.kpiCodes.map((code) => (
                  <li key={code}>· {getKpiSpec(code)?.name ?? code}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-medium mb-1">Règles d&apos;affectation ({plan.allocationRules.length})</p>
              <ul className="muted space-y-0.5">
                {plan.allocationRules.map((rule) => (
                  <li key={rule.id}>
                    · étape {rule.stage} — {rule.name}
                  </li>
                ))}
              </ul>
            </div>

            {plan.requiredDrivers.length > 0 && (
              <Callout tone="warn">
                Données statistiques nécessaires : {plan.requiredDrivers.join(", ")}. Sans elles, certains
                indicateurs resteront en état « donnée manquante ».
              </Callout>
            )}
          </div>
        </Card>

        <Card title="Pourquoi" subtitle="Traçabilité complète des décisions du moteur de règles">
          <ul className="space-y-3 text-sm">
            {[...groupedTrace.values()].map((entry) => (
              <li key={`${entry.ruleId}-${entry.effect}`}>
                <p className="font-medium">
                  {entry.effect} : {entry.targets.slice(0, 6).join(", ")}
                  {entry.targets.length > 6 ? `… (+${entry.targets.length - 6})` : ""}
                </p>
                <p className="muted text-xs mt-0.5">
                  {entry.because} <span className="opacity-70">[{entry.ruleId}]</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {current && (
        <Card className="mt-5" title="Différences avec la configuration actuelle">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-medium">Ajouts</p>
              <ul className="muted mt-1 space-y-0.5">
                {diff.addedCapabilities.map((c) => (
                  <li key={c}>+ capacité {c}</li>
                ))}
                {diff.addedDimensions.map((d) => (
                  <li key={d.code}>+ axe {d.label}</li>
                ))}
                {diff.addedKpis.map((k) => (
                  <li key={k}>+ indicateur {k}</li>
                ))}
                {diff.addedRules.map((r) => (
                  <li key={r.id}>+ règle {r.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">Éléments qui ne seront plus proposés</p>
              <ul className="muted mt-1 space-y-0.5">
                {diff.removedCapabilities.map((c) => (
                  <li key={c}>− capacité {c}</li>
                ))}
                {diff.removedKpis.map((k) => (
                  <li key={k}>− indicateur {k}</li>
                ))}
              </ul>
              <p className="muted text-xs mt-2">
                Rien n&apos;est supprimé : les axes qui portent des écritures restent disponibles.
              </p>
            </div>
          </div>
        </Card>
      )}

      <p className="muted text-sm mt-5">
        <Link href={`/app/${companyId}/onboarding`} className="text-brand-600">
          Revenir au questionnaire
        </Link>{" "}
        pour ajuster vos réponses.
      </p>
    </div>
  );
}
