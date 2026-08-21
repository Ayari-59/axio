import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany, loadAllocationRules, loadDataset } from "@/lib/repository";
import { loadActivityMap } from "@/services/abc.service";
import { buildSnapshot } from "@/services/analysis.service";
import { compareAllocationMethods, hasActivityRouting, narrateComparison } from "@/core/costing/abc";
import { UNASSIGNED } from "@/core/costing/allocate";
import { Badge, Callout, Card, Num, PageHeader, Table } from "@/components/ui";
import { money, percent, periodLabel, signedPercent } from "@/lib/format";
import { ActivityEditor } from "./activity-editor";
import { removeActivitiesAction } from "./actions";

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string; dim?: string }>;
}) {
  const { companyId } = await params;
  const { period, dim } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const [map, dataset, rules, snapshot] = await Promise.all([
    loadActivityMap(companyId),
    loadDataset(companyId),
    loadAllocationRules(companyId),
    buildSnapshot(companyId, period),
  ]);

  const base = `/app/${companyId}`;
  const availableDrivers = [...new Set(dataset.drivers.map((d) => d.driverCode))];
  const costObjects = dataset.dimensions.filter((d) => d.isCostObject);
  const activeDimension = dim && costObjects.some((d) => d.code === dim) ? dim : (costObjects[0]?.code ?? "");

  const comparison =
    map.configured && activeDimension && hasActivityRouting(rules)
      ? compareAllocationMethods(dataset, rules, activeDimension, { periodCodes: [snapshot.periodCode] })
      : null;

  const dimensionLabel = costObjects.find((d) => d.code === activeDimension)?.label ?? "objet de coût";

  return (
    <div>
      <PageHeader
        title="Comptabilité par activités"
        description="Une activité n'est pas déductible d'un export comptable : c'est un choix de modélisation. Le moteur propose celles de votre modèle économique, avec leur inducteur — à vous de les ajuster."
        action={
          map.configured ? (
            <form action={removeActivitiesAction.bind(null, companyId)}>
              <button className="rounded-lg border px-3.5 py-2 text-sm font-medium text-bad-500">
                Retirer l&apos;ABC
              </button>
            </form>
          ) : null
        }
      />

      <div className="mb-5">
        <Callout tone={map.configured ? "good" : "brand"}>
          {map.configured ? (
            <>
              Vos charges indirectes transitent par <strong>{map.activities.length} activités</strong> avant
              d&apos;atteindre vos {dimensionLabel.toLowerCase()}s. Chaque activité descend avec son propre
              inducteur — c&apos;est ce qui distingue l&apos;ABC d&apos;une clé de répartition unique.
            </>
          ) : (
            <>
              L&apos;ABC n&apos;est pas encore en place : vos charges indirectes descendent des centres
              directement aux objets de coûts, avec une clé unique. La carte ci-dessous est une proposition
              fondée sur votre modèle économique ; rien n&apos;est créé tant que vous ne la validez pas.
            </>
          )}
        </Callout>
      </div>

      <ActivityEditor
        companyId={companyId}
        initial={map.activities}
        configured={map.configured}
        availableDrivers={availableDrivers}
      />

      {map.missingDrivers.length > 0 && (
        <div className="mt-5">
          <Callout tone="warn">
            Inducteurs sans données : <strong>{[...new Set(map.missingDrivers)].join(", ")}</strong>. Les
            activités concernées ne pourront pas être réparties et leurs charges resteront visibles en « non
            affecté » — jamais réparties au hasard.{" "}
            <Link href={`${base}/data`} className="underline">
              Saisir ces inducteurs
            </Link>
            .
          </Callout>
        </div>
      )}

      {comparison && (
        <>
          <div className="flex flex-wrap items-center gap-2 mt-8 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide muted mr-2">
              Coût complet classique vs ABC — {periodLabel(snapshot.periodCode)}
            </h2>
            {costObjects.map((dimension) => (
              <Link
                key={dimension.code}
                href={`${base}/settings/activities?period=${snapshot.periodCode}&dim=${dimension.code}`}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  dimension.code === activeDimension ? "bg-brand-600 text-white" : "border"
                }`}
              >
                {dimension.label}
              </Link>
            ))}
          </div>

          <Card
            title="Ce que l'analyse par activités change"
            subtitle="Mêmes données, mêmes charges, deux répartitions"
          >
            <Callout tone={comparison.crossSubsidy > 0 ? "warn" : "good"}>
              {narrateComparison(comparison, dimensionLabel)}
            </Callout>

            <div className="mt-4">
              <Table
                headers={[
                  dimensionLabel,
                  "CA",
                  "Indirects — clé unique",
                  "Indirects — ABC",
                  "Écart",
                  "%",
                  "Marge classique",
                  "Marge ABC",
                  "Coût unitaire ABC",
                ]}
              >
                {comparison.lines.map((line) => (
                  <tr key={line.memberCode}>
                    <td>
                      {line.memberCode === UNASSIGNED ? (
                        <span className="muted">{line.memberLabel}</span>
                      ) : (
                        line.memberLabel
                      )}
                    </td>
                    <td className="text-right"><Num>{money(line.revenue)}</Num></td>
                    <td className="text-right"><Num tone="muted">{money(line.traditionalIndirect)}</Num></td>
                    <td className="text-right"><Num>{money(line.abcIndirect)}</Num></td>
                    <td className="text-right">
                      <Num tone={line.delta > 0 ? "bad" : line.delta < 0 ? "good" : undefined}>
                        {money(line.delta)}
                      </Num>
                    </td>
                    <td className="text-right"><Num tone="muted">{signedPercent(line.deltaPct)}</Num></td>
                    <td className="text-right">
                      <Num tone={line.traditionalMargin < 0 ? "bad" : undefined}>{money(line.traditionalMargin)}</Num>
                    </td>
                    <td className="text-right">
                      <Num tone={line.abcMargin < 0 ? "bad" : "good"}>{money(line.abcMargin)}</Num>
                    </td>
                    <td className="text-right">
                      {line.abcUnitCost === null ? (
                        <span className="muted text-xs">—</span>
                      ) : (
                        <Num>
                          {money(line.abcUnitCost, true)}
                          {line.traditionalUnitCost !== null && (
                            <span className="muted text-xs ml-1">(vs {money(line.traditionalUnitCost, true)})</span>
                          )}
                        </Num>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            </div>

            <p className="muted text-xs mt-4">
              L&apos;écart total déplacé représente {money(comparison.crossSubsidy)} sur{" "}
              {money(comparison.indirectTotal)} de charges indirectes réparties, soit{" "}
              {percent(comparison.indirectTotal === 0 ? null : (comparison.crossSubsidy / comparison.indirectTotal) * 100)}.
              Un objet dont la marge devient négative en ABC alors qu&apos;elle était positive en clé unique
              était financé par les autres.
            </p>
          </Card>

          <Card className="mt-5" title="Où passent les charges" subtitle="Bassins intermédiaires de la période">
            <Table headers={["Bassin", "Axe", "Reçu", "Cédé", "À répartir"]}>
              {snapshot.costing.pools
                .filter((pool) => Math.abs(pool.received) > 0.01 || Math.abs(pool.total) > 0.01)
                .map((pool) => (
                  <tr key={`${pool.dimensionCode}-${pool.memberCode}`}>
                    <td>
                      {dataset.members.find(
                        (m) => m.dimensionCode === pool.dimensionCode && m.code === pool.memberCode,
                      )?.label ?? pool.memberCode}
                    </td>
                    <td className="text-right">
                      <Badge tone={pool.dimensionCode === "ACTIVITY" ? "brand" : "neutral"}>
                        {pool.dimensionCode === "ACTIVITY" ? "activité" : "centre"}
                      </Badge>
                    </td>
                    <td className="text-right"><Num>{money(pool.directIndirect + pool.received)}</Num></td>
                    <td className="text-right"><Num tone="muted">{money(pool.given)}</Num></td>
                    <td className="text-right"><Num>{money(pool.total)}</Num></td>
                  </tr>
                ))}
            </Table>
            <p className="muted text-xs mt-3">
              Les centres se vident au profit des activités : c&apos;est le premier étage de l&apos;ABC. Le
              détail euro par euro est consultable dans les{" "}
              <Link href={`${base}/costs`} className="text-brand-600">
                traces d&apos;affectation
              </Link>
              .
            </p>
          </Card>
        </>
      )}

      {!map.configured && (
        <Card className="mt-5" title="Ce que vous obtiendrez">
          <ul className="text-sm space-y-2 muted">
            <li>
              <strong className="text-current">Un coût par objet plus juste</strong> — chaque activité descend
              avec l&apos;inducteur qui la déclenche réellement, au lieu d&apos;une clé unique appliquée à tout.
            </li>
            <li>
              <strong className="text-current">La mise en évidence du subventionnement croisé</strong> — la
              comparaison chiffrée entre les deux méthodes apparaîtra ici même après génération.
            </li>
            <li>
              <strong className="text-current">La traçabilité complète</strong> — chaque euro conserve
              l&apos;activité traversée, son inducteur et sa base de répartition.
            </li>
          </ul>
        </Card>
      )}
    </div>
  );
}
