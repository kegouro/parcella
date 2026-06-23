/**
 * fieldViz.ts — Visualización del campo integrando.
 *
 * Fase 1 (implementado):
 *   mode 'scalar' → colorea la malla barrida por el valor de compileScalar.
 *   mode 'geometric' → sin colorización extra.
 *
 * Fase 2 (implementado):
 *   mode 'vector' → flechas ArrowHelper muestreadas del campo vectorial
 *   sobre la superficie o curva barrida.
 */

import * as THREE from 'three';
import type { AppState, Vec3 } from '../core/types.js';
import { compileScalar, compileVector } from '../core/fields.js';

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
// FASE 2 — Campo vectorial (implementado)
// ---------------------------------------------------------------------------

/**
 * Color índigo/lavanda para las flechas del campo vectorial.
 * Coherente con el acento #7c5cff de la escena.
 */
const ARROW_COLOR = 0x9b7fff;

/**
 * Longitud máxima de flecha en unidades de escena.
 * Evita flechas gigantes cuando |F| es muy grande.
 */
const ARROW_MAX_LEN = 0.6;

/**
 * Factor de escala base: longitud = min(|F| * ARROW_SCALE, ARROW_MAX_LEN).
 */
const ARROW_SCALE = 0.25;

/**
 * Paso de muestreo sobre la grilla (cada cuántas filas/columnas se dibuja una flecha).
 * Con res=32 y STEP=4 → ~64 flechas por superficie; con res=8 → ~4 flechas por curva.
 */
const ARROW_STEP = 4;

/**
 * Dispone (libera) todas las flechas de un grupo de ArrowHelpers previamente
 * añadido a la escena y lo elimina de la escena.
 *
 * @param group  Grupo a disponer. Puede ser null (no-op).
 * @param scene  Escena de la que eliminar el grupo.
 */
export function disposeVectorArrows(
  group: THREE.Group | null,
  scene: THREE.Scene,
): void {
  if (!group) return;
  group.traverse((obj) => {
    if (obj instanceof THREE.ArrowHelper) {
      // ArrowHelper internamente usa Line y Mesh; liberamos sus geometrías/materiales.
      (obj.line as THREE.Line).geometry.dispose();
      ((obj.line as THREE.Line).material as THREE.Material).dispose();
      (obj.cone as THREE.Mesh).geometry.dispose();
      ((obj.cone as THREE.Mesh).material as THREE.Material).dispose();
    }
  });
  scene.remove(group);
}

/**
 * Construye un THREE.Group con flechas ArrowHelper muestreadas sobre
 * los puntos del conjunto barrido (curva o superficie).
 *
 * Para cada punto de muestra evalúa F(p) y dibuja una flecha:
 *   - dirección: F(p) / |F(p)|
 *   - longitud:  min(|F(p)| * ARROW_SCALE, ARROW_MAX_LEN)
 *   - color:     índigo/lavanda (#9b7fff)
 *
 * Omite puntos donde F es cero o contiene NaN/Infinity.
 * Usa try/catch por punto para no romper el loop ante errores de evaluación.
 *
 * @param state    AppState con integrand.mode === 'vector'.
 * @param samples  Puntos del barrido: puede ser una grilla (Vec3[][]) para
 *                 superficies o un array plano (Vec3[]) para curvas.
 * @returns        THREE.Group listo para añadir a la escena, o null si no
 *                 hay componentes vectoriales o el modo no es 'vector'.
 */
export function buildVectorArrows(
  state: AppState,
  samples: Vec3[][] | Vec3[],
): THREE.Group | null {
  if (state.integrand.mode !== 'vector') return null;

  const components = state.integrand.vector ?? ['0', '0', '0'];

  let F: (p: Vec3) => Vec3;
  try {
    F = compileVector(components);
  } catch {
    return null;
  }

  const group = new THREE.Group();

  // Normaliza la entrada a Vec3[] plano con paso ARROW_STEP
  const flatPoints: Vec3[] = [];

  if (samples.length === 0) return group;

  // Detecta si es Vec3[][] (array de arrays) comprobando el primer elemento
  const first = samples[0];
  if (Array.isArray(first) && Array.isArray((first as unknown[])[0])) {
    // Vec3[][] → superficie
    const grid = samples as Vec3[][];
    for (let i = 0; i < grid.length; i += ARROW_STEP) {
      const row = grid[i];
      for (let j = 0; j < row.length; j += ARROW_STEP) {
        flatPoints.push(row[j]);
      }
    }
  } else {
    // Vec3[] → curva (o punto, ignorado)
    const curve = samples as Vec3[];
    for (let i = 0; i < curve.length; i += ARROW_STEP) {
      flatPoints.push(curve[i]);
    }
  }

  for (const p of flatPoints) {
    try {
      const Fp = F(p);
      const [fx, fy, fz] = Fp;

      // Omitir si cualquier componente es NaN o no finito
      if (!isFinite(fx) || !isFinite(fy) || !isFinite(fz)) continue;

      const magnitude = Math.sqrt(fx * fx + fy * fy + fz * fz);
      if (magnitude < 1e-9) continue;

      const dir = new THREE.Vector3(fx / magnitude, fy / magnitude, fz / magnitude);
      const origin = new THREE.Vector3(p[0], p[1], p[2]);
      const arrowLen = Math.min(magnitude * ARROW_SCALE, ARROW_MAX_LEN);

      // headLength y headWidth proporcionales a la longitud de la flecha
      const headLen = arrowLen * 0.3;
      const headWidth = headLen * 0.6;

      const arrow = new THREE.ArrowHelper(dir, origin, arrowLen, ARROW_COLOR, headLen, headWidth);
      group.add(arrow);
    } catch {
      // Omitir puntos problemáticos sin romper el loop
      continue;
    }
  }

  return group;
}
