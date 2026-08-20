import { collectNumbers, verifyNumbers } from "@/core/copilot/answer";

/**
 * Couche de formulation (docs/11 §4).
 *
 * `AI_PROVIDER=local` (défaut) : gabarits déterministes, application complète sans clé d'API.
 * `AI_PROVIDER=anthropic`      : le modèle rédige à partir des seuls chiffres fournis, et sa
 *                                réponse est vérifiée nombre par nombre avant affichage.
 */

export type NarrationRequest = {
  question: string;
  /** Résultats calculés par les moteurs — seule source de vérité chiffrée. */
  context: unknown;
  /** Réponse déterministe, servie si le modèle est absent ou si la vérification échoue. */
  fallback: string;
};

export type NarrationResult = {
  text: string;
  provider: "local" | "anthropic";
  verified: boolean;
  rejectedNumbers?: number[];
};

const SYSTEM_PROMPT = `Tu es un contrôleur de gestion. Tu commentes des chiffres DÉJÀ CALCULÉS.
Règles absolues :
- tu ne produis, ne corriges et n'extrapoles AUCUN chiffre ;
- tout nombre de ta réponse doit figurer dans le contexte fourni ;
- si l'information n'est pas dans le contexte, dis-le explicitement ;
- style : factuel, 4 phrases maximum, pas de formule creuse, pas de recommandation non demandée.`;

export async function narrate(request: NarrationRequest): Promise<NarrationResult> {
  const provider = (process.env.AI_PROVIDER ?? "local").toLowerCase();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (provider !== "anthropic" || !apiKey) {
    return { text: request.fallback, provider: "local", verified: true };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "claude-sonnet-5",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Question : ${request.question}\n\nContexte chiffré (JSON) :\n${JSON.stringify(request.context)}\n\nRédige la réponse.`,
          },
        ],
      }),
    });

    if (!response.ok) return { text: request.fallback, provider: "local", verified: true };

    const payload = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = payload.content?.map((c) => c.text ?? "").join("").trim();
    if (!text) return { text: request.fallback, provider: "local", verified: true };

    const allowed = collectNumbers(request.context);
    const check = verifyNumbers(text, allowed);
    if (!check.ok) {
      // Garde-fou : toute réponse contenant un chiffre absent du contexte est écartée.
      return {
        text: request.fallback,
        provider: "local",
        verified: false,
        rejectedNumbers: check.offending,
      };
    }

    return { text, provider: "anthropic", verified: true };
  } catch {
    return { text: request.fallback, provider: "local", verified: true };
  }
}

export function aiProviderLabel(): string {
  const provider = (process.env.AI_PROVIDER ?? "local").toLowerCase();
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) return "Anthropic (rédaction) + moteur local (calculs)";
  return "Moteur local (aucun appel externe)";
}
