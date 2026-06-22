/**
 * fieldViz.ts — Visualización del campo integrando.
 *
 * Fase 1 (implementado):
 *   mode 'scalar' → colorea la malla barrida por el valor de compileScalar.
 *   mode 'geometric' → sin colorización extra.
 *
 * Fase 2 (pendiente, documentado):
 *   mode 'vector' → flechas ArrowHelper muestreadas del campo vectorial
 *   sobre la superficie. Ver sección FASE 2 al final de este archivo.
 */

import * as THREE from 'three';
import type { AppState } from '../core/types.js';
import { compileScalar } from '../core/fields.js';

// ---------------------------------------------------------------------------
// Colores del mapa escalar (frío → cálido)
// ---------------------------------------------------------------------------

const COLOR_COLD = new THREE.Color(0x2255ff); // azul frío
const COLOR_WARM = new THREE.Color(0xff5522); // naranja-rojo cálido

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Resultado de la colorización escalar.
 * Solo contiene el atributo de color para aplicar a una geometría existente.
 */
export interface FieldVizResult {
  /** Atributo de color (Float32Array) para aplicar al BufferGeometry de la malla. */
  colorAttribute: THREE.Float32BufferAttribute | null;
}

/**
 * Calcula los colores vértice-a-vértice para una malla barrida (Vec3[][])
 * según el valor del campo escalar.
 *
 * @param state   AppState con el integrando.
 * @param surface Grilla de puntos cartesianos (Vec3[][]).
 * @returns       FieldVizResult con el atributo de color, o null si mode != 'scalar'.
 */
export function buildFieldColors(
  state: AppState,
  surface: [number, number, number][][],
): FieldVizResult {
  if (state.integrand.mode !== 'scalar' || !state.integrand.scalar) {
    return { colorAttribute: null };
  }

  let scalarFn: (p: [number, number, number]) => number;

  try {
    scalarFn = compileScalar(state.integrand.scalar);
  } catch {
    return { colorAttribute: null };
  }

  // Evalúa en todos los vértices
  const rows = surface.length;
  const cols = surface[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return { colorAttribute: null };

  const values: number[] = [];
  let vmin = Infinity;
  let vmax = -Infinity;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = scalarFn(surface[i][j]);
      values.push(isFinite(v) ? v : 0);
      if (isFinite(v)) {
        if (v < vmin) vmin = v;
        if (v > vmax) vmax = v;
      }
    }
  }

  const range = vmax - vmin;
  const colors = new Float32Array(values.length * 3);
  const tmp = new THREE.Color();

  for (let k = 0; k < values.length; k++) {
    const t = range > 0 ? (values[k] - vmin) / range : 0.5;
    tmp.lerpColors(COLOR_COLD, COLOR_WARM, Math.max(0, Math.min(1, t)));
    colors[k * 3]     = tmp.r;
    colors[k * 3 + 1] = tmp.g;
    colors[k * 3 + 2] = tmp.b;
  }

  return {
    colorAttribute: new THREE.Float32BufferAttribute(colors, 3),
  };
}

/**
 * Aplica la colorización de campo a una malla ya construida.
 * Si no hay colorAttribute, la malla queda con su color original.
 */
export function applyFieldColors(
  mesh: THREE.Mesh,
  result: FieldVizResult,
) {
  if (!result.colorAttribute) return;

  mesh.geometry.setAttribute('color', result.colorAttribute);
  // Activar vertexColors en el material
  const mat = mesh.material;
  if (!Array.isArray(mat) && 'vertexColors' in mat) {
    (mat as THREE.MeshStandardMaterial).vertexColors = true;
    (mat as THREE.MeshStandardMaterial).needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// FASE 2 — Campo vectorial (pendiente)
// ---------------------------------------------------------------------------
//
// Para mode 'vector', crear flechas ArrowHelper muestreadas sobre la superficie:
//
//   import { compileVector } from '../core/fields.js';
//
//   function buildVectorArrows(state: AppState, surface: Vec3[][]): THREE.Group {
//     const F = compileVector(state.integrand.vector!);
//     const group = new THREE.Group();
//     const SAMPLE = 6; // cada cuántos puntos de la grilla
//     for (let i = 0; i < surface.length; i += SAMPLE) {
//       for (let j = 0; j < surface[i].length; j += SAMPLE) {
//         const p  = surface[i][j];
//         const Fp = F(p);
//         const len = Math.hypot(...Fp);
//         if (len < 1e-9) continue;
//         const dir = new THREE.Vector3(...Fp).normalize();
//         const origin = new THREE.Vector3(...p);
//         const arrow = new THREE.ArrowHelper(dir, origin, Math.min(len * 0.2, 0.5), 0xff55aa);
//         group.add(arrow);
//       }
//     }
//     return group;
//   }
//
// Integrar en index.ts update(): if mode==='vector' && surface, buildVectorArrows.
