/**
 * parser.ts — Utilidades de parseo y evaluación con mathjs.
 *
 * Política de errores:
 *   - `compileExpr` lanza un `Error` con mensaje claro si la expresión no es
 *     válida en tiempo de compilación (sintaxis incorrecta, función desconocida…).
 *   - `evalBound` devuelve `NaN` si la expresión es una cadena vacía, pero lanza
 *     un `Error` si la expresión es inválida o la evaluación falla. Esto permite
 *     distinguir "límite aún sin rellenar" (NaN tolerable en UI) de "expresión
 *     corrupta" (error que el usuario debe corregir).
 *
 * Decisión de diseño — caché:
 *   Se usa un Map<string, CompiledExpr> como caché simple por texto de expresión.
 *   mathjs no es barato en compilación; reusar la instancia compilada es seguro
 *   porque `evaluate()` / `evaluate(scope)` es puro para expresiones matemáticas.
 */

import { compile, type EvalFunction } from 'mathjs';
import type { Bound } from './types.js';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

/** Función compilada por mathjs lista para evaluar con un scope. */
type CompiledExpr = EvalFunction;

// ---------------------------------------------------------------------------
// Caché de expresiones compiladas
// ---------------------------------------------------------------------------

/** Cache: texto → expresión compilada por mathjs. */
const _cache = new Map<string, CompiledExpr>();

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Parsea y compila una expresión mathjs, reutilizando compilaciones anteriores.
 *
 * @param expr  Expresión matemática en sintaxis mathjs.
 *              Puede referenciar cualquier variable; el scope se pasa en la
 *              función retornada.
 * @returns     Función `(scope) => number` lista para evaluar.
 * @throws      `Error` si la expresión tiene sintaxis inválida.
 *
 * @example
 *   const f = compileExpr('r^2 * sin(theta)');
 *   f({ r: 2, theta: Math.PI / 2 }); // → 4
 */
export function compileExpr(expr: string): (scope: Record<string, number>) => number {
  // Normalizar espacios para maximizar hits de caché.
  const key = expr.trim();

  let compiled = _cache.get(key);
  if (!compiled) {
    // compile() lanza SyntaxError de mathjs si la expresión es inválida.
    try {
      compiled = compile(key);
    } catch (raw) {
      const msg = raw instanceof Error ? raw.message : String(raw);
      throw new Error(`Expresión inválida "${key}": ${msg}`);
    }
    _cache.set(key, compiled);
  }

  return (scope: Record<string, number>) => {
    try {
      // mathjs devuelve number para expresiones escalares; cast seguro.
      return compiled!.evaluate(scope) as number;
    } catch (raw) {
      const msg = raw instanceof Error ? raw.message : String(raw);
      throw new Error(`Error al evaluar "${key}" con scope ${JSON.stringify(scope)}: ${msg}`);
    }
  };
}

/**
 * Evalúa un límite de integración (`Bound`) dado un scope de variables externas.
 *
 * - Si `b` es `number`, se devuelve directamente (sin parseo).
 * - Si `b` es `string` vacío, se devuelve `NaN` (límite sin rellenar).
 * - Si `b` es `string` no vacío, se compila y evalúa con `scope`.
 *
 * @param b      Límite (constante numérica o expresión mathjs).
 * @param scope  Variables externas disponibles para la evaluación.
 * @returns      Valor numérico del límite, o `NaN` si la cadena está vacía.
 * @throws       `Error` si la cadena es inválida o la evaluación falla.
 *
 * @example
 *   evalBound(0, {});                      // → 0
 *   evalBound('sqrt(1 - x^2)', { x: 0 }); // → 1
 *   evalBound('', {});                     // → NaN
 */
export function evalBound(b: Bound, scope: Record<string, number>): number {
  if (typeof b === 'number') {
    return b;
  }

  const trimmed = b.trim();
  if (trimmed === '') {
    return NaN;
  }

  const fn = compileExpr(trimmed);
  return fn(scope);
}

/**
 * Vacía la caché de expresiones compiladas.
 * Útil en tests para asegurar aislamiento entre casos.
 */
export function clearCache(): void {
  _cache.clear();
}
