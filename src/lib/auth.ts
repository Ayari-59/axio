import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { Role } from "@/core/model/enums";

/**
 * Session maison (docs/02 §2) : JWT HS256 signé, cookie httpOnly.
 * Choix assumé plutôt qu'une bibliothèque d'authentification : moins de surface, aucun
 * comportement implicite, et pas de dépendance à la compatibilité du framework.
 */

const COOKIE_NAME = "axio_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET manquant ou trop court : générez une valeur aléatoire de 32 octets.");
  }
  return new TextEncoder().encode(value);
}

export type SessionPayload = {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSession(): Promise<SessionPayload | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string" || typeof payload.organizationId !== "string") return null;
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

export type SessionUser = SessionPayload & { role: Role };

/** Session enrichie du rôle dans l'organisation. Null si la session est absente ou invalide. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await readSession();
  if (!session) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, organizationId: session.organizationId },
    orderBy: { role: "asc" },
  });
  if (!membership) return null;

  return { ...session, role: membership.role as Role };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
