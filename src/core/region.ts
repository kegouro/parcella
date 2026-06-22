/**
 * region.ts — Manejo de la región de integración: evaluación de límites y muestreo.
 *
 * Convenciones de coordenadas (compartidas por todos los módulos):
 *   Cilíndricas: vars [ρ, φ, z] (índices 0,1,2). x=ρcosφ, y=ρsinφ, z=z.
 *   Esféricas:   vars [r, θ, φ] (índices 0,1,2).
 *                θ azimutal ∈ [0,2π), φ polar ∈ [0,π] desde +z.
 *                dV = r² sinφ dr dθ dφ.
 *
 * `Region.order`: de MÁS INDEPENDIENTE (order[0]) a MÁS DEPENDIENTE (order[2]).
 * `Region.bounds[k]`: límites de la variable order[k]; pueden depender de
 *   las variables order[0..k-1] ya fijadas.
 */

import { evalBound } from './parser.js';
import type { Region, Vec3 } from './types.js';

// ---------------------------------------------------------------------------
// Tipo re-exportado para uso externo (evita importar CoordSystem completo)
// ---------------------------------------------------------------------------

/** Interfaz mínima de CoordSystem que region.ts necesita en tiempo de ejecución. */
export interface CoordSystemLike {
  /** Las tres variables en orden canónico (u, v, w). */
  vars: [{ name: string }, { name: string }, { name: string }];
  /** Transforma (u,v,w) → (x,y,z) en cartesianas. */
  toCartesian(u: number, v: number, w: number): Vec3;
}

// ---------------------------------------------------------------------------
// evalLimits
// ---------------------------------------------------------------------------

/**
 * Evalúa los límites (lower, upper) de la variable en `region.order[level]`.
 *
 * @param region  Región de integración.
 * @param system  Sistema de coordenadas (solo se usa `vars` para nombres).
 * @param level   Índice en `region.order` cuya variable se evalúa (0, 1 o 2).
 * @param outer   Mapa nombre→valor de las variables order[0..level-1] ya fijadas.
 * @returns       { lower, upper } como números evaluados.
 * @throws        Error si algún límite es una expresión inválida.
 */
export function evalLimits(
  region: Region,
  _system: CoordSystemLike,
  level: number,
  outer: Record<string, number>,
): { lower: number; upper: number } {
  if (level < 0 || level > 2) {
    throw new Error(`level debe ser 0, 1 o 2; recibido: ${level}`);
  }

  const varBounds = region.bounds[level];

  // El scope incluye todas las variables externas (más independientes).
  // Añadimos también los nombres canónicos del sistema por si las expresiones
  // los usan directamente.
  const scope: Record<string, number> = { ...outer };

  const lower = evalBound(varBounds.lower, scope);
  const upper = evalBound(varBounds.upper, scope);

  return { lower, upper };
}

// ---------------------------------------------------------------------------
// sampleRegion
// ---------------------------------------------------------------------------

/**
 * Muestrea un punto de la región dado t ∈ [0,1]³ (uno por nivel de `order`).
 *
 * Algoritmo:
 *   Para cada nivel k = 0, 1, 2 (en orden de `region.order`):
 *     1. Evalúa límites con las variables externas ya calculadas.
 *     2. Interpola: valor_k = lower_k + (upper_k − lower_k) * t[k].
 *     3. Registra el valor bajo el nombre canónico de esa variable.
 *   Finalmente arma el vector canónico [u, v, w] y llama a system.toCartesian.
 *
 * @param region  Región de integración.
 * @param system  Sistema de coordenadas.
 * @param t       Triplete [t0, t1, t2] ∈ [0,1]³, uno por nivel de order.
 * @returns       { coords: [u,v,w] en orden canónico, cartesian: [x,y,z] }.
 */
export function sampleRegion(
  region: Region,
  system: CoordSystemLike,
  t: [number, number, number],
): { coords: [number, number, number]; cartesian: Vec3 } {
  // Arreglo de coordenadas en orden canónico del sistema (índices 0,1,2).
  const coords: [number, number, number] = [0, 0, 0];

  // Scope acumulativo de variables resueltas (nombre → valor).
  const outer: Record<string, number> = {};

  for (let level = 0; level < 3; level++) {
    const varIdx = region.order[level]; // índice canónico de la variable
    const varName = system.vars[varIdx].name;

    const { lower, upper } = evalLimits(region, system, level, outer);
    const value = lower + (upper - lower) * t[level];

    coords[varIdx] = value;
    outer[varName] = value;
  }

  const cartesian = system.toCartesian(coords[0], coords[1], coords[2]);

  return { coords, cartesian };
}
