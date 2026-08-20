"use client";

import { useActionState, useMemo, useState } from "react";
import type { ImportAnalysis } from "@/services/import.service";
import type { ImportMapping, MappingTarget } from "@/core/import/mapping";
import { commitAction, dryRunAction, type DryRunState } from "../../actions";

const STANDARD_TARGETS: { value: MappingTarget; label: string }[] = [
  { value: "ignore", label: "— ignorer —" },
  { value: "date", label: "Date" },
  { value: "amount", label: "Montant" },
  { value: "quantity", label: "Quantité" },
  { value: "unitPrice", label: "Prix unitaire" },
  { value: "label", label: "Libellé" },
  { value: "account", label: "Compte" },
  { value: "kind", label: "Sens (produit / charge)" },
  { value: "behavior", label: "Comportement (fixe / variable)" },
  { value: "traceability", label: "Traçabilité (direct / indirect)" },
];

export function MappingEditor({
  companyId,
  batchId,
  analysis,
  dimensions,
}: {
  companyId: string;
  batchId: string;
  analysis: ImportAnalysis;
  dimensions: { code: string; label: string }[];
}) {
  const [targets, setTargets] = useState<Record<number, MappingTarget>>(() =>
    Object.fromEntries(
      analysis.suggestions.map((s) => [s.index, s.confidence >= 70 ? s.target : ("ignore" as MappingTarget)]),
    ),
  );
  const [createMissing, setCreateMissing] = useState(true);
  const [defaultKind, setDefaultKind] = useState<"" | "REVENUE" | "COST">("");

  const mapping: ImportMapping = useMemo(
    () => ({
      columns: analysis.profiles.map((profile) => ({
        column: profile.name,
        index: profile.index,
        target: targets[profile.index] ?? "ignore",
      })),
      defaults: defaultKind ? { kind: defaultKind } : {},
      createMissingMembers: createMissing,
    }),
    [analysis.profiles, targets, createMissing, defaultKind],
  );

  const dryRun = dryRunAction.bind(null, companyId, batchId);
  const [state, formAction, pending] = useActionState<DryRunState, FormData>(dryRun, {});
  const commit = commitAction.bind(null, companyId, batchId);

  const hasDate = Object.values(targets).includes("date");
  const hasAmount = Object.values(targets).includes("amount");

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Correspondance des colonnes</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Colonne source</th>
                <th>Type détecté</th>
                <th>Exemples</th>
                <th>Correspondance</th>
                <th className="text-right">Confiance</th>
              </tr>
            </thead>
            <tbody>
              {analysis.profiles.map((profile) => {
                const suggestion = analysis.suggestions.find((s) => s.index === profile.index);
                return (
                  <tr key={profile.index}>
                    <td className="font-medium">{profile.name}</td>
                    <td className="muted text-xs">
                      {profile.type} · {profile.distinctCount} valeurs · rempli {profile.fillRate} %
                    </td>
                    <td className="muted text-xs truncate max-w-64">{profile.samples.join(" · ")}</td>
                    <td>
                      <select
                        value={targets[profile.index] ?? "ignore"}
                        onChange={(e) =>
                          setTargets((prev) => ({ ...prev, [profile.index]: e.target.value as MappingTarget }))
                        }
                      >
                        <optgroup label="Champs">
                          {STANDARD_TARGETS.map((target) => (
                            <option key={target.value} value={target.value}>
                              {target.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Axes d'analyse">
                          {dimensions.map((dimension) => (
                            <option key={dimension.code} value={`dimension:${dimension.code}`}>
                              Axe : {dimension.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td className="text-right text-xs tabular">
                      {suggestion && suggestion.confidence > 0 ? `${suggestion.confidence} %` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-6 mt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
            Créer automatiquement les membres inconnus
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>Sens par défaut</span>
            <select
              className="w-auto"
              value={defaultKind}
              onChange={(e) => setDefaultKind(e.target.value as "" | "REVENUE" | "COST")}
            >
              <option value="">déduit du compte (7 = produit)</option>
              <option value="COST">charge</option>
              <option value="REVENUE">produit</option>
            </select>
          </label>
        </div>

        {(!hasDate || !hasAmount) && (
          <p className="text-sm text-warn-500 mt-3">
            Une colonne « Date » et une colonne « Montant » sont indispensables.
          </p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Aperçu du fichier</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                {analysis.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.preview.map((row, index) => (
                <tr key={index}>
                  {analysis.headers.map((_, columnIndex) => (
                    <td key={columnIndex} className="text-xs">
                      {row[columnIndex]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <form action={formAction}>
          <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
          <button
            type="submit"
            disabled={pending || !hasDate || !hasAmount}
            className="rounded-lg border font-medium px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {pending ? "Essai en cours…" : "Tester à blanc"}
          </button>
        </form>

        <form action={commit}>
          <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
          <button
            type="submit"
            disabled={!state.report || state.report.valid === 0}
            className="rounded-lg bg-brand-600 text-white font-medium px-4 py-2.5 text-sm disabled:opacity-50"
          >
            Importer {state.report ? `${state.report.valid} lignes` : ""}
          </button>
        </form>
      </div>

      {state.error && <p className="text-sm text-bad-500">{state.error}</p>}

      {state.report && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Résultat de l&apos;essai à blanc</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Lignes valides" value={String(state.report.valid)} />
            <Stat label="Lignes rejetées" value={String(state.report.rejected.length)} />
            <Stat label="Produits" value={state.report.totals.revenue.toLocaleString("fr-FR") + " €"} />
            <Stat label="Charges" value={state.report.totals.cost.toLocaleString("fr-FR") + " €"} />
          </div>

          {state.report.newMembers.length > 0 && (
            <p className="text-sm mt-4">
              <strong>Membres à créer :</strong>{" "}
              {state.report.newMembers
                .map((m) => `${m.codes.length} sur l'axe ${m.dimensionCode}`)
                .join(" · ")}
            </p>
          )}
          {state.report.newPeriods.length > 0 && (
            <p className="text-sm mt-1">
              <strong>Périodes à créer :</strong> {state.report.newPeriods.join(", ")}
            </p>
          )}

          {state.report.rejected.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium">Lignes rejetées (10 premières)</p>
              <ul className="muted text-xs mt-1 space-y-0.5">
                {state.report.rejected.slice(0, 10).map((rejected) => (
                  <li key={rejected.row}>
                    ligne {rejected.row} — {rejected.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <p className="text-sm font-medium">
              Qualité projetée : <span className="tabular">{state.report.qualityScore} %</span>
            </p>
            <ul className="muted text-xs mt-1 space-y-0.5">
              {state.report.qualityIssues.slice(0, 5).map((issue) => (
                <li key={issue.code}>
                  {issue.label} : {issue.count} — {issue.fix}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="muted text-xs uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold tabular mt-0.5">{value}</p>
    </div>
  );
}
