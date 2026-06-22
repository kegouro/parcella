/**
 * sweepMesh.ts — Malla del conjunto barrido.
 *
 * Consume `sweptSamples` y construye:
 *   kind 'point'   → esfera pequeña índigo
 *   kind 'curve'   → línea gruesa índigo
 *   kind 'surface' → malla semitranslúcida índigo + wireframe
 *   kind 'solid'   → caras semitransparentes índigo
 */

import * as THREE from 'three';
import type { Vec3 } from '../core/types.js';

// ---------------------------------------------------------------------------
// Constantes de color
// ---------------------------------------------------------------------------

const INDIGO       = 0x7c5cff;
const INDIGO_WF    = 0x5540cc;   // wireframe más oscuro
const MESH_OPACITY = 0.45;
const WF_OPACITY   = 0.25;

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface SweepMeshResult {
  group: THREE.Group;
}

/**
 * Construye los objetos Three.js a partir de los resultados de sweptSamples.
 * El Group devuelto se puede agregar a la escena y later disponer con disposeSweepMesh.
 */
export function buildSweepMesh(
  kind: 'point' | 'curve' | 'surface' | 'solid',
  point: Vec3 | undefined,
  curve: Vec3[] | undefined,
  surface: Vec3[][] | undefined,
  solidFaces: Vec3[][][] | undefined,
): SweepMeshResult {
  const group = new THREE.Group();

  switch (kind) {
    case 'point':
      if (point) group.add(_makePoint(point));
      break;
    case 'curve':
      if (curve && curve.length >= 2) group.add(_makeCurve(curve));
      break;
    case 'surface':
      if (surface && surface.length >= 2) {
        const { mesh, wf } = _makeSurface(surface);
        group.add(mesh);
        group.add(wf);
      }
      break;
    case 'solid':
      if (solidFaces) {
        for (const face of solidFaces) {
          if (face.length >= 2) {
            const { mesh, wf } = _makeSurface(face, 0.25);
            group.add(mesh);
            group.add(wf);
          }
        }
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

function _makeCurve(curve: Vec3[]): THREE.Line {
  const pts = curve.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: INDIGO, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

/**
 * Construye una malla desde una grilla Vec3[][] (rows x cols).
 * Genera triángulos por cuadrantes y el wireframe correspondiente.
 */
function _makeSurface(
  grid: Vec3[][],
  opacityOverride?: number,
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
  const mat = new THREE.MeshStandardMaterial({
    color: INDIGO,
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
    color: INDIGO_WF,
    transparent: true,
    opacity: WF_OPACITY,
  });
  const wf = new THREE.LineSegments(wfGeo, wfMat);

  return { mesh, wf };
}
