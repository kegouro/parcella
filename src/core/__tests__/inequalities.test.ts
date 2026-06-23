/**
 * inequalities.test.ts — Tests de deduceRegion.
 *
 * Verifica los casos canónicos: bola, hemisferio, cilindro, disco 2D,
 * caja, paraboloide, y un caso no reconocido.
 */

import { describe, it, expect } from 'vitest';
import { deduceRegion } from '../inequalities.js';
import { evalBound } from '../parser.js';

// ---------------------------------------------------------------------------
// Helper: evalúa un Bound que puede ser number o string de mathjs
// ---------------------------------------------------------------------------
function evalB(b: number | string, scope: Record<string, number> = {}): number {
  return evalBound(b, scope);
}

// ---------------------------------------------------------------------------
// 1. Bola sólida R=1
// ---------------------------------------------------------------------------
describe('Bola sólida R=1', () => {
  const res = deduceRegion(['x^2+y^2+z^2 <= 1^2']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('system = spherical', () => expect(res.system).toBe('spherical'));
  it('note menciona Bola', () => expect(res.note).toMatch(/bola/i));
  it('region system = spherical', () => expect(res.region?.system).toBe('spherical'));
  it('order = [0,1,2]', () => expect(res.region?.order).toEqual([0, 1, 2]));

  it('r ∈ [0, 1]', () => {
    const b = res.region!.bounds[0];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(1);
  });
  it('θ ∈ [0, 2π]', () => {
    const b = res.region!.bounds[1];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(2 * Math.PI);
  });
  it('φ ∈ [0, π]', () => {
    const b = res.region!.bounds[2];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(Math.PI);
  });
});

// ---------------------------------------------------------------------------
// 2. Bola sólida R=2
// ---------------------------------------------------------------------------
describe('Bola sólida R=2', () => {
  const res = deduceRegion(['x^2 + y^2 + z^2 <= 2^2']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('system = spherical', () => expect(res.system).toBe('spherical'));
  it('r upper = 2', () => {
    expect(evalB(res.region!.bounds[0].upper)).toBeCloseTo(2);
  });
  it('φ upper = π', () => {
    expect(evalB(res.region!.bounds[2].upper)).toBeCloseTo(Math.PI);
  });
});

// ---------------------------------------------------------------------------
// 3. Hemisferio superior  (bola R=1 + z >= 0)
// ---------------------------------------------------------------------------
describe('Hemisferio superior R=1', () => {
  const res = deduceRegion(['x^2+y^2+z^2 <= 1^2', 'z >= 0']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('system = spherical', () => expect(res.system).toBe('spherical'));
  it('note menciona superior', () => expect(res.note).toMatch(/superior/i));
  it('φ ∈ [0, π/2]', () => {
    const b = res.region!.bounds[2];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(Math.PI / 2);
  });
  it('r upper = 1', () => {
    expect(evalB(res.region!.bounds[0].upper)).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// 3b. Hemisferio inferior  (bola + z <= 0)
// ---------------------------------------------------------------------------
describe('Hemisferio inferior R=1', () => {
  const res = deduceRegion(['x^2+y^2+z^2 <= 1^2', 'z <= 0']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('note menciona inferior', () => expect(res.note).toMatch(/inferior/i));
  it('φ ∈ [π/2, π]', () => {
    const b = res.region!.bounds[2];
    expect(evalB(b.lower)).toBeCloseTo(Math.PI / 2);
    expect(evalB(b.upper)).toBeCloseTo(Math.PI);
  });
});

// ---------------------------------------------------------------------------
// 4. Cilindro R=2, z ∈ [0, 3]
// ---------------------------------------------------------------------------
describe('Cilindro R=2, z∈[0,3]', () => {
  const res = deduceRegion(['x^2+y^2 <= 2^2', '0 <= z <= 3']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('system = cylindrical', () => expect(res.system).toBe('cylindrical'));
  it('note menciona Cilindro', () => expect(res.note).toMatch(/cilindro/i));
  it('ρ ∈ [0, 2]', () => {
    const b = res.region!.bounds[0];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(2);
  });
  it('φ ∈ [0, 2π]', () => {
    const b = res.region!.bounds[1];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(2 * Math.PI);
  });
  it('z ∈ [0, 3]', () => {
    const b = res.region!.bounds[2];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(3);
  });
});

// ---------------------------------------------------------------------------
// 5. Disco 2D  x²+y² <= R²  (sin cota z)
// ---------------------------------------------------------------------------
describe('Disco 2D R=1', () => {
  const res = deduceRegion(['x^2+y^2 <= 1^2']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('system = polar', () => expect(res.system).toBe('polar'));
  it('note menciona Disco', () => expect(res.note).toMatch(/disco/i));
  it('r ∈ [0, 1]', () => {
    const b = res.region!.bounds[0];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(1);
  });
  it('z congelada en 0 (lower = upper = 0)', () => {
    const b = res.region!.bounds[2];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Caja  x∈[0,1], y∈[-1,2], z∈[0,5]
// ---------------------------------------------------------------------------
describe('Caja rectangular', () => {
  const res = deduceRegion(['0 <= x <= 1', '-1 <= y <= 2', '0 <= z <= 5']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('system = cartesian', () => expect(res.system).toBe('cartesian'));
  it('note menciona Caja', () => expect(res.note).toMatch(/caja/i));
  it('x ∈ [0, 1]', () => {
    const b = res.region!.bounds[0];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(1);
  });
  it('y ∈ [-1, 2]', () => {
    const b = res.region!.bounds[1];
    expect(evalB(b.lower)).toBeCloseTo(-1);
    expect(evalB(b.upper)).toBeCloseTo(2);
  });
  it('z ∈ [0, 5]', () => {
    const b = res.region!.bounds[2];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// 7. Paraboloide  z >= x²+y², z <= 4
// ---------------------------------------------------------------------------
describe('Paraboloide z≥x²+y², z≤4', () => {
  const res = deduceRegion(['z >= x^2+y^2', 'z <= 4']);

  it('ok = true', () => expect(res.ok).toBe(true));
  it('system = cylindrical', () => expect(res.system).toBe('cylindrical'));
  it('note menciona Paraboloide', () => expect(res.note).toMatch(/paraboloide/i));
  it('ρ ∈ [0, sqrt(4)=2]', () => {
    const b = res.region!.bounds[0];
    expect(evalB(b.lower)).toBeCloseTo(0);
    expect(evalB(b.upper)).toBeCloseTo(2);
  });
  it('z lower depende de ρ (rho^2)', () => {
    const b = res.region!.bounds[2];
    // Con rho=1: z_lower=1
    expect(evalB(b.lower, { rho: 1 })).toBeCloseTo(1);
    // Con rho=0: z_lower=0
    expect(evalB(b.lower, { rho: 0 })).toBeCloseTo(0);
  });
  it('z upper = 4', () => {
    const b = res.region!.bounds[2];
    expect(evalB(b.upper)).toBeCloseTo(4);
  });
});

// ---------------------------------------------------------------------------
// 8. Caso NO reconocido → ok:false con reason
// ---------------------------------------------------------------------------
describe('Caso no reconocido', () => {
  const res = deduceRegion(['x^3 + y^3 <= 8', 'z >= 0']);

  it('ok = false', () => expect(res.ok).toBe(false));
  it('no hay region', () => expect(res.region).toBeUndefined());
  it('reason está definida y en español', () => {
    expect(res.reason).toBeDefined();
    expect(res.reason!.length).toBeGreaterThan(5);
  });
  it('reason menciona Manual o modo manual', () => {
    expect(res.reason).toMatch(/manual/i);
  });
});

// ---------------------------------------------------------------------------
// 9. Normalización: acepta espacios extra y mayúsculas en operadores
// ---------------------------------------------------------------------------
describe('Normalización de espacios', () => {
  it('bola con espacios extra', () => {
    const res = deduceRegion(['  x^2  +  y^2  +  z^2  <=  1^2  ']);
    expect(res.ok).toBe(true);
    expect(res.system).toBe('spherical');
  });

  it('caja con desigualdades separadas', () => {
    const res = deduceRegion(['x >= -1', 'x <= 1', 'y >= 0', 'y <= 2', 'z >= 0', 'z <= 3']);
    expect(res.ok).toBe(true);
    expect(res.system).toBe('cartesian');
  });
});
