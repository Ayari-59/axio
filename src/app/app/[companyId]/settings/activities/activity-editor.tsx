"use client";

import { useActionState, useMemo, useState } from "react";
import { DRIVER_CODES } from "@/core/model/enums";
import type { ActivityRow } from "@/services/abc.service";
import { applyActivitiesAction, type ActivityState } from "./actions";

/**
 * Carte des activités : ce que l'entreprise *fait*, et ce qui déclenche chaque activité.
 * L'écran impose la seule règle non négociable de l'ABC — la somme des ressources
 * consommées fait 100 % — et refuse une activité sans inducteur.
 */

export function ActivityEditor({
  companyId,
  initial,
  configured,
  availableDrivers,
}: {
  companyId: string;
  initial: ActivityRow[];
  configured: boolean;
  availableDrivers: string[];
}) {
  const [rows, setRows] = useState<ActivityRow[]>(initial);
  const action = applyActivitiesAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<ActivityState, FormData>(action, {});

  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.share) || 0), 0), [rows]);
  const balanced = Math.abs(total - 100) < 0.5;

  const update = (code: string, patch: Partial<ActivityRow>) =>
    setRows((previous) => previous.map((row) => (row.code === code ? { ...row, ...patch } : row)));

  const remove = (code: string) => setRows((previous) => previous.filter((row) => row.code !== code));

  const add = () =>
    setRows((previous) => [
      ...previous,
      {
        code: `ACTIVITE_${previous.length + 1}`,
        label: "Nouvelle activité",
        driverKey: "HOURS",
        driverLabel: "heures",
        share: 0,
        rationale: "",
        hasDriverData: availableDrivers.includes("HOURS"),
        driverTotal: 0,
      },
    ]);

  /** Répartit l'écart restant sur la dernière activité, pour atteindre 100 % sans calcul mental. */
  const balance = () => {
    if (rows.length === 0) return;
    const others = rows.slice(0, -1).reduce((sum, row) => sum + (Number(row.share) || 0), 0);
    setRows((previous) =>
      previous.map((row, index) =>
        index === previous.length - 1 ? { ...row, share: Math.round((100 - others) * 10) / 10 } : row,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Activité</th>
                <th>Inducteur — ce qui déclenche l&apos;activité</th>
                <th className="text-right">Part des ressources</th>
                <th className="text-right">Donnée</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hasData = availableDrivers.includes(row.driverKey);
                return (
                  <tr key={row.code}>
                    <td>
                      <input
                        value={row.label}
                        onChange={(e) => update(row.code, { label: e.target.value })}
                        className="min-w-48"
                      />
                      {row.rationale && <p className="muted text-xs mt-1 max-w-md">{row.rationale}</p>}
                    </td>
                    <td>
                      <select
                        value={row.driverKey}
                        onChange={(e) => update(row.code, { driverKey: e.target.value })}
                        className="w-auto min-w-44"
                      >
                        {DRIVER_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                            {availableDrivers.includes(code) ? "" : " (aucune donnée)"}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={row.share}
                        onChange={(e) => update(row.code, { share: Number(e.target.value) })}
                        className="w-24 text-right"
                      />
                      <span className="muted text-xs ml-1">%</span>
                    </td>
                    <td className="text-right">
                      {hasData ? (
                        <span className="text-xs text-good-500">renseignée</span>
                      ) : (
                        <span className="text-xs text-warn-500">manquante</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button type="button" onClick={() => remove(row.code)} className="text-xs text-bad-500">
                        retirer
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="font-semibold">Total</td>
                <td />
                <td className="text-right">
                  <span className={`tabular font-semibold ${balanced ? "text-good-500" : "text-warn-500"}`}>
                    {Math.round(total * 10) / 10} %
                  </span>
                </td>
                <td colSpan={2} className="text-right">
                  {!balanced && (
                    <button type="button" onClick={balance} className="text-xs text-brand-600">
                      ajuster à 100 %
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} className="rounded-lg border px-3.5 py-2 text-sm font-medium">
          + Ajouter une activité
        </button>

        <form action={formAction}>
          <input
            type="hidden"
            name="activities"
            value={JSON.stringify(
              rows.map((row) => ({
                code: row.code,
                label: row.label,
                driverKey: row.driverKey,
                share: Number(row.share) || 0,
                rationale: row.rationale,
              })),
            )}
          />
          <button
            type="submit"
            disabled={pending || !balanced}
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Génération…" : configured ? "Mettre à jour la carte" : "Générer la carte d'activités"}
          </button>
        </form>

        {!balanced && (
          <span className="muted text-sm">
            La somme doit faire 100 % : une ressource ne peut être consommée qu&apos;une fois.
          </span>
        )}
      </div>

      {state.error && <p className="text-sm text-bad-500">{state.error}</p>}
      {state.success && <p className="text-sm text-good-500">{state.success}</p>}
    </div>
  );
}
