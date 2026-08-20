import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CAPABILITIES, COST_METHODS } from "@/core/model/enums";
import { allRules, PACKS } from "@/core/templates";
import { kpiCodes } from "@/core/kpi/catalog";

/**
 * Garde-fous d'architecture (docs/16 §N4).
 * Ces tests protègent la promesse du produit : « configuration > code ».
 * Ils échouent dès qu'un raccourci sectoriel est introduit dans le moteur.
 */

const ROOT = process.cwd();

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(full)) files.push(full);
  }
  return files;
}

/** Retire commentaires et chaînes de documentation : on n'analyse que le code exécuté. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const CORE_FILES = walk(join(ROOT, "src", "core"));
const ALL_FILES = walk(join(ROOT, "src"));

/** Dossiers du cœur autorisés à contenir du vocabulaire sectoriel : ce sont des données. */
const VOCABULARY_ALLOWED = [join("core", "templates")];

describe("aucun secteur codé en dur dans le moteur", () => {
  const SECTOR_WORDS = [
    "chantier",
    "consultant",
    "magasin",
    "atelier",
    "usine",
    "btp",
    "fonderie",
    "restaurant",
    "compagnon",
    "mission",
  ];

  it("les mots métier n'apparaissent que dans core/templates", () => {
    const offenders: string[] = [];
    for (const file of CORE_FILES) {
      const relativePath = relative(join(ROOT, "src"), file);
      if (VOCABULARY_ALLOWED.some((allowed) => relativePath.startsWith(allowed + sep))) continue;
      const code = stripComments(readFileSync(file, "utf8")).toLowerCase();
      for (const word of SECTOR_WORDS) {
        // Frontières de mot : « businessModelProfile » ne doit pas déclencher « usine ».
        if (new RegExp(`\\b${word}s?\\b`).test(code)) offenders.push(`${relativePath} → « ${word} »`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("le cœur est pur", () => {
  const FORBIDDEN_IMPORTS = [
    "@prisma/client",
    "next/",
    "next-",
    "node:fs",
    "node:path",
    "fs",
    "@/lib/db",
    "@/services",
    "react",
  ];

  it("core/** n'importe ni base de données, ni framework, ni système de fichiers", () => {
    const offenders: string[] = [];
    for (const file of CORE_FILES) {
      const code = readFileSync(file, "utf8");
      const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const imported of imports) {
        if (imported.startsWith(".")) continue;
        if (imported === "zod") continue;
        if (FORBIDDEN_IMPORTS.some((forbidden) => imported === forbidden || imported.startsWith(forbidden))) {
          offenders.push(`${relative(ROOT, file)} → ${imported}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("core/** n'utilise pas l'horloge système (les dates sont injectées)", () => {
    const offenders: string[] = [];
    for (const file of CORE_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/Date\.now\(\)|new Date\(\s*\)/.test(code)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});

describe("aucune exécution dynamique de code", () => {
  it("ni eval, ni new Function dans src/**", () => {
    const offenders: string[] = [];
    for (const file of ALL_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/\beval\s*\(/.test(code) || /new\s+Function\s*\(/.test(code)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("cohérence des packs de règles", () => {
  it("toutes les capacités activées existent dans le référentiel", () => {
    const declared = new Set<string>(CAPABILITIES);
    const used = allRules()
      .flatMap((rule) => rule.then)
      .filter((effect) => effect.type === "enable_capability")
      .map((effect) => (effect as { value: string }).value);
    expect(used.filter((capability) => !declared.has(capability))).toEqual([]);
  });

  it("tous les KPI suggérés existent dans le catalogue", () => {
    const catalog = new Set(kpiCodes());
    const suggested = allRules()
      .flatMap((rule) => rule.then)
      .filter((effect) => effect.type === "suggest_kpi")
      .map((effect) => (effect as { value: { code: string } }).value.code);
    expect(suggested.filter((code) => !catalog.has(code))).toEqual([]);
  });

  it("toutes les méthodes de coût existent dans le référentiel", () => {
    const declared = new Set<string>(COST_METHODS);
    const used = allRules()
      .flatMap((rule) => rule.then)
      .filter((effect) => effect.type === "set_cost_method")
      .map((effect) => (effect as { value: string }).value);
    expect(used.filter((method) => !declared.has(method))).toEqual([]);
  });

  it("tous les KPI référencés par un bloc de cockpit sont proposés par une règle", () => {
    const suggested = new Set(
      allRules()
        .flatMap((rule) => rule.then)
        .filter((effect) => effect.type === "suggest_kpi")
        .map((effect) => (effect as { value: { code: string } }).value.code),
    );
    const referenced = allRules()
      .flatMap((rule) => rule.then)
      .filter((effect) => effect.type === "add_dashboard_block")
      .flatMap((effect) => {
        const block = (effect as { value: { block: { type: string; code?: string; codes?: string[] } } }).value.block;
        if (block.type === "kpi" && block.code) return [block.code];
        if (block.type === "kpi-row" && block.codes) return block.codes;
        return [];
      });
    expect(referenced.filter((code) => !suggested.has(code))).toEqual([]);
  });

  it("chaque pack est sérialisable en JSON (condition d'un stockage en base)", () => {
    for (const pack of PACKS) {
      expect(() => JSON.parse(JSON.stringify(pack))).not.toThrow();
      expect(JSON.parse(JSON.stringify(pack)).rules.length).toBe(pack.rules.length);
    }
  });
});
