/**
 * derivation.ts — Lecciones de derivación geométrica del elemento diferencial.
 *
 * Cada lección tiene DOS fases:
 *   1. "solo"    — cada diferencial por separado: cómo se mueve el punto al variar
 *                  una sola coordenada (el arco/segmento que traza, en su color).
 *   2. "combina" — se construye el elemento sumando un eje a la vez (acumulativo):
 *                  punto/segmento → superficie → sólido.
 *
 * Módulo PURO (sin DOM, sin Three.js). La longitud de cada arista se toma de
 * jacobianFactorsLatex (fuente única de verdad, verificada con SymPy).
 */

import { getSystem } from './coords.js';
import type { SystemId } from './types.js';

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface DerivStep {
  index: number;
  /** Fase de la lección. */
  phase: 'solo' | 'combina';
  /** Título corto del paso. */
  title: string;
  /** Explicación geométrica en español (1–2 frases). */
  narration: string;
  /** Tipo de elemento geométrico resultante. */
  symbol: 'point' | 'dl' | 'dS' | 'dA' | 'dV';
  /** Longitud de la NUEVA arista de este paso (= jacobianFactorsLatex[sweepVar]). */
  lengthLatex: string;
  /** Producto acumulado de longitudes hasta este paso (sin color). */
  partialLatex: string;
  /** Qué variables están "presentes" en este paso, orden canónico [0,1,2]. */
  activeVars: [boolean, boolean, boolean];
  /** Índice canónico de la variable que se barre/muestra en este paso. */
  sweepVar: number | null;
  /**
   * Índices canónicos cuyas longitudes forman el producto de este paso, en orden.
   * La UI los usa para colorear cada factor con varColor(idx).
   */
  includedVars: number[];
}

export interface Lesson {
  system: SystemId;
  label: string;
  /** Orden canónico de variables a barrer (planar: solo 2 índices). */
  buildOrder: number[];
  /** Pasos: fase "solo" (uno por variable) + fase "combina" (acumulativos). */
  steps: DerivStep[];
  /** Expresión LaTeX completa del elemento final. */
  finalLatex: string;
}

// ---------------------------------------------------------------------------
// Narración — fase "solo" (el diferencial individual)
// ---------------------------------------------------------------------------

interface VarMeta {
  title: string;
  narration: string;
}

const SOLO_META: Record<string, VarMeta> = {
  'cartesian:0': { title: 'Diferencial de x', narration: 'Al variar solo x, el punto se desliza en línea recta a lo largo del eje x una distancia dx. Es el diferencial de longitud en x.' },
  'cartesian:1': { title: 'Diferencial de y', narration: 'Al variar solo y, el punto se desliza en línea recta a lo largo del eje y una distancia dy.' },
  'cartesian:2': { title: 'Diferencial de z', narration: 'Al variar solo z, el punto se desliza en línea recta a lo largo del eje z una distancia dz.' },

  'polar:0': { title: 'Diferencial radial dr', narration: 'Al variar solo r, el punto se aleja del origen en línea recta una distancia dr (dirección radial).' },
  'polar:1': { title: 'Diferencial azimutal r dφ', narration: 'Al variar solo φ (radio r fijo), el punto recorre un arco de longitud r·dφ sobre la circunferencia de radio r.' },

  'cylindrical:0': { title: 'Diferencial radial dρ', narration: 'Al variar solo ρ, el punto se aleja del eje z en línea recta una distancia dρ.' },
  'cylindrical:1': { title: 'Diferencial azimutal ρ dφ', narration: 'Al variar solo φ (radio ρ fijo), el punto recorre un arco de longitud ρ·dφ sobre la circunferencia.' },
  'cylindrical:2': { title: 'Diferencial de altura dz', narration: 'Al variar solo z, el punto sube en línea recta paralelo al eje z una distancia dz.' },

  'spherical:0': { title: 'Diferencial radial dr', narration: 'Al variar solo r, el punto se aleja del origen en línea recta una distancia dr (dirección radial).' },
  'spherical:1': { title: 'Diferencial polar r dθ', narration: 'Al variar solo θ (radio r fijo), el punto recorre un arco de longitud r·dθ a lo largo del meridiano (de polo a polo).' },
  'spherical:2': { title: 'Diferencial azimutal r sinθ dφ', narration: 'Al variar solo φ (r y θ fijos), el punto recorre un arco de longitud r·sinθ·dφ sobre el paralelo (círculo horizontal).' },
};

// ---------------------------------------------------------------------------
// Narración — fase "combina" (sumar un eje a la vez)
// ---------------------------------------------------------------------------

const COMBINA_META: Record<string, VarMeta> = {
  'cartesian:0': { title: 'Sumamos x', narration: 'Arrastramos el punto a lo largo de dx: nace un segmento de longitud dx.' },
  'cartesian:1': { title: 'Sumamos y', narration: 'Arrastramos el segmento a lo largo de dy: forma un rectángulo dx × dy (elemento de área).' },
  'cartesian:2': { title: 'Sumamos z', narration: 'Arrastramos el rectángulo a lo largo de dz: forma el paralelepípedo dx × dy × dz (elemento de volumen).' },

  'polar:0': { title: 'Sumamos r', narration: 'Arrastramos el punto a lo largo de dr: nace un segmento radial de longitud dr.' },
  'polar:1': { title: 'Sumamos φ', narration: 'Arrastramos el segmento a lo largo del arco r·dφ: barre el elemento de área dA = r·dr·dφ.' },

  'cylindrical:0': { title: 'Sumamos ρ', narration: 'Arrastramos el punto a lo largo de dρ: nace un segmento radial de longitud dρ.' },
  'cylindrical:1': { title: 'Sumamos φ', narration: 'Arrastramos el segmento a lo largo del arco ρ·dφ: forma un parche de superficie curvo.' },
  'cylindrical:2': { title: 'Sumamos z', narration: 'Arrastramos el parche a lo largo de dz: forma el elemento de volumen ρ·dρ·dφ·dz.' },

  'spherical:0': { title: 'Sumamos r', narration: 'Arrastramos el punto a lo largo de dr: nace un segmento radial de longitud dr.' },
  'spherical:1': { title: 'Sumamos θ', narration: 'Arrastramos el segmento a lo largo del arco r·dθ (meridiano): forma una franja de superficie.' },
  'spherical:2': { title: 'Sumamos φ', narration: 'Arrastramos la franja a lo largo del arco r·sinθ·dφ (paralelo): cierra el elemento de volumen r²·sinθ·dr·dθ·dφ.' },
};

// ---------------------------------------------------------------------------
// Sistemas disponibles para lecciones (excluye 'curvilinear')
// ---------------------------------------------------------------------------

const LESSON_SYSTEMS: SystemId[] = ['cartesian', 'polar', 'cylindrical', 'spherical'];

// ---------------------------------------------------------------------------
// buildLesson
// ---------------------------------------------------------------------------

export function buildLesson(systemId: SystemId): Lesson {
  const system = getSystem(systemId);
  const isPlanar = system.planar === true;
  const buildOrder: number[] = isPlanar ? [0, 1] : [0, 1, 2];

  const steps: DerivStep[] = [];
  let idx = 0;

  // ── Fase 1: "solo" — cada diferencial por separado ───────────────────────
  for (const v of buildOrder) {
    const meta = SOLO_META[`${systemId}:${v}`];
    const lengthLatex = system.jacobianFactorsLatex[v];
    const active: [boolean, boolean, boolean] = [false, false, false];
    active[v] = true;
    steps.push({
      index: idx++,
      phase: 'solo',
      title: meta?.title ?? `Diferencial de ${system.vars[v].label}`,
      narration: meta?.narration ?? `Al variar solo ${system.vars[v].label}, el punto traza una arista de longitud ${lengthLatex}.`,
      symbol: 'dl',
      lengthLatex,
      partialLatex: lengthLatex,
      activeVars: active,
      sweepVar: v,
      includedVars: [v],
    });
  }

  // ── Fase 2: "combina" — sumar un eje a la vez ────────────────────────────
  const accumulated: string[] = [];
  const included: number[] = [];
  const active: [boolean, boolean, boolean] = [false, false, false];

  for (let k = 0; k < buildOrder.length; k++) {
    const v = buildOrder[k];
    const meta = COMBINA_META[`${systemId}:${v}`];
    const lengthLatex = system.jacobianFactorsLatex[v];
    accumulated.push(lengthLatex);
    included.push(v);
    active[v] = true;

    const count = accumulated.length;
    let symbol: DerivStep['symbol'];
    if (count === 1) symbol = 'dl';
    else if (count === 2) symbol = isPlanar ? 'dA' : 'dS';
    else symbol = 'dV';

    steps.push({
      index: idx++,
      phase: 'combina',
      title: meta?.title ?? `Sumamos ${system.vars[v].label}`,
      narration: meta?.narration ?? `Barremos ${system.vars[v].label}: el elemento sube de dimensión.`,
      symbol,
      lengthLatex,
      partialLatex: accumulated.join(' \\cdot '),
      activeVars: [active[0], active[1], active[2]],
      sweepVar: v,
      includedVars: included.slice(),
    });
  }

  const prefix = isPlanar ? 'dA' : 'dV';
  const finalLatex = `${prefix} = ${system.volumeElementLatex}`;

  return { system: systemId, label: system.label, buildOrder, steps, finalLatex };
}

// ---------------------------------------------------------------------------
// availableLessons
// ---------------------------------------------------------------------------

export function availableLessons(): { id: SystemId; label: string }[] {
  return LESSON_SYSTEMS.map((id) => ({ id, label: getSystem(id).label }));
}
