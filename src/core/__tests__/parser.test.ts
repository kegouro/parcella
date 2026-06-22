/**
 * parser.test.ts — Tests de compileExpr y evalBound.
 *
 * Aislados del DOM y Three.js; corren directamente en node con Vitest.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { compileExpr, evalBound, clearCache } from '../parser.js';

// Limpia la caché entre tests para asegurar que no hay estado compartido.
beforeEach(() => {
  clearCache();
});

// ---------------------------------------------------------------------------
// compileExpr
// ---------------------------------------------------------------------------

describe('compileExpr', () => {
  it('evalúa una constante numérica', () => {
    const f = compileExpr('42');
    expect(f({})).toBe(42);
  });

  it('evalúa una expresión aritmética simple', () => {
    const f = compileExpr('2 + 3 * 4');
    expect(f({})).toBe(14);
  });

  it('evalúa una expresión con variable del scope', () => {
    const f = compileExpr('x^2 + 1');
    expect(f({ x: 3 })).toBe(10);
  });

  it('evalúa funciones trigonométricas (sin, cos)', () => {
    const f = compileExpr('sin(pi / 2)');
    expect(f({})).toBeCloseTo(1, 10);
  });

  it('evalúa sqrt correctamente', () => {
    const f = compileExpr('sqrt(1 - x^2)');
    expect(f({ x: 0 })).toBeCloseTo(1, 10);
    expect(f({ x: 1 })).toBeCloseTo(0, 10);
  });

  it('evalúa el jacobiano esférico r^2 * sin(theta)', () => {
    const f = compileExpr('r^2 * sin(theta)');
    expect(f({ r: 2, theta: Math.PI / 2 })).toBeCloseTo(4, 10);
    expect(f({ r: 1, theta: Math.PI / 6 })).toBeCloseTo(0.5, 10);
  });

  it('reutiliza la instancia compilada (caché) — resultados idénticos', () => {
    // compileExpr devuelve una nueva función wrapper en cada llamada (necesario
    // para el tipado), pero ambas comparten la misma instancia interna de mathjs
    // en caché. Verificamos consistencia de resultados, no identidad de referencia.
    const f1 = compileExpr('x + y');
    const f2 = compileExpr('x + y');
    const scope = { x: 3, y: 7 };
    expect(f1(scope)).toBe(f2(scope));
    expect(f1(scope)).toBe(10);
  });

  it('lanza Error con mensaje claro ante sintaxis inválida', () => {
    expect(() => compileExpr('x ++ +')).toThrow(/inválida/i);
  });

  it('normaliza espacios al cachear (trim) — resultados idénticos', () => {
    const f1 = compileExpr('  x + 1  ');
    const f2 = compileExpr('x + 1');
    expect(f1({ x: 5 })).toBe(f2({ x: 5 }));
    expect(f1({ x: 5 })).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// evalBound
// ---------------------------------------------------------------------------

describe('evalBound', () => {
  it('devuelve el número directamente cuando b es number', () => {
    expect(evalBound(0, {})).toBe(0);
    expect(evalBound(-Math.PI, {})).toBe(-Math.PI);
  });

  it('devuelve NaN para cadena vacía (límite sin rellenar)', () => {
    expect(evalBound('', {})).toBeNaN();
  });

  it('devuelve NaN para cadena solo con espacios', () => {
    expect(evalBound('   ', {})).toBeNaN();
  });

  it('evalúa una constante como cadena', () => {
    expect(evalBound('3.14159', {})).toBeCloseTo(Math.PI, 4);
  });

  it('evalúa expresión con variable externa del scope', () => {
    // Límite superior del cilindro: z_max = z(rho) = sqrt(4 - rho^2)
    const result = evalBound('sqrt(4 - rho^2)', { rho: 0 });
    expect(result).toBeCloseTo(2, 10);
  });

  it('evalúa expresión con múltiples variables externas', () => {
    // Límite que depende de dos variables externas
    const result = evalBound('a + b', { a: 3, b: 7 });
    expect(result).toBe(10);
  });

  it('lanza Error si la expresión de cadena es inválida', () => {
    expect(() => evalBound('??invalid', {})).toThrow();
  });

  it('maneja pi como constante de mathjs', () => {
    expect(evalBound('2 * pi', {})).toBeCloseTo(2 * Math.PI, 10);
  });
});

// ---------------------------------------------------------------------------
// Integración: compileExpr + evalBound juntos
// ---------------------------------------------------------------------------

describe('integración — límites dependientes de variables externas', () => {
  it('límite de esfera: z de 0 a sqrt(R^2 - rho^2)', () => {
    const R = 3;
    const rho = 1;
    const upper = evalBound('sqrt(R^2 - rho^2)', { R, rho });
    expect(upper).toBeCloseTo(Math.sqrt(R * R - rho * rho), 10);
  });

  it('jacobiano cilíndrico J = rho evaluado en varios puntos', () => {
    const f = compileExpr('rho');
    expect(f({ rho: 0 })).toBe(0);
    expect(f({ rho: 2.5 })).toBe(2.5);
  });

  it('jacobiano esférico J = r^2 * sin(phi) en polo norte', () => {
    const f = compileExpr('r^2 * sin(phi)');
    // En phi=0 (polo norte) el jacobiano es 0.
    expect(f({ r: 5, phi: 0 })).toBeCloseTo(0, 10);
    // En el ecuador phi=pi/2.
    expect(f({ r: 1, phi: Math.PI / 2 })).toBeCloseTo(1, 10);
  });
});
