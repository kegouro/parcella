/**
 * region.test.ts — Tests de evalLimits y sampleRegion.
 *
 * Convenciones:
 *   Cilíndricas: vars [ρ, φ, z] índices [0,1,2].
 *   Esféricas:   vars [r, θ, φ] índices [0,1,2].
 *                θ azimutal ∈ [0,2π), φ polar ∈ [0,π] desde +z.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evalLimits, sampleRegion, type CoordSystemLike } from '../region.js';
import { clearCache } from '../parser.js';
import type { Region } from '../types.js';

beforeEach(() => {
  clearCache();
});

// ---------------------------------------------------------------------------
// Sistemas de coordenadas de prueba
// ---------------------------------------------------------------------------

/** Sistema cilíndrico mínimo para tests. vars: [ρ=0, φ=1, z=2] */
const cylindricalSystem: CoordSystemLike = {
  vars: [
    { name: 'rho' },
    { name: 'phi' },
    { name: 'z' },
  ],
  toCartesian(rho: number, phi: number, z: number): [number, number, number] {
    return [rho * Math.cos(phi), rho * Math.sin(phi), z];
  },
};

/** Sistema esférico mínimo para tests. vars: [r=0, theta=1, phi=2] */
const sphericalSystem: CoordSystemLike = {
  vars: [
    { name: 'r' },
    { name: 'theta' },
    { name: 'phi' },
  ],
  toCartesian(r: number, theta: number, phi: number): [number, number, number] {
    // theta azimutal, phi polar desde +z
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ];
  },
};

/** Sistema cartesiano mínimo para tests. vars: [x=0, y=1, z=2] */
const cartesianSystem: CoordSystemLike = {
  vars: [
    { name: 'x' },
    { name: 'y' },
    { name: 'z' },
  ],
  toCartesian(x: number, y: number, z: number): [number, number, number] {
    return [x, y, z];
  },
};

// ---------------------------------------------------------------------------
// evalLimits — límites constantes
// ---------------------------------------------------------------------------

describe('evalLimits — límites constantes', () => {
  const region: Region = {
    system: 'cylindrical',
    order: [0, 1, 2],
    bounds: [
      { lower: 0, upper: 1 },        // ρ ∈ [0,1]
      { lower: 0, upper: '2 * pi' }, // φ ∈ [0,2π]
      { lower: -1, upper: 1 },       // z ∈ [-1,1]
    ],
  };

  it('evalúa límites del nivel 0 (ρ) sin variables externas', () => {
    const { lower, upper } = evalLimits(region, cylindricalSystem, 0, {});
    expect(lower).toBe(0);
    expect(upper).toBe(1);
  });

  it('evalúa límites del nivel 1 (φ) con expresión "2*pi"', () => {
    const { lower, upper } = evalLimits(region, cylindricalSystem, 1, { rho: 0.5 });
    expect(lower).toBeCloseTo(0);
    expect(upper).toBeCloseTo(2 * Math.PI, 10);
  });

  it('evalúa límites del nivel 2 (z) constantes', () => {
    const { lower, upper } = evalLimits(region, cylindricalSystem, 2, { rho: 0.5, phi: 1 });
    expect(lower).toBe(-1);
    expect(upper).toBe(1);
  });

  it('lanza Error para level inválido', () => {
    expect(() => evalLimits(region, cylindricalSystem, 3 as 2, {})).toThrow();
    expect(() => evalLimits(region, cylindricalSystem, -1 as 0, {})).toThrow();
  });
});

// ---------------------------------------------------------------------------
// evalLimits — límites dependientes (cono invertido)
// ---------------------------------------------------------------------------

describe('evalLimits — límites dependientes', () => {
  /**
   * Cono: order [2,1,0] → z más independiente, luego φ, luego ρ.
   * z ∈ [0,2], φ ∈ [0,2π], ρ ∈ [0, z*1] (tan(45°)=1)
   */
  const cone: Region = {
    system: 'cylindrical',
    order: [2, 1, 0],
    bounds: [
      { lower: 0, upper: 2 },        // bounds[0] → order[0]=z  → z ∈ [0,2]
      { lower: 0, upper: '2 * pi' }, // bounds[1] → order[1]=φ
      { lower: 0, upper: 'z * 1' },  // bounds[2] → order[2]=ρ → depende de z
    ],
  };

  it('evalúa nivel 0 (z) sin variables externas', () => {
    const { lower, upper } = evalLimits(cone, cylindricalSystem, 0, {});
    expect(lower).toBe(0);
    expect(upper).toBe(2);
  });

  it('evalúa nivel 1 (φ) con z ya fijada', () => {
    const { lower, upper } = evalLimits(cone, cylindricalSystem, 1, { z: 1.5 });
    expect(lower).toBeCloseTo(0);
    expect(upper).toBeCloseTo(2 * Math.PI, 10);
  });

  it('evalúa nivel 2 (ρ) que depende de z', () => {
    // ρ_max = z * 1
    const { lower, upper } = evalLimits(cone, cylindricalSystem, 2, { z: 1.5, phi: 0 });
    expect(lower).toBe(0);
    expect(upper).toBeCloseTo(1.5, 10);
  });

  it('ρ_max = 0 cuando z = 0 (vértice del cono)', () => {
    const { lower, upper } = evalLimits(cone, cylindricalSystem, 2, { z: 0, phi: 0 });
    expect(lower).toBe(0);
    expect(upper).toBeCloseTo(0, 10);
  });

  it('ρ_max = 2 cuando z = 2 (base del cono)', () => {
    const { lower, upper } = evalLimits(cone, cylindricalSystem, 2, { z: 2, phi: 0 });
    expect(lower).toBe(0);
    expect(upper).toBeCloseTo(2, 10);
  });
});

// ---------------------------------------------------------------------------
// evalLimits — límites dependientes (paraboloide)
// ---------------------------------------------------------------------------

describe('evalLimits — paraboloide (z depende de ρ)', () => {
  const paraboloid: Region = {
    system: 'cylindrical',
    order: [0, 1, 2],
    bounds: [
      { lower: 0, upper: 1 },           // ρ
      { lower: 0, upper: '2 * pi' },    // φ
      { lower: 0, upper: 'rho^2' },     // z = ρ²
    ],
  };

  it('z_max = ρ² evaluado correctamente', () => {
    const { lower, upper } = evalLimits(paraboloid, cylindricalSystem, 2, { rho: 0.5, phi: 0 });
    expect(lower).toBe(0);
    expect(upper).toBeCloseTo(0.25, 10);
  });

  it('z_max = 1 cuando ρ = 1', () => {
    const { lower, upper } = evalLimits(paraboloid, cylindricalSystem, 2, { rho: 1, phi: 0 });
    expect(lower).toBe(0);
    expect(upper).toBeCloseTo(1, 10);
  });
});

// ---------------------------------------------------------------------------
// sampleRegion — cilindro (t=[0,0,0] → lower corner, t=[1,1,1] → upper corner)
// ---------------------------------------------------------------------------

describe('sampleRegion — cilindro', () => {
  const cylinder: Region = {
    system: 'cylindrical',
    order: [0, 1, 2],
    bounds: [
      { lower: 0, upper: 1 },
      { lower: 0, upper: '2 * pi' },
      { lower: 0, upper: 2 },
    ],
  };

  it('t=[0,0,0] da el lower corner (ρ=0, φ=0, z=0) → origen cartesiano', () => {
    const { coords, cartesian } = sampleRegion(cylinder, cylindricalSystem, [0, 0, 0]);
    expect(coords[0]).toBeCloseTo(0); // ρ
    expect(coords[1]).toBeCloseTo(0); // φ
    expect(coords[2]).toBeCloseTo(0); // z
    expect(cartesian[0]).toBeCloseTo(0); // x = ρcosφ = 0
    expect(cartesian[1]).toBeCloseTo(0); // y = ρsinφ = 0
    expect(cartesian[2]).toBeCloseTo(0); // z = 0
  });

  it('t=[1,1,1] da el upper corner (ρ=1, φ=2π, z=2)', () => {
    const { coords, cartesian } = sampleRegion(cylinder, cylindricalSystem, [1, 1, 1]);
    expect(coords[0]).toBeCloseTo(1);       // ρ
    expect(coords[1]).toBeCloseTo(2 * Math.PI); // φ = 2π
    expect(coords[2]).toBeCloseTo(2);       // z
    // φ=2π → cosφ=1, sinφ≈0
    expect(cartesian[0]).toBeCloseTo(1, 8); // x = ρcosφ = 1
    expect(cartesian[1]).toBeCloseTo(0, 8); // y = ρsinφ ≈ 0
    expect(cartesian[2]).toBeCloseTo(2);    // z
  });

  it('t=[0.5,0.5,0.5] da el punto medio', () => {
    const { coords } = sampleRegion(cylinder, cylindricalSystem, [0.5, 0.5, 0.5]);
    expect(coords[0]).toBeCloseTo(0.5);       // ρ = 0.5
    expect(coords[1]).toBeCloseTo(Math.PI);   // φ = π
    expect(coords[2]).toBeCloseTo(1);         // z = 1
  });
});

// ---------------------------------------------------------------------------
// sampleRegion — esféricas (convención θ azimutal, φ polar)
// ---------------------------------------------------------------------------

describe('sampleRegion — bola sólida (esféricas)', () => {
  const solidSphere: Region = {
    system: 'spherical',
    order: [0, 1, 2],
    bounds: [
      { lower: 0, upper: 1 },
      { lower: 0, upper: '2 * pi' },
      { lower: 0, upper: 'pi' },
    ],
  };

  it('t=[0,0,0] → (r=0, θ=0, φ=0) → origen cartesiano', () => {
    const { coords, cartesian } = sampleRegion(solidSphere, sphericalSystem, [0, 0, 0]);
    expect(coords[0]).toBeCloseTo(0); // r
    expect(coords[1]).toBeCloseTo(0); // θ
    expect(coords[2]).toBeCloseTo(0); // φ
    // r=0 → x=y=z=0 independientemente de ángulos
    expect(cartesian[0]).toBeCloseTo(0);
    expect(cartesian[1]).toBeCloseTo(0);
    expect(cartesian[2]).toBeCloseTo(0);
  });

  it('t=[1,0,0.5] → r=1, θ=0, φ=π/2 → polo ecuatorial (+x)', () => {
    const { coords, cartesian } = sampleRegion(solidSphere, sphericalSystem, [1, 0, 0.5]);
    expect(coords[0]).toBeCloseTo(1);            // r = 1
    expect(coords[1]).toBeCloseTo(0);            // θ = 0
    expect(coords[2]).toBeCloseTo(Math.PI / 2);  // φ = π/2
    // x = r sinφ cosθ = 1 * 1 * 1 = 1
    expect(cartesian[0]).toBeCloseTo(1, 8);
    expect(cartesian[1]).toBeCloseTo(0, 8);
    expect(cartesian[2]).toBeCloseTo(0, 8);
  });

  it('t=[1,0,0] → r=1, θ=0, φ=0 → polo norte (+z)', () => {
    const { cartesian } = sampleRegion(solidSphere, sphericalSystem, [1, 0, 0]);
    // z = r cosφ = 1*cos(0) = 1
    expect(cartesian[2]).toBeCloseTo(1, 8);
    expect(cartesian[0]).toBeCloseTo(0, 8);
    expect(cartesian[1]).toBeCloseTo(0, 8);
  });

  it('t=[1,0,1] → r=1, θ=0, φ=π → polo sur (-z)', () => {
    const { cartesian } = sampleRegion(solidSphere, sphericalSystem, [1, 0, 1]);
    // z = r cosφ = 1*cos(π) = -1
    expect(cartesian[2]).toBeCloseTo(-1, 8);
    expect(cartesian[0]).toBeCloseTo(0, 8);
    expect(cartesian[1]).toBeCloseTo(0, 8);
  });
});

// ---------------------------------------------------------------------------
// sampleRegion — cono (order no canónico, límites dependientes)
// ---------------------------------------------------------------------------

describe('sampleRegion — cono (order [2,1,0])', () => {
  /**
   * order=[2,1,0]: order[0]=z (más independ.), order[1]=φ, order[2]=ρ (más depend.)
   * bounds[0] → z ∈ [0,2]
   * bounds[1] → φ ∈ [0,2π]
   * bounds[2] → ρ ∈ [0, z*1]  depende de z
   */
  const cone: Region = {
    system: 'cylindrical',
    order: [2, 1, 0],
    bounds: [
      { lower: 0, upper: 2 },        // bounds[0] → order[0]=z → z ∈ [0,2]
      { lower: 0, upper: '2 * pi' }, // bounds[1] → order[1]=φ
      { lower: 0, upper: 'z * 1' },  // bounds[2] → order[2]=ρ → depende de z
    ],
  };

  it('t=[0,0,0] → z=0, φ=0, ρ=0 → origen', () => {
    const { coords, cartesian } = sampleRegion(cone, cylindricalSystem, [0, 0, 0]);
    // level 0: z = 0+(2-0)*0 = 0
    // level 1: φ = 0+(2π-0)*0 = 0
    // level 2: ρ = 0+(z*1-0)*0 = 0  (z=0 → ρ_max=0, t[2]=0 → ρ=0)
    expect(coords[2]).toBeCloseTo(0); // z
    expect(coords[1]).toBeCloseTo(0); // φ
    expect(coords[0]).toBeCloseTo(0); // ρ
    expect(cartesian[0]).toBeCloseTo(0);
    expect(cartesian[1]).toBeCloseTo(0);
    expect(cartesian[2]).toBeCloseTo(0);
  });

  it('t=[1,0,1] → z=2, φ=0, ρ=z*1=2 → base del cono en +x', () => {
    const { coords, cartesian } = sampleRegion(cone, cylindricalSystem, [1, 0, 1]);
    // level 0: z = 0+(2-0)*1 = 2
    // level 1: φ = 0+(2π-0)*0 = 0
    // level 2: ρ = 0+(z*1-0)*1 = 2  (z=2 → ρ_max=2, t[2]=1)
    expect(coords[2]).toBeCloseTo(2); // z
    expect(coords[1]).toBeCloseTo(0); // φ
    expect(coords[0]).toBeCloseTo(2); // ρ
    // x = ρcosφ = 2*cos(0) = 2
    expect(cartesian[0]).toBeCloseTo(2, 8);
    expect(cartesian[1]).toBeCloseTo(0, 8);
    expect(cartesian[2]).toBeCloseTo(2, 8);
  });
});

// ---------------------------------------------------------------------------
// sampleRegion — cartesiano (caja)
// ---------------------------------------------------------------------------

describe('sampleRegion — caja cartesiana', () => {
  const box: Region = {
    system: 'cartesian',
    order: [0, 1, 2],
    bounds: [
      { lower: 0, upper: 1 },
      { lower: 0, upper: 1 },
      { lower: 0, upper: 1 },
    ],
  };

  it('t=[0,0,0] → (0,0,0)', () => {
    const { cartesian } = sampleRegion(box, cartesianSystem, [0, 0, 0]);
    expect(cartesian).toEqual([0, 0, 0]);
  });

  it('t=[1,1,1] → (1,1,1)', () => {
    const { cartesian } = sampleRegion(box, cartesianSystem, [1, 1, 1]);
    expect(cartesian[0]).toBeCloseTo(1);
    expect(cartesian[1]).toBeCloseTo(1);
    expect(cartesian[2]).toBeCloseTo(1);
  });

  it('t=[0.5,0.5,0.5] → (0.5,0.5,0.5)', () => {
    const { cartesian } = sampleRegion(box, cartesianSystem, [0.5, 0.5, 0.5]);
    expect(cartesian[0]).toBeCloseTo(0.5);
    expect(cartesian[1]).toBeCloseTo(0.5);
    expect(cartesian[2]).toBeCloseTo(0.5);
  });
});
