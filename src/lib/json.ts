import type { z } from "zod";

/**
 * Colonnes JSON portables (docs/04 §3) : la base stocke du texte, l'application
 * ne manipule que des objets validés. En PostgreSQL, `parse` devient l'identité.
 */

export function parseJson<T>(schema: z.ZodType<T>, raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonLoose<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}
