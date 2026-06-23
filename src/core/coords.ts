/**
 * coords.ts — Sistemas de coordenadas de Parcella.
 *
 * Convenciones canónicas:
 *
 * CARTESIANAS  vars [x, y, z]
 *   h = [1, 1, 1],  J = 1
 *   dV = dx dy dz
 *
 * CILÍNDRICAS  vars [ρ, φ, z],  ρ≥0, φ∈[0,2π)
 *   x = ρ cosφ,  y = ρ sinφ,  z = z
 *   h = [1, ρ, 1],  J = ρ
 *   dV = ρ dρ dφ dz
 *
 * ESFÉRICAS  vars [r, θ, φ]
 *   θ AZIMUTAL ∈[0,2π),  φ POLAR (desde +z) ∈[0,π]
 *   x = r sinφ cosθ,  y = r sinφ sinθ,  z = r cosφ
 *   h = [1, r sinφ, r],  J = r² sinφ
 *   dV = r² sinφ dr dθ dφ
 *
 * Nota sobre jacobianFactorsLatex:
 *   Cada elemento es el arco físico h_i · d(var_i).
 *   Su producto da volumeElementLatex.
 */

import { compile } from 'mathjs';
import type { CoordSystem, SystemId, Vec3 } from './types.js';

// ---------------------------------------------------------------------------
// CARTESIANAS
// ---------------------------------------------------------------------------

export const CARTESIAN: CoordSystem = {
  id: 'cartesian',
  label: 'Cartesianas',

  vars: [
    { name: 'x', latex: 'x', label: 'X' },
    { name: 'y', latex: 'y', label: 'Y' },
    { name: 'z', latex: 'z', label: 'Z' },
  ],

  toCartesian(u: number, v: number, w: number): Vec3 {
    return [u, v, w];
  },

  scaleFactors(_u: number, _v: number, _w: number): Vec3 {
    return [1, 1, 1];
  },

  jacobian(_u: number, _v: number, _w: number): number {
    return 1;
  },

  volumeElementLatex: 'dx\\,dy\\,dz',

  jacobianFactorsLatex: ['dx', 'dy', 'dz'],
};

// ---------------------------------------------------------------------------
// POLARES (2D)
// ---------------------------------------------------------------------------

export const POLAR: CoordSystem = {
  id: 'polar',
  label: 'Polares',
  planar: true,

  vars: [
    { name: 'r',   latex: 'r',      label: 'Radio' },
    { name: 'phi', latex: '\\phi',  label: 'Azimut' },
    { name: 'z',   latex: 'z',      label: 'Fuera de plano' },
  ],

  // u=r, v=φ, w=z   (igual que cilíndricas; z por compatibilidad con el motor de 3 vars)
  toCartesian(r: number, phi: number, z: number): Vec3 {
    return [r * Math.cos(phi), r * Math.sin(phi), z];
  },

  scaleFactors(r: number, _phi: number, _z: number): Vec3 {
    return [1, r, 1];
  },

  jacobian(r: number, _phi: number, _z: number): number {
    return r;
  },

  // Elemento de ÁREA (sistema planar; no hay volumen)
  volumeElementLatex: 'r\\,dr\\,d\\phi',

  jacobianFactorsLatex: ['dr', 'r\\,d\\phi', 'dz'],
};

// ---------------------------------------------------------------------------
// CILÍNDRICAS
// ---------------------------------------------------------------------------

export const CYLINDRICAL: CoordSystem = {
  id: 'cylindrical',
  label: 'Cilíndricas',

  vars: [
    { name: 'rho', latex: '\\rho', label: 'Radio' },
    { name: 'phi', latex: '\\phi', label: 'Azimut' },
    { name: 'z',   latex: 'z',    label: 'Altura' },
  ],

  // u=ρ, v=φ, w=z
  toCartesian(rho: number, phi: number, z: number): Vec3 {
    return [rho * Math.cos(phi), rho * Math.sin(phi), z];
  },

  scaleFactors(rho: number, _phi: number, _z: number): Vec3 {
    return [1, rho, 1];
  },

  jacobian(rho: number, _phi: number, _z: number): number {
    return rho;
  },

  volumeElementLatex: '\\rho\\,d\\rho\\,d\\phi\\,dz',

  jacobianFactorsLatex: ['d\\rho', '\\rho\\,d\\phi', 'dz'],
};

// ---------------------------------------------------------------------------
// ESFÉRICAS
// ---------------------------------------------------------------------------

export const SPHERICAL: CoordSystem = {
  id: 'spherical',
  label: 'Esféricas',

  vars: [
    { name: 'r',     latex: 'r',       label: 'Radio' },
    { name: 'theta', latex: '\\theta', label: 'Azimut' },
    { name: 'phi',   latex: '\\phi',   label: 'Polar (cenital)' },
  ],

  // u=r, v=θ (azimutal), w=φ (polar desde +z)
  toCartesian(r: number, theta: number, phi: number): Vec3 {
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ];
  },

  scaleFactors(r: number, _theta: number, phi: number): Vec3 {
    return [1, r * Math.sin(phi), r];
  },

  jacobian(r: number, _theta: number, phi: number): number {
    return r * r * Math.sin(phi);
  },

  volumeElementLatex: 'r^2\\sin\\phi\\,dr\\,d\\theta\\,d\\phi',

  jacobianFactorsLatex: ['dr', 'r\\sin\\phi\\,d\\theta', 'r\\,d\\phi'],
};

// ---------------------------------------------------------------------------
// Mapa de sistemas
// ---------------------------------------------------------------------------

/**
 * Registro global de sistemas de coordenadas.
 * 'curvilinear' apunta a CARTESIAN como identidad por defecto;
 * se puede sobreescribir con makeCurvilinear (Fase 2).
 */
export const SYSTEMS: Record<SystemId, CoordSystem> = {
  cartesian:   CARTESIAN,
  polar:       POLAR,
  cylindrical: CYLINDRICAL,
  spherical:   SPHERICAL,
  curvilinear: CARTESIAN,  // identidad por defecto (Fase 2: reemplazar con makeCurvilinear)
};

/** Devuelve el CoordSystem asociado a un SystemId. */
export function getSystem(id: SystemId): CoordSystem {
  return SYSTEMS[id];
}

// ---------------------------------------------------------------------------
// Fase 2 — makeCurvilinear
// ---------------------------------------------------------------------------

/**
 * Opciones para construir un sistema curvilíneo genérico.
 * Las expresiones x/y/z son strings evaluables por mathjs con variables u, v, w.
 *
 * @phase2 Esta factory es Fase 2. En Fase 1 sólo se usan los tres sistemas canónicos.
 */
export interface CurvilinearOpts {
  id?: SystemId;
  label?: string;
  /** Expresión mathjs para x(u,v,w). */
  xExpr: string;
  /** Expresión mathjs para y(u,v,w). */
  yExpr: string;
  /** Expresión mathjs para z(u,v,w). */
  zExpr: string;
  /** Especificaciones de las tres variables [u, v, w]. Opcional. */
  vars?: CoordSystem['vars'];
}

/**
 * Construye un CoordSystem curvilíneo genérico a partir de expresiones mathjs
 * para el mapeo (u,v,w) → (x,y,z).
 *
 * Los factores de escala de Lamé se calculan por DIFERENCIAS FINITAS numéricas:
 *   h_i ≈ |r(u_i + ε) − r(u_i − ε)| / (2ε)
 *
 * El jacobiano se obtiene como J = h_u · h_v · h_w.
 *
 * Limitaciones (Fase 2):
 *  - Las cadenas LaTeX son genéricas (h_u du, h_v dv, h_w dw).
 *  - La precisión de las diferencias finitas depende de ε = 1e-6.
 *
 * @phase2
 */
export function makeCurvilinear(opts: CurvilinearOpts): CoordSystem {
  const EPS = 1e-6;

  const exprX = compile(opts.xExpr);
  const exprY = compile(opts.yExpr);
  const exprZ = compile(opts.zExpr);

  function evalAt(u: number, v: number, w: number): Vec3 {
    const scope = { u, v, w };
    return [
      exprX.evaluate(scope) as number,
      exprY.evaluate(scope) as number,
      exprZ.evaluate(scope) as number,
    ];
  }

  function norm3(a: Vec3, b: Vec3, denom: number): number {
    return Math.sqrt(
      ((a[0] - b[0]) / denom) ** 2 +
      ((a[1] - b[1]) / denom) ** 2 +
      ((a[2] - b[2]) / denom) ** 2,
    );
  }

  function scaleFactors(u: number, v: number, w: number): Vec3 {
    const hu = norm3(evalAt(u + EPS, v, w), evalAt(u - EPS, v, w), 2 * EPS);
    const hv = norm3(evalAt(u, v + EPS, w), evalAt(u, v - EPS, w), 2 * EPS);
    const hw = norm3(evalAt(u, v, w + EPS), evalAt(u, v, w - EPS), 2 * EPS);
    return [hu, hv, hw];
  }

  const defaultVars: CoordSystem['vars'] = [
    { name: 'u', latex: 'u', label: 'U' },
    { name: 'v', latex: 'v', label: 'V' },
    { name: 'w', latex: 'w', label: 'W' },
  ];

  return {
    id: opts.id ?? 'curvilinear',
    label: opts.label ?? 'Curvilíneo',
    vars: opts.vars ?? defaultVars,

    toCartesian: evalAt,

    scaleFactors,

    jacobian(u: number, v: number, w: number): number {
      const [hu, hv, hw] = scaleFactors(u, v, w);
      return hu * hv * hw;
    },

    volumeElementLatex: 'h_u\\,h_v\\,h_w\\,du\\,dv\\,dw',

    jacobianFactorsLatex: ['h_u\\,du', 'h_v\\,dv', 'h_w\\,dw'],
  };
}
