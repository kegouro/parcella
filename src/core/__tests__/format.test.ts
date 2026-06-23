/**
 * format.test.ts — Tests de numberToLatex y boundToLatex.
 */

import { describe, it, expect } from 'vitest';
import { numberToLatex, boundToLatex } from '../format.js';

// ---------------------------------------------------------------------------
// numberToLatex
// ---------------------------------------------------------------------------

describe('numberToLatex', () => {
  it('cero', () => {
    expect(numberToLatex(0)).toBe('0');
  });

  it('entero positivo', () => {
    expect(numberToLatex(3)).toBe('3');
    expect(numberToLatex(42)).toBe('42');
  });

  it('entero negativo', () => {
    expect(numberToLatex(-2)).toBe('-2');
    expect(numberToLatex(-100)).toBe('-100');
  });

  it('decimal simple', () => {
    expect(numberToLatex(1.5)).toBe('1.5');
  });

  it('decimal con 4 cifras significativas sin ceros finales', () => {
    const s = numberToLatex(0.3333);
    expect(s).toBe('0.3333');
  });

  it('no agrega punto decimal a enteros', () => {
    expect(numberToLatex(1000)).toBe('1000');
  });

  it('NaN produce texto', () => {
    expect(numberToLatex(NaN)).toBe('\\text{NaN}');
  });

  it('Infinity produce \\infty', () => {
    expect(numberToLatex(Infinity)).toBe('\\infty');
    expect(numberToLatex(-Infinity)).toBe('-\\infty');
  });
});

// ---------------------------------------------------------------------------
// boundToLatex — string bounds (expresiones)
// ---------------------------------------------------------------------------

describe('boundToLatex — string expressions', () => {
  it("'pi' → '\\\\pi'", () => {
    expect(boundToLatex('pi')).toBe('\\pi');
  });

  it("'2*pi' → '2\\\\pi'", () => {
    expect(boundToLatex('2*pi')).toBe('2\\pi');
  });

  it("'pi/2' → '\\\\frac{\\\\pi}{2}'", () => {
    const result = boundToLatex('pi/2');
    expect(result).toBe('\\frac{\\pi}{2}');
  });

  it("'3*pi/2' → '\\\\frac{3\\\\pi}{2}'", () => {
    const result = boundToLatex('3*pi/2');
    expect(result).toBe('\\frac{3\\pi}{2}');
  });

  it("'sqrt(1-x^2)' contiene \\\\sqrt", () => {
    const result = boundToLatex('sqrt(1-x^2)');
    expect(result).toContain('\\sqrt');
    // mathjs produce { x}^{2} — verificamos que contiene ^{2} en general
    expect(result).toContain('^{2}');
  });

  it("'z*tan(a)' no contiene \\\\cdot y contiene tan", () => {
    const result = boundToLatex('z*tan(a)');
    expect(result).not.toContain('\\cdot');
    // mathjs puede generar 'tan' o '\tan' según versión; verificamos sin backslash también
    expect(result.replace(/\\/g, '')).toContain('tan');
  });

  it("número como string '0' → '0'", () => {
    expect(boundToLatex('0')).toBe('0');
  });

  it("string vacío → ''", () => {
    expect(boundToLatex('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// boundToLatex — number bounds
// ---------------------------------------------------------------------------

describe('boundToLatex — number bounds', () => {
  it('0 → "0"', () => {
    expect(boundToLatex(0)).toBe('0');
  });

  it('entero positivo', () => {
    expect(boundToLatex(1)).toBe('1');
    expect(boundToLatex(2)).toBe('2');
  });

  it('entero negativo', () => {
    expect(boundToLatex(-1)).toBe('-1');
  });

  it('decimal', () => {
    expect(boundToLatex(0.5)).toBe('0.5');
  });
});
