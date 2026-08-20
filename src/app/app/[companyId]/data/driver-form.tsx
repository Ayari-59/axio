"use client";

import { useActionState, useState } from "react";
import { DRIVER_CODES } from "@/core/model/enums";
import { addDriverAction, type DriverState } from "./actions";

export function DriverForm({
  companyId,
  periods,
  dimensions,
  members,
  requiredDrivers,
}: {
  companyId: string;
  periods: string[];
  dimensions: { code: string; label: string }[];
  members: { dimensionCode: string; code: string; label: string }[];
  requiredDrivers: string[];
}) {
  const action = addDriverAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<DriverState, FormData>(action, {});
  const [dimensionCode, setDimensionCode] = useState("");

  const codes = [...new Set([...requiredDrivers, ...DRIVER_CODES])];
  const scopedMembers = members.filter((m) => m.dimensionCode === dimensionCode);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="block text-sm font-medium mb-1">Inducteur</span>
        <select name="driverCode" defaultValue={requiredDrivers[0] ?? "HOURS"}>
          {codes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Période</span>
        <select name="periodCode" defaultValue={periods[periods.length - 1]}>
          {[...periods].reverse().map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Axe (facultatif)</span>
        <select name="dimensionCode" value={dimensionCode} onChange={(e) => setDimensionCode(e.target.value)}>
          <option value="">Entreprise entière</option>
          {dimensions.map((dimension) => (
            <option key={dimension.code} value={dimension.code}>
              {dimension.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Membre</span>
        <select name="memberCode" disabled={scopedMembers.length === 0}>
          <option value="">—</option>
          {scopedMembers.map((member) => (
            <option key={member.code} value={member.code}>
              {member.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Valeur</span>
        <input name="value" type="number" step="0.01" required />
      </label>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border font-medium px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {state.error && <p className="text-sm text-bad-500 sm:col-span-2">{state.error}</p>}
      {state.success && <p className="text-sm text-good-500 sm:col-span-2">{state.success}</p>}
    </form>
  );
}
