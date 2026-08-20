"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { authenticate, registerUser } from "@/services/company.service";

export type AuthState = { error?: string };

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const organizationName = String(formData.get("organizationName") ?? "").trim();

  if (!email.includes("@")) return { error: "Adresse e-mail invalide." };
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (name.length < 2) return { error: "Indiquez votre nom." };

  try {
    const { user, organization } = await registerUser({ email, password, name, organizationName });
    await createSession({
      userId: user.id,
      organizationId: organization.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_USED") {
      return { error: "Un compte existe déjà avec cette adresse." };
    }
    return { error: "La création du compte a échoué." };
  }

  redirect("/app");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const result = await authenticate(email, password);
  if (!result) return { error: "Identifiants incorrects." };

  await createSession({
    userId: result.user.id,
    organizationId: result.organizationId,
    email: result.user.email,
    name: result.user.name,
  });

  redirect("/app");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
