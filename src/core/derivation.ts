/**
 * derivation.ts — Lecciones de derivación geométrica del elemento diferencial.
 *
 * Genera lecciones paso a paso (punto → dl → dS/dA → dV) para los sistemas
 * de coordenadas canónicos de Parcella. Módulo PURO (sin DOM, sin Three.js).
 *
 * La longitud de cada arista se toma de jacobianFactorsLatex (fuente única de
 * verdad, verificada con SymPy). La narración explica la geometría de cada barrido.
 */

import { getSystem } from './coords.js';
import type { SystemId } from './types.js';

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface DerivStep {
  /** 0 = punto de partida. */
  index: number;
  /** Título corto del paso, p.ej. "Barre el azimut θ". */
  title: string;
  /** Explicación geométrica en español (1–2 frases). */
  narration: string;
  /** Tipo de elemento geométrico resultante. */
  symbol: 'point' | 'dl' | 'dS' | 'dA' | 'dV';
  /**
   * Longitud de la NUEVA arista añadida en este paso
   * (= jacobianFactorsLatex[sweepVar]).
   * Vacío en el paso 0 (punto).
   */
  lengthLatex: string;
  /**
   * Producto acumulado de longitudes hasta este paso.
   * Vacío en el paso 0.
   * Ejemplo: "dr \\cdot r\\sin\\phi\\,d\\theta"
   */
  partialLatex: string;
  /** Qué variables ya fueron barridas en orden canónico [0,1,2]. */
  activeVars: [boolean, boolean, boolean];
  /** Índice canónico de la variable que se barre en este paso; null en el paso 0. */
  sweepVar: number | null;
}

export interface Lesson {
  system: SystemId;
  /** Nombre legible del sistema, p.ej. "Esféricas". */
  label: string;
  /** Orden canónico de variables a barrer (planar: solo 2 índices). */
  buildOrder: number[];
  /** Pasos de la lección: 1 (punto) + n (uno por variable barrida). */
  steps: DerivStep[];
  /** Expresión LaTeX completa del elemento final, p.ej. "dV = r^2\\sin\\phi\\,dr\\,d\\theta\\,d\\phi". */
  finalLatex: string;
}

// ---------------------------------------------------------------------------
// Metadatos de narración geométrica por (sistema, variable canónica)
// ---------------------------------------------------------------------------

interface VarMeta {
  title: string;
  narration: string;
}

/** Tabla de metadatos narrativos: clave `${systemId}:${varIndex}`. */
const VAR_META: Record<string, VarMeta> = {
  // ── Cartesianas ──────────────────────────────────────────────────────────
  'cartesian:0': {
    title: 'Barre la coordenada x',
    narration:
      'Avanza una distancia infinitesimal dx en línea recta a lo largo del eje x. ' +
      'El punto se convierte en un segmento de longitud dx.',
  },
  'cartesian:1': {
    title: 'Barre la coordenada y',
    narration:
      'Avanza una distancia infinitesimal dy en línea recta a lo largo del eje y. ' +
      'El segmento anterior se extiende formando un rectángulo de lados dx × dy.',
  },
  'cartesian:2': {
    title: 'Barre la coordenada z',
    narration:
      'Avanza una distancia infinitesimal dz en línea recta a lo largo del eje z. ' +
      'El rectángulo se extiende en un paralelepípedo rectangular dx × dy × dz.',
  },

  // ── Polares (2D) ─────────────────────────────────────────────────────────
  'polar:0': {
    title: 'Barre el radio r',
    narration:
      'Aléjate del origen una distancia infinitesimal dr (desplazamiento radial, en línea recta). ' +
      'El punto se convierte en un segmento de longitud dr.',
  },
  'polar:1': {
    title: 'Barre el azimut φ',
    narration:
      'Gira un ángulo infinitesimal dφ manteniéndote a radio r: el punto recorre un arco de longitud r·dφ. ' +
      'El segmento radial barre un parche de área curvo.',
  },

  // ── Cilíndricas ──────────────────────────────────────────────────────────
  'cylindrical:0': {
    title: 'Barre el radio ρ',
    narration:
      'Aléjate del eje z una distancia infinitesimal dρ (desplazamiento radial, en línea recta). ' +
      'El punto se convierte en un segmento de longitud dρ.',
  },
  'cylindrical:1': {
    title: 'Barre el azimut φ',
    narration:
      'Gira un ángulo infinitesimal dφ a radio ρ: el punto recorre un arco de longitud ρ·dφ. ' +
      'El segmento radial barre una banda curva de la superficie cilíndrica.',
  },
  'cylindrical:2': {
    title: 'Barre la altura z',
    narration:
      'Avanza una distancia infinitesimal dz en línea recta paralela al eje z. ' +
      'El parche de superficie se extiende en un trozo de volumen cilíndrico.',
  },

  // ── Esféricas ────────────────────────────────────────────────────────────
  'spherical:0': {
    title: 'Barre el radio r',
    narration:
      'Aléjate del origen una distancia infinitesimal dr (desplazamiento radial, en línea recta). ' +
      'El punto se convierte en un segmento de longitud dr.',
  },
  'spherical:1': {
    title: 'Barre el azimut θ',
    narration:
      'Gira un ángulo infinitesimal dθ en el paralelo de radio r·sinφ: el punto recorre un arco de longitud r·sinφ·dθ. ' +
      'El segmento anterior barre una franja de la superficie esférica.',
  },
  'spherical:2': {
    title: 'Barre el ángulo polar φ',
    narration:
      'Gira un ángulo infinitesimal dφ en el meridiano de radio r: el punto recorre un arco de longitud r·dφ. ' +
      'La franja anterior se cierra formando el elemento de volumen esférico.',
  },
};

// ---------------------------------------------------------------------------
// Narración del paso 0 (punto de partida) por sistema
// ---------------------------------------------------------------------------

const STEP0_NARRATION: Record<string, string> = {
  cartesian:
    'Partimos de un punto fijo (x₀, y₀, z₀) en coordenadas cartesianas. ' +
    'Barreremos sucesivamente x, y y z para construir el elemento de volumen dV.',
  polar:
    'Partimos de un punto fijo (r₀, φ₀) en coordenadas polares en el plano. ' +
    'Barreremos r y φ para construir el elemento de área dA.',
  cylindrical:
    'Partimos de un punto fijo (ρ₀, φ₀, z₀) en coordenadas cilíndricas. ' +
    'Barreremos ρ, φ y z para construir el elemento de volumen dV.',
  spherical:
    'Partimos de un punto fijo (r₀, θ₀, φ₀) en coordenadas esféricas. ' +
    'Barreremos r, θ y φ para construir el elemento de volumen dV.',
};

// ---------------------------------------------------------------------------
// Sistemas disponibles para lecciones (excluye 'curvilinear')
// ---------------------------------------------------------------------------

const LESSON_SYSTEMS: SystemId[] = ['cartesian', 'polar', 'cylindrical', 'spherical'];

// ---------------------------------------------------------------------------
// buildLesson
// ---------------------------------------------------------------------------

/**
 * Genera la lección completa de derivación geométrica para un sistema dado.
 *
 * @param systemId  Identificador del sistema de coordenadas.
 * @returns         Lección con todos los pasos (punto + un paso por variable barrida).
 */
export function buildLesson(systemId: SystemId): Lesson {
  const system = getSystem(systemId);
  const isPlanar = system.planar === true;

  // Orden de barrido: para sistemas planos solo [0,1]; para 3D: [0,1,2]
  const buildOrder: number[] = isPlanar ? [0, 1] : [0, 1, 2];

  const steps: DerivStep[] = [];

  // ── Paso 0: punto de partida ─────────────────────────────────────────────
  steps.push({
    index: 0,
    title: 'Punto de partida',
    narration: STEP0_NARRATION[systemId] ?? `Partimos de un punto en el sistema ${system.label}.`,
    symbol: 'point',
    lengthLatex: '',
    partialLatex: '',
    activeVars: [false, false, false],
    sweepVar: null,
  });

  // ── Pasos de barrido ─────────────────────────────────────────────────────
  const accumulatedLengths: string[] = [];
  const activeVars: [boolean, boolean, boolean] = [false, false, false];

  for (let stepNum = 0; stepNum < buildOrder.length; stepNum++) {
    const varIdx = buildOrder[stepNum]; // índice canónico de la variable que se barre
    const metaKey = `${systemId}:${varIdx}`;
    const meta = VAR_META[metaKey];

    // Longitud de la nueva arista
    const lengthLatex = system.jacobianFactorsLatex[varIdx];

    // Acumular
    accumulatedLengths.push(lengthLatex);
    activeVars[varIdx] = true;

    // partialLatex: producto de las longitudes acumuladas
    const partialLatex = accumulatedLengths.join(' \\cdot ');

    // Symbol según nº de variables ya barridas
    const barridas = accumulatedLengths.length;
    let symbol: DerivStep['symbol'];
    if (barridas === 1) {
      symbol = 'dl';
    } else if (barridas === 2) {
      symbol = isPlanar ? 'dA' : 'dS';
    } else {
      symbol = 'dV';
    }

    steps.push({
      index: stepNum + 1,
      title: meta?.title ?? `Barre la variable ${system.vars[varIdx].label}`,
      narration:
        meta?.narration ??
        `Se barre la variable ${system.vars[varIdx].label} generando una arista de longitud ${lengthLatex}.`,
      symbol,
      lengthLatex,
      partialLatex,
      activeVars: [activeVars[0], activeVars[1], activeVars[2]],
      sweepVar: varIdx,
    });
  }

  // ── finalLatex ───────────────────────────────────────────────────────────
  const prefix = isPlanar ? 'dA' : 'dV';
  const finalLatex = `${prefix} = ${system.volumeElementLatex}`;

  return {
    system: systemId,
    label: system.label,
    buildOrder,
    steps,
    finalLatex,
  };
}

// ---------------------------------------------------------------------------
// availableLessons
// ---------------------------------------------------------------------------

/**
 * Devuelve la lista de sistemas para los que hay lección disponible.
 * Excluye 'curvilinear' (caso general sin metadatos narrativos).
 */
export function availableLessons(): { id: SystemId; label: string }[] {
  return LESSON_SYSTEMS.map((id) => ({
    id,
    label: getSystem(id).label,
  }));
}
