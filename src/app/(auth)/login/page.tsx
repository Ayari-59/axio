"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            A
          </span>
          <span className="font-semibold tracking-tight">Axio</span>
        </Link>

        <h1 className="text-xl font-semibold">Connexion</h1>
        <p className="muted text-sm mt-1">Accédez à vos entreprises pilotées.</p>

        <form action={action} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Adresse e-mail</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Mot de passe</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          {state.error && <p className="text-sm text-bad-500">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-600 text-white font-medium py-2.5 disabled:opacity-60"
          >
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="muted text-sm mt-6">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-brand-600 font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
