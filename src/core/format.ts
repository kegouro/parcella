/**
 * format.ts — Formateo de límites de integración a LaTeX limpio.
 *
 * Módulo puro (sin DOM, sin side-effects): importable tanto desde UI como tests.
 * Usa mathjs para parsear expresiones string y producir LaTeX vía .toTex(),
 * luego aplica post-proceso para limpiar artefactos comunes.
 */

import { parse } from 'mathjs';
import type { Bound } from './types.js';

// ---------------------------------------------------------------------------
// numberToLatex
// ---------------------------------------------------------------------------

/**
 * Formatea un número como string LaTeX legible.
 * - Enteros: sin punto decimal.
 * - Decimales: 4 cifras significativas, sin ceros finales.
 * - Cero, infinitos, NaN: casos especiales.
 *
 * @example
 *   numberToLatex(0)       → '0'
 *   numberToLatex(3)       → '3'
 *   numberToLatex(-2)      → '-2'
 *   numberToLatex(1.5)     → '1.5'
 *   numberToLatex(0.3333)  → '0.3333'
 *   numberToLatex(1234567) → '1234567'
 */
export function numberToLatex(n: number): string {
  if (!isFinite(n)) {
    if (isNaN(n)) return '\\text{NaN}';
    return n > 0 ? '\\infty' : '-\\infty';
  }
  // Entero exacto (int64 safe range)
  if (Number.isInteger(n)) {
    return String(n);
  }
  // Decimales: hasta 4 cifras significativas, eliminar ceros finales
  const s = n.toPrecision(4).replace(/\.?0+$/, '');
  return s;
}

// ---------------------------------------------------------------------------
// Post-procesamiento de LaTeX generado por mathjs
// ---------------------------------------------------------------------------

/**
 * Limpia el LaTeX generado por mathjs.toTex() para que sea más legible:
 * - `2\cdot\pi` → `2\pi`
 * - `n\cdot\pi` → `n\pi`  (cualquier coeficiente simple seguido de \pi)
 * - `\cdot` entre coeficiente y función trig → espacio fino
 * - Elimina `~` (espacio duro de mathjs)
 * - Elimina backticks que mathjs añade a identificadores desconocidos
 */
function cleanLatex(tex: string): string {
  let s = tex;

  // Eliminar tildes (~) que mathjs usa como separador de espacio
  s = s.replace(/~/g, '');

  // Eliminar backticks de identificadores (`varName` → varName)
  s = s.replace(/`([^`]+)`/g, '$1');

  // Caso especial: \frac{N\cdot\pi}{D} → \frac{N\pi}{D}
  s = s.replace(/\\frac\{([^{}]+?)\\cdot\\pi\}/g, '\\frac{$1\\pi}');

  // `coefficient \cdot \pi` → `coefficient\pi`
  // Cubre: 2\cdot\pi, n\cdot\pi, {n}\cdot\pi
  s = s.replace(/([0-9a-zA-Z\}])\s*\\cdot\s*\\pi/g, '$1\\pi');

  // Símbolos \cdot entre coeficiente numérico y función/símbolo → espacio fino \,
  // e.g.  2\cdot\sin → 2\,\sin
  s = s.replace(/([0-9])\s*\\cdot\s*(\\[a-zA-Z]+)/g, '$1\\,$2');

  // Eliminar \cdot residual entre letras/números si no es parte de producto vectorial
  // Solo eliminamos cuando va entre un número y una letra (z\cdot\tan → z\,\tan)
  s = s.replace(/([a-zA-Z0-9])\s*\\cdot\s*\\([a-zA-Z]+)/g, '$1\\,$2');

  // Limpiar espacios redundantes
  s = s.trim();

  return s;
}

// ---------------------------------------------------------------------------
// boundToLatex
// ---------------------------------------------------------------------------

/**
 * Convierte un `Bound` (number | string) a LaTeX limpio para mostrar en la UI.
 *
 * - Si es `number`, usa `numberToLatex`.
 * - Si es `string`, parsea con mathjs y aplica `toTex()` + post-proceso.
 *   Si el parseo falla, devuelve el string crudo escapado.
 *
 * Casos objetivo:
 *   'pi'       → '\pi'
 *   '2*pi'     → '2\pi'
 *   'pi/2'     → '\frac{\pi}{2}'
 *   '3*pi/2'   → '\frac{3\pi}{2}'
 *   'sqrt(1-x^2)' → '\sqrt{1-x^{2}}'
 *   'z*tan(a)' → 'z\,\tan\left(a\right)'
 */
export function boundToLatex(b: Bound): string {
  if (typeof b === 'number') {
    return numberToLatex(b);
  }

  const trimmed = b.trim();
  if (trimmed === '') return '';

  try {
    const node = parse(trimmed);
    const raw = node.toTex();
    return cleanLatex(raw);
  } catch {
    // Parseo fallido: devolver string escapado (sin comandos LaTeX peligrosos)
    return trimmed
      .replace(/\\/g, '\\backslash ')
      .replace(/[{}]/g, '\\$&')
      .replace(/_/g, '\\_')
      .replace(/\^/g, '\\^{}');
  }
}
