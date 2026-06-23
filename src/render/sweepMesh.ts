/**
 * sweepMesh.ts — Malla del conjunto barrido.
 *
 * Consume `sweptSamples` y construye:
 *   kind 'point'   → esfera pequeña (color var activa o índigo)
 *   kind 'curve'   → línea gruesa en el color de la única variable activa
 *   kind 'surface' → malla semitranslúcida en el color de la 2ª variable activa
 *                    (la "más externa" que abre la superficie) + wireframe sutil
 *   kind 'solid'   → caras semitransparentes índigo neutro
 */

import * as THREE from 'three';
import type { Vec3 } from '../core/types.js';
import { varColor } from '../core/colors.js';

// ---------------------------------------------------------------------------
// Constantes de color
// ---------------------------------------------------------------------------

const INDIGO       = 0x7c5cff;
const INDIGO_WF    = 0x5540cc;   // wireframe más oscuro
const MESH_OPACITY = 0.45;
const WF_OPACITY   = 0.25;

/** Convierte '#rrggbb' a número hex para Three.js. */
function _hexNum(cssColor: string): number {
  return parseInt(cssColor.replace('#', ''), 16);
}

/**
 * Devuelve los índices canónicos de las variables activas, en orden canónico.
 */
function _activeIndices(active: [boolean, boolean, boolean]): number[] {
  const out: number[] = [];
  for (let c = 0; c < 3; c++) if (active[c]) out.push(c);
  return out;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface SweepMeshResult {
  group: THREE.Group;
}

/**
 * Construye los objetos Three.js a partir de los resultados de sweptSamples.
 * El Group devuelto se puede agregar a la escena y later disponer con disposeSweepMesh.
 *
 * @param active  Estado de activación por variable canónica (0,1,2).
 *                Se usa para seleccionar el color correcto.
 */
export function buildSweepMesh(
  kind: 'point' | 'curve' | 'surface' | 'solid',
  point: Vec3 | undefined,
  curve: Vec3[] | undefined,
  surface: Vec3[][] | undefined,
  solidFaces: Vec3[][][] | undefined,
  active: [boolean, boolean, boolean] = [false, false, false],
): SweepMeshResult {
  const group = new THREE.Group();
  const activeIdx = _activeIndices(active);

  switch (kind) {
    case 'point':
      if (point) group.add(_makePoint(point));
      break;
    case 'curve': {
      // La única variable activa define el color
      const curveColor = activeIdx.length > 0
        ? _hexNum(varColor(activeIdx[0]))
        : INDIGO;
      if (curve && curve.length >= 2) group.add(_makeCurve(curve, curveColor));
      break;
    }
    case 'surface': {
      // La 2ª variable activa (más externa) da el color de la superficie
      const surfColor = activeIdx.length >= 2
        ? _hexNum(varColor(activeIdx[1]))
        : activeIdx.length === 1
          ? _hexNum(varColor(activeIdx[0]))
          : INDIGO;
      if (surface && surface.length >= 2) {
        const { mesh, wf } = _makeSurface(surface, undefined, surfColor);
        group.add(mesh);
        group.add(wf);
      }
      break;
    }
    case 'solid':
      // Cada par de caras es perpendicular a una variable activa y se colorea con
      // SU color → se ve el aporte de cada coordenada al volumen. El orden de
      // solidFaces es [c0=0, c0=max, c1=0, c1=max, c2=0, c2=max], así que la cara
      // k corresponde a la variable activeIdx[floor(k/2)].
      if (solidFaces) {
        solidFaces.forEach((face, k) => {
          if (face.length >= 2) {
            const vIdx = activeIdx[Math.floor(k / 2)] ?? 0;
            const col = _hexNum(varColor(vIdx));
            const { mesh, wf } = _makeSurface(face, 0.3, col);
            group.add(mesh);
            group.add(wf);
          }
        });
      }
      break;
  }

  return { group };
}

// ---------------------------------------------------------------------------
// Dispose
// ---------------------------------------------------------------------------

export function disposeSweepMesh(result: SweepMeshResult) {
  result.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        (obj.material as THREE.Material).dispose();
      }
    }
  });
  result.group.clear();
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function _makePoint(p: Vec3): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.04, 16, 12);
  const mat = new THREE.MeshStandardMaterial({ color: INDIGO, roughness: 0.3, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(p[0], p[1], p[2]);
  return mesh;
}

function _makeCurve(curve: Vec3[], color: number): THREE.Line {
  const pts = curve.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

/**
 * Construye una malla desde una grilla Vec3[][] (rows x cols).
 * Genera triángulos por cuadrantes y el wireframe correspondiente.
 */
function _makeSurface(
  grid: Vec3[][],
  opacityOverride?: number,
  colorOverride?: number,
): { mesh: THREE.Mesh; wf: THREE.LineSegments } {
  const rows = grid.length;
  const cols = grid[0].length;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const [x, y, z] = grid[i][j];
      positions.push(x, y, z);
    }
  }

  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = (i + 1) * cols + j;
      const d = c + 1;
      // Dos triángulos por quad
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const opacity = opacityOverride ?? MESH_OPACITY;
  const color   = colorOverride ?? INDIGO;

  // Wireframe color: oscurecer ligeramente el color de la malla
  // Para índigo usamos INDIGO_WF; para otros colores lo bajamos de brillo un 30%
  const wfColor = color === INDIGO ? INDIGO_WF : _darken(color, 0.65);

  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    roughness: 0.6,
    metalness: 0.0,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // Wireframe
  const wfGeo = new THREE.WireframeGeometry(geo);
  const wfMat = new THREE.LineBasicMaterial({
    color: wfColor,
    transparent: true,
    opacity: WF_OPACITY,
  });
  const wf = new THREE.LineSegments(wfGeo, wfMat);

  return { mesh, wf };
}

/** Oscurece un color hex multiplicando cada canal por `factor` (0–1). */
function _darken(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
