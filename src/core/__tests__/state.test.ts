import { describe, it, expect } from 'vitest';
import {
  defaultState,
  encodeState,
  decodeState,
  stateToUrl,
  stateFromUrl,
} from '../state.js';
import type { AppState } from '../types.js';

describe('defaultState()', () => {
  it('devuelve un objeto con region, integrand y sweep', () => {
    const s = defaultState();
    expect(s).toHaveProperty('region');
    expect(s).toHaveProperty('integrand');
    expect(s).toHaveProperty('sweep');
  });

  it('system es spherical', () => {
    const { region } = defaultState();
    expect(region.system).toBe('spherical');
  });

  it('order es permutación de [0, 1, 2]', () => {
    const { region } = defaultState();
    expect([...region.order].sort()).toEqual([0, 1, 2]);
  });

  it('bounds tiene exactamente 3 elementos con lower y upper definidos', () => {
    const { region } = defaultState();
    expect(region.bounds).toHaveLength(3);
    for (const b of region.bounds) {
      expect(b.lower).toBeDefined();
      expect(b.upper).toBeDefined();
    }
  });

  it('sweep.active tiene longitud 3 y todos son booleanos', () => {
    const { sweep } = defaultState();
    expect(sweep.active).toHaveLength(3);
    for (const a of sweep.active) expect(typeof a).toBe('boolean');
  });

  it('sweep.frozen tiene longitud 3 y todos son números', () => {
    const { sweep } = defaultState();
    expect(sweep.frozen).toHaveLength(3);
    for (const f of sweep.frozen) expect(typeof f).toBe('number');
  });

  it('sweep.progress tiene longitud 3', () => {
    const { sweep } = defaultState();
    expect(sweep.progress).toHaveLength(3);
  });

  it('integrand.mode es geometric', () => {
    const { integrand } = defaultState();
    expect(integrand.mode).toBe('geometric');
  });
});

describe('encodeState / decodeState — round-trip', () => {
  it('round-trip para defaultState()', () => {
    const s = defaultState();
    const encoded = encodeState(s);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(s);
  });

  it('round-trip para un estado modificado', () => {
    const s: AppState = {
      region: {
        system: 'cylindrical',
        order: [1, 0, 2],
        bounds: [
          { lower: 0, upper: 5 },
          { lower: 0, upper: '2*pi' },
          { lower: -3, upper: 3 },
        ],
      },
      integrand: {
        mode: 'scalar',
        scalar: 'x^2 + y^2',
      },
      sweep: {
        active: [true, false, true],
        frozen: [1, Math.PI / 4, 0],
        progress: [0.5, 0, 1],
      },
    };
    const encoded = encodeState(s);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(s);
  });

  it('el string codificado no contiene +, / ni =', () => {
    const encoded = encodeState(defaultState());
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe('decodeState — entradas inválidas', () => {
  it('devuelve null para string vacío', () => {
    expect(decodeState('')).toBeNull();
  });

  it('devuelve null para "basura!!"', () => {
    expect(decodeState('basura!!')).toBeNull();
  });

  it('devuelve null para base64url válido pero sin estructura AppState', () => {
    // JSON válido pero sin las claves requeridas: parsea pero no tiene estructura AppState
    const fakeJson = btoa(JSON.stringify({ foo: 'bar' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(decodeState(fakeJson)).toBeNull();
  });
});

describe('stateToUrl / stateFromUrl', () => {
  it('stateToUrl produce una URL con parámetro s', () => {
    const s = defaultState();
    const url = stateToUrl(s, 'http://localhost/');
    expect(url).toContain('?s=');
  });

  it('stateFromUrl recupera el estado de la URL generada por stateToUrl', () => {
    const s = defaultState();
    const url = stateToUrl(s, 'http://localhost/');
    const recovered = stateFromUrl(url);
    expect(recovered).toEqual(s);
  });

  it('stateFromUrl devuelve null si no hay parámetro s', () => {
    expect(stateFromUrl('http://localhost/')).toBeNull();
  });

  it('stateFromUrl devuelve null si la URL es inválida', () => {
    expect(stateFromUrl('no-es-una-url')).toBeNull();
  });
});
