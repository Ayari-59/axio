/**
 * Évaluateur de formules de KPI (docs/09 §2).
 *
 * Analyseur maison : tokenizer → descente récursive → évaluation.
 * Ni `eval`, ni `new Function` : une formule est une donnée saisie par l'utilisateur,
 * elle ne doit jamais devenir du code exécutable.
 *
 * Propagation du null : toute opération impliquant une valeur indisponible ou une division
 * par zéro retourne `null` — jamais NaN ni Infinity.
 */

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

type Token =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

export type Ast =
  | { type: "number"; value: number }
  | { type: "measure"; name: string }
  | { type: "unary"; op: "-"; operand: Ast }
  | { type: "binary"; op: "+" | "-" | "*" | "/"; left: Ast; right: Ast }
  | { type: "call"; name: string; args: Ast[] };

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;

export const FUNCTIONS = ["min", "max", "abs", "round", "avg", "safe", "prev", "ytd", "budget"] as const;
export type FunctionName = (typeof FUNCTIONS)[number];

/** Fonctions dont l'argument est un nom de mesure (et non une expression). */
const MEASURE_FUNCTIONS = new Set<string>(["prev", "ytd", "budget"]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === " " || char === "\t" || char === "\n") {
      i += 1;
      continue;
    }
    if (char >= "0" && char <= "9") {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
      const raw = source.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new FormulaError(`Nombre invalide : « ${raw} »`);
      tokens.push({ type: "number", value });
      i = j;
      continue;
    }
    if (IDENT_START.test(char)) {
      let j = i;
      while (j < source.length && IDENT_PART.test(source[j])) j += 1;
      tokens.push({ type: "ident", value: source.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/".includes(char)) {
      tokens.push({ type: "op", value: char });
      i += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      i += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      i += 1;
      continue;
    }
    throw new FormulaError(`Caractère non autorisé dans une formule : « ${char} »`);
  }
  return tokens;
}

export function parseFormula(source: string): Ast {
  const tokens = tokenize(source);
  let position = 0;

  const peek = (): Token | undefined => tokens[position];
  const next = (): Token | undefined => tokens[position++];

  function parseExpression(): Ast {
    let left = parseTerm();
    for (;;) {
      const token = peek();
      if (token?.type === "op" && (token.value === "+" || token.value === "-")) {
        next();
        const right = parseTerm();
        left = { type: "binary", op: token.value, left, right };
        continue;
      }
      return left;
    }
  }

  function parseTerm(): Ast {
    let left = parseFactor();
    for (;;) {
      const token = peek();
      if (token?.type === "op" && (token.value === "*" || token.value === "/")) {
        next();
        const right = parseFactor();
        left = { type: "binary", op: token.value, left, right };
        continue;
      }
      return left;
    }
  }

  function parseFactor(): Ast {
    const token = next();
    if (!token) throw new FormulaError("Formule incomplète.");

    if (token.type === "op" && token.value === "-") {
      return { type: "unary", op: "-", operand: parseFactor() };
    }
    if (token.type === "op" && token.value === "+") return parseFactor();
    if (token.type === "number") return { type: "number", value: token.value };
    if (token.type === "paren" && token.value === "(") {
      const expression = parseExpression();
      const closing = next();
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        throw new FormulaError("Parenthèse fermante manquante.");
      }
      return expression;
    }
    if (token.type === "ident") {
      const following = peek();
      if (following?.type === "paren" && following.value === "(") {
        next();
        const name = token.value.toLowerCase();
        if (!(FUNCTIONS as readonly string[]).includes(name)) {
          throw new FormulaError(`Fonction inconnue : « ${token.value} »`);
        }
        const args: Ast[] = [];
        if (peek()?.type === "paren" && (peek() as { value: string }).value === ")") {
          next();
          return { type: "call", name, args };
        }
        for (;;) {
          args.push(parseExpression());
          const separator = next();
          if (!separator) throw new FormulaError("Parenthèse fermante manquante.");
          if (separator.type === "comma") continue;
          if (separator.type === "paren" && separator.value === ")") break;
          throw new FormulaError("Séparateur d'arguments invalide.");
        }
        if (MEASURE_FUNCTIONS.has(name)) {
          const first = args[0];
          if (!first || first.type !== "measure") {
            throw new FormulaError(`${name}() attend un nom de mesure en argument.`);
          }
        }
        return { type: "call", name, args };
      }
      return { type: "measure", name: token.value };
    }
    throw new FormulaError("Expression invalide.");
  }

  const ast = parseExpression();
  if (position !== tokens.length) throw new FormulaError("Fin de formule inattendue.");
  return ast;
}

export type FormulaContext = {
  get(measure: string): number | null;
  prev?(measure: string): number | null;
  ytd?(measure: string): number | null;
  budget?(measure: string): number | null;
};

export function evaluateAst(ast: Ast, context: FormulaContext): number | null {
  switch (ast.type) {
    case "number":
      return ast.value;
    case "measure":
      return context.get(ast.name);
    case "unary": {
      const value = evaluateAst(ast.operand, context);
      return value === null ? null : -value;
    }
    case "binary": {
      const left = evaluateAst(ast.left, context);
      const right = evaluateAst(ast.right, context);
      if (left === null || right === null) return null;
      switch (ast.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/": {
          if (right === 0) return null;
          const result = left / right;
          return Number.isFinite(result) ? result : null;
        }
      }
      return null;
    }
    case "call":
      return evaluateCall(ast, context);
  }
}

function evaluateCall(ast: Extract<Ast, { type: "call" }>, context: FormulaContext): number | null {
  const name = ast.name;

  if (MEASURE_FUNCTIONS.has(name)) {
    const measure = ast.args[0];
    if (!measure || measure.type !== "measure") return null;
    if (name === "prev") return context.prev?.(measure.name) ?? null;
    if (name === "ytd") return context.ytd?.(measure.name) ?? null;
    return context.budget?.(measure.name) ?? null;
  }

  const values = ast.args.map((arg) => evaluateAst(arg, context));

  if (name === "safe") {
    const [value, fallback] = values;
    return value === null ? (fallback ?? null) : value;
  }

  if (values.some((v) => v === null)) return null;
  const numbers = values as number[];

  switch (name) {
    case "min":
      return numbers.length ? Math.min(...numbers) : null;
    case "max":
      return numbers.length ? Math.max(...numbers) : null;
    case "abs":
      return numbers.length ? Math.abs(numbers[0]) : null;
    case "avg":
      return numbers.length ? numbers.reduce((s, v) => s + v, 0) / numbers.length : null;
    case "round": {
      const [value, digits] = numbers;
      if (value === undefined) return null;
      const factor = 10 ** (digits ?? 0);
      return Math.round(value * factor) / factor;
    }
    default:
      return null;
  }
}

export function evaluateFormula(source: string, context: FormulaContext): number | null {
  return evaluateAst(parseFormula(source), context);
}

/** Liste les mesures référencées par une formule (validation à l'enregistrement d'un KPI). */
export function collectMeasures(ast: Ast, acc: Set<string> = new Set()): Set<string> {
  switch (ast.type) {
    case "measure":
      acc.add(ast.name);
      break;
    case "unary":
      collectMeasures(ast.operand, acc);
      break;
    case "binary":
      collectMeasures(ast.left, acc);
      collectMeasures(ast.right, acc);
      break;
    case "call":
      for (const arg of ast.args) collectMeasures(arg, acc);
      break;
    default:
      break;
  }
  return acc;
}

export function validateFormula(
  source: string,
  isKnownMeasure: (name: string) => boolean,
): { ok: boolean; errors: string[]; measures: string[] } {
  try {
    const ast = parseFormula(source);
    const measures = [...collectMeasures(ast)];
    const unknown = measures.filter((m) => !isKnownMeasure(m));
    return {
      ok: unknown.length === 0,
      errors: unknown.map((m) => `Mesure inconnue : « ${m} »`),
      measures,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "Formule invalide"],
      measures: [],
    };
  }
}
