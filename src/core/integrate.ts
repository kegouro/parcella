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
 *   'vector':    Flujo (2 activas) o circulación (1 activa). Ver detalles abajo.
 *
 * Convención de orientación del modo 'vector':
 *
 *   FLUJO (2 variables activas, ∫∫ F·dS):
 *     Sean a < b los índices canónicos de las dos variables activas (orden ascendente).
 *     En cada punto se calculan las derivadas parciales cartesianas:
 *       r_a = ∂r/∂t_a = toCartesian con var_a desplazada en ±h, escalada por (U_a − L_a)
 *       r_b = ∂r/∂t_b = ídem para var_b, escalada por (U_b − L_b)
 *     El vector área orientado es dS = r_a × r_b (regla de la mano derecha, orden a→b).
 *     El integrando es F(punto) · dS, que YA incluye el área diferencial;
 *     NO se multiplica además por los factores de escala h_c (esos están implícitos
 *     en las derivadas parciales de toCartesian).
 *
 *   CIRCULACIÓN (1 variable activa, ∮ F·dl):
 *     Sea a el índice canónico de la variable activa.
 *     La derivada cartesiana de la curva respecto al parámetro t es:
 *       dr/dt = toCartesian con var_a desplazada en ±h, escalada por (U_a − L_a)
 *     El integrando es F(punto) · (dr/dt) dt, integrado sobre t ∈ [0,1].
 *     NO se usan factores h_c (no es una integral de longitud de arco sino de línea).
 *
 *   0 o 3 activas en modo vector: retorna 0 (no aplica flujo ni circulación).
 */

import { evalLimits } from './region.js';
import { compileScalar, compileVector, dot, cross } from './fields.js';
import type { Region, CoordSystem, Integrand, SweepState, Vec3 } from './types.js';

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
// Helpers para modo vector
// ---------------------------------------------------------------------------

/**
 * Derivada parcial cartesiana de la parametrización respecto al parámetro t_c.
 *
 * Dado que var_c = L_c + (U_c − L_c) · t_c, la derivada respecto a t_c es:
 *   d(toCartesian)/dt_c = (∂r/∂var_c) · (U_c − L_c)
 *
 * Se aproxima por diferencias centradas en `var_c` con paso `h`, luego se
 * escala por `range` (= U_c − L_c) para convertir al parámetro t.
 *
 * @param system    Sistema de coordenadas.
 * @param coords    Coordenadas actuales [u,v,w] en orden canónico.
 * @param c         Índice canónico de la variable a derivar (0,1,2).
 * @param range     U_c − L_c (rango de la variable c).
 * @param h         Paso de diferencias finitas (por defecto 1e-5).
 * @returns         Vector derivada cartesiana escalado: dr/dt_c.
 */
function cartesianPartial(
  system: CoordSystem,
  coords: [number, number, number],
  c: number,
  range: number,
  h = 1e-5,
): Vec3 {
  const cp = coords.slice() as [number, number, number];
  const cm = coords.slice() as [number, number, number];
  cp[c] += h;
  cm[c] -= h;
  const rp = system.toCartesian(cp[0], cp[1], cp[2]);
  const rm = system.toCartesian(cm[0], cm[1], cm[2]);
  // (r(c+h) - r(c-h)) / (2h)  *  range
  const scale = range / (2 * h);
  return [
    (rp[0] - rm[0]) * scale,
    (rp[1] - rm[1]) * scale,
    (rp[2] - rm[2]) * scale,
  ];
}

// ---------------------------------------------------------------------------
// Núcleo recursivo (Fubini, regla del punto medio)
// ---------------------------------------------------------------------------

/**
 * Integra recursivamente nivel a nivel.
 *
 * Variables activas: se itera con `res` puntos medios en [0, tMax].
 * Variables congeladas: se fija el valor y se pasa al siguiente nivel.
 * En la hoja (level===3): evalúa el integrando según el modo.
 *
 * Para 'geometric' y 'scalar':
 *   g(punto) * ∏_{c∈active} h_c(punto)
 *   El factor ∏(Uᵢ−Lᵢ)·dtᵢ se acumula al subir (range * dt por nivel activo).
 *
 * Para 'vector':
 *   El vector área / tangente ya lleva los rangos incorporados (ver cartesianPartial).
 *   El nivel recursivo NO multiplica por h_c ni por range para las vars activas;
 *   eso se delega a la construcción de r_a, r_b (o dr/dt).
 *   Sin embargo, el bucle de punto medio sí acumula range * dt para el cambio
 *   de variable t→var (igual que los otros modos), y la hoja devuelve el
 *   producto punto F·dS (sin hProd adicional).
 */
function recurse(
  region: Region,
  system: CoordSystem,
  sweep: SweepState,
  scalarFn: ((p: [number, number, number]) => number) | null,
  vectorFn: ((p: Vec3) => Vec3) | null,
  mode: string,
  upTo: boolean,
  res: number,
  level: number,
  outer: Record<string, number>,
  coords: [number, number, number],
  activeCanonical: Set<number>,
  // Rangos de las variables activas, indexados por índice canónico.
  // Solo relevante para modo 'vector': se necesitan en la hoja para calcular dr/dt.
  activeRanges: Map<number, number>,
): number {
  // ---- Hoja: evaluar integrando ----
  if (level === 3) {
    const [u, v, w] = coords;
    const cartesian = system.toCartesian(u, v, w);

    if (mode === 'vector') {
      // Modo vector: sin h-factors del sistema (ya están en las derivadas cartesianas)
      if (vectorFn === null) return 0;
      const F = vectorFn(cartesian);
      const nActive = activeCanonical.size;

      if (nActive === 2) {
        // Flujo ∫∫ F·dS = ∫∫ F · (r_a × r_b) dt_a dt_b
        // Orden: índices canónicos ascendentes a < b → dS = r_a × r_b
        const [ca, cb] = [...activeCanonical].sort((x, y) => x - y);
        const rangeA = activeRanges.get(ca) ?? 1;
        const rangeB = activeRanges.get(cb) ?? 1;
        const ra = cartesianPartial(system, coords, ca, rangeA);
        const rb = cartesianPartial(system, coords, cb, rangeB);
        const dS = cross(ra, rb);
        return dot(F, dS);
      } else if (nActive === 1) {
        // Circulación ∮ F·dl = ∫ F · (dr/dt) dt
        const [ca] = [...activeCanonical];
        const rangeA = activeRanges.get(ca) ?? 1;
        const drdt = cartesianPartial(system, coords, ca, rangeA);
        return dot(F, drdt);
      } else {
        // 0 o 3 activas en modo vector → no aplica
        return 0;
      }
    }

    // Modos 'geometric' y 'scalar': usar h-factors del sistema de coordenadas
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
      region, system, sweep, scalarFn, vectorFn, mode, upTo, res,
      level + 1, { ...outer, [varName]: value }, newCoords, activeCanonical,
      activeRanges,
    );
  }

  // ---- Variable activa: regla del punto medio ----
  const tMax = upTo ? sweep.progress[c] : 1.0;
  if (tMax <= 0) return 0;

  // Registrar el rango de esta variable activa para que la hoja pueda construir dr/dt.
  // (Solo importa en modo 'vector', pero se registra siempre sin costo apreciable.)
  const newActiveRanges = new Map(activeRanges);
  newActiveRanges.set(c, range);

  const dt = tMax / res;
  let sum = 0;

  for (let k = 0; k < res; k++) {
    const tMid = (k + 0.5) * dt;
    const value = lower + range * tMid;
    const newCoords: [number, number, number] = [coords[0], coords[1], coords[2]];
    newCoords[c] = value;

    const inner = recurse(
      region, system, sweep, scalarFn, vectorFn, mode, upTo, res,
      level + 1, { ...outer, [varName]: value }, newCoords, activeCanonical,
      newActiveRanges,
    );

    // Jacobiano de cambio de variable t→var: (upper−lower) · dt
    // Para modo 'vector' con 2 activas: los rangos ya están absorbidos en r_a, r_b
    // (via cartesianPartial), por lo que aquí NO se acumula range*dt para las activas.
    // Sin embargo, la integral sigue siendo sobre dt_a dt_b (dos bucles de punto medio),
    // y cada bucle aporta su propio dt. El range de ESTE nivel se incluye porque
    // el bucle recorre t∈[0,tMax] con paso dt=tMax/res, y la integral aproximada es
    // Σ inner * dt (no * range * dt), ya que range ya está en el vector dr/dt.
    // Para no bifurcar la lógica, el integrand en modo vector ya incorpora los rangos,
    // y los bucles solo acumulan dt (escala temporal). Implementamos esto devolviendo
    // el integrando con los rangos incluidos, y el bucle solo multiplica por dt.
    if (mode === 'vector') {
      sum += inner * dt;
    } else {
      sum += inner * range * dt;
    }
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

  let scalarFn: ((p: Vec3) => number) | null = null;
  if (integrand.mode === 'scalar') {
    scalarFn = compileScalar(integrand.scalar ?? '1');
  }

  let vectorFn: ((p: Vec3) => Vec3) | null = null;
  if (integrand.mode === 'vector') {
    vectorFn = compileVector(integrand.vector ?? ['0', '0', '0']);
  }

  const activeCanonical = new Set<number>();
  for (let c = 0; c < 3; c++) {
    if (sweep.active[c]) activeCanonical.add(c);
  }

  return recurse(
    region, system, sweep, scalarFn, vectorFn, integrand.mode,
    upTo, res, 0, {}, [0, 0, 0], activeCanonical,
    new Map<number, number>(),
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
