"use client";

import { useActionState, useMemo, useState } from "react";
import {
  LEVER_LABELS,
  LEVER_TARGETS,
  simulate,
  type EconomicModel,
  type Lever,
  type LeverTarget,
} from "@/core/analytics/simulation";
import { money, percent, signedPercent } from "@/lib/format";
import { saveScenarioAction, type ScenarioState } from "./actions";

/**
 * Le simulateur exécute EXACTEMENT le même code que le serveur (`core/analytics/simulation`),
 * ce qui permet un aperçu instantané sans aller-retour réseau, sans risque de divergence.
 */

const DEFAULT_LEVERS: { target: LeverTarget; changeType: "pct" | "abs"; value: number }[] = [
  { target: "price", changeType: "pct", value: 0 },
  { target: "volume", changeType: "pct", value: 0 },
  { target: "variableCost", changeType: "pct", value: 0 },
  { target: "fixedCost", changeType: "pct", value: 0 },
];

export function Simulator({
  companyId,
  periodCode,
  model,
}: {
  companyId: string;
  periodCode: string;
  model: EconomicModel;
}) {
  const [levers, setLevers] = useState<Lever[]>(
    DEFAULT_LEVERS.map((lever, index) => ({ id: `lever-${index}`, ...lever })),
  );
  const action = saveScenarioAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<ScenarioState, FormData>(action, {});

  const active = useMemo(() => levers.filter((lever) => lever.value !== 0), [levers]);
  const result = useMemo(() => simulate(model, active), [model, active]);

  const setValue = (id: string, value: number) =>
    setLevers((prev) => prev.map((lever) => (lever.id === id ? { ...lever, value } : lever)));

  const addLever = (target: LeverTarget) =>
    setLevers((prev) => [
      ...prev,
      {
        id: `lever-${prev.length}-${target}`,
        target,
        changeType: target === "headcount" || target === "investment" ? "abs" : "pct",
        value: 0,
        params: target === "investment" ? { amortizationYears: 5 } : target === "fxRate" ? { exposurePct: 0 } : undefined,
      },
    ]);

  const rows: { label: string; before: number | null; after: number | null; format: "money" | "pct" | "ratio" }[] = [
    { label: "Chiffre d'affaires", before: result.before.revenue, after: result.after.revenue, format: "money" },
    { label: "Coûts variables", before: result.before.variableCost, after: result.after.variableCost, format: "money" },
    { label: "Charges fixes", before: result.before.fixedCost, after: result.after.fixedCost, format: "money" },
    {
      label: "Marge sur coûts variables",
      before: result.before.contributionMargin,
      after: result.after.contributionMargin,
      format: "money",
    },
    {
      label: "Taux de marge sur CV",
      before: result.before.contributionMarginRate,
      after: result.after.contributionMarginRate,
      format: "pct",
    },
    { label: "Résultat", before: result.before.result, after: result.after.result, format: "money" },
    { label: "Seuil de rentabilité", before: result.before.breakEven, after: result.after.breakEven, format: "money" },
    {
      label: "Marge de sécurité",
      before: result.before.safetyMarginRate,
      after: result.after.safetyMarginRate,
      format: "pct",
    },
    {
      label: "Levier opérationnel",
      before: result.before.operatingLeverage,
      after: result.after.operatingLeverage,
      format: "ratio",
    },
  ];

  const unusedTargets = LEVER_TARGETS.filter((target) => !levers.some((lever) => lever.target === target));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Leviers</h2>
        <p className="muted text-xs mt-1">
          L&apos;impact est recalculé instantanément : le moteur tourne dans votre navigateur.
        </p>

        <div className="space-y-4 mt-4">
          {levers.map((lever) => (
            <div key={lever.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{LEVER_LABELS[lever.target]}</span>
                <span className="tabular muted">
                  {lever.changeType === "pct"
                    ? `${lever.value > 0 ? "+" : ""}${lever.value} %`
                    : `${lever.value > 0 ? "+" : ""}${lever.value.toLocaleString("fr-FR")}${lever.target === "headcount" ? " ETP" : " €"}`}
                </span>
              </div>
              {lever.changeType === "pct" ? (
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={0.5}
                  value={lever.value}
                  onChange={(e) => setValue(lever.id, Number(e.target.value))}
                />
              ) : (
                <input
                  type="number"
                  step={lever.target === "headcount" ? 1 : 1000}
                  value={lever.value}
                  onChange={(e) => setValue(lever.id, Number(e.target.value))}
                />
              )}
            </div>
          ))}
        </div>

        {unusedTargets.length > 0 && (
          <div className="mt-5">
            <p className="muted text-xs mb-2">Ajouter un levier</p>
            <div className="flex flex-wrap gap-1.5">
              {unusedTargets.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => addLever(target)}
                  className="text-xs border rounded-full px-3 py-1 hover:bg-ink-100"
                >
                  + {LEVER_LABELS[target]}
                </button>
              ))}
            </div>
          </div>
        )}

        {result.notes.length > 0 && (
          <ul className="muted text-xs mt-5 space-y-1">
            {result.notes.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        )}

        <form action={formAction} className="mt-6 flex flex-wrap items-end gap-3">
          <input type="hidden" name="levers" value={JSON.stringify(active)} />
          <input type="hidden" name="periodCode" value={periodCode} />
          <label className="block flex-1 min-w-48">
            <span className="block text-sm font-medium mb-1">Nom du scénario</span>
            <input name="name" placeholder="Hausse tarifaire 2027" />
          </label>
          <button
            type="submit"
            disabled={pending || active.length === 0}
            className="rounded-lg border font-medium px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
        {state.error && <p className="text-sm text-bad-500 mt-2">{state.error}</p>}
        {state.success && <p className="text-sm text-good-500 mt-2">{state.success}</p>}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Impact</h2>
        <p className="muted text-xs mt-1">Base : période analysée, annualisation non appliquée.</p>

        <div className="scroll-x mt-4">
          <table>
            <thead>
              <tr>
                <th>Indicateur</th>
                <th className="text-right">Actuel</th>
                <th className="text-right">Simulé</th>
                <th className="text-right">Écart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const delta =
                  row.before === null || row.after === null ? null : row.after - row.before;
                const deltaPct =
                  row.before === null || row.after === null || row.before === 0
                    ? null
                    : (delta! / Math.abs(row.before)) * 100;
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="text-right tabular">{format(row.before, row.format)}</td>
                    <td className="text-right tabular font-medium">{format(row.after, row.format)}</td>
                    <td
                      className={`text-right tabular ${
                        delta === null || delta === 0 ? "muted" : delta > 0 ? "text-good-500" : "text-bad-500"
                      }`}
                    >
                      {deltaPct === null ? "—" : signedPercent(deltaPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-sm mt-5">
          {active.length === 0
            ? "Déplacez un curseur pour simuler."
            : `Avec ce scénario, le résultat ${result.deltas.result >= 0 ? "progresse" : "recule"} de ${money(Math.abs(result.deltas.result))} et le seuil de rentabilité ${
                (result.deltas.breakEven ?? 0) <= 0 ? "baisse" : "monte"
              } de ${money(Math.abs(result.deltas.breakEven ?? 0))}.`}
        </p>
      </section>
    </div>
  );
}

function format(value: number | null, kind: "money" | "pct" | "ratio"): string {
  if (value === null) return "—";
  if (kind === "money") return money(value);
  if (kind === "pct") return percent(value);
  return value.toFixed(2);
}
