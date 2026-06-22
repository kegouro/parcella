/**
 * state.ts — Estado por defecto y serialización compartible por URL.
 *
 * Módulo puro (sin DOM requerido); accesos a `window`/`location` son
 * defensivos y opcionales para que los tests corran en Node.
 */

import type { AppState } from './types.js';

// ---------------------------------------------------------------------------
// Estado por defecto
// ---------------------------------------------------------------------------

/**
 * Devuelve un AppState inicial didáctico:
 * sistema esférico, bola de radio 1.
 *
 * Convención: θ azimutal (0…2π), φ polar (0…π).
 * Orden de integración interno→externo: r=0, θ=1, φ=2.
 */
export function defaultState(): AppState {
  return {
    region: {
      system: 'spherical',
      order: [0, 1, 2],
      bounds: [
        { lower: 0, upper: 1 },          // r ∈ [0, 1]
        { lower: 0, upper: '2*pi' },      // θ ∈ [0, 2π]
        { lower: 0, upper: 'pi' },        // φ ∈ [0, π]
      ],
    },
    integrand: {
      mode: 'geometric',
    },
    sweep: {
      active: [true, true, true],
      frozen: [0.5, Math.PI, Math.PI / 2],
      progress: [1, 1, 1],
    },
  };
}

// ---------------------------------------------------------------------------
// Serialización base64url (sin +, /, =)
// ---------------------------------------------------------------------------

/**
 * Serializa AppState a un string base64url seguro para URL.
 * Usa JSON compacto → base64url (compatible con Node y navegador).
 */
export function encodeState(s: AppState): string {
  const json = JSON.stringify(s);
  // Codificar unicode de forma segura antes de base64
  const bytes = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1: string) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  const b64 = btoa(bytes);
  // base64url: reemplazar +→-, /→_, quitar =
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Deserializa un string base64url a AppState.
 * Devuelve null si el string es inválido o no se puede parsear.
 */
export function decodeState(str: string): AppState | null {
  try {
    // Revertir base64url → base64 estándar + padding
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = atob(padded);
    // Revertir el escape unicode
    const json = decodeURIComponent(
      bytes
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(json) as AppState;
    // Validación mínima de estructura
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.region ||
      !parsed.integrand ||
      !parsed.sweep
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers URL
// ---------------------------------------------------------------------------

const PARAM = 's';

/**
 * Construye una URL con el estado serializado en el parámetro `?s=…`.
 *
 * @param s       Estado a serializar.
 * @param baseUrl URL base. Si se omite, intenta usar `location.href` (solo navegador).
 */
export function stateToUrl(s: AppState, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
  const url = new URL(base);
  url.searchParams.set(PARAM, encodeState(s));
  return url.toString();
}

/**
 * Extrae y deserializa el estado del parámetro `?s=…` de una URL.
 *
 * @param url URL a parsear. Si se omite, usa `location.href` (solo navegador).
 * @returns AppState si el parámetro existe y es válido, null en caso contrario.
 */
export function stateFromUrl(url?: string): AppState | null {
  try {
    const href = url ?? (typeof window !== 'undefined' ? window.location.href : '');
    if (!href) return null;
    const parsed = new URL(href);
    const param = parsed.searchParams.get(PARAM);
    if (!param) return null;
    return decodeState(param);
  } catch {
    return null;
  }
}
