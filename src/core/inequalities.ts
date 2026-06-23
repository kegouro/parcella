/**
 * inequalities.ts — Deducción automática de Region a partir de desigualdades.
 *
 * Dado un array de strings que el usuario escribe (e.g. "x^2+y^2+z^2 <= R^2",
 * "z >= 0"), intenta reconocer uno de los casos canónicos y construir una
 * Region lista para usar.  Si no se reconoce, devuelve ok:false con reason.
 *
 * Casos soportados:
 *   1. Bola sólida         x²+y²+z² ≤ R²
 *   2. Semiesfera superior bola + z≥0
 *   3. Semiesfera inferior  bola + z≤0
 *   4. Cilindro            x²+y²≤R² + cota en z
 *   5. Disco 2D            x²+y²≤R² (sin z o z=0)
 *   6. Caja rectangular    a≤x≤b, c≤y≤d, e≤z≤f
 *   7. Paraboloide         z≥x²+y² + z≤h
 */

import { evaluate } from 'mathjs';
import type { Region, SystemId } from './types.js';

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface DeduceResult {
  ok: boolean;
  region?: Region;
  system?: SystemId;
  reason?: string;
  note?: string;
}

/**
 * Deduce los límites de integración (una Region) a partir de desigualdades
 * escritas en texto.
 *
 * @param inequalities  Array de cadenas, cada una con una desigualdad o acotación.
 *                      Se normalizan espacios; se aceptan <=, >=, <, >, =.
 * @returns             DeduceResult con ok:true y la Region, o ok:false con reason.
 */
export function deduceRegion(inequalities: string[]): DeduceResult {
  const normalized = inequalities.map(normalizeStr).filter((s) => s.length > 0);

  // Intenta cada reconocedor en orden
  const result =
    tryHemisphere(normalized) ??    // antes que bola (es un caso más específico)
    tryBall(normalized) ??
    tryCylinder(normalized) ??
    tryDisk2D(normalized) ??
    tryBox(normalized) ??
    tryParaboloid(normalized) ??
    null;

  if (result) return result;

  return {
    ok: false,
    reason:
      'No se reconoció ningún caso canónico. Usa el modo Manual para definir los límites.',
  };
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/** Elimina espacios extra y pasa a minúsculas para comparación uniforme. */
function normalizeStr(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Evalúa una expresión con mathjs.  Devuelve NaN si falla.
 * Soporta constantes numéricas y expresiones simples como "sqrt(2)", "pi/2", etc.
 */
function tryEval(expr: string): number {
  try {
    const val = evaluate(expr);
    if (typeof val === 'number' && isFinite(val)) return val;
    return NaN;
  } catch {
    return NaN;
  }
}

// ---------------------------------------------------------------------------
// Patrones de expresión regular compartidos
// ---------------------------------------------------------------------------

// Captura expresiones como: x^2+y^2+z^2, x^2 + y^2 + z^2, etc.
const RE_SPHERE_LHS = /x\^2\s*\+\s*y\^2\s*\+\s*z\^2/;
const RE_CIRCLE_LHS = /x\^2\s*\+\s*y\^2/;

/** Extrae el lado derecho de "lhs <= rhs" o "lhs < rhs". */
function extractRHS(str: string, lhs: RegExp): string | null {
  const m = str.match(new RegExp(lhs.source + /\s*(?:<=|<)\s*(.+)$/.source));
  return m ? m[1].trim() : null;
}

/**
 * Intenta parsear R² de una expresión del estilo "R^2" o "R²" (número).
 * Acepta expresiones mathjs simples.
 * Devuelve R > 0, o NaN si no puede.
 */
function parseRadiusSquared(rhsExpr: string): number {
  // Caso "número^2" → R = sqrt(número)
  const m2 = rhsExpr.match(/^([0-9]*\.?[0-9]+)\^2$/);
  if (m2) return parseFloat(m2[1]);

  // Caso número directo (R² ya dado como número, e.g. "4" → R=2)
  const val = tryEval(rhsExpr);
  if (!isNaN(val) && val > 0) return Math.sqrt(val);

  return NaN;
}

/**
 * Intenta parsear un número o expresión mathjs simple.
 * Devuelve el valor o NaN.
 */
function parseNum(expr: string): number {
  return tryEval(expr);
}

// ---------------------------------------------------------------------------
// Reconocedor 1: Bola sólida  x²+y²+z² ≤ R²
// ---------------------------------------------------------------------------
function tryBall(normalized: string[]): DeduceResult | null {
  // Busca exactamente x^2+y^2+z^2 <= RHS
  let R = NaN;
  for (const s of normalized) {
    const rhs = extractRHS(s, RE_SPHERE_LHS);
    if (rhs !== null) {
      R = parseRadiusSquared(rhs);
      break;
    }
  }
  if (isNaN(R) || R <= 0) return null;

  // No debe haber restricción en z (eso lo maneja tryHemisphere)
  const hasZConstraint = normalized.some((s) => /\bz\b/.test(s) && !RE_SPHERE_LHS.test(s));
  if (hasZConstraint) return null;

  return {
    ok: true,
    system: 'spherical',
    note: `Bola → esféricas (R=${R})`,
    region: {
      system: 'spherical',
      order: [0, 1, 2],
      bounds: [
        { lower: 0, upper: R },
        { lower: 0, upper: 'pi' },       // θ polar ∈ [0,π]
        { lower: 0, upper: '2 * pi' },   // φ azimutal ∈ [0,2π)
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Reconocedor 2: Semiesfera  (bola + z≥0 o z≤0)
// ---------------------------------------------------------------------------
function tryHemisphere(normalized: string[]): DeduceResult | null {
  let R = NaN;
  for (const s of normalized) {
    const rhs = extractRHS(s, RE_SPHERE_LHS);
    if (rhs !== null) {
      R = parseRadiusSquared(rhs);
      break;
    }
  }
  if (isNaN(R) || R <= 0) return null;

  // Busca z >= 0 o 0 <= z (semiesfera superior)
  const upperHemi = normalized.some(
    (s) =>
      /^\s*z\s*(?:>=|>)\s*0\s*$/.test(s) ||
      /^\s*0\s*(?:<=|<)\s*z\s*$/.test(s),
  );
  // Busca z <= 0 o 0 >= z (semiesfera inferior)
  const lowerHemi = normalized.some(
    (s) =>
      /^\s*z\s*(?:<=|<)\s*0\s*$/.test(s) ||
      /^\s*0\s*(?:>=|>)\s*z\s*$/.test(s),
  );

  if (!upperHemi && !lowerHemi) return null;

  // θ es el ángulo polar (desde +z): superior z≥0 → θ∈[0,π/2]; inferior z≤0 → θ∈[π/2,π]
  const thetaLower = lowerHemi ? 'pi / 2' : 0;
  const thetaUpper = lowerHemi ? 'pi' : 'pi / 2';
  const label = lowerHemi ? 'inferior' : 'superior';

  return {
    ok: true,
    system: 'spherical',
    note: `Semiesfera ${label} → esféricas (R=${R})`,
    region: {
      system: 'spherical',
      order: [0, 1, 2],
      bounds: [
        { lower: 0, upper: R },
        { lower: thetaLower, upper: thetaUpper },  // θ polar
        { lower: 0, upper: '2 * pi' },             // φ azimutal
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Reconocedor 3: Cilindro  x²+y² ≤ R² con cota en z
// ---------------------------------------------------------------------------
function tryCylinder(normalized: string[]): DeduceResult | null {
  // x²+y² <= R²  (no debe tener z en la misma inecuación)
  let R = NaN;
  for (const s of normalized) {
    // Asegurarse de que NO sea una ecuación esférica
    if (RE_SPHERE_LHS.test(s)) continue;
    const rhs = extractRHS(s, RE_CIRCLE_LHS);
    if (rhs !== null) {
      R = parseRadiusSquared(rhs);
      break;
    }
  }
  if (isNaN(R) || R <= 0) return null;

  // Busca cota en z: "a <= z <= b" o "a <= z" + "z <= b" separadas
  const { zLower, zUpper } = extractZBounds(normalized);
  if (isNaN(zLower) || isNaN(zUpper)) return null;

  return {
    ok: true,
    system: 'cylindrical',
    note: `Cilindro → cilíndricas (R=${R}, z∈[${zLower},${zUpper}])`,
    region: {
      system: 'cylindrical',
      order: [0, 1, 2],
      bounds: [
        { lower: 0, upper: R },
        { lower: 0, upper: '2 * pi' },
        { lower: zLower, upper: zUpper },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Reconocedor 4: Disco 2D  x²+y² ≤ R² (sin cota z, o z=0)
// ---------------------------------------------------------------------------
function tryDisk2D(normalized: string[]): DeduceResult | null {
  let R = NaN;
  for (const s of normalized) {
    if (RE_SPHERE_LHS.test(s)) continue;
    const rhs = extractRHS(s, RE_CIRCLE_LHS);
    if (rhs !== null) {
      R = parseRadiusSquared(rhs);
      break;
    }
  }
  if (isNaN(R) || R <= 0) return null;

  // No debe haber restricciones de z que impliquen un rango no nulo
  const hasZRange = normalized.some(
    (s) =>
      !RE_CIRCLE_LHS.test(s) &&
      /\bz\b/.test(s) &&
      !/^\s*z\s*(?:=|==)\s*0\s*$/.test(s) &&
      !/^\s*0\s*(?:=|==)\s*z\s*$/.test(s),
  );
  if (hasZRange) return null;

  return {
    ok: true,
    system: 'polar',
    note: `Disco 2D → polares (R=${R})`,
    region: {
      system: 'polar',
      order: [0, 1, 2],
      bounds: [
        { lower: 0, upper: R },
        { lower: 0, upper: '2 * pi' },
        { lower: 0, upper: 0 },  // z congelada en 0
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Reconocedor 5: Caja  a<=x<=b, c<=y<=d, e<=z<=f
// ---------------------------------------------------------------------------
function tryBox(normalized: string[]): DeduceResult | null {
  const xB = extractVarBounds('x', normalized);
  const yB = extractVarBounds('y', normalized);
  const zB = extractVarBounds('z', normalized);

  if (
    isNaN(xB.lower) || isNaN(xB.upper) ||
    isNaN(yB.lower) || isNaN(yB.upper) ||
    isNaN(zB.lower) || isNaN(zB.upper)
  ) return null;

  return {
    ok: true,
    system: 'cartesian',
    note: `Caja → cartesianas (x∈[${xB.lower},${xB.upper}], y∈[${yB.lower},${yB.upper}], z∈[${zB.lower},${zB.upper}])`,
    region: {
      system: 'cartesian',
      order: [0, 1, 2],
      bounds: [
        { lower: xB.lower, upper: xB.upper },
        { lower: yB.lower, upper: yB.upper },
        { lower: zB.lower, upper: zB.upper },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Reconocedor 6: Paraboloide  z >= x²+y², z <= h
// ---------------------------------------------------------------------------
function tryParaboloid(normalized: string[]): DeduceResult | null {
  // Busca "z >= x^2+y^2" o "x^2+y^2 <= z"
  const hasParaboloidBase = normalized.some(
    (s) =>
      /^\s*z\s*(?:>=|>)\s*x\^2\s*\+\s*y\^2\s*$/.test(s) ||
      /^\s*x\^2\s*\+\s*y\^2\s*(?:<=|<)\s*z\s*$/.test(s),
  );
  if (!hasParaboloidBase) return null;

  // Busca cota superior en z: "z <= h" o "h >= z"
  let h = NaN;
  for (const s of normalized) {
    const m = s.match(/^\s*z\s*(?:<=|<)\s*(.+)$/) ??
               s.match(/^\s*(.+)\s*(?:>=|>)\s*z\s*$/);
    if (m) {
      const val = parseNum(m[1].trim());
      if (!isNaN(val)) { h = val; break; }
    }
  }
  if (isNaN(h)) return null;

  const R = Math.sqrt(h); // ρ_max = sqrt(h) cuando z = ρ²

  return {
    ok: true,
    system: 'cylindrical',
    note: `Paraboloide z≥ρ² con z≤${h} → cilíndricas (ρ∈[0,√${h}], z∈[ρ²,${h}])`,
    region: {
      system: 'cylindrical',
      // Orden: ρ (0) más independiente → φ (1) → z (2) depende de ρ
      order: [0, 1, 2],
      bounds: [
        { lower: 0, upper: R },
        { lower: 0, upper: '2 * pi' },
        { lower: 'rho^2', upper: h },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Extrae cotas de z buscando patrones "a <= z <= b", "a <= z", "z <= b". */
function extractZBounds(normalized: string[]): { zLower: number; zUpper: number } {
  let zLower = NaN;
  let zUpper = NaN;

  for (const s of normalized) {
    // Patrón compuesto: "a <= z <= b"
    const compound = s.match(/^\s*(.+?)\s*(?:<=|<)\s*z\s*(?:<=|<)\s*(.+?)\s*$/);
    if (compound) {
      zLower = parseNum(compound[1]);
      zUpper = parseNum(compound[2]);
      break;
    }
    // "a <= z" o "a < z"
    const lower = s.match(/^\s*(.+?)\s*(?:<=|<)\s*z\s*$/);
    if (lower) zLower = parseNum(lower[1]);

    // "z <= b" o "z < b"
    const upper = s.match(/^\s*z\s*(?:<=|<)\s*(.+?)\s*$/);
    if (upper) zUpper = parseNum(upper[1]);

    // "z >= a" o "z > a"
    const geq = s.match(/^\s*z\s*(?:>=|>)\s*(.+?)\s*$/);
    if (geq) zLower = parseNum(geq[1]);

    // "b >= z" o "b > z"
    const geqR = s.match(/^\s*(.+?)\s*(?:>=|>)\s*z\s*$/);
    if (geqR) zUpper = parseNum(geqR[1]);
  }

  return { zLower, zUpper };
}

/**
 * Extrae cotas de una variable (x, y o z) de las desigualdades.
 * Busca patrones del tipo "a <= var <= b", "a <= var", "var <= b", etc.
 */
function extractVarBounds(v: string, normalized: string[]): { lower: number; upper: number } {
  let lower = NaN;
  let upper = NaN;

  for (const s of normalized) {
    // "a <= v <= b"
    const re = new RegExp(
      `^\\s*(.+?)\\s*(?:<=|<)\\s*${v}\\s*(?:<=|<)\\s*(.+?)\\s*$`,
    );
    const compound = s.match(re);
    if (compound) {
      lower = parseNum(compound[1]);
      upper = parseNum(compound[2]);
      break;
    }
    // "a <= v"
    const lowerM = s.match(new RegExp(`^\\s*(.+?)\\s*(?:<=|<)\\s*${v}\\s*$`));
    if (lowerM) lower = parseNum(lowerM[1]);

    // "v <= b"
    const upperM = s.match(new RegExp(`^\\s*${v}\\s*(?:<=|<)\\s*(.+?)\\s*$`));
    if (upperM) upper = parseNum(upperM[1]);

    // "v >= a"
    const geqL = s.match(new RegExp(`^\\s*${v}\\s*(?:>=|>)\\s*(.+?)\\s*$`));
    if (geqL) lower = parseNum(geqL[1]);

    // "b >= v"
    const geqR = s.match(new RegExp(`^\\s*(.+?)\\s*(?:>=|>)\\s*${v}\\s*$`));
    if (geqR) upper = parseNum(geqR[1]);
  }

  return { lower, upper };
}
