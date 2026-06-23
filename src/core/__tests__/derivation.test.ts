/**
 * derivation.test.ts — Tests del módulo de lecciones de derivación geométrica.
 * Estructura en dos fases: "solo" (cada diferencial) + "combina" (acumulativo).
 */

import { describe, it, expect } from 'vitest';
import { buildLesson, availableLessons } from '../derivation.js';

// ---------------------------------------------------------------------------
// availableLessons
// ---------------------------------------------------------------------------

describe('availableLessons', () => {
  it('devuelve exactamente los 4 sistemas canónicos (sin curvilinear)', () => {
    const ids = availableLessons().map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['cartesian', 'polar', 'cylindrical', 'spherical']));
    expect(ids).not.toContain('curvilinear');
    expect(ids).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Esféricas
// ---------------------------------------------------------------------------

describe('buildLesson (spherical)', () => {
  const lesson = buildLesson('spherical');
  const solo = lesson.steps.filter((s) => s.phase === 'solo');
  const combina = lesson.steps.filter((s) => s.phase === 'combina');

  it('tiene 6 pasos (3 solo + 3 combina)', () => {
    expect(lesson.steps).toHaveLength(6);
    expect(solo).toHaveLength(3);
    expect(combina).toHaveLength(3);
  });

  it('las 3 primeras son "solo" con una sola variable activa', () => {
    for (const s of solo) {
      expect(s.activeVars.filter(Boolean)).toHaveLength(1);
      expect(s.symbol).toBe('dl');
    }
    expect(solo.map((s) => s.sweepVar)).toEqual([0, 1, 2]);
  });

  it('las combina suben de dimensión: dl → dS → dV', () => {
    expect(combina.map((s) => s.symbol)).toEqual(['dl', 'dS', 'dV']);
    expect(combina.map((s) => s.activeVars.filter(Boolean).length)).toEqual([1, 2, 3]);
    expect(combina[2].includedVars).toEqual([0, 1, 2]);
  });

  it('el diferencial solo de θ (polar) es r\\,d\\theta', () => {
    expect(solo.find((s) => s.sweepVar === 1)!.lengthLatex).toBe('r\\,d\\theta');
  });

  it('el diferencial solo de φ (azimutal) es r\\sin\\theta\\,d\\phi', () => {
    expect(solo.find((s) => s.sweepVar === 2)!.lengthLatex).toBe('r\\sin\\theta\\,d\\phi');
  });

  it('finalLatex es dV con r^2\\sin\\theta', () => {
    expect(lesson.finalLatex.startsWith('dV =')).toBe(true);
    expect(lesson.finalLatex).toContain('r^2\\sin\\theta');
  });
});

// ---------------------------------------------------------------------------
// Polares (planar)
// ---------------------------------------------------------------------------

describe('buildLesson (polar)', () => {
  const lesson = buildLesson('polar');
  const combina = lesson.steps.filter((s) => s.phase === 'combina');

  it('tiene 4 pasos (2 solo + 2 combina)', () => {
    expect(lesson.steps).toHaveLength(4);
    expect(lesson.steps.filter((s) => s.phase === 'solo')).toHaveLength(2);
    expect(combina).toHaveLength(2);
  });

  it('el último combina es "dA" (planar)', () => {
    expect(combina[combina.length - 1].symbol).toBe('dA');
    expect(combina[combina.length - 1].activeVars).toEqual([true, true, false]);
  });

  it('finalLatex empieza con "dA ="', () => {
    expect(lesson.finalLatex.startsWith('dA =')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cartesianas
// ---------------------------------------------------------------------------

describe('buildLesson (cartesian)', () => {
  const lesson = buildLesson('cartesian');
  const combina = lesson.steps.filter((s) => s.phase === 'combina');

  it('tiene 6 pasos', () => {
    expect(lesson.steps).toHaveLength(6);
  });

  it('partialLatex del último combina es "dx \\cdot dy \\cdot dz"', () => {
    expect(combina[combina.length - 1].partialLatex).toBe('dx \\cdot dy \\cdot dz');
  });

  it('finalLatex es "dV = dx\\,dy\\,dz"', () => {
    expect(lesson.finalLatex).toBe('dV = dx\\,dy\\,dz');
  });
});

// ---------------------------------------------------------------------------
// Cilíndricas
// ---------------------------------------------------------------------------

describe('buildLesson (cylindrical)', () => {
  const lesson = buildLesson('cylindrical');

  it('tiene 6 pasos', () => {
    expect(lesson.steps).toHaveLength(6);
  });

  it('el diferencial de φ es "\\rho\\,d\\phi"', () => {
    const phiSolo = lesson.steps.find((s) => s.phase === 'solo' && s.sweepVar === 1);
    expect(phiSolo!.lengthLatex).toBe('\\rho\\,d\\phi');
  });
});

// ---------------------------------------------------------------------------
// Coherencia general
// ---------------------------------------------------------------------------

describe('coherencia general de lecciones', () => {
  for (const { id } of availableLessons()) {
    it(`[${id}] index coincide con la posición; ningún paso sin variable`, () => {
      const lesson = buildLesson(id);
      lesson.steps.forEach((step, i) => {
        expect(step.index).toBe(i);
        expect(step.sweepVar).not.toBeNull();
        expect(step.partialLatex.length).toBeGreaterThan(0);
        expect(step.includedVars.length).toBeGreaterThan(0);
      });
      // Primero todas las "solo", luego todas las "combina".
      const phases = lesson.steps.map((s) => s.phase);
      const firstCombina = phases.indexOf('combina');
      expect(phases.slice(0, firstCombina).every((p) => p === 'solo')).toBe(true);
      expect(phases.slice(firstCombina).every((p) => p === 'combina')).toBe(true);
    });
  }
});
