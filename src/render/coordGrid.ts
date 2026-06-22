/**
 * coordGrid.ts — Iso-líneas tenues del sistema de coordenadas activo.
 *
 * Dibuja "papel cuadriculado" del sistema dentro de la región:
 *   Cartesianas  → planos x=cte, y=cte, z=cte
 *   Cilíndricas  → cilindros ρ=cte, semiplanos φ=cte, planos z=cte
 *   Esféricas    → cascarones r=cte, conos φ=cte, semiplanos θ=cte
 *
 * Sutil: líneas finas y opacidad baja para no tapar la figura principal.
 */

import * as THREE from 'three';
import type { AppState } from '../core/types.js';
import { getSystem } from '../core/coords.js';
import { sampleRegion } from '../core/region.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const GRID_LINE_COLOR = 0x3a4060;
const GRID_OPACITY    = 0.45;
const ISO_STEPS       = 6;   // número de iso-líneas por variable
const CURVE_RES       = 40;  // puntos por iso-línea

// ---------------------------------------------------------------------------
// buildCoordGrid
// ---------------------------------------------------------------------------

/**
 * Construye los objetos Three.js de las iso-líneas del sistema.
 * Devuelve un Group que se puede agregar/remover de la escena.
 */
export function buildCoordGrid(state: AppState): THREE.Group {
  const group = new THREE.Group();
  const system = getSystem(state.region.system);
  const { region } = state;

  const mat = new THREE.LineBasicMaterial({
    color: GRID_LINE_COLOR,
    transparent: true,
    opacity: GRID_OPACITY,
  });

  // Para cada par de variables que barren, fijamos la tercera en ISO_STEPS valores
  // y trazamos la curva paramétrica resultante.
  try {
    // 3 pares: (0,1) fijo 2, (0,2) fijo 1, (1,2) fijo 0
    const pairs: [number, number, number][] = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 2, 0],
    ];

    for (const [a, b, fixed] of pairs) {
      for (let step = 0; step <= ISO_STEPS; step++) {
        const tFixed = step / ISO_STEPS;

        // Barrer la primera variable del par (b fijo en su mitad)
        const lineA = _traceLine(region, system, a, b, fixed, tFixed, 0.5, CURVE_RES);
        if (lineA) group.add(_makeLine(lineA, mat));

        // Barrer la segunda variable del par (a fijo en su mitad)
        const lineB = _traceLine(region, system, b, a, fixed, tFixed, 0.5, CURVE_RES);
        if (lineB) group.add(_makeLine(lineB, mat));
      }
    }
  } catch {
    // Si la región tiene límites inválidos, no dibujamos la grilla
  }

  return group;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CoordSystemLike = Parameters<typeof sampleRegion>[1];

/**
 * Traza una curva variando la variable `varIdx` de t=0 a t=1,
 * con `fixedIdx` en `tFixed` y `otherIdx` en `tOther`.
 */
function _traceLine(
  region: AppState['region'],
  system: CoordSystemLike,
  varIdx: number,
  _otherIdx: number,
  fixedIdx: number,
  tFixed: number,
  tOther: number,
  res: number,
): THREE.Vector3[] | null {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < res; i++) {
    const tVar = i / (res - 1);

    // Construir el trío de t por nivel (region.order)
    const t: [number, number, number] = [0, 0, 0];
    for (let level = 0; level < 3; level++) {
      const c = region.order[level];
      if (c === varIdx) t[level] = tVar;
      else if (c === fixedIdx) t[level] = tFixed;
      else t[level] = tOther; // otherIdx
    }

    const { cartesian } = sampleRegion(region, system, t);
    const [x, y, z] = cartesian;

    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null;
    points.push(new THREE.Vector3(x, y, z));
  }

  return points;
}

function _makeLine(points: THREE.Vector3[], mat: THREE.LineBasicMaterial): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, mat);
}

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

export function disposeCoordGrid(group: THREE.Group) {
  group.traverse((obj) => {
    if (obj instanceof THREE.Line) {
      obj.geometry.dispose();
      // Material es compartido; no lo disponemos aquí para no romper otras líneas.
    }
  });
  group.clear();
}
