/**
 * types.ts — Contrato central de Parcella.
 *
 * Disciplina: este módulo es puro (sin DOM, sin Three.js).
 * Todos los demás módulos (core/, render/, ui/) importan desde aquí.
 * Nunca importar desde render/ ni ui/ en este archivo.
 */

// ---------------------------------------------------------------------------
// Primitivos geométricos
// ---------------------------------------------------------------------------

/** Punto o vector 3-D en coordenadas cartesianas. */
export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Sistemas de coordenadas
// ---------------------------------------------------------------------------

/**
 * Identificador canónico de sistema de coordenadas.
 * 'curvilinear' es el caso general del que los demás son instancias;
 * se usa en Fase 2 cuando el usuario define su propio mapeo.
 */
export type SystemId = 'cartesian' | 'polar' | 'cylindrical' | 'spherical' | 'curvilinear';

/**
 * Especificación de una variable de coordenada individual.
 * Ejemplo esférico: { name: 'r', latex: 'r', label: 'Radio' }
 */
export interface VarSpec {
  /** Nombre de la variable tal como lo entiende mathjs (sin espacios). */
  name: string;
  /** Símbolo LaTeX para renderizar con KaTeX. */
  latex: string;
  /** Etiqueta legible para la UI. */
  label: string;
}

/**
 * Sistema de coordenadas completo.
 * Cada sistema implementa el mapeo hacia cartesianas, los factores de escala
 * h_i, el jacobiano y las cadenas LaTeX para armar el diferencial de volumen.
 *
 * Convención de parámetros: (u, v, w) son las tres coordenadas en el orden
 * definido por `vars` (p. ej. esféricas: u=r, v=θ, w=φ).
 */
export interface CoordSystem {
  id: SystemId;
  /** Nombre legible para la UI ("Esféricas", "Cilíndricas", …). */
  label: string;
  /** Las tres variables en orden canónico (u, v, w). */
  vars: [VarSpec, VarSpec, VarSpec];

  /** Transforma (u,v,w) → (x,y,z) en cartesianas. */
  toCartesian(u: number, v: number, w: number): Vec3;

  /**
   * Factores de escala de Lamé: h_u, h_v, h_w.
   * Definen |∂r/∂u_i| de modo que dl_i = h_i du_i.
   */
  scaleFactors(u: number, v: number, w: number): Vec3;

  /**
   * Jacobiano de la transformación: J = h_u · h_v · h_w.
   * Se usa como medida del elemento de volumen: dV = J du dv dw.
   */
  jacobian(u: number, v: number, w: number): number;

  /**
   * Expresión LaTeX completa del elemento de volumen.
   * Ejemplo esférico: "r^2 \\sin\\theta\\, dr\\, d\\theta\\, d\\phi"
   */
  volumeElementLatex: string;

  /**
   * Factor diferencial de cada variable por separado, para armar el diferencial
   * término a término según qué variables están activas.
   * Ejemplo esférico: ["r^2\\sin\\theta\\,dr", "d\\theta", "d\\phi"]
   * Nota: el producto de los tres factores debe coincidir con volumeElementLatex.
   */
  jacobianFactorsLatex: [string, string, string];

  /**
   * true si el sistema es PLANAR (2D, en el plano z=0), como las polares.
   * En ese caso la tercera variable está "fuera de plano" y la UI la mantiene
   * congelada/oculta; el elemento máximo es un área (dA), no un volumen.
   */
  planar?: boolean;
}

// ---------------------------------------------------------------------------
// Región de integración
// ---------------------------------------------------------------------------

/**
 * Límite de una variable: constante numérica o expresión mathjs que puede
 * depender de variables externas (las que están más "adentro" en el orden
 * de integración).
 *
 * Ejemplos:
 *   lower: 0               → constante
 *   upper: "sqrt(1 - x^2)" → depende de x (variable externa ya integrada)
 */
export type Bound = number | string;

/** Par de límites (inferior, superior) para una variable. */
export interface VarBounds {
  lower: Bound;
  upper: Bound;
}

/**
 * Región de integración: sistema + orden de integración + límites.
 *
 * `order` contiene los índices de `vars` del sistema (0, 1, 2) en el orden
 * en que se integra: el primero es la variable "más interna" (primer barrido)
 * y el último es la "más externa".
 *
 * Ejemplo cilíndrico (∫dz ∫dφ ∫ρ dρ, orden interno→externo: ρ=0, φ=1, z=2):
 *   order: [0, 1, 2]
 *   bounds[0] = límites de ρ (pueden depender de nada)
 *   bounds[1] = límites de φ (pueden depender de ρ)
 *   bounds[2] = límites de z (pueden depender de ρ y φ)
 */
export interface Region {
  system: SystemId;
  /** Índices de las variables en el orden de integración (interno → externo). */
  order: [number, number, number];
  /** Límites en el mismo orden que `order`. */
  bounds: [VarBounds, VarBounds, VarBounds];
}

// ---------------------------------------------------------------------------
// Integrando
// ---------------------------------------------------------------------------

/**
 * Modo del integrando:
 * - 'geometric': integra 1 (solo mide volumen/área/longitud).
 * - 'scalar':    integra f(x,y,z) (campo escalar).
 * - 'vector':    integra F·dS o F·dl (campo vectorial; Fase 2).
 */
export type IntegrandMode = 'geometric' | 'scalar' | 'vector';

/**
 * Integrando de la integral.
 *
 * Las expresiones (`scalar`, `vector`) se escriben en mathjs y pueden usar
 * x, y, z (cartesianas) o los nombres de variable del sistema activo.
 * El parser de `parser.ts` se encarga de compilarlas.
 */
export interface Integrand {
  mode: IntegrandMode;
  /** Expresión mathjs del campo escalar f. Solo relevante si mode === 'scalar'. */
  scalar?: string;
  /**
   * Componentes [Fx, Fy, Fz] del campo vectorial F en mathjs.
   * Solo relevante si mode === 'vector' (Fase 2).
   */
  vector?: [string, string, string];
}

// ---------------------------------------------------------------------------
// Estado del barrido animado
// ---------------------------------------------------------------------------

/**
 * Estado del barrido diferencial: qué variables se están integrando (activas),
 * el valor de muestra de las congeladas, y el avance del barrido en cada variable.
 *
 * Índices: [0] ↔ primera variable del sistema, [1] ↔ segunda, [2] ↔ tercera.
 *
 * Geometría barrida según variables activas:
 *   0 activas → punto
 *   1 activa  → curva (dl)
 *   2 activas → parche de superficie (dS)
 *   3 activas → sólido (dV)
 */
export interface SweepState {
  /** Indica si cada variable está siendo integrada (true) o congelada (false). */
  active: [boolean, boolean, boolean];
  /**
   * Valor de muestra de cada variable congelada (ignorado si active[i] === true).
   * Se usa para posicionar el elemento diferencial en el visor.
   */
  frozen: [number, number, number];
  /**
   * Progreso del barrido por variable activa, en [0, 1].
   * 0 = inicio del límite inferior; 1 = límite superior alcanzado.
   * Las variables congeladas tienen progress ignorado (convencionalmente 0).
   */
  progress: [number, number, number];
}

// ---------------------------------------------------------------------------
// Estado global de la aplicación
// ---------------------------------------------------------------------------

/**
 * AppState — estado serializable y compartible por URL.
 * Captura todo lo necesario para reproducir una sesión exacta.
 */
export interface AppState {
  region: Region;
  integrand: Integrand;
  sweep: SweepState;
}
