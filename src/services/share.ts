// share.ts — cargar/guardar el estado en la URL para compartir sesiones.
import type { AppState } from '../core/types.js';
import { encodeState, decodeState } from '../core/state.js';

/** Lee el parámetro `?s=` de la URL actual y lo decodifica. null si no hay o es inválido. */
export function loadStateFromUrl(): AppState | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = new URLSearchParams(window.location.search).get('s');
    return s ? decodeState(s) : null;
  } catch {
    return null;
  }
}

/** Refleja el estado en la URL (sin recargar) para que sea copiable/marcable. */
export function syncUrl(state: AppState): void {
  try {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('s', encodeState(state));
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* almacenamiento/URL no disponible: ignorar */
  }
}

/** Copia un enlace compartible al portapapeles. Devuelve true si tuvo éxito. */
export async function copyShareLink(state: AppState): Promise<boolean> {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('s', encodeState(state));
    await navigator.clipboard.writeText(url.toString());
    return true;
  } catch {
    return false;
  }
}
