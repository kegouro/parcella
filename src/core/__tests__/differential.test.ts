/**
 * differential.test.ts — Tests de elementSymbol, differentialLatex,
 * sweptSamples y elementCell.
 */

import { describe, it, expect } from 'vitest';
import {
  elementSymbol,
  differentialLatex,
  sweptSamples,
  elementCell,
} from '../differential.js';
import { SPHERICAL, CARTESIAN } from '../coords.js';
import { sampleRegion } from '../region.js';
import type { Region, SweepState } from '../types.js';

// ---------------------------------------------------------------------------
// Regiones de prueba
// ---------------------------------------------------------------------------

/** Bola sólida en esféricas, order canónico [r, θ, φ] */
const solidSphere: Region = {
  system: 'spherical',
  order: [0, 1, 2],
  bounds: [
    { lower: 0, upper: 1 },
    { lower: 0, upper: '2 * pi' },
    { lower: 0, upper: 'pi' },
  ],
};

/** Caja unitaria cartesiana */
const unitBox: Region = {
  system: 'cartesian',
  order: [0, 1, 2],
  bounds: [
    { lower: 0, upper: 1 },
    { lower: 0, upper: 1 },
    { lower: 0, upper: 1 },
  ],
};

// ---------------------------------------------------------------------------
// elementSymbol
// ---------------------------------------------------------------------------

describe('elementSymbol', () => {
  it('0 activas → point', () => {
    expect(elementSymbol(0)).toBe('point');
  });
  it('1 activa → dl', () => {
    expect(elementSymbol(1)).toBe('dl');
  });
  it('2 activas → dS', () => {
    expect(elementSymbol(2)).toBe('dS');
  });
  it('3 activas → dV', () => {
    expect(elementSymbol(3)).toBe('dV');
  });
  it('valor fuera de rango → error', () => {
    expect(() => elementSymbol(4)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// differentialLatex
// ---------------------------------------------------------------------------

describe('differentialLatex — esféricas, 3 activas → dV', () => {
  const sweep: SweepState = {
    active: [true, true, true],
    frozen: [0, 0, 0],
    progress: [1, 1, 1],
  };

  it('symbol es "dV"', () => {
    const { symbol } = differentialLatex(SPHERICAL, sweep);
    expect(symbol).toBe('dV');
  });

  it('hay 3 factores todos activos', () => {
    const { factors } = differentialLatex(SPHERICAL, sweep);
    expect(factors).toHaveLength(3);
    expect(factors.every((f) => f.active)).toBe(true);
  });

  it('expression contiene los 3 factores LaTeX de SPHERICAL', () => {
    const { expression } = differentialLatex(SPHERICAL, sweep);
    // jacobianFactorsLatex de esféricas: ['dr', 'r\\sin\\phi\\,d\\theta', 'r\\,d\\phi']
    expect(expression).toContain('dr');
    expect(expression).toContain('r\\sin\\phi\\,d\\theta');
    expect(expression).toContain('r\\,d\\phi');
  });

  it('expression empieza con "dV ="', () => {
    const { expression } = differentialLatex(SPHERICAL, sweep);
    expect(expression.startsWith('dV =')).toBe(true);
  });
});

describe('differentialLatex — esféricas, active=[true,false,true] → dS', () => {
  const sweep: SweepState = {
    active: [true, false, true],  // r(c=0) activo, θ(c=1) congelado, φ(c=2) activo
    frozen: [0, 0.5, 0],
    progress: [0.8, 0, 0.6],
  };

  it('symbol es "dS"', () => {
    const { symbol } = differentialLatex(SPHERICAL, sweep);
    expect(symbol).toBe('dS');
  });

  it('factores: c=0 activo, c=1 inactivo, c=2 activo', () => {
    const { factors } = differentialLatex(SPHERICAL, sweep);
    expect(factors[0].active).toBe(true);  // r
    expect(factors[1].active).toBe(false); // θ
    expect(factors[2].active).toBe(true);  // φ
  });

  it('expression contiene dr y r\\,d\\phi', () => {
    const { expression } = differentialLatex(SPHERICAL, sweep);
    expect(expression).toContain('dr');
    expect(expression).toContain('r\\,d\\phi');
  });

  it('expression NO contiene el factor de θ', () => {
    const { expression } = differentialLatex(SPHERICAL, sweep);
    // El factor de θ es 'r\\sin\\phi\\,d\\theta'
    expect(expression).not.toContain('r\\sin\\phi\\,d\\theta');
  });

  it('expression empieza con "dS ="', () => {
    const { expression } = differentialLatex(SPHERICAL, sweep);
    expect(expression.startsWith('dS =')).toBe(true);
  });
});

describe('differentialLatex — 0 activas → point con expression vacía', () => {
  const sweep: SweepState = {
    active: [false, false, false],
    frozen: [0.5, 0.5, 0.5],
    progress: [0, 0, 0],
  };

  it('symbol es "point"', () => {
    const { symbol } = differentialLatex(CARTESIAN, sweep);
    expect(symbol).toBe('point');
  });

  it('expression es cadena vacía', () => {
    const { expression } = differentialLatex(CARTESIAN, sweep);
    expect(expression).toBe('');
  });
});

// ---------------------------------------------------------------------------
// sweptSamples
// ---------------------------------------------------------------------------

describe('sweptSamples — 0 activas → kind point', () => {
  const sweep: SweepState = {
    active: [false, false, false],
    frozen: [0.5, 0.5, 0.5],
    progress: [0, 0, 0],
  };

  it('kind es "point"', () => {
    const result = sweptSamples(unitBox, CARTESIAN, sweep);
    expect(result.kind).toBe('point');
  });

  it('point coincide con sampleRegion', () => {
    const result = sweptSamples(unitBox, CARTESIAN, sweep);
    // Todas frozen → t por nivel = frozen[order[level]]
    const t: [number, number, number] = [0.5, 0.5, 0.5]; // order=[0,1,2], todos frozen
    const { cartesian } = sampleRegion(unitBox, CARTESIAN, t);
    expect(result.point).toBeDefined();
    expect(result.point![0]).toBeCloseTo(cartesian[0]);
    expect(result.point![1]).toBeCloseTo(cartesian[1]);
    expect(result.point![2]).toBeCloseTo(cartesian[2]);
  });
});

describe('sweptSamples — 1 activa → kind curve', () => {
  const res = 12;
  // Solo r activo (c=0), θ y φ congelados
  const sweep: SweepState = {
    active: [true, false, false],
    frozen: [0, 0.25, 0.5],  // θ frozen en t=0.25, φ frozen en t=0.5
    progress: [1, 0, 0],      // r barre hasta progress=1
  };

  it('kind es "curve"', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    expect(result.kind).toBe('curve');
  });

  it('curva tiene exactamente res puntos', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    expect(result.curve).toHaveLength(res);
  });

  it('primer punto coincide con sampleRegion en t_r=0 (extremo inferior)', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    // c=0 (r) activo, t_r=0 → level 0 (order[0]=0) t=0
    // c=1 (θ) frozen: frozen[1]=0.25 → level 1 t=0.25
    // c=2 (φ) frozen: frozen[2]=0.5  → level 2 t=0.5
    const t: [number, number, number] = [0, 0.25, 0.5];
    const { cartesian } = sampleRegion(solidSphere, SPHERICAL, t);
    expect(result.curve![0][0]).toBeCloseTo(cartesian[0], 8);
    expect(result.curve![0][1]).toBeCloseTo(cartesian[1], 8);
    expect(result.curve![0][2]).toBeCloseTo(cartesian[2], 8);
  });

  it('último punto coincide con sampleRegion en t_r=progress[0]=1', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    // c=0 activo, progress[0]=1 → level 0 t=1
    const t: [number, number, number] = [1, 0.25, 0.5];
    const { cartesian } = sampleRegion(solidSphere, SPHERICAL, t);
    const last = result.curve![res - 1];
    expect(last[0]).toBeCloseTo(cartesian[0], 8);
    expect(last[1]).toBeCloseTo(cartesian[1], 8);
    expect(last[2]).toBeCloseTo(cartesian[2], 8);
  });
});

describe('sweptSamples — 2 activas → kind surface', () => {
  const res = 8;
  // r y θ activos (c=0, c=1), φ congelado
  const sweep: SweepState = {
    active: [true, true, false],
    frozen: [0, 0, 0.5],
    progress: [1, 1, 0],
  };

  it('kind es "surface"', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    expect(result.kind).toBe('surface');
  });

  it('superficie es una grilla res×res', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    expect(result.surface).toHaveLength(res);
    expect(result.surface![0]).toHaveLength(res);
  });
});

describe('sweptSamples — 3 activas → kind solid', () => {
  const res = 6;
  const sweep: SweepState = {
    active: [true, true, true],
    frozen: [0, 0, 0],
    progress: [1, 1, 1],
  };

  it('kind es "solid"', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    expect(result.kind).toBe('solid');
  });

  it('solidFaces no está vacío (6 caras)', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    expect(result.solidFaces).toBeDefined();
    expect(result.solidFaces!.length).toBe(6);
  });

  it('cada cara es una grilla res×res', () => {
    const result = sweptSamples(solidSphere, SPHERICAL, sweep, res);
    for (const face of result.solidFaces!) {
      expect(face).toHaveLength(res);
      expect(face[0]).toHaveLength(res);
    }
  });
});

// ---------------------------------------------------------------------------
// elementCell
// ---------------------------------------------------------------------------

describe('elementCell', () => {
  describe('0 activas → solo center, sin edges', () => {
    const sweep: SweepState = {
      active: [false, false, false],
      frozen: [0.5, 0.5, 0.5],
      progress: [0, 0, 0],
    };

    it('center coincide con el punto (todas congeladas)', () => {
      const { center, edges } = elementCell(unitBox, CARTESIAN, sweep);
      // frozen=[0.5,0.5,0.5] en caja [0,1]³ → cartesian=(0.5,0.5,0.5)
      expect(center[0]).toBeCloseTo(0.5);
      expect(center[1]).toBeCloseTo(0.5);
      expect(center[2]).toBeCloseTo(0.5);
      expect(edges).toHaveLength(0);
    });
  });

  describe('1 activa → center en progress, 1 edge', () => {
    // Solo x (c=0) activo, progress[0]=0.5
    const sweep: SweepState = {
      active: [true, false, false],
      frozen: [0, 0.5, 0.5],
      progress: [0.5, 0, 0],
    };

    it('hay exactamente 1 edge', () => {
      const { edges } = elementCell(unitBox, CARTESIAN, sweep);
      expect(edges).toHaveLength(1);
    });

    it('center coincide con sampleRegion(progress activo, frozen congelado)', () => {
      const { center } = elementCell(unitBox, CARTESIAN, sweep);
      // order=[0,1,2]; level 0 → c=0 activo → t=progress[0]=0.5
      //                 level 1 → c=1 frozen → t=frozen[1]=0.5
      //                 level 2 → c=2 frozen → t=frozen[2]=0.5
      const t: [number, number, number] = [0.5, 0.5, 0.5];
      const { cartesian } = sampleRegion(unitBox, CARTESIAN, t);
      expect(center[0]).toBeCloseTo(cartesian[0]);
      expect(center[1]).toBeCloseTo(cartesian[1]);
      expect(center[2]).toBeCloseTo(cartesian[2]);
    });

    it('el edge no es cero (hay desplazamiento en la var activa)', () => {
      const { edges } = elementCell(unitBox, CARTESIAN, sweep);
      const mag = Math.sqrt(edges[0][0] ** 2 + edges[0][1] ** 2 + edges[0][2] ** 2);
      expect(mag).toBeGreaterThan(0);
    });
  });

  describe('2 activas → center en progress, 2 edges', () => {
    // x e y activos
    const sweep: SweepState = {
      active: [true, true, false],
      frozen: [0, 0, 0.3],
      progress: [0.5, 0.5, 0],
    };

    it('hay exactamente 2 edges', () => {
      const { edges } = elementCell(unitBox, CARTESIAN, sweep);
      expect(edges).toHaveLength(2);
    });
  });

  describe('3 activas → 3 edges en esféricas', () => {
    const sweep: SweepState = {
      active: [true, true, true],
      frozen: [0, 0, 0],
      progress: [0.5, 0.5, 0.5],
    };

    it('hay exactamente 3 edges', () => {
      const { edges } = elementCell(solidSphere, SPHERICAL, sweep);
      expect(edges).toHaveLength(3);
    });

    it('center coincide con sampleRegion en progress', () => {
      const { center } = elementCell(solidSphere, SPHERICAL, sweep);
      // order=[0,1,2]; todos activos → t[level]=progress[order[level]]
      const t: [number, number, number] = [0.5, 0.5, 0.5];
      const { cartesian } = sampleRegion(solidSphere, SPHERICAL, t);
      expect(center[0]).toBeCloseTo(cartesian[0], 6);
      expect(center[1]).toBeCloseTo(cartesian[1], 6);
      expect(center[2]).toBeCloseTo(cartesian[2], 6);
    });
  });
});
