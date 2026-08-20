"use client";

import { useActionState } from "react";
import { uploadAction, type UploadState } from "./actions";

export function UploadForm({ companyId }: { companyId: string }) {
  const action = uploadAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<UploadState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="block flex-1 min-w-64">
        <span className="block text-sm font-medium mb-1">Fichier CSV</span>
        <input type="file" name="file" accept=".csv,text/csv,text/plain" required />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 text-white font-medium px-4 py-2.5 text-sm disabled:opacity-60"
      >
        {pending ? "Analyse…" : "Analyser le fichier"}
      </button>
      {state.error && <p className="text-sm text-bad-500 w-full">{state.error}</p>}
    </form>
  );
}
