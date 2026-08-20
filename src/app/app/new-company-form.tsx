"use client";

import { useActionState } from "react";
import { SECTORS } from "@/core/templates";
import { createCompanyAction, type CompanyState } from "./actions";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function NewCompanyForm() {
  const [state, action, pending] = useActionState<CompanyState, FormData>(createCompanyAction, {});

  return (
    <form action={action} className="card p-5 mt-3 grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="block text-sm font-medium mb-1">Nom de l&apos;entreprise</span>
        <input name="name" required placeholder="Delta Conseil" />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Secteur</span>
        <select name="industry" defaultValue="other">
          {SECTORS.map((sector) => (
            <option key={sector.code} value={sector.code}>
              {sector.label}
            </option>
          ))}
        </select>
        <span className="muted block text-xs mt-1">
          Le secteur ne verrouille rien : il choisit un jeu de règles que les étapes suivantes affinent.
        </span>
      </label>

      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium mb-1">Activité en une phrase</span>
        <input name="activity" placeholder="Conseil en organisation pour les collectivités" />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Début d&apos;exercice</span>
        <select name="fiscalYearStartMonth" defaultValue="1">
          {MONTHS.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Devise</span>
        <select name="currency" defaultValue="EUR">
          <option value="EUR">Euro (EUR)</option>
          <option value="TND">Dinar tunisien (TND)</option>
          <option value="CHF">Franc suisse (CHF)</option>
          <option value="USD">Dollar (USD)</option>
        </select>
      </label>

      {state.error && <p className="text-sm text-bad-500 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 text-white font-medium px-4 py-2.5 disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer et configurer"}
        </button>
      </div>
    </form>
  );
}
