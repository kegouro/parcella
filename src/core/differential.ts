/**
 * differential.ts — Geometría barrida y LaTeX del diferencial de Parcella.
 *
 * Convenciones de indexación (compartidas con integrate.ts):
 *   - sweep.active/frozen/progress: índices CANÓNICOS (posición en system.vars).
 *   - region.order[i]: índice canónico de la variable en el nivel i.
 *   - frozen[c] y progress[c] son fracciones t ∈ [0,1].
 *   - sampleRegion recibe t por NIVEL (orden de region.order).
 */

import { sampleRegion } from './region.js';
import type { CoordSystem, Region, SweepState, Vec3 } from './types.js';

// ---------------------------------------------------------------------------
// elementSymbol
// ---------------------------------------------------------------------------

/**
 * Devuelve el tipo de elemento geométrico según el número de variables activas.
 */
export function elementSymbol(activeCount: number): 'point' | 'dl' | 'dS' | 'dV' {
  switch (activeCount) {
    case 0: return 'point';
    case 1: return 'dl';
    case 2: return 'dS';
    case 3: return 'dV';
    default:
      throw new Error(`activeCount debe ser 0, 1, 2 o 3; recibido: ${activeCount}`);
  }
}

// ---------------------------------------------------------------------------
// differentialLatex
// ---------------------------------------------------------------------------

export interface DifferentialFactor {
  latex: string;
  active: boolean;
  varName: string;
}

export interface DifferentialLatexResult {
  symbol: string;
  factors: DifferentialFactor[];
  expression: string;
}

/**
 * Construye la expresión LaTeX del diferencial del elemento barrido.
 *
 * @param system  Sistema de coordenadas (se usan vars y jacobianFactorsLatex).
 * @param sweep   Estado del barrido.
 * @returns       { symbol, factors, expression }
 */
export function differentialLatex(
  system: CoordSystem,
  sweep: SweepState,
): DifferentialLatexResult {
  const activeCount = sweep.active.filter(Boolean).length;
  const symbol = elementSymbol(activeCount);

  // Factores en orden canónico (c = 0,1,2)
  const factors: DifferentialFactor[] = system.jacobianFactorsLatex.map((latex, c) => ({
    latex,
    active: sweep.active[c],
    varName: system.vars[c].name,
  }));

  // expression: símbolo = producto de factores ACTIVOS
  if (activeCount === 0) {
    return { symbol, factors, expression: '' };
  }

  const activeFactors = factors.filter((f) => f.active).map((f) => f.latex);
  const rhs = activeFactors.join(' \\cdot ');
  const expression = `${symbol} = ${rhs}`;

  return { symbol, factors, expression };
}

// ---------------------------------------------------------------------------
// Helpers para construir el vector t-por-nivel a partir del sweep
// ---------------------------------------------------------------------------

/**
 * Dado un sweep y una región, construye el vector [t0, t1, t2] en orden de NIVEL
 * (region.order). Para cada nivel i con variable canónica c = region.order[i]:
 *   - Si activa: usa el valor sweep proporcionado (normalmente progress[c]).
 *   - Si congelada: usa sweep.frozen[c].
 *
 * @param region         Región de integración.
 * @param sweep          Estado del barrido.
 * @param activeOverride Por cada variable activa, el t a usar (normalmente progress[c]
 *                       pero puede ser otro valor, p.ej. 0 para el extremo inferior).
 */
function buildTByLevel(
  region: Region,
  sweep: SweepState,
  activeOverride: (c: number) => number,
): [number, number, number] {
  const t: [number, number, number] = [0, 0, 0];
  for (let level = 0; level < 3; level++) {
    const c = region.order[level];
    t[level] = sweep.active[c] ? activeOverride(c) : sweep.frozen[c];
  }
  return t;
}

// ---------------------------------------------------------------------------
// sweptSamples
// ---------------------------------------------------------------------------

export interface SweptSamples {
  kind: 'point' | 'curve' | 'surface' | 'solid';
  point?: Vec3;
  curve?: Vec3[];
  surface?: Vec3[][];
  solidFaces?: Vec3[][][];
}

/**
 * Construye la muestra cartesiana del conjunto barrido según las variables activas.
 *
 * @param region   Región de integración.
 * @param system   Sistema de coordenadas.
 * @param sweep    Estado del barrido.
 * @param res      Resolución de la grilla (nº de puntos por lado). Por defecto 24.
 */
export function sweptSamples(
  region: Region,
  system: CoordSystem,
  sweep: SweepState,
  res = 24,
): SweptSamples {
  const activeIndices = [0, 1, 2].filter((c) => sweep.active[c]);
  const activeCount = activeIndices.length;

  // ---- 0 activas → punto ----
  if (activeCount === 0) {
    const t = buildTByLevel(region, sweep, (_c) => 0); // todas congeladas
    const { cartesian } = sampleRegion(region, system, t);
    return { kind: 'point', point: cartesian };
  }

  // ---- 1 activa → curva ----
  if (activeCount === 1) {
    const [c0] = activeIndices;
    const curve: Vec3[] = [];
    for (let i = 0; i < res; i++) {
      const tActive = (i / (res - 1)) * sweep.progress[c0];
      const t = buildTByLevel(region, sweep, (c) => (c === c0 ? tActive : 0));
      const { cartesian } = sampleRegion(region, system, t);
      curve.push(cartesian);
    }
    return { kind: 'curve', curve };
  }

  // ---- 2 activas → superficie ----
  if (activeCount === 2) {
    const [c0, c1] = activeIndices;
    const surface: Vec3[][] = [];
    for (let i = 0; i < res; i++) {
      const row: Vec3[] = [];
      const t0 = (i / (res - 1)) * sweep.progress[c0];
      for (let j = 0; j < res; j++) {
        const t1 = (j / (res - 1)) * sweep.progress[c1];
        const t = buildTByLevel(region, sweep, (c) => {
          if (c === c0) return t0;
          if (c === c1) return t1;
          return 0;
        });
        const { cartesian } = sampleRegion(region, system, t);
        row.push(cartesian);
      }
      surface.push(row);
    }
    return { kind: 'surface', surface };
  }

  // ---- 3 activas → sólido (6 caras del bloque [0,progress]³) ----
  // Las 6 caras del cubo paramétrico. Cada cara fija una variable en su extremo
  // (0 o progress) y barre las otras dos.
  const [c0, c1, c2] = activeIndices; // [0,1,2]
  const pMax = [sweep.progress[c0], sweep.progress[c1], sweep.progress[c2]];

  // Genera una cara: fixedVar (canónica) fijada en fixedVal, las otras dos barren.
  function makeFace(fixedVar: number, fixedVal: number): Vec3[][] {
    // Las dos vars que barren (las que NO son fixedVar)
    const [va, vb] = [c0, c1, c2].filter((c) => c !== fixedVar);
    const face: Vec3[][] = [];
    for (let i = 0; i < res; i++) {
      const row: Vec3[] = [];
      const ta = (i / (res - 1)) * pMax[[c0, c1, c2].indexOf(va)];
      for (let j = 0; j < res; j++) {
        const tb = (j / (res - 1)) * pMax[[c0, c1, c2].indexOf(vb)];
        const t = buildTByLevel(region, sweep, (c) => {
          if (c === fixedVar) return fixedVal;
          if (c === va) return ta;
          if (c === vb) return tb;
          return 0;
        });
        const { cartesian } = sampleRegion(region, system, t);
        row.push(cartesian);
      }
      face.push(row);
    }
    return face;
  }

  const solidFaces: Vec3[][][] = [
    makeFace(c0, 0),          // cara c0=0
    makeFace(c0, pMax[0]),    // cara c0=progress[c0]
    makeFace(c1, 0),          // cara c1=0
    makeFace(c1, pMax[1]),    // cara c1=progress[c1]
    makeFace(c2, 0),          // cara c2=0
    makeFace(c2, pMax[2]),    // cara c2=progress[c2]
  ];

  return { kind: 'solid', solidFaces };
}

// ---------------------------------------------------------------------------
// elementCell
// ---------------------------------------------------------------------------

export interface ElementCell {
  center: Vec3;
  edges: Vec3[];
}

/**
 * El "parcella" infinitesimal en la posición actual.
 *
 * `center` es el punto actual (activas en progress, congeladas en frozen).
 * `edges` contiene un vector (en coordenadas cartesianas) por cada variable
 * ACTIVA, estimado por diferencia finita con un paso dt en t.
 *
 * @param region  Región de integración.
 * @param system  Sistema de coordenadas.
 * @param sweep   Estado del barrido.
 * @param dt      Paso en t para la diferencia finita. Por defecto 0.04.
 */
export function elementCell(
  region: Region,
  system: CoordSystem,
  sweep: SweepState,
  dt = 0.04,
): ElementCell {
  // Centro: activas en progress, congeladas en frozen
  const tCenter = buildTByLevel(region, sweep, (c) => sweep.progress[c]);
  const { cartesian: center } = sampleRegion(region, system, tCenter);

  // Un edge por variable activa
  const edges: Vec3[] = [];

  for (let c = 0; c < 3; c++) {
    if (!sweep.active[c]) continue;

    // Punto desplazado: esta var activa avanza dt, las demás igual
    const tPlus = buildTByLevel(region, sweep, (ci) => {
      if (ci === c) return Math.min(sweep.progress[ci] + dt, 1);
      return sweep.progress[ci];
    });
    const { cartesian: plus } = sampleRegion(region, system, tPlus);

    const edge: Vec3 = [
      plus[0] - center[0],
      plus[1] - center[1],
      plus[2] - center[2],
    ];
    edges.push(edge);
  }

  return { center, edges };
}
