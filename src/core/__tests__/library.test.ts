/**
 * library.test.ts — Tests de los presets de PRESETS.
 *
 * Verifica:
 *   - Cada preset produce una Region válida.
 *   - `order` es una permutación de [0,1,2].
 *   - Los límites son parseables (números o strings válidos de mathjs).
 *   - defaultSweep() devuelve un SweepState coherente.
 */

import { describe, it, expect } from 'vitest';
import { PRESETS, findPreset } from '../library.js';
import { evalBound } from '../parser.js';
import type { Preset } from '../library.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Comprueba que order sea una permutación de [0,1,2]. */
function isValidOrder(order: [number, number, number]): boolean {
  const sorted = [...order].sort();
  return sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 2;
}

/**
 * Intenta evaluar un bound con un scope de muestra.
 * Si el bound es expresión que depende de variables, pasa un scope genérico.
 */
function tryEvalBound(bound: number | string): boolean {
  try {
    // Scope con todas las posibles variables que pueden aparecer en límites.
    const scope = {
      rho: 0.5, phi: 1.0, z: 1.0,
      r: 0.5, theta: 1.0,
      x: 0.5, y: 0.5,
    };
    const val = evalBound(bound, scope);
    // NaN es válido solo para strings vacíos (límite sin rellenar), no en presets.
    return !Number.isNaN(val) || bound === '';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IDs esperados
// ---------------------------------------------------------------------------

const EXPECTED_IDS = [
  'solid-sphere',
  'spherical-shell',
  'hemisphere',
  'spherical-cap',
  'cylinder',
  'cone',
  'box',
  'torus',
  'paraboloid',
  'wedge',
  'disk',
  'annulus',
  'polar-disk',
  'polar-annulus',
  'polar-sector',
];

// ---------------------------------------------------------------------------
// Tests generales para TODOS los presets
// ---------------------------------------------------------------------------

describe('PRESETS — estructura general', () => {
  it('PRESETS es un array no vacío', () => {
    expect(Array.isArray(PRESETS)).toBe(true);
    expect(PRESETS.length).toBeGreaterThan(0);
  });

  it('todos los IDs esperados están presentes', () => {
    const ids = PRESETS.map((p) => p.id);
    for (const expected of EXPECTED_IDS) {
      expect(ids).toContain(expected);
    }
  });

  it('no hay IDs duplicados', () => {
    const ids = PRESETS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Test paramétrico: cada preset individualmente
// ---------------------------------------------------------------------------

describe.each(PRESETS.map((p) => ({ preset: p, id: p.id })))(
  'Preset "$id"',
  ({ preset }: { preset: Preset; id: string }) => {
    it('tiene id, label y description no vacíos', () => {
      expect(preset.id.length).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    });

    it('tiene system válido', () => {
      expect(['cartesian', 'polar', 'cylindrical', 'spherical', 'curvilinear']).toContain(preset.system);
    });

    it('build() devuelve una Region con system válido', () => {
      const region = preset.build();
      expect(['cartesian', 'polar', 'cylindrical', 'spherical', 'curvilinear']).toContain(region.system);
    });

    it('order es permutación de [0,1,2]', () => {
      const region = preset.build();
      expect(isValidOrder(region.order)).toBe(true);
    });

    it('bounds tiene exactamente 3 elementos', () => {
      const region = preset.build();
      expect(region.bounds.length).toBe(3);
    });

    it('todos los límites son parseables con scope de muestra', () => {
      const region = preset.build();
      for (let i = 0; i < 3; i++) {
        const { lower, upper } = region.bounds[i];
        expect(tryEvalBound(lower)).toBe(true);
        expect(tryEvalBound(upper)).toBe(true);
      }
    });

    it('defaultSweep() devuelve un SweepState coherente', () => {
      const sweep = preset.defaultSweep();
      expect(sweep.active.length).toBe(3);
      expect(sweep.frozen.length).toBe(3);
      expect(sweep.progress.length).toBe(3);
      // Cada active es boolean
      for (const a of sweep.active) {
        expect(typeof a).toBe('boolean');
      }
      // Cada progress ∈ [0,1]
      for (const p of sweep.progress) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    });
  },
);

// ---------------------------------------------------------------------------
// Tests específicos de presets seleccionados
// ---------------------------------------------------------------------------

describe('Presets esféricos — convención θ azimutal, φ polar', () => {
  it('solid-sphere: r∈[0,1], θ∈[0,2π], φ∈[0,π]', () => {
    const r = findPreset('solid-sphere')!.build();
    const scope = {};
    // r: index 0 en order[0]
    expect(evalBound(r.bounds[0].lower, scope)).toBe(0);
    expect(evalBound(r.bounds[0].upper, scope)).toBe(1);
    // θ: upper ≈ 2π
    expect(evalBound(r.bounds[1].upper, scope)).toBeCloseTo(2 * Math.PI, 10);
    // φ: upper ≈ π
    expect(evalBound(r.bounds[2].upper, scope)).toBeCloseTo(Math.PI, 10);
  });

  it('hemisphere: φ_max = π/2 (solo mitad superior)', () => {
    const r = findPreset('hemisphere')!.build();
    const phiUpper = evalBound(r.bounds[2].upper, {});
    expect(phiUpper).toBeCloseTo(Math.PI / 2, 10);
  });

  it('spherical-shell: r_min > 0', () => {
    const r = findPreset('spherical-shell')!.build();
    const rMin = evalBound(r.bounds[0].lower, {});
    expect(rMin).toBeGreaterThan(0);
  });

  it('spherical-cap: φ_max < π/2 (casquete pequeño)', () => {
    const r = findPreset('spherical-cap')!.build();
    const phiUpper = evalBound(r.bounds[2].upper, {});
    expect(phiUpper).toBeGreaterThan(0);
    expect(phiUpper).toBeLessThan(Math.PI / 2);
  });
});

describe('Presets cilíndricos', () => {
  it('cylinder: ρ∈[0,R], φ∈[0,2π], z∈[0,H], order=[0,1,2]', () => {
    const r = findPreset('cylinder')!.build();
    expect(r.order).toEqual([0, 1, 2]);
    expect(evalBound(r.bounds[0].lower, {})).toBe(0);
    expect(evalBound(r.bounds[0].upper, {})).toBeGreaterThan(0);
  });

  it('cone: order=[2,1,0] (z más independiente)', () => {
    const r = findPreset('cone')!.build();
    expect(r.order[0]).toBe(2); // z más independiente
    expect(r.order[2]).toBe(0); // ρ más dependiente
  });

  it('torus: ρ_min > 0 (hueco interior)', () => {
    const r = findPreset('torus')!.build();
    const rhoMin = evalBound(r.bounds[0].lower, {});
    expect(rhoMin).toBeGreaterThan(0);
  });

  it('paraboloid: z_upper depende de rho (expresión string)', () => {
    const r = findPreset('paraboloid')!.build();
    const upper = r.bounds[2].upper;
    expect(typeof upper).toBe('string');
    // Evaluado en rho=1: z_max = 1^2 / 1 = 1
    expect(evalBound(upper, { rho: 1 })).toBeCloseTo(1, 8);
    // Evaluado en rho=0: z_max = 0
    expect(evalBound(upper, { rho: 0 })).toBeCloseTo(0, 8);
  });

  it('disk: z_upper = 0 (plano z=0)', () => {
    const r = findPreset('disk')!.build();
    expect(evalBound(r.bounds[2].upper, {})).toBe(0);
  });

  it('annulus: ρ_min > 0 (hueco central)', () => {
    const r = findPreset('annulus')!.build();
    const rhoMin = evalBound(r.bounds[0].lower, {});
    expect(rhoMin).toBeGreaterThan(0);
  });
});

describe('Presets cartesianos', () => {
  it('box: todos los límites son numéricos', () => {
    const r = findPreset('box')!.build();
    for (const b of r.bounds) {
      expect(typeof b.lower).toBe('number');
      expect(typeof b.upper).toBe('number');
    }
  });

  it('wedge: z_upper depende de x (expresión string)', () => {
    const r = findPreset('wedge')!.build();
    const upper = r.bounds[2].upper;
    expect(typeof upper).toBe('string');
    // En x=0: z_max = H*(1-0/L) = H
    expect(evalBound(upper, { x: 0 })).toBeGreaterThan(0);
    // En x=L: z_max = 0
    const L = 2;
    expect(evalBound(upper, { x: L })).toBeCloseTo(0, 8);
  });
});

// ---------------------------------------------------------------------------
// Presets polares — invariantes
// ---------------------------------------------------------------------------

describe('Presets polares', () => {
  const POLAR_IDS = ['polar-disk', 'polar-annulus', 'polar-sector'] as const;

  for (const pid of POLAR_IDS) {
    describe(pid, () => {
      it('order es permutación de [0,1,2]', () => {
        const region = findPreset(pid)!.build();
        expect(isValidOrder(region.order)).toBe(true);
      });

      it('system === "polar"', () => {
        const preset = findPreset(pid)!;
        expect(preset.system).toBe('polar');
        expect(preset.build().system).toBe('polar');
      });

      it('z (índice 2) congelada: active[2] === false', () => {
        const sweep = findPreset(pid)!.defaultSweep();
        expect(sweep.active.length).toBe(3);
        expect(sweep.active[2]).toBe(false);
      });

      it('r y φ activos: active[0] y active[1] === true', () => {
        const sweep = findPreset(pid)!.defaultSweep();
        expect(sweep.active[0]).toBe(true);
        expect(sweep.active[1]).toBe(true);
      });

      it('bounds[2] = z en [0,0] (plano z=0)', () => {
        const region = findPreset(pid)!.build();
        expect(evalBound(region.bounds[2].lower, {})).toBe(0);
        expect(evalBound(region.bounds[2].upper, {})).toBe(0);
      });

      it('todos los límites son parseables', () => {
        const region = findPreset(pid)!.build();
        for (const b of region.bounds) {
          expect(tryEvalBound(b.lower)).toBe(true);
          expect(tryEvalBound(b.upper)).toBe(true);
        }
      });
    });
  }

  it('polar-disk: r_min = 0, r_max = 1', () => {
    const r = findPreset('polar-disk')!.build();
    expect(evalBound(r.bounds[0].lower, {})).toBe(0);
    expect(evalBound(r.bounds[0].upper, {})).toBe(1);
  });

  it('polar-annulus: r_min > 0 (hueco central)', () => {
    const r = findPreset('polar-annulus')!.build();
    expect(evalBound(r.bounds[0].lower, {})).toBeGreaterThan(0);
  });

  it('polar-sector: φ_max < 2π (solo un sector)', () => {
    const r = findPreset('polar-sector')!.build();
    const phiUpper = evalBound(r.bounds[1].upper, {});
    expect(phiUpper).toBeGreaterThan(0);
    expect(phiUpper).toBeLessThan(2 * Math.PI);
  });
});

// ---------------------------------------------------------------------------
// findPreset
// ---------------------------------------------------------------------------

describe('findPreset', () => {
  it('devuelve el preset correcto por id', () => {
    const p = findPreset('cylinder');
    expect(p).toBeDefined();
    expect(p!.id).toBe('cylinder');
  });

  it('devuelve undefined para id inexistente', () => {
    expect(findPreset('no-existe')).toBeUndefined();
  });
});
