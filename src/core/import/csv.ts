/**
 * Lecture de fichiers plats (docs/12 P4).
 * Analyseur maison : les exports comptables français mélangent séparateurs `;`, décimales à
 * virgule, espaces insécables comme séparateur de milliers et dates JJ/MM/AAAA.
 */

export type ParsedCsv = {
  delimiter: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
};

const CANDIDATE_DELIMITERS = [";", ",", "\t", "|"];

export function detectDelimiter(sample: string): string {
  const lines = sample.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 10);
  let best = ";";
  let bestScore = -1;
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = lines.map((line) => splitLine(line, delimiter).length);
    if (counts.length === 0) continue;
    const first = counts[0];
    if (first < 2) continue;
    const consistent = counts.every((c) => c === first);
    const score = (consistent ? 100 : 0) + first;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((v) => v.trim());
}

export function parseCsv(content: string, delimiter?: string): ParsedCsv {
  const clean = content.replace(/^﻿/, "");
  const sep = delimiter ?? detectDelimiter(clean);
  const lines = clean.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { delimiter: sep, headers: [], rows: [], totalRows: 0 };

  const headers = splitLine(lines[0], sep).map((h) => h.replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => splitLine(line, sep));
  return { delimiter: sep, headers, rows, totalRows: rows.length };
}

/** « 1 234,56 », « 1.234,56 », « (1 234,56) », « 1234.56 » → 1234.56 */
export function parseNumber(raw: string): number | null {
  if (raw === undefined || raw === null) return null;
  let value = String(raw).trim();
  if (value === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/[\s  ]/g, "").replace(/€|EUR|\$/gi, "");
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  }

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  if (hasComma && hasDot) {
    // Le dernier séparateur rencontré est le séparateur décimal.
    value = value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (hasComma) {
    value = value.replace(",", ".");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/** Accepte JJ/MM/AAAA, JJ-MM-AAAA, AAAA-MM-JJ, AAAA/MM/JJ, JJ.MM.AAAA */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const value = String(raw).trim();

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const fr = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(value);
  if (fr) {
    const year = Number(fr[3]);
    return toIso(year < 100 ? 2000 + year : year, Number(fr[2]), Number(fr[1]));
  }
  return null;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function periodCodeFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Détecte le type dominant d'une colonne à partir d'un échantillon. */
export function detectColumnType(values: string[]): "date" | "number" | "text" | "empty" {
  const filled = values.filter((v) => v !== undefined && String(v).trim() !== "");
  if (filled.length === 0) return "empty";
  const dates = filled.filter((v) => parseDate(v) !== null).length;
  if (dates / filled.length > 0.8) return "date";
  const numbers = filled.filter((v) => parseNumber(v) !== null).length;
  if (numbers / filled.length > 0.8) return "number";
  return "text";
}
