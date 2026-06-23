/**
 * elementMesh.ts — El "parcella" infinitesimal.
 *
 * Recibe el resultado de `elementCell` (center + edges) y construye:
 *   0 edges → esfera puntual
 *   1 edge  → segmento (dl)
 *   2 edges → placa (dS) = paralelograma
 *   3 edges → cajita (dV) = paralelepípedo
 *
 * Cada arista se colorea según el índice canónico de su variable (varColor).
 */

import * as THREE from 'three';
import type { Vec3 } from '../core/types.js';
import { varColor } from '../core/colors.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const AMBER_OPACITY = 0.85;
const ELEM_SCALE    = 1.0;     // multiplicador visual del tamaño del parcella

// Color de relleno neutro para caras (no tiene variable asociada)
const FACE_COLOR    = 0xffd080;

// ---------------------------------------------------------------------------
// Helpers de color
// ---------------------------------------------------------------------------

/** Convierte un string '#rrggbb' o '#rgb' a número hex para Three.js. */
function _hexNum(cssColor: string): number {
  return parseInt(cssColor.replace('#', ''), 16);
}

/**
 * Dado `activeVars` ([b0,b1,b2]) devuelve un array con los índices canónicos
 * de las variables activas, en orden canónico (0 < 1 < 2).
 * La k-ésima entrada corresponde a edges[k].
 */
function _canonicalIndices(activeVars: [boolean, boolean, boolean]): number[] {
  const indices: number[] = [];
  for (let c = 0; c < 3; c++) {
    if (activeVars[c]) indices.push(c);
  }
  return indices;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface ElementMeshResult {
  group: THREE.Group;
}

/**
 * Construye los objetos Three.js del parcella infinitesimal.
 *
 * @param center     Centro del elemento en coordenadas cartesianas.
 * @param edges      Un vector por cada variable ACTIVA, en orden canónico.
 * @param activeVars Indica qué variables (índices 0,1,2) están activas.
 */
export function buildElementMesh(
  center: Vec3,
  edges: Vec3[],
  activeVars: [boolean, boolean, boolean] = [true, true, true],
): ElementMeshResult {
  const group = new THREE.Group();
  const canonicalIdx = _canonicalIndices(activeVars);

  switch (edges.length) {
    case 0:
      // 0 variables activas → la posición ya la dibuja el barrido como un único
      // punto. El elemento no dibuja nada aquí para no duplicar la esfera.
      break;
    case 1:
      group.add(..._makeSegment(center, edges[0], canonicalIdx[0]));
      break;
    case 2:
      group.add(..._makePlate(center, edges[0], edges[1], canonicalIdx));
      break;
    case 3:
    default:
      group.add(..._makeBox(center, edges[0], edges[1], edges[2], canonicalIdx));
      break;
  }

  return { group };
}

// ---------------------------------------------------------------------------
// Dispose
// ---------------------------------------------------------------------------

export function disposeElementMesh(result: ElementMeshResult) {
  result.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
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

const _v = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);
const _add = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().add(b);

function _edgeScaled(e: Vec3): THREE.Vector3 {
  return _v(e).multiplyScalar(ELEM_SCALE);
}

/**
 * Crea un segmento (dl) coloreado con el color de la variable canónica `canonicalIdx`.
 */
function _makeSegment(center: Vec3, edge: Vec3, canonicalIdx: number): THREE.Object3D[] {
  const col = _hexNum(varColor(canonicalIdx));
  const c = _v(center);
  const e = _edgeScaled(edge);
  const end = _add(c, e);

  const pts = [c, end];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: col, linewidth: 3 });
  const line = new THREE.Line(geo, mat);

  // Marcadores en los extremos
  const sphere = (pos: THREE.Vector3) => {
    const sg = new THREE.SphereGeometry(0.04, 12, 8);
    const sm = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.5,
    });
    const s = new THREE.Mesh(sg, sm);
    s.position.copy(pos);
    return s;
  };

  return [line, sphere(c), sphere(end)];
}

/**
 * Crea una placa (dS) con dos conjuntos de aristas, cada uno coloreado según
 * su variable canónica. `canonicalIdx[0]` → aristas en dirección e1,
 * `canonicalIdx[1]` → aristas en dirección e2.
 */
function _makePlate(center: Vec3, e1: Vec3, e2: Vec3, canonicalIdx: number[]): THREE.Object3D[] {
  const c  = _v(center);
  const v1 = _edgeScaled(e1);
  const v2 = _edgeScaled(e2);

  // Cuatro vértices del paralelograma
  const p00 = c.clone();
  const p10 = _add(c, v1);
  const p11 = _add(_add(c, v1), v2);
  const p01 = _add(c, v2);

  const positions = new Float32Array([
    p00.x, p00.y, p00.z,
    p10.x, p10.y, p10.z,
    p11.x, p11.y, p11.z,
    p01.x, p01.y, p01.z,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: FACE_COLOR,
    emissive: FACE_COLOR,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: AMBER_OPACITY,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geo, mat);

  const objs: THREE.Object3D[] = [mesh];

  // Aristas en dirección e1 (color var 0 de las activas)
  const col1 = _hexNum(varColor(canonicalIdx[0] ?? 0));
  // Aristas en dirección e2 (color var 1 de las activas)
  const col2 = _hexNum(varColor(canonicalIdx[1] ?? 1));

  // Dos aristas en dirección v1: p00→p10 y p01→p11
  for (const [a, b] of [[p00, p10], [p01, p11]] as [THREE.Vector3, THREE.Vector3][]) {
    const edgeGeo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const edgeMat = new THREE.LineBasicMaterial({ color: col1 });
    objs.push(new THREE.Line(edgeGeo, edgeMat));
  }

  // Dos aristas en dirección v2: p00→p01 y p10→p11
  for (const [a, b] of [[p00, p01], [p10, p11]] as [THREE.Vector3, THREE.Vector3][]) {
    const edgeGeo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const edgeMat = new THREE.LineBasicMaterial({ color: col2 });
    objs.push(new THREE.Line(edgeGeo, edgeMat));
  }

  return objs;
}

/**
 * Crea el paralelepípedo (dV). Las 12 aristas se agrupan en 3 grupos de 4:
 *   - 4 aristas en dirección v1 → color de canonicalIdx[0]
 *   - 4 aristas en dirección v2 → color de canonicalIdx[1]
 *   - 4 aristas en dirección v3 → color de canonicalIdx[2]
 */
function _makeBox(center: Vec3, e1: Vec3, e2: Vec3, e3: Vec3, canonicalIdx: number[]): THREE.Object3D[] {
  const c  = _v(center);
  const v1 = _edgeScaled(e1);
  const v2 = _edgeScaled(e2);
  const v3 = _edgeScaled(e3);

  // 8 vértices del paralelepípedo
  const verts = [
    c.clone(),                         // 0: origin
    _add(c, v1),                       // 1: +v1
    _add(c, v2),                       // 2: +v2
    _add(_add(c, v1), v2),             // 3: +v1+v2
    _add(c, v3),                       // 4: +v3
    _add(_add(c, v1), v3),             // 5: +v1+v3
    _add(_add(c, v2), v3),             // 6: +v2+v3
    _add(_add(_add(c, v1), v2), v3),   // 7: +v1+v2+v3
  ];

  // 6 caras (quad trianguladas)
  const faceIndices = [
    [0, 1, 3, 2],  // frente
    [4, 5, 7, 6],  // atrás
    [0, 1, 5, 4],  // abajo
    [2, 3, 7, 6],  // arriba
    [0, 2, 6, 4],  // izquierda
    [1, 3, 7, 5],  // derecha
  ];

  const positions: number[] = [];
  const indices: number[] = [];
  let vi = 0;

  for (const [a, b, c2, d] of faceIndices) {
    for (const idx of [a, b, c2, d]) {
      const v = verts[idx];
      positions.push(v.x, v.y, v.z);
    }
    // Dos triángulos por cara
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: FACE_COLOR,
    emissive: FACE_COLOR,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: AMBER_OPACITY * 0.6,
    side: THREE.DoubleSide,
    roughness: 0.2,
    metalness: 0.15,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  const objs: THREE.Object3D[] = [mesh];

  // 12 aristas agrupadas por dirección
  // Dirección v1 (4 aristas): pares de vértices que difieren solo en v1
  const edgeGroups: Array<[number, number][]> = [
    [[0,1],[2,3],[4,5],[6,7]],   // dirección v1
    [[0,2],[1,3],[4,6],[5,7]],   // dirección v2
    [[0,4],[1,5],[2,6],[3,7]],   // dirección v3
  ];

  for (let k = 0; k < 3; k++) {
    const col = _hexNum(varColor(canonicalIdx[k] ?? k));
    const pts: THREE.Vector3[] = [];
    for (const [a, b] of edgeGroups[k]) {
      pts.push(verts[a], verts[b]);
    }
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const edgeIdx: number[] = [];
    for (let i = 0; i < pts.length; i += 2) edgeIdx.push(i, i + 1);
    edgeGeo.setIndex(edgeIdx);
    const edgeMat = new THREE.LineBasicMaterial({ color: col, linewidth: 2 });
    objs.push(new THREE.LineSegments(edgeGeo, edgeMat));
  }

  return objs;
}
