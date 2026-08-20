import { describe, expect, it } from "vitest";
import { detectIntent, normalize } from "@/core/copilot/intents";
import { buildCommentary, collectNumbers, verifyNumbers } from "@/core/copilot/answer";

describe("détection d'intention", () => {
  const cases: { question: string; intent: string; extra?: (d: ReturnType<typeof detectIntent>) => void }[] = [
    { question: "Quelle est ma marge ce mois-ci ?", intent: "measure_value" },
    { question: "quel est mon chiffre d'affaires ?", intent: "measure_value" },
    { question: "Où en est ma trésorerie ?", intent: "measure_value" },
    { question: "Pourquoi ma marge baisse ?", intent: "explain_variance" },
    { question: "pourquoi mes charges augmentent", intent: "explain_variance" },
    { question: "Explique-moi la baisse de rentabilité", intent: "explain_variance" },
    { question: "D'où vient la dégradation du résultat ?", intent: "explain_variance" },
    {
      question: "Quels sont mes cinq clients les moins rentables ?",
      intent: "rank_objects",
      extra: (d) => {
        expect(d.dimensionHint).toBe("CLIENT");
        expect(d.order).toBe("asc");
        expect(d.topN).toBe(5);
      },
    },
    {
      question: "top 3 des chantiers les plus rentables",
      intent: "rank_objects",
      extra: (d) => {
        expect(d.dimensionHint).toBe("PROJECT");
        expect(d.order).toBe("desc");
        expect(d.topN).toBe(3);
      },
    },
    { question: "Quel département dépasse son budget ?", intent: "check_budget" },
    { question: "où en est mon budget ?", intent: "check_budget" },
    { question: "Quel chantier présente le plus grand risque ?", intent: "list_risks" },
    { question: "y a-t-il des alertes ?", intent: "list_risks" },
    {
      question: "Que se passe-t-il si j'augmente mes prix de 5 % ?",
      intent: "simulate",
      extra: (d) => expect(d.levers).toContainEqual({ target: "price", value: 5 }),
    },
    {
      question: "et si j'embauche 2 personnes ?",
      intent: "simulate",
      extra: (d) => expect(d.levers).toContainEqual({ target: "headcount", value: 2 }),
    },
    { question: "Prépare-moi une analyse mensuelle de contrôle de gestion.", intent: "build_report" },
    { question: "fais-moi un rapport", intent: "build_report" },
    { question: "Comment est calculé le taux d'occupation ?", intent: "explain_kpi" },
    { question: "c'est quoi le seuil de rentabilité ?", intent: "explain_kpi" },
    { question: "bonjour", intent: "unknown" },
  ];

  for (const testCase of cases) {
    it(`« ${testCase.question} » → ${testCase.intent}`, () => {
      const detection = detectIntent(testCase.question);
      expect(detection.intent).toBe(testCase.intent);
      testCase.extra?.(detection);
    });
  }

  it("normalise accents, apostrophes et ponctuation", () => {
    expect(normalize("Pourquoi ma MARGE baisse-t-elle ?")).toBe("pourquoi ma marge baisse-t-elle");
    expect(normalize("l'écart d'exploitation")).toBe("l ecart d exploitation");
  });

  it("détecte le sens d'un levier exprimé à la baisse", () => {
    const detection = detectIntent("que se passe-t-il si mes ventes baissent de 3 % ?");
    expect(detection.levers?.some((l) => l.target === "volume" && l.value === -3)).toBe(true);
  });
});

describe("garde-fou anti-hallucination", () => {
  const context = {
    revenue: 412_000,
    marginRate: 24.1,
    contributors: [{ label: "Vega", delta: -4_900 }],
  };
  const allowed = collectNumbers(context);

  it("accepte une réponse dont tous les chiffres viennent du contexte", () => {
    const answer =
      "Le chiffre d'affaires atteint 412 000 € et le taux de marge s'établit à 24,1 %. Vega pèse -4 900 €.";
    expect(verifyNumbers(answer, allowed).ok).toBe(true);
  });

  it("rejette une réponse contenant un chiffre inventé", () => {
    const answer = "Le chiffre d'affaires atteint 412 000 € et la trésorerie s'élève à 87 500 €.";
    const check = verifyNumbers(answer, allowed);
    expect(check.ok).toBe(false);
    expect(check.offending).toContain(87_500);
  });

  it("tolère les petits entiers (rangs, comptages)", () => {
    expect(verifyNumbers("3 contributeurs expliquent la variation.", allowed).ok).toBe(true);
  });
});

describe("commentaire de gestion", () => {
  it("produit un texte déterministe et chiffré", () => {
    const commentary = buildCommentary({
      periodLabel: "mars 2026",
      revenue: 412_000,
      revenueDeltaPct: 6.2,
      marginRate: 24.1,
      marginRateDeltaPts: -2.4,
      attribution: null,
      topAlert: { title: "Sous-occupation", message: "Le taux d'occupation est inférieur à 70 %." },
      breakEven: { breakEven: 380_000, safetyMarginRate: 7.8 },
    });

    expect(commentary).toContain("mars 2026");
    expect(commentary).toContain("24,1 %");
    expect(commentary).toContain("seuil de rentabilité");
    expect(buildCommentary({
      periodLabel: "mars 2026",
      revenue: 412_000,
      revenueDeltaPct: 6.2,
      marginRate: 24.1,
      marginRateDeltaPts: -2.4,
      attribution: null,
      topAlert: null,
      breakEven: null,
    })).toBe(
      buildCommentary({
        periodLabel: "mars 2026",
        revenue: 412_000,
        revenueDeltaPct: 6.2,
        marginRate: 24.1,
        marginRateDeltaPts: -2.4,
        attribution: null,
        topAlert: null,
        breakEven: null,
      }),
    );
  });
});
