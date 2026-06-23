/**
 * derivation.test.ts — Tests del módulo de lecciones de derivación geométrica.
 */

import { describe, it, expect } from 'vitest';
import { buildLesson, availableLessons } from '../derivation.js';

// ---------------------------------------------------------------------------
// availableLessons
// ---------------------------------------------------------------------------

describe('availableLessons', () => {
  it('devuelve exactamente los 4 sistemas canónicos (sin curvilinear)', () => {
    const lessons = availableLessons();
    const ids = lessons.map((l) => l.id);
    expect(ids).toContain('cartesian');
    expect(ids).toContain('polar');
    expect(ids).toContain('cylindrical');
    expect(ids).toContain('spherical');
    expect(ids).not.toContain('curvilinear');
    expect(ids).toHaveLength(4);
  });

  it('cada entrada tiene id y label', () => {
    for (const entry of availableLessons()) {
      expect(entry.id).toBeTruthy();
      expect(entry.label).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Esféricas
// ---------------------------------------------------------------------------

describe('buildLesson (spherical)', () => {
  const lesson = buildLesson('spherical');

  it('tiene 4 pasos (1 punto + 3 barridos)', () => {
    expect(lesson.steps).toHaveLength(4);
  });

  it('los symbols siguen la secuencia point→dl→dS→dV', () => {
    const symbols = lesson.steps.map((s) => s.symbol);
    expect(symbols).toEqual(['point', 'dl', 'dS', 'dV']);
  });

  it('el paso de θ (índice canónico 1, polar) tiene lengthLatex correcto', () => {
    // buildOrder esféricas: [0,1,2] → paso 2 (index=2) barre θ (var canónica 1)
    // Nueva convención: θ polar → h_θ = r → arco = r dθ
    const thetaStep = lesson.steps.find((s) => s.sweepVar === 1);
    expect(thetaStep).toBeDefined();
    expect(thetaStep!.lengthLatex).toBe('r\\,d\\theta');
  });

  it('el paso de φ (índice canónico 2, azimutal) tiene lengthLatex correcto', () => {
    // Nueva convención: φ azimutal → h_φ = r sinθ → arco = r sinθ dφ
    const phiStep = lesson.steps.find((s) => s.sweepVar === 2);
    expect(phiStep).toBeDefined();
    expect(phiStep!.lengthLatex).toBe('r\\sin\\theta\\,d\\phi');
  });

  it('finalLatex contiene r^2\\sin\\theta', () => {
    expect(lesson.finalLatex).toContain('r^2\\sin\\theta');
  });

  it('finalLatex empieza con "dV ="', () => {
    expect(lesson.finalLatex.startsWith('dV =')).toBe(true);
  });

  it('buildOrder es [0,1,2]', () => {
    expect(lesson.buildOrder).toEqual([0, 1, 2]);
  });

  it('el paso 0 tiene sweepVar null y lengthLatex vacío', () => {
    const step0 = lesson.steps[0];
    expect(step0.sweepVar).toBeNull();
    expect(step0.lengthLatex).toBe('');
    expect(step0.partialLatex).toBe('');
  });

  it('activeVars es monótono creciente en número de true', () => {
    let prevCount = -1;
    for (const step of lesson.steps) {
      const count = step.activeVars.filter(Boolean).length;
      expect(count).toBeGreaterThanOrEqual(prevCount);
      prevCount = count;
    }
  });
});

// ---------------------------------------------------------------------------
// Polares (planar)
// ---------------------------------------------------------------------------

describe('buildLesson (polar)', () => {
  const lesson = buildLesson('polar');

  it('tiene 3 pasos (1 punto + 2 barridos)', () => {
    expect(lesson.steps).toHaveLength(3);
  });

  it('el último symbol es "dA" (sistema planar)', () => {
    const last = lesson.steps[lesson.steps.length - 1];
    expect(last.symbol).toBe('dA');
  });

  it('finalLatex empieza con "dA ="', () => {
    expect(lesson.finalLatex.startsWith('dA =')).toBe(true);
  });

  it('buildOrder es [0,1] (solo dos variables)', () => {
    expect(lesson.buildOrder).toEqual([0, 1]);
  });

  it('activeVars del último paso tiene [true, true, false]', () => {
    const last = lesson.steps[lesson.steps.length - 1];
    expect(last.activeVars).toEqual([true, true, false]);
  });
});

// ---------------------------------------------------------------------------
// Cartesianas
// ---------------------------------------------------------------------------

describe('buildLesson (cartesian)', () => {
  const lesson = buildLesson('cartesian');

  it('tiene 4 pasos (1 punto + 3 barridos)', () => {
    expect(lesson.steps).toHaveLength(4);
  });

  it('partialLatex del último paso es "dx \\cdot dy \\cdot dz"', () => {
    const last = lesson.steps[lesson.steps.length - 1];
    expect(last.partialLatex).toBe('dx \\cdot dy \\cdot dz');
  });

  it('los tres lengthLatex son dx, dy, dz', () => {
    const sweepSteps = lesson.steps.filter((s) => s.sweepVar !== null);
    expect(sweepSteps.map((s) => s.lengthLatex)).toEqual(['dx', 'dy', 'dz']);
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

  it('tiene 4 pasos', () => {
    expect(lesson.steps).toHaveLength(4);
  });

  it('el paso de φ (var canónica 1) tiene lengthLatex "\\rho\\,d\\phi"', () => {
    const phiStep = lesson.steps.find((s) => s.sweepVar === 1);
    expect(phiStep).toBeDefined();
    expect(phiStep!.lengthLatex).toBe('\\rho\\,d\\phi');
  });

  it('el símbolo intermedio (2 vars barridas) es dS', () => {
    const step2 = lesson.steps[2]; // index 2: barren ρ y φ → dS
    expect(step2.symbol).toBe('dS');
  });

  it('activeVars coherente: monótono creciente', () => {
    let prev = -1;
    for (const step of lesson.steps) {
      const count = step.activeVars.filter(Boolean).length;
      expect(count).toBeGreaterThanOrEqual(prev);
      prev = count;
    }
  });
});

// ---------------------------------------------------------------------------
// Propiedades generales de coherencia
// ---------------------------------------------------------------------------

describe('coherencia general de lecciones', () => {
  for (const { id } of availableLessons()) {
    it(`[${id}] step.index coincide con posición en el array`, () => {
      const lesson = buildLesson(id);
      lesson.steps.forEach((step, i) => {
        expect(step.index).toBe(i);
      });
    });

    it(`[${id}] sweepVar nulo solo en paso 0`, () => {
      const lesson = buildLesson(id);
      expect(lesson.steps[0].sweepVar).toBeNull();
      for (const step of lesson.steps.slice(1)) {
        expect(step.sweepVar).not.toBeNull();
      }
    });

    it(`[${id}] partialLatex vacío solo en paso 0`, () => {
      const lesson = buildLesson(id);
      expect(lesson.steps[0].partialLatex).toBe('');
      for (const step of lesson.steps.slice(1)) {
        expect(step.partialLatex.length).toBeGreaterThan(0);
      }
    });
  }
});
