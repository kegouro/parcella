/**
 * fields.ts — Campos escalares y vectoriales para Parcella.
 *
 * Este módulo opera exclusivamente sobre coordenadas cartesianas (x, y, z).
 * El mapeo desde sistemas curvos (esféricas, cilíndricas…) ocurre en la capa
 * de integración: esa capa convierte al punto cartesiano antes de llamar aquí.
 *
 * Modo 'vector' (flujo/circulación, EM) se completa en Fase 2.
 * Las funciones flux() y circulation() ya están implementadas y testeadas
 * para que la Fase 2 solo necesite conectar el integrador.
 */

import { compileExpr } from './parser.js';
import type { Vec3 } from './types.js';

// ---------------------------------------------------------------------------
// Helpers Vec3 puros
// ---------------------------------------------------------------------------

/** Producto punto a·b. */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Norma euclidiana de v. */
export function norm(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

/** Escala v por un escalar s. */
export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

/** Suma de dos vectores. */
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Resta de dos vectores (a - b). */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Producto vectorial a × b. */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// ---------------------------------------------------------------------------
// Compiladores de campos
// ---------------------------------------------------------------------------

/**
 * Compila una expresión escalar f(x,y,z) en mathjs.
 *
 * - Si `expr` es vacío (o solo espacios), devuelve una función que siempre
 *   retorna NaN (límite "sin rellenar"; no lanza).
 * - De lo contrario compila con `compileExpr` y evalúa en el scope {x,y,z}
 *   derivado del punto cartesiano recibido.
 *
 * @param expr  Expresión mathjs en variables x, y, z.
 * @returns     Función `(p: Vec3) => number`.
 * @throws      `Error` si la expresión es no-vacía pero sintácticamente inválida.
 */
export function compileScalar(expr: string): (p: Vec3) => number {
  const trimmed = expr.trim();

  if (trimmed === '') {
    return (_p: Vec3) => NaN;
  }

  const fn = compileExpr(trimmed);

  return (p: Vec3): number => {
    const [x, y, z] = p;
    return fn({ x, y, z });
  };
}

/**
 * Compila un campo vectorial F = (Fx, Fy, Fz) donde cada componente es
 * una expresión mathjs en x, y, z.
 *
 * Componentes vacíos se evalúan como NaN (comportamiento análogo a compileScalar).
 *
 * @param comp  Trío [exprFx, exprFy, exprFz].
 * @returns     Función `(p: Vec3) => Vec3`.
 * @throws      `Error` si alguna expresión no-vacía es sintácticamente inválida.
 */
export function compileVector(
  comp: [string, string, string],
): (p: Vec3) => Vec3 {
  const [sfx, sfy, sfz] = comp.map((e) => compileScalar(e));

  return (p: Vec3): Vec3 => [sfx(p), sfy(p), sfz(p)];
}

// ---------------------------------------------------------------------------
// Integrales de superficie y de línea (Fase 2)
// ---------------------------------------------------------------------------

/**
 * Calcula F(p) · n̂ (flujo diferencial).
 *
 * Normaliza `normal` antes de hacer el producto punto, por lo que el vector
 * normal puede pasarse sin unitarizar (p. ej. directamente desde la geometría).
 *
 * Usar para ensamblar ∫∫ F · dS integrando flux(F, p, n) * dA.
 *
 * @param F       Campo vectorial compilado.
 * @param p       Punto cartesiano de evaluación.
 * @param normal  Vector normal (no necesita ser unitario).
 * @returns       F(p) · n̂.
 */
export function flux(
  F: (p: Vec3) => Vec3,
  p: Vec3,
  normal: Vec3,
): number {
  const n = norm(normal);
  const nHat: Vec3 = n === 0 ? [0, 0, 0] : scale(normal, 1 / n);
  return dot(F(p), nHat);
}

/**
 * Calcula F(p) · t̂ (circulación diferencial).
 *
 * Normaliza `tangent` antes del producto punto.
 *
 * Usar para ensamblar ∮ F · dl integrando circulation(F, p, t) * ds.
 *
 * @param F        Campo vectorial compilado.
 * @param p        Punto cartesiano de evaluación.
 * @param tangent  Vector tangente a la curva (no necesita ser unitario).
 * @returns        F(p) · t̂.
 */
export function circulation(
  F: (p: Vec3) => Vec3,
  p: Vec3,
  tangent: Vec3,
): number {
  const t = norm(tangent);
  const tHat: Vec3 = t === 0 ? [0, 0, 0] : scale(tangent, 1 / t);
  return dot(F(p), tHat);
}
