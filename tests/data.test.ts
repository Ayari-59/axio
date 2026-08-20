import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, parseDate, parseNumber, periodCodeFromDate } from "@/core/import/csv";
import { memberCodeFrom, profileColumns, suggestMapping, transformRow } from "@/core/import/mapping";
import { matchAccount } from "@/core/templates/accounts";
import { runQualityChecks } from "@/core/quality/checks";
import { cost, dataset, dimension, member, period, revenue } from "./fixtures/builders";

describe("lecture de fichiers plats", () => {
  it("détecte le séparateur", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("gère les guillemets et les séparateurs échappés", () => {
    const parsed = parseCsv('nom;montant\n"Dupont; et fils";1 234,56');
    expect(parsed.headers).toEqual(["nom", "montant"]);
    expect(parsed.rows[0]).toEqual(["Dupont; et fils", "1 234,56"]);
  });

  it("lit les montants au format français", () => {
    expect(parseNumber("1 234,56")).toBe(1234.56);
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1234.56")).toBe(1234.56);
    expect(parseNumber("(1 234,56)")).toBe(-1234.56);
    expect(parseNumber("-99")).toBe(-99);
    expect(parseNumber("1 234,56 €")).toBe(1234.56);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });

  it("lit les dates dans les formats courants", () => {
    expect(parseDate("31/03/2026")).toBe("2026-03-31");
    expect(parseDate("2026-03-31")).toBe("2026-03-31");
    expect(parseDate("31.03.2026")).toBe("2026-03-31");
    expect(parseDate("01/12/26")).toBe("2026-12-01");
    expect(parseDate("pas une date")).toBeNull();
    expect(periodCodeFromDate("2026-03-31")).toBe("2026-03");
  });
});

describe("mapping assisté", () => {
  const csv = parseCsv(
    [
      "Date facture;Compte;Libellé;Montant HT;Client;Affaire;Nature",
      "31/03/2026;606100;Achat matériaux;12 400,00;Foncia;Alba;MATERIAL",
      "31/03/2026;606100;Achat matériaux;3 100,00;OPH;Bréa;MATERIAL",
    ].join("\n"),
  );
  const profiles = profileColumns(csv.headers, csv.rows);
  const dimensions = [
    dimension("CLIENT", "Client", { isCostObject: true }),
    dimension("PROJECT", "Chantier", { isCostObject: true }),
    dimension("NATURE", "Nature"),
  ];
  const suggestions = suggestMapping(profiles, dimensions);
  const target = (column: string) => suggestions.find((s) => s.column === column);

  it("profile les colonnes", () => {
    expect(profiles.find((p) => p.name === "Date facture")?.type).toBe("date");
    expect(profiles.find((p) => p.name === "Montant HT")?.type).toBe("number");
    expect(profiles.find((p) => p.name === "Client")?.distinctCount).toBe(2);
  });

  it("propose les correspondances standards", () => {
    expect(target("Date facture")?.target).toBe("date");
    expect(target("Montant HT")?.target).toBe("amount");
    expect(target("Compte")?.target).toBe("account");
    expect(target("Libellé")?.target).toBe("label");
  });

  it("reconnaît les axes d'analyse, y compris un libellé sectoriel", () => {
    expect(target("Client")?.target).toBe("dimension:CLIENT");
    expect(target("Affaire")?.target).toBe("dimension:PROJECT");
    expect(target("Nature")?.target).toBe("dimension:NATURE");
  });

  it("transforme une ligne en écriture", () => {
    const mapping = {
      columns: suggestions.map((s) => ({ column: s.column, index: s.index, target: s.target })),
      defaults: {},
      createMissingMembers: true,
    };
    const result = transformRow(csv.rows[0], { mapping });
    expect(result.ok).toBe(true);
    expect(result.entry?.amount).toBe(12_400);
    expect(result.entry?.periodCode).toBe("2026-03");
    expect(result.entry?.kind).toBe("COST"); // compte 606 → charge
    expect(result.entry?.traceability).toBe("DIRECT"); // ventilé sur un objet de coût
    expect(result.entry?.dims).toMatchObject({ CLIENT: "FONCIA", PROJECT: "ALBA", NATURE: "MATERIAL" });
  });

  it("classe l'écriture d'après le plan de comptes, par préfixe le plus spécifique", () => {
    const mapping = {
      columns: suggestions.map((s) => ({ column: s.column, index: s.index, target: s.target })),
      defaults: {},
      createMissingMembers: true,
    };
    // Le fichier porte « 606100 » ; le plan connaît « 606 ».
    const accountDefaults = (accountNumber: string) => {
      const preset = matchAccount(accountNumber);
      if (!preset) return undefined;
      return {
        kind: preset.type === "REVENUE" ? ("REVENUE" as const) : ("COST" as const),
        behavior: preset.defaultBehavior,
        traceability: preset.defaultTraceability,
        natureCode: preset.defaultNatureCode ?? undefined,
      };
    };
    const result = transformRow(csv.rows[0], { mapping, accountDefaults });
    expect(result.entry?.behavior).toBe("SEMI_VARIABLE"); // 606 = achats non stockés
    expect(matchAccount("641200")?.number).toBe("641");
    expect(matchAccount("706000")?.type).toBe("REVENUE");
    expect(matchAccount("999999")).toBeUndefined();
  });

  it("rapproche une valeur de colonne d'un membre existant par son libellé", () => {
    const mapping = {
      columns: suggestions.map((s) => ({ column: s.column, index: s.index, target: s.target })),
      defaults: {},
      createMissingMembers: true,
    };
    // Le fichier contient le libellé « Foncia » ; le référentiel porte le code « CLI_FONCIA ».
    const resolveMember = (dimensionCode: string, rawValue: string) =>
      dimensionCode === "CLIENT" && memberCodeFrom(rawValue) === "FONCIA" ? "CLI_FONCIA" : memberCodeFrom(rawValue);
    const result = transformRow(csv.rows[0], { mapping, resolveMember });
    expect(result.entry?.dims.CLIENT).toBe("CLI_FONCIA");
  });

  it("rejette une ligne sans date ni montant, avec un motif", () => {
    const mapping = {
      columns: suggestions.map((s) => ({ column: s.column, index: s.index, target: s.target })),
      defaults: {},
      createMissingMembers: true,
    };
    const result = transformRow(["", "606100", "x", "", "", "", ""], { mapping });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Date");
  });

  it("normalise les codes de membres", () => {
    expect(memberCodeFrom("Résidence Alba")).toBe("RESIDENCE_ALBA");
    expect(memberCodeFrom("  OPH-Atlantique ")).toBe("OPH_ATLANTIQUE");
  });
});

describe("contrôle qualité", () => {
  const clean = () =>
    dataset({
      periods: [period("2026-01")],
      dimensions: [
        dimension("NATURE", "Nature"),
        dimension("CENTER", "Centre", { kind: "RESPONSIBILITY" }),
        dimension("PROJECT", "Chantier", { kind: "COST_OBJECT", isCostObject: true }),
      ],
      members: [
        member("NATURE", "MATERIAL"),
        member("CENTER", "ADMIN"),
        member("PROJECT", "A"),
      ],
      entries: [
        revenue("2026-01", 1000, { PROJECT: "A" }, { quantity: 10, unitPrice: 100 }),
        cost("2026-01", 400, { NATURE: "MATERIAL", PROJECT: "A" }),
        cost("2026-01", 100, { NATURE: "MATERIAL", CENTER: "ADMIN" }, { traceability: "INDIRECT" }),
      ],
    });

  it("ne signale rien sur un jeu propre", () => {
    const report = runQualityChecks(clean());
    expect(report.score).toBe(100);
    expect(report.issues).toEqual([]);
    expect(report.confidence).toBe("high");
  });

  it("détecte une charge directe sans objet de coût", () => {
    const data = clean();
    data.entries.push(cost("2026-01", 250, { NATURE: "MATERIAL" }));
    const report = runQualityChecks(data);
    expect(report.issues.some((i) => i.code === "unallocated_direct_cost")).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it("détecte les doublons", () => {
    const data = clean();
    const duplicate = { ...data.entries[1], id: "dup" };
    data.entries.push(duplicate);
    const report = runQualityChecks(data);
    expect(report.issues.find((i) => i.code === "duplicate_entry")?.count).toBe(1);
  });

  it("détecte un membre inconnu", () => {
    const data = clean();
    data.entries.push(cost("2026-01", 100, { NATURE: "MATERIAL", PROJECT: "INCONNU" }));
    const report = runQualityChecks(data);
    expect(report.issues.some((i) => i.code === "unknown_member")).toBe(true);
  });

  it("détecte les périodes sans écriture et les inducteurs attendus manquants", () => {
    const data = clean();
    data.periods.push(period("2026-02"));
    const report = runQualityChecks(data, { requiredDrivers: ["HOURS", "FTE"] });
    expect(report.issues.some((i) => i.code === "missing_period")).toBe(true);
    expect(report.issues.find((i) => i.code === "missing_driver")?.detail).toContain("HOURS");
  });

  it("dégrade l'indice de confiance quand la qualité chute", () => {
    const data = clean();
    for (let i = 0; i < 20; i += 1) data.entries.push(cost("2026-01", 100, { NATURE: "MATERIAL" }));
    const report = runQualityChecks(data);
    expect(report.confidence).not.toBe("high");
  });
});
