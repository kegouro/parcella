/**
 * integrate.test.ts — Tests de integración numérica.
 *
 * Tolerancia ~1e-2 para regla del punto medio con res=60.
 */

import { describe, it, expect } from 'vitest';
import { SPHERICAL, CYLINDRICAL } from '../coords.js';
import {
  integrateTotal,
  integratePartial,
  progressFraction,
  measureLabel,
} from '../integrate.js';
import type { Region, Integrand, SweepState } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RES = 60;

function allActive(progress: [number, number, number] = [1, 1, 1]): SweepState {
  return {
    active: [true, true, true],
    frozen: [0, 0, 0],
    progress,
  };
}

// ---------------------------------------------------------------------------
// 1. Volumen de la bola unitaria en esféricas
//    r∈[0,1], θ∈[0,2π], φ∈[0,π], vars canónicas: [r=0, θ=1, φ=2]
//    order [0,1,2]: nivel 0=r (más independiente), nivel 1=θ, nivel 2=φ
//    Valor esperado: 4π/3 ≈ 4.18879
// ---------------------------------------------------------------------------

const ballRegion: Region = {
  system: 'spherical',
  order: [0, 1, 2],
  bounds: [
    { lower: 0, upper: 1 },       // r ∈ [0,1]
    { lower: 0, upper: 6.28318 }, // θ ∈ [0,2π]
    { lower: 0, upper: 3.14159 }, // φ ∈ [0,π]
  ],
};

const geom: Integrand = { mode: 'geometric' };
const scalar1: Integrand = { mode: 'scalar', scalar: '1' };
const scalarR2: Integrand = { mode: 'scalar', scalar: 'x^2+y^2+z^2' };

describe('Volumen bola unitaria (esféricas, 3 activas)', () => {
  const sweep = allActive();

  it('geometric → 4π/3', () => {
    const result = integrateTotal(ballRegion, SPHERICAL, geom, sweep, { res: RES });
    expect(result).toBeCloseTo(4 * Math.PI / 3, 1);
  });

  it("scalar '1' → mismo volumen 4π/3", () => {
    const result = integrateTotal(ballRegion, SPHERICAL, scalar1, sweep, { res: RES });
    expect(result).toBeCloseTo(4 * Math.PI / 3, 1);
  });

  it("scalar 'x^2+y^2+z^2' → 4π/5 ≈ 2.5133", () => {
    // ∫∫∫ r² · r² sinφ dr dθ dφ = (∫₀¹ r⁴ dr)(∫₀²π dθ)(∫₀π sinφ dφ)
    //   = (1/5)(2π)(2) = 4π/5
    const result = integrateTotal(ballRegion, SPHERICAL, scalarR2, sweep, { res: RES });
    expect(result).toBeCloseTo(4 * Math.PI / 5, 1);
  });
});

// ---------------------------------------------------------------------------
// 2. Área de la esfera unitaria
//    r congelado en t=1 (r=1), θ y φ activos
//    Valor esperado: 4π ≈ 12.566
// ---------------------------------------------------------------------------

describe('Área superficie esfera r=1 (r congelado)', () => {
  const sweep: SweepState = {
    active: [false, true, true], // r congelado, θ y φ activos
    frozen: [1, 0, 0],          // frozen[0]=1 → r fijo en upper=1 (t=1→ 0+1·1=1)
    progress: [0, 1, 1],
  };

  it('geometric → 4π ≈ 12.566', () => {
    const result = integrateTotal(ballRegion, SPHERICAL, geom, sweep, { res: RES });
    expect(result).toBeCloseTo(4 * Math.PI, 1);
  });
});

// ---------------------------------------------------------------------------
// 3. Área del disco en cilíndricas
//    ρ∈[0,1], φ∈[0,2π], z congelado
//    Valor esperado: π ≈ 3.14159
// ---------------------------------------------------------------------------

const diskRegion: Region = {
  system: 'cylindrical',
  order: [0, 1, 2],
  bounds: [
    { lower: 0, upper: 1 },       // ρ ∈ [0,1]
    { lower: 0, upper: 6.28318 }, // φ ∈ [0,2π]
    { lower: 0, upper: 1 },       // z (congelado, no importa el rango)
  ],
};

describe('Área disco cilíndrico (z congelado)', () => {
  const sweep: SweepState = {
    active: [true, true, false], // ρ y φ activos, z congelado
    frozen: [0, 0, 0.5],        // z fijo a algún valor
    progress: [1, 1, 0],
  };

  it('geometric → π ≈ 3.14159', () => {
    const result = integrateTotal(diskRegion, CYLINDRICAL, geom, sweep, { res: RES });
    expect(result).toBeCloseTo(Math.PI, 1);
  });
});

// ---------------------------------------------------------------------------
// 4. progressFraction: valor intermedio coherente (monótono)
// ---------------------------------------------------------------------------

describe('progressFraction — monotonía', () => {
  it('p=0.25 < p=0.5 < p=1.0 para bola geométrica', () => {
    function makeSweep(p: number): SweepState {
      return {
        active: [true, true, true],
        frozen: [0, 0, 0],
        progress: [p, p, p],
      };
    }

    const f25 = progressFraction(ballRegion, SPHERICAL, geom, makeSweep(0.25), RES);
    const f50 = progressFraction(ballRegion, SPHERICAL, geom, makeSweep(0.5), RES);
    const f100 = progressFraction(ballRegion, SPHERICAL, geom, makeSweep(1.0), RES);

    expect(f25).toBeGreaterThan(0);
    expect(f50).toBeGreaterThan(f25);
    expect(f100).toBeGreaterThan(f50);
    expect(f100).toBeCloseTo(1.0, 3);
  });

  it('total=0 → progressFraction devuelve 0', () => {
    // Región degenerada con rango cero en la primera var activa
    const degRegion: Region = {
      system: 'spherical',
      order: [0, 1, 2],
      bounds: [
        { lower: 0, upper: 0 }, // r=0 → rango 0 → integral=0
        { lower: 0, upper: 6.28318 },
        { lower: 0, upper: 3.14159 },
      ],
    };
    const sweep = allActive();
    const frac = progressFraction(degRegion, SPHERICAL, geom, sweep, RES);
    expect(frac).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. measureLabel
// ---------------------------------------------------------------------------

describe('measureLabel', () => {
  it('0 activas → ""', () => expect(measureLabel(0)).toBe(''));
  it('1 activa  → "longitud"', () => expect(measureLabel(1)).toBe('longitud'));
  it('2 activas → "área"', () => expect(measureLabel(2)).toBe('área'));
  it('3 activas → "volumen"', () => expect(measureLabel(3)).toBe('volumen'));
});

// ---------------------------------------------------------------------------
// 6. integratePartial vs integrateTotal
// ---------------------------------------------------------------------------

describe('integratePartial / integrateTotal', () => {
  it('progress=[1,1,1] → partial ≈ total', () => {
    const sweep = allActive([1, 1, 1]);
    const total = integrateTotal(ballRegion, SPHERICAL, geom, sweep, { res: RES });
    const partial = integratePartial(ballRegion, SPHERICAL, geom, sweep, { res: RES });
    expect(partial).toBeCloseTo(total, 3);
  });

  it('progress=[0.5,1,1] → partial < total', () => {
    const sweep = allActive([0.5, 1, 1]);
    const total = integrateTotal(ballRegion, SPHERICAL, geom, sweep, { res: RES });
    const partial = integratePartial(ballRegion, SPHERICAL, geom, sweep, { res: RES });
    expect(partial).toBeLessThan(total);
    expect(partial).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Longitud de arco en esféricas (1 variable activa)
//    θ activo (índice canónico 1), r=1 congelado, φ=π/2 congelado
//    Arco = ∫₀^{2π} h_θ dθ = ∫₀^{2π} r·sinφ dθ = 1·1·2π ≈ 6.28318
// ---------------------------------------------------------------------------

describe('Longitud de arco ecuador (θ activo, r=1, φ=π/2 congelados)', () => {
  const arcRegion: Region = {
    system: 'spherical',
    order: [0, 1, 2],
    bounds: [
      { lower: 0, upper: 1 },        // r ∈ [0,1]
      { lower: 0, upper: 6.28318 },  // θ ∈ [0,2π]
      { lower: 0, upper: 3.14159 },  // φ ∈ [0,π]
    ],
  };

  // r congelado en t=1 (r=1), θ activo, φ congelado en t=0.5 (φ=π/2)
  const sweep: SweepState = {
    active: [false, true, false],
    frozen: [1, 0, 0.5],  // r→1, φ→π/2
    progress: [0, 1, 0],
  };

  it('geometric → 2π ≈ 6.28318', () => {
    const result = integrateTotal(arcRegion, SPHERICAL, geom, sweep, { res: RES });
    expect(result).toBeCloseTo(2 * Math.PI, 1);
  });
});
