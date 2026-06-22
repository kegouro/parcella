/**
 * integrate.ts — Integración numérica acumulativa sobre variables activas.
 *
 * Modelo de barrido:
 *   - sweep.active[c] / frozen[c] / progress[c] indexados en orden CANÓNICO
 *     (índice c en system.vars).
 *   - region.order[i] = c: el nivel i de integración corresponde a la variable
 *     canónica c.
 *   - Las variables congeladas fijan su coordenada en valor = lower + range * frozen[c].
 *
 * Cambio de variable (Fubini con límites dependientes):
 *   Para el nivel i con límites [Lᵢ, Uᵢ] (evaluados con outer ya conocidos):
 *     varᵢ = Lᵢ + (Uᵢ − Lᵢ) · tᵢ,   tᵢ ∈ [0, 1]
 *     d(varᵢ) = (Uᵢ − Lᵢ) dtᵢ   → factor Jacobiano por nivel
 *
 * Medida del submanifold (solo vars activas):
 *   dM = ∏_{c activo} hc(punto) · ∏_{c activo} (Uc − Lc) dtc
 *
 * Modos de integrando:
 *   'geometric': g = 1 → integral da la medida.
 *   'scalar':    g = f(x,y,z) usando compileScalar.
 *   'vector':    Fase 2 — placeholder, retorna 0.
 */

import { evalLimits } from './region.js';
import { compileScalar } from './fields.js';
import type { Region, CoordSystem, Integrand, SweepState } from './types.js';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface IntegrateOpts {
  /** Subdivisiones por dimensión activa (regla del punto medio). Default: 40. */
  res?: number;
  /**
   * true (default): cada var activa integra t ∈ [0, progress[c]] (parcial).
   * false: integra t ∈ [0, 1] (total).
   */
  upTo?: boolean;
}

// ---------------------------------------------------------------------------
// Núcleo recursivo (Fubini, regla del punto medio)
// ---------------------------------------------------------------------------

/**
 * Integra recursivamente nivel a nivel.
 *
 * Variables activas: se itera con `res` puntos medios en [0, tMax].
 * Variables congeladas: se fija el valor y se pasa al siguiente nivel.
 * En la hoja (level===3): evalúa g(punto) * ∏_{c∈active} h_c(punto).
 *   El factor ∏(Uᵢ−Lᵢ)·dtᵢ se acumula al subir (range * dt por nivel activo).
 */
function recurse(
  region: Region,
  system: CoordSystem,
  sweep: SweepState,
  scalarFn: ((p: [number, number, number]) => number) | null,
  mode: string,
  upTo: boolean,
  res: number,
  level: number,
  outer: Record<string, number>,
  coords: [number, number, number],
  activeCanonical: Set<number>,
): number {
  // ---- Hoja: evaluar integrando * producto de h-factors activos ----
  if (level === 3) {
    const [u, v, w] = coords;
    const cartesian = system.toCartesian(u, v, w);
    const h = system.scaleFactors(u, v, w);

    let hProd = 1;
    for (const c of activeCanonical) {
      hProd *= h[c];
    }

    let g: number;
    if (mode === 'geometric') {
      g = 1;
    } else if (mode === 'scalar' && scalarFn !== null) {
      g = scalarFn(cartesian);
    } else {
      // 'vector' — Fase 2: placeholder
      g = 0;
    }

    return g * hProd;
  }

  // ---- Nivel i: variable canónica c ----
  const c = region.order[level];
  const varName = system.vars[c].name;
  const { lower, upper } = evalLimits(region, system, level, outer);
  const range = upper - lower;

  // ---- Variable congelada: fijar y bajar ----
  if (!activeCanonical.has(c)) {
    const value = lower + range * sweep.frozen[c];
    const newCoords: [number, number, number] = [coords[0], coords[1], coords[2]];
    newCoords[c] = value;
    return recurse(
      region, system, sweep, scalarFn, mode, upTo, res,
      level + 1, { ...outer, [varName]: value }, newCoords, activeCanonical,
    );
  }

  // ---- Variable activa: regla del punto medio ----
  const tMax = upTo ? sweep.progress[c] : 1.0;
  if (tMax <= 0) return 0;

  const dt = tMax / res;
  let sum = 0;

  for (let k = 0; k < res; k++) {
    const tMid = (k + 0.5) * dt;
    const value = lower + range * tMid;
    const newCoords: [number, number, number] = [coords[0], coords[1], coords[2]];
    newCoords[c] = value;

    const inner = recurse(
      region, system, sweep, scalarFn, mode, upTo, res,
      level + 1, { ...outer, [varName]: value }, newCoords, activeCanonical,
    );

    // Jacobiano de cambio de variable t→var: (upper−lower) · dt
    sum += inner * range * dt;
  }

  return sum;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Integra el integrando sobre las variables activas del sweep.
 *
 * @param region    Región con order y bounds.
 * @param system    Sistema de coordenadas (scaleFactors, toCartesian, vars).
 * @param integrand Descripción del integrando (mode, scalar, vector).
 * @param sweep     Estado activo/congelado/progreso.
 * @param opts      { res=40, upTo=true }.
 * @returns         Valor numérico de la integral.
 */
export function integrate(
  region: Region,
  system: CoordSystem,
  integrand: Integrand,
  sweep: SweepState,
  opts?: IntegrateOpts,
): number {
  const res = opts?.res ?? 40;
  const upTo = opts?.upTo ?? true;

  let scalarFn: ((p: [number, number, number]) => number) | null = null;
  if (integrand.mode === 'scalar') {
    scalarFn = compileScalar(integrand.scalar ?? '1');
  }

  const activeCanonical = new Set<number>();
  for (let c = 0; c < 3; c++) {
    if (sweep.active[c]) activeCanonical.add(c);
  }

  return recurse(
    region, system, sweep, scalarFn, integrand.mode,
    upTo, res, 0, {}, [0, 0, 0], activeCanonical,
  );
}

/**
 * Integra el valor total (t ∈ [0,1] en todas las vars activas).
 */
export function integrateTotal(
  region: Region,
  system: CoordSystem,
  integrand: Integrand,
  sweep: SweepState,
  opts?: Omit<IntegrateOpts, 'upTo'>,
): number {
  return integrate(region, system, integrand, sweep, { ...opts, upTo: false });
}

/**
 * Integra la parte parcial (t ∈ [0, progress[c]] en cada var activa).
 */
export function integratePartial(
  region: Region,
  system: CoordSystem,
  integrand: Integrand,
  sweep: SweepState,
  opts?: Omit<IntegrateOpts, 'upTo'>,
): number {
  return integrate(region, system, integrand, sweep, { ...opts, upTo: true });
}

/**
 * Fracción del barrido completado: partial / total ∈ [0, 1].
 * Si total ≈ 0, devuelve 0.
 */
export function progressFraction(
  region: Region,
  system: CoordSystem,
  integrand: Integrand,
  sweep: SweepState,
  res?: number,
): number {
  const total = integrateTotal(region, system, integrand, sweep, { res });
  if (Math.abs(total) < Number.EPSILON) return 0;
  const partial = integratePartial(region, system, integrand, sweep, { res });
  return partial / total;
}

/**
 * Etiqueta de medida según el número de variables activas.
 */
export function measureLabel(activeCount: number): 'longitud' | 'área' | 'volumen' | '' {
  if (activeCount === 1) return 'longitud';
  if (activeCount === 2) return 'área';
  if (activeCount === 3) return 'volumen';
  return '';
}
