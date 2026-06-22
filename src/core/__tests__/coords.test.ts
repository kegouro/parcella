/**
 * coords.test.ts — Tests de los sistemas de coordenadas de Parcella.
 *
 * Convención esférica recordatorio:
 *   vars = [r, θ, φ]   θ=azimut ∈[0,2π),  φ=polar desde +z ∈[0,π]
 *   x = r sinφ cosθ,  y = r sinφ sinθ,  z = r cosφ
 *   J = r² sinφ
 */

import { describe, it, expect } from 'vitest';
import {
  CARTESIAN,
  CYLINDRICAL,
  SPHERICAL,
  SYSTEMS,
  getSystem,
  makeCurvilinear,
} from '../coords.js';

// ---------------------------------------------------------------------------
// CARTESIANAS
// ---------------------------------------------------------------------------

describe('CARTESIAN', () => {
  it('tiene id correcto', () => {
    expect(CARTESIAN.id).toBe('cartesian');
  });

  it('toCartesian es identidad', () => {
    expect(CARTESIAN.toCartesian(1, 2, 3)).toEqual([1, 2, 3]);
    expect(CARTESIAN.toCartesian(0, 0, 0)).toEqual([0, 0, 0]);
    expect(CARTESIAN.toCartesian(-1, 5, -3)).toEqual([-1, 5, -3]);
  });

  it('scaleFactors = [1,1,1]', () => {
    expect(CARTESIAN.scaleFactors(1, 2, 3)).toEqual([1, 1, 1]);
    expect(CARTESIAN.scaleFactors(0, 0, 0)).toEqual([1, 1, 1]);
  });

  it('jacobian = 1', () => {
    expect(CARTESIAN.jacobian(1, 2, 3)).toBe(1);
    expect(CARTESIAN.jacobian(0, 0, 0)).toBe(1);
  });

  it('jacobian = producto de scaleFactors', () => {
    const h = CARTESIAN.scaleFactors(2, 3, 4);
    expect(CARTESIAN.jacobian(2, 3, 4)).toBeCloseTo(h[0] * h[1] * h[2], 10);
  });

  it('volumeElementLatex correcto', () => {
    expect(CARTESIAN.volumeElementLatex).toBe('dx\\,dy\\,dz');
  });

  it('jacobianFactorsLatex correctos', () => {
    expect(CARTESIAN.jacobianFactorsLatex).toEqual(['dx', 'dy', 'dz']);
  });

  it('vars tienen names correctos', () => {
    expect(CARTESIAN.vars[0].name).toBe('x');
    expect(CARTESIAN.vars[1].name).toBe('y');
    expect(CARTESIAN.vars[2].name).toBe('z');
  });
});

// ---------------------------------------------------------------------------
// CILÍNDRICAS
// ---------------------------------------------------------------------------

describe('CYLINDRICAL', () => {
  it('tiene id correcto', () => {
    expect(CYLINDRICAL.id).toBe('cylindrical');
  });

  it('toCartesian: eje z (rho=0)', () => {
    const [x, y, z] = CYLINDRICAL.toCartesian(0, Math.PI / 3, 5);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(5, 10);
  });

  it('toCartesian: rho=2, phi=0 → (2,0,z)', () => {
    const [x, y, z] = CYLINDRICAL.toCartesian(2, 0, 7);
    expect(x).toBeCloseTo(2, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(7, 10);
  });

  it('toCartesian: rho=3, phi=pi/2 → (0,3,z)', () => {
    const [x, y, z] = CYLINDRICAL.toCartesian(3, Math.PI / 2, -1);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(3, 10);
    expect(z).toBeCloseTo(-1, 10);
  });

  it('toCartesian: rho=1, phi=pi → (-1,0,z)', () => {
    const [x, y, z] = CYLINDRICAL.toCartesian(1, Math.PI, 0);
    expect(x).toBeCloseTo(-1, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it('scaleFactors = [1, rho, 1]', () => {
    const h = CYLINDRICAL.scaleFactors(3, Math.PI / 4, 2);
    expect(h[0]).toBeCloseTo(1, 10);
    expect(h[1]).toBeCloseTo(3, 10);
    expect(h[2]).toBeCloseTo(1, 10);
  });

  it('jacobian = rho', () => {
    expect(CYLINDRICAL.jacobian(4, 0.5, 1)).toBeCloseTo(4, 10);
    expect(CYLINDRICAL.jacobian(0, 1, 2)).toBeCloseTo(0, 10);
  });

  it('jacobian = producto de scaleFactors', () => {
    const rho = 2.5;
    const h = CYLINDRICAL.scaleFactors(rho, 1, 3);
    expect(CYLINDRICAL.jacobian(rho, 1, 3)).toBeCloseTo(h[0] * h[1] * h[2], 10);
  });

  it('volumeElementLatex correcto', () => {
    expect(CYLINDRICAL.volumeElementLatex).toBe('\\rho\\,d\\rho\\,d\\phi\\,dz');
  });

  it('jacobianFactorsLatex correctos', () => {
    expect(CYLINDRICAL.jacobianFactorsLatex).toEqual(['d\\rho', '\\rho\\,d\\phi', 'dz']);
  });

  it('vars tienen names correctos (rho, phi, z)', () => {
    expect(CYLINDRICAL.vars[0].name).toBe('rho');
    expect(CYLINDRICAL.vars[1].name).toBe('phi');
    expect(CYLINDRICAL.vars[2].name).toBe('z');
  });
});

// ---------------------------------------------------------------------------
// ESFÉRICAS
// ---------------------------------------------------------------------------

describe('SPHERICAL', () => {
  it('tiene id correcto', () => {
    expect(SPHERICAL.id).toBe('spherical');
  });

  // Puntos de referencia (r=1, θ=0, φ=0) → polo norte (0,0,1)
  it('toCartesian: r=1, theta=0, phi=0 → polo norte (0,0,1)', () => {
    const [x, y, z] = SPHERICAL.toCartesian(1, 0, 0);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(1, 10);
  });

  // (r=1, θ=0, φ=π/2) → ecuador en x positivo (1,0,0)
  it('toCartesian: r=1, theta=0, phi=pi/2 → (1,0,0)', () => {
    const [x, y, z] = SPHERICAL.toCartesian(1, 0, Math.PI / 2);
    expect(x).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  // (r=1, θ=π/2, φ=π/2) → (0,1,0)
  it('toCartesian: r=1, theta=pi/2, phi=pi/2 → (0,1,0)', () => {
    const [x, y, z] = SPHERICAL.toCartesian(1, Math.PI / 2, Math.PI / 2);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(1, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  // (r=1, θ=0, φ=π) → polo sur (0,0,-1)
  it('toCartesian: r=1, theta=0, phi=pi → polo sur (0,0,-1)', () => {
    const [x, y, z] = SPHERICAL.toCartesian(1, 0, Math.PI);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(-1, 10);
  });

  // (r=2, θ=pi, φ=pi/2) → (-2,0,0)
  it('toCartesian: r=2, theta=pi, phi=pi/2 → (-2,0,0)', () => {
    const [x, y, z] = SPHERICAL.toCartesian(2, Math.PI, Math.PI / 2);
    expect(x).toBeCloseTo(-2, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it('scaleFactors = [1, r sinφ, r]', () => {
    const r = 3;
    const phi = Math.PI / 4;
    const h = SPHERICAL.scaleFactors(r, 0, phi);
    expect(h[0]).toBeCloseTo(1, 10);
    expect(h[1]).toBeCloseTo(r * Math.sin(phi), 10);
    expect(h[2]).toBeCloseTo(r, 10);
  });

  it('jacobian: r=2, phi=pi/2 → 4', () => {
    // J = r² sinφ = 4 * 1 = 4
    expect(SPHERICAL.jacobian(2, 0, Math.PI / 2)).toBeCloseTo(4, 10);
  });

  it('jacobian: r=3, phi=pi/6 → 9 * sin(pi/6) = 4.5', () => {
    const expected = 9 * Math.sin(Math.PI / 6); // 4.5
    expect(SPHERICAL.jacobian(3, 0, Math.PI / 6)).toBeCloseTo(expected, 10);
  });

  it('jacobian: r=0 → 0', () => {
    expect(SPHERICAL.jacobian(0, 0, Math.PI / 4)).toBeCloseTo(0, 10);
  });

  it('jacobian = producto de scaleFactors', () => {
    const r = 2;
    const phi = Math.PI / 3;
    const h = SPHERICAL.scaleFactors(r, 1, phi);
    expect(SPHERICAL.jacobian(r, 1, phi)).toBeCloseTo(h[0] * h[1] * h[2], 10);
  });

  it('volumeElementLatex correcto', () => {
    expect(SPHERICAL.volumeElementLatex).toBe('r^2\\sin\\phi\\,dr\\,d\\theta\\,d\\phi');
  });

  it('jacobianFactorsLatex correctos (arcos físicos)', () => {
    expect(SPHERICAL.jacobianFactorsLatex).toEqual([
      'dr',
      'r\\sin\\phi\\,d\\theta',
      'r\\,d\\phi',
    ]);
  });

  it('vars tienen names correctos (r, theta, phi)', () => {
    expect(SPHERICAL.vars[0].name).toBe('r');
    expect(SPHERICAL.vars[1].name).toBe('theta');
    expect(SPHERICAL.vars[2].name).toBe('phi');
  });

  it('vars tienen latex correctos', () => {
    expect(SPHERICAL.vars[0].latex).toBe('r');
    expect(SPHERICAL.vars[1].latex).toBe('\\theta');
    expect(SPHERICAL.vars[2].latex).toBe('\\phi');
  });
});

// ---------------------------------------------------------------------------
// SYSTEMS y getSystem
// ---------------------------------------------------------------------------

describe('SYSTEMS / getSystem', () => {
  it('SYSTEMS["cartesian"] === CARTESIAN', () => {
    expect(SYSTEMS['cartesian']).toBe(CARTESIAN);
  });

  it('SYSTEMS["cylindrical"] === CYLINDRICAL', () => {
    expect(SYSTEMS['cylindrical']).toBe(CYLINDRICAL);
  });

  it('SYSTEMS["spherical"] === SPHERICAL', () => {
    expect(SYSTEMS['spherical']).toBe(SPHERICAL);
  });

  it('SYSTEMS["curvilinear"] existe (identidad por defecto)', () => {
    expect(SYSTEMS['curvilinear']).toBeDefined();
  });

  it('getSystem("spherical") devuelve SPHERICAL', () => {
    expect(getSystem('spherical')).toBe(SPHERICAL);
  });

  it('getSystem("cylindrical") devuelve CYLINDRICAL', () => {
    expect(getSystem('cylindrical')).toBe(CYLINDRICAL);
  });
});

// ---------------------------------------------------------------------------
// makeCurvilinear (Fase 2) — reproduce esféricas con tolerancia numérica
// ---------------------------------------------------------------------------

describe('makeCurvilinear', () => {
  // Sistema esférico en variables (u=r, v=theta, w=phi):
  //   x = u * sin(w) * cos(v)
  //   y = u * sin(w) * sin(v)
  //   z = u * cos(w)
  const sphericalCurvi = makeCurvilinear({
    id: 'curvilinear',
    label: 'Esféricas curvilíneas',
    xExpr: 'u * sin(w) * cos(v)',
    yExpr: 'u * sin(w) * sin(v)',
    zExpr: 'u * cos(w)',
  });

  it('toCartesian reproduce esféricas: r=1, theta=0, phi=pi/2 → (1,0,0)', () => {
    const [x, y, z] = sphericalCurvi.toCartesian(1, 0, Math.PI / 2);
    expect(x).toBeCloseTo(1, 8);
    expect(y).toBeCloseTo(0, 8);
    expect(z).toBeCloseTo(0, 8);
  });

  it('toCartesian reproduce esféricas: r=2, theta=pi/2, phi=pi/2 → (0,2,0)', () => {
    const [x, y, z] = sphericalCurvi.toCartesian(2, Math.PI / 2, Math.PI / 2);
    expect(x).toBeCloseTo(0, 8);
    expect(y).toBeCloseTo(2, 8);
    expect(z).toBeCloseTo(0, 8);
  });

  it('jacobian reproduce r²sinφ: r=2, phi=pi/2 → ≈4', () => {
    const r = 2;
    const phi = Math.PI / 2;
    const J = sphericalCurvi.jacobian(r, 0, phi);
    const expected = r * r * Math.sin(phi); // 4
    expect(J).toBeCloseTo(expected, 3);
  });

  it('jacobian reproduce r²sinφ: r=3, phi=pi/3 → ≈9 sin(pi/3)', () => {
    const r = 3;
    const phi = Math.PI / 3;
    const J = sphericalCurvi.jacobian(r, 0.5, phi);
    const expected = r * r * Math.sin(phi);
    expect(J).toBeCloseTo(expected, 3);
  });

  it('scaleFactors[0] ≈ 1 (h_r) en (r=2, theta=0.3, phi=pi/4)', () => {
    const [hu] = sphericalCurvi.scaleFactors(2, 0.3, Math.PI / 4);
    expect(hu).toBeCloseTo(1, 3);
  });

  it('scaleFactors[2] ≈ r (h_phi) en (r=3, theta=0, phi=pi/3)', () => {
    const r = 3;
    const phi = Math.PI / 3;
    const h = sphericalCurvi.scaleFactors(r, 0, phi);
    expect(h[2]).toBeCloseTo(r, 3);  // h_phi = r
  });

  it('reproduces cartesian identity: x=u, y=v, z=w', () => {
    const cartCurvi = makeCurvilinear({ xExpr: 'u', yExpr: 'v', zExpr: 'w' });
    const [x, y, z] = cartCurvi.toCartesian(1, 2, 3);
    expect(x).toBeCloseTo(1, 8);
    expect(y).toBeCloseTo(2, 8);
    expect(z).toBeCloseTo(3, 8);
  });

  it('jacobian ≈ 1 para identidad cartesiana', () => {
    const cartCurvi = makeCurvilinear({ xExpr: 'u', yExpr: 'v', zExpr: 'w' });
    expect(cartCurvi.jacobian(1, 2, 3)).toBeCloseTo(1, 3);
  });
});
