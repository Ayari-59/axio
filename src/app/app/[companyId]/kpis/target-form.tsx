"use client";

import { useActionState } from "react";
import { setTargetAction, type TargetState } from "./actions";

export function TargetForm({
  companyId,
  code,
  target,
  unit,
}: {
  companyId: string;
  code: string;
  target: number | null;
  unit: string;
}) {
  const action = setTargetAction.bind(null, companyId, code);
  const [state, formAction, pending] = useActionState<TargetState, FormData>(action, {});

  return (
    <form action={formAction} className="flex items-end gap-2">
      <label className="block">
        <span className="block text-xs font-medium mb-1">Cible ({unit === "PCT" ? "%" : unit === "EUR" ? "€" : unit.toLowerCase()})</span>
        <input name="target" defaultValue={target ?? ""} className="w-32" placeholder="aucune" />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">
        {pending ? "…" : "Enregistrer"}
      </button>
      {state.error && <span className="text-xs text-bad-500">{state.error}</span>}
      {state.success && <span className="text-xs text-good-500">{state.success}</span>}
    </form>
  );
}
