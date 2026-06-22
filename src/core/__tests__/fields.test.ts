/**
 * fields.test.ts — Tests de src/core/fields.ts
 *
 * Ejecutar solo este archivo:
 *   npx vitest run src/core/__tests__/fields.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  compileScalar,
  compileVector,
  dot,
  norm,
  scale,
  add,
  sub,
  cross,
  flux,
  circulation,
} from '../fields.js';
import type { Vec3 } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers: tolerancia numérica
// ---------------------------------------------------------------------------
const EPS = 1e-10;
const approx = (a: number, b: number) => Math.abs(a - b) < EPS;

// ---------------------------------------------------------------------------
// compileScalar
// ---------------------------------------------------------------------------
describe('compileScalar', () => {
  it('evalúa x^2 + y^2 + z^2 en (1,2,2) → 9', () => {
    const f = compileScalar('x^2 + y^2 + z^2');
    expect(f([1, 2, 2])).toBe(9);
  });

  it('evalúa x*y en (3,4,0) → 12', () => {
    const f = compileScalar('x * y');
    expect(f([3, 4, 0])).toBe(12);
  });

  it('evalúa z en (0,0,7) → 7', () => {
    const f = compileScalar('z');
    expect(f([0, 0, 7])).toBe(7);
  });

  it('expresión vacía devuelve NaN sin lanzar', () => {
    const f = compileScalar('');
    expect(Number.isNaN(f([1, 2, 3]))).toBe(true);
  });

  it('expresión con solo espacios devuelve NaN sin lanzar', () => {
    const f = compileScalar('   ');
    expect(Number.isNaN(f([0, 0, 0]))).toBe(true);
  });

  it('lanza Error para expresión con sintaxis inválida', () => {
    expect(() => compileScalar('x ++* y')).toThrow();
  });

  it('evalúa sqrt(x^2+y^2) en (3,4,0) → 5', () => {
    const f = compileScalar('sqrt(x^2 + y^2)');
    expect(approx(f([3, 4, 0]), 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// compileVector
// ---------------------------------------------------------------------------
describe('compileVector', () => {
  it('campo identidad ["x","y","z"] en (1,2,3) → [1,2,3]', () => {
    const F = compileVector(['x', 'y', 'z']);
    expect(F([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('campo radial ["x","y","z"] en (2,0,0) → [2,0,0]', () => {
    const F = compileVector(['x', 'y', 'z']);
    expect(F([2, 0, 0])).toEqual([2, 0, 0]);
  });

  it('campo constante ["1","2","3"] en cualquier punto → [1,2,3]', () => {
    const F = compileVector(['1', '2', '3']);
    expect(F([5, -3, 0])).toEqual([1, 2, 3]);
  });

  it('componentes vacías devuelven NaN', () => {
    const F = compileVector(['', '', '']);
    const result = F([1, 2, 3]);
    expect(result.every(Number.isNaN)).toBe(true);
  });

  it('campo ["x^2","y^2","z^2"] en (2,3,4) → [4,9,16]', () => {
    const F = compileVector(['x^2', 'y^2', 'z^2']);
    expect(F([2, 3, 4])).toEqual([4, 9, 16]);
  });
});

// ---------------------------------------------------------------------------
// Helpers Vec3
// ---------------------------------------------------------------------------
describe('dot', () => {
  it('[1,0,0]·[0,1,0] = 0 (perpendiculares)', () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('[1,2,3]·[4,5,6] = 32', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('[1,1,1]·[1,1,1] = 3', () => {
    expect(dot([1, 1, 1], [1, 1, 1])).toBe(3);
  });
});

describe('norm', () => {
  it('norm([3,4,0]) = 5', () => {
    expect(norm([3, 4, 0])).toBe(5);
  });

  it('norm([1,0,0]) = 1', () => {
    expect(norm([1, 0, 0])).toBe(1);
  });

  it('norm([0,0,0]) = 0', () => {
    expect(norm([0, 0, 0])).toBe(0);
  });

  it('norm([1,1,1]) = sqrt(3)', () => {
    expect(approx(norm([1, 1, 1]), Math.sqrt(3))).toBe(true);
  });
});

describe('scale', () => {
  it('scale([1,2,3], 2) = [2,4,6]', () => {
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it('scale([1,1,1], 0) = [0,0,0]', () => {
    expect(scale([1, 1, 1], 0)).toEqual([0, 0, 0]);
  });
});

describe('add', () => {
  it('add([1,2,3],[4,5,6]) = [5,7,9]', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });
});

describe('sub', () => {
  it('sub([5,7,9],[4,5,6]) = [1,2,3]', () => {
    expect(sub([5, 7, 9], [4, 5, 6])).toEqual([1, 2, 3]);
  });
});

describe('cross', () => {
  it('[1,0,0] × [0,1,0] = [0,0,1]', () => {
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it('[0,1,0] × [0,0,1] = [1,0,0]', () => {
    expect(cross([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0]);
  });

  it('[0,0,1] × [1,0,0] = [0,1,0]', () => {
    expect(cross([0, 0, 1], [1, 0, 0])).toEqual([0, 1, 0]);
  });

  it('a × a = [0,0,0]', () => {
    expect(cross([3, 5, 7], [3, 5, 7])).toEqual([0, 0, 0]);
  });

  it('[1,2,3] × [4,5,6] = [-3,6,-3]', () => {
    expect(cross([1, 2, 3], [4, 5, 6])).toEqual([-3, 6, -3]);
  });
});

// ---------------------------------------------------------------------------
// flux
// ---------------------------------------------------------------------------
describe('flux', () => {
  const Fx: (p: Vec3) => Vec3 = (_p) => [1, 0, 0];

  it('F=[1,0,0], n=[1,0,0] → flux = 1', () => {
    expect(flux(Fx, [0, 0, 0], [1, 0, 0])).toBe(1);
  });

  it('F=[1,0,0], n=[0,1,0] → flux = 0', () => {
    expect(flux(Fx, [0, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('F=[1,0,0], n=[-1,0,0] → flux = -1 (antiparalelo)', () => {
    expect(flux(Fx, [0, 0, 0], [-1, 0, 0])).toBe(-1);
  });

  it('normaliza n no unitario: n=[2,0,0] da mismo resultado que n=[1,0,0]', () => {
    expect(flux(Fx, [0, 0, 0], [2, 0, 0])).toBe(1);
  });

  it('campo radial F(p)=p, n=[1,0,0] en p=[5,0,0] → 5 (F(p)·n̂=5)', () => {
    const Fradial: (p: Vec3) => Vec3 = (p) => p;
    // F([5,0,0]) = [5,0,0]; n̂ = [1,0,0]; producto punto = 5
    expect(flux(Fradial, [5, 0, 0], [1, 0, 0])).toBe(5);
  });

  it('F=[0,1,0], n=[3,4,0] (no unitario) → flux = 4/5', () => {
    const Fy: (p: Vec3) => Vec3 = (_p) => [0, 1, 0];
    // n̂ = [3/5, 4/5, 0]; F·n̂ = 4/5
    expect(approx(flux(Fy, [0, 0, 0], [3, 4, 0]), 4 / 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// circulation
// ---------------------------------------------------------------------------
describe('circulation', () => {
  const Fx: (p: Vec3) => Vec3 = (_p) => [1, 0, 0];

  it('F=[1,0,0], t=[1,0,0] → circulation = 1', () => {
    expect(circulation(Fx, [0, 0, 0], [1, 0, 0])).toBe(1);
  });

  it('F=[1,0,0], t=[0,1,0] → circulation = 0', () => {
    expect(circulation(Fx, [0, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('normaliza t no unitario: t=[3,0,0] da mismo resultado que t=[1,0,0]', () => {
    expect(circulation(Fx, [0, 0, 0], [3, 0, 0])).toBe(1);
  });

  it('F=[0,1,0], t=[3,4,0] (no unitario) → circulation = 4/5', () => {
    const Fy: (p: Vec3) => Vec3 = (_p) => [0, 1, 0];
    expect(approx(circulation(Fy, [0, 0, 0], [3, 4, 0]), 4 / 5)).toBe(true);
  });

  it('F=[-y,x,0] (rotacional), t=[0,1,0] en p=[1,0,0] → F(p)=[0,1,0], circulation=1', () => {
    const Frot: (p: Vec3) => Vec3 = (p) => [-p[1], p[0], 0];
    // F([1,0,0]) = [0,1,0]; t=[0,1,0]; circulación = 1
    expect(circulation(Frot, [1, 0, 0], [0, 1, 0])).toBe(1);
  });
});
