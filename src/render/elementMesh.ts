/**
 * elementMesh.ts — El "parcella" infinitesimal.
 *
 * Recibe el resultado de `elementCell` (center + edges) y construye:
 *   0 edges → esfera puntual
 *   1 edge  → segmento (dl)
 *   2 edges → placa (dS) = paralelograma
 *   3 edges → cajita (dV) = paralelepípedo
 *
 * Color ámbar brillante (#ffb454) para máxima visibilidad.
 */

import * as THREE from 'three';
import type { Vec3 } from '../core/types.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const AMBER         = 0xffb454;
const AMBER_EDGE    = 0xffd080;
const AMBER_OPACITY = 0.85;
const ELEM_SCALE    = 1.0;     // multiplicador visual del tamaño del parcella

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface ElementMeshResult {
  group: THREE.Group;
}

/**
 * Construye los objetos Three.js del parcella infinitesimal.
 */
export function buildElementMesh(
  center: Vec3,
  edges: Vec3[],
): ElementMeshResult {
  const group = new THREE.Group();

  switch (edges.length) {
    case 0:
      group.add(_makePointElem(center));
      break;
    case 1:
      group.add(..._makeSegment(center, edges[0]));
      break;
    case 2:
      group.add(..._makePlate(center, edges[0], edges[1]));
      break;
    case 3:
    default:
      group.add(..._makeBox(center, edges[0], edges[1], edges[2]));
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

function _makePointElem(center: Vec3): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.06, 16, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: AMBER,
    emissive: AMBER,
    emissiveIntensity: 0.6,
    roughness: 0.15,
    metalness: 0.3,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...center);
  return m;
}

function _makeSegment(center: Vec3, edge: Vec3): THREE.Object3D[] {
  const c = _v(center);
  const e = _edgeScaled(edge);
  const end = _add(c, e);

  const pts = [c, end];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: AMBER_EDGE, linewidth: 3 });
  const line = new THREE.Line(geo, mat);

  // Marcadores en los extremos
  const sphere = (pos: THREE.Vector3) => {
    const sg = new THREE.SphereGeometry(0.04, 12, 8);
    const sm = new THREE.MeshStandardMaterial({
      color: AMBER,
      emissive: AMBER,
      emissiveIntensity: 0.5,
    });
    const s = new THREE.Mesh(sg, sm);
    s.position.copy(pos);
    return s;
  };

  return [line, sphere(c), sphere(end)];
}

function _makePlate(center: Vec3, e1: Vec3, e2: Vec3): THREE.Object3D[] {
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
    color: AMBER,
    emissive: AMBER,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: AMBER_OPACITY,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // Aristas
  const edgePts = [p00, p10, p11, p01, p00];
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
  const edgeMat = new THREE.LineBasicMaterial({ color: AMBER_EDGE });
  const edges = new THREE.Line(edgeGeo, edgeMat);

  return [mesh, edges];
}

function _makeBox(center: Vec3, e1: Vec3, e2: Vec3, e3: Vec3): THREE.Object3D[] {
  const c  = _v(center);
  const v1 = _edgeScaled(e1);
  const v2 = _edgeScaled(e2);
  const v3 = _edgeScaled(e3);

  // 8 vértices del paralelepípedo
  const verts = [
    c.clone(),
    _add(c, v1),
    _add(c, v2),
    _add(_add(c, v1), v2),
    _add(c, v3),
    _add(_add(c, v1), v3),
    _add(_add(c, v2), v3),
    _add(_add(_add(c, v1), v2), v3),
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
    color: AMBER,
    emissive: AMBER,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: AMBER_OPACITY,
    side: THREE.DoubleSide,
    roughness: 0.2,
    metalness: 0.15,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // 12 aristas del paralelepípedo
  const edgePairs: [number, number][] = [
    [0,1],[2,3],[4,5],[6,7],  // en dirección v1
    [0,2],[1,3],[4,6],[5,7],  // en dirección v2
    [0,4],[1,5],[2,6],[3,7],  // en dirección v3
  ];

  const edgePts: THREE.Vector3[] = [];
  for (const [a, b] of edgePairs) {
    edgePts.push(verts[a], verts[b]);
  }

  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
  // Construir índices para LineSegments (pares consecutivos)
  const edgeIdx: number[] = [];
  for (let i = 0; i < edgePts.length; i += 2) {
    edgeIdx.push(i, i + 1);
  }
  edgeGeo.setIndex(edgeIdx);
  const edgeMat = new THREE.LineBasicMaterial({ color: AMBER_EDGE, linewidth: 2 });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);

  return [mesh, edgeLines];
}
