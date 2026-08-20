"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type AuthState } from "../actions";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, {});

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            A
          </span>
          <span className="font-semibold tracking-tight">Axio</span>
        </Link>

        <h1 className="text-xl font-semibold">Créer un compte</h1>
        <p className="muted text-sm mt-1">Une organisation est créée automatiquement ; vous pourrez y ajouter plusieurs entreprises.</p>

        <form action={action} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Nom et prénom</span>
            <input name="name" required autoComplete="name" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Adresse e-mail</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Mot de passe</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
            <span className="muted block text-xs mt-1">8 caractères minimum.</span>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Nom de l&apos;organisation (facultatif)</span>
            <input name="organizationName" placeholder="Cabinet, groupe, holding…" />
          </label>

          {state.error && <p className="text-sm text-bad-500">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-600 text-white font-medium py-2.5 disabled:opacity-60"
          >
            {pending ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <p className="muted text-sm mt-6">
          Déjà inscrit ?{" "}
          <Link href="/login" className="text-brand-600 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
