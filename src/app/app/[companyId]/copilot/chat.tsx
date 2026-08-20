"use client";

import { useActionState, useRef } from "react";
import { askAction, type CopilotState } from "./actions";

export function CopilotChat({
  companyId,
  periodCode,
  suggestions,
}: {
  companyId: string;
  periodCode: string;
  suggestions: string[];
}) {
  const action = askAction.bind(null, companyId, periodCode);
  const [state, formAction, pending] = useActionState<CopilotState, FormData>(action, { answers: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {state.answers.length === 0 && (
          <div className="card p-5">
            <p className="text-sm font-medium">Posez une question en français.</p>
            <p className="muted text-sm mt-1">
              Le copilote détecte l&apos;intention, appelle les moteurs de calcul, puis rédige. Chaque réponse
              indique les données utilisées et la façon dont le chiffre a été obtenu.
            </p>
          </div>
        )}

        {state.answers.map((answer, index) => (
          <div key={index} className="space-y-2">
            <div className="text-sm">
              <span className="muted">Vous :</span> {answer.question}
            </div>
            <div className="card p-5">
              <p className="text-sm leading-relaxed">{answer.text}</p>

              {answer.table && (
                <div className="scroll-x mt-4">
                  <table>
                    <thead>
                      <tr>
                        {answer.table.columns.map((column, i) => (
                          <th key={column} className={i === 0 ? "" : "text-right"}>
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {answer.table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={cellIndex === 0 ? "" : "text-right tabular"}>
                              {typeof cell === "number" ? cell.toLocaleString("fr-FR") : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="mt-4">
                <summary className="text-xs muted cursor-pointer">Comment ce chiffre est obtenu</summary>
                <ul className="muted text-xs mt-2 space-y-1">
                  {answer.computation.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                  {answer.sources.map((line) => (
                    <li key={line}>· source : {line}</li>
                  ))}
                  <li>
                    · rédaction : {answer.provider === "anthropic" ? "modèle de langage (chiffres vérifiés)" : "gabarit local"}
                    {answer.verified ? "" : " — réponse du modèle rejetée : chiffre absent du contexte"}
                  </li>
                  <li>· indice de confiance : {answer.confidence}</li>
                </ul>
              </details>

              {answer.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {answer.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        if (inputRef.current) inputRef.current.value = suggestion;
                      }}
                      className="text-xs border rounded-full px-3 py-1 hover:bg-ink-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {state.error && <p className="text-sm text-bad-500">{state.error}</p>}

      <form action={formAction} className="flex gap-2 sticky bottom-4">
        <input ref={inputRef} name="question" placeholder="Posez votre question…" autoComplete="off" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 text-white font-medium px-4 py-2.5 text-sm disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "…" : "Envoyer"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = suggestion;
            }}
            className="text-xs border rounded-full px-3 py-1 hover:bg-ink-100"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
