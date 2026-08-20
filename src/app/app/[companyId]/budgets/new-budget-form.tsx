"use client";

import { useActionState } from "react";
import { createBudgetAction, type BudgetState } from "./actions";

export function NewBudgetForm({ companyId, years }: { companyId: string; years: number[] }) {
  const action = createBudgetAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<BudgetState, FormData>(action, {});

  const currentYear = years[years.length - 1] ?? new Date().getUTCFullYear();
  const sourceYear = years.length > 1 ? years[years.length - 2] : currentYear;

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
      <label className="block lg:col-span-2">
        <span className="block text-sm font-medium mb-1">Nom</span>
        <input name="name" defaultValue={`Budget ${currentYear}`} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Exercice cible</span>
        <select name="fiscalYear" defaultValue={String(currentYear)}>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Exercice source</span>
        <select name="sourceFiscalYear" defaultValue={String(sourceYear)}>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-sm font-medium mb-1">CA %</span>
          <input name="growthPct" type="number" step="0.5" defaultValue={5} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">Charges %</span>
          <input name="costGrowthPct" type="number" step="0.5" defaultValue={3} />
        </label>
      </div>

      <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 text-white font-medium px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {pending ? "Construction…" : "Construire le budget"}
        </button>
        {state.error && <span className="text-sm text-bad-500">{state.error}</span>}
        {state.success && <span className="text-sm text-good-500">{state.success}</span>}
      </div>
    </form>
  );
}
