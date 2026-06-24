/**
 * colors.ts — Color por variable de coordenada (índice canónico 0,1,2),
 * con PALETAS seleccionables en tiempo de ejecución.
 *
 * Cada coordenada tiene un color usado de forma CONSISTENTE en toda la app
 * (factor del diferencial, signo de su integral, su slider, y la zona que esa
 * integral construye en el visor 3D). El usuario puede cambiar la paleta desde
 * la UI (p. ej. una paleta segura para daltónicos).
 */

export type PaletteName = 'calido' | 'daltonico' | 'neon' | 'pastel';

interface PaletteDef {
  label: string;
  colors: [string, string, string]; // [var0, var1, var2]
}

/** Paletas disponibles. Slot 0 = radial, 1 = polar, 2 = azimutal. */
const PALETTES: Record<PaletteName, PaletteDef> = {
  // Cálido (por defecto): ámbar, cian, verde.
  calido: { label: 'Cálido', colors: ['#f5a524', '#38bdf8', '#34d399'] },
  // Seguro para daltónicos (Okabe–Ito): naranja, azul, verde-azulado.
  daltonico: { label: 'Daltónico', colors: ['#e69f00', '#0072b2', '#009e73'] },
  // Neón: magenta, cian, lima.
  neon: { label: 'Neón', colors: ['#ff2d95', '#00e5ff', '#c6ff00'] },
  // Pastel: rosa, celeste, menta.
  pastel: { label: 'Pastel', colors: ['#f6a6b2', '#a6c8ff', '#a6e3c0'] },
};

let current: PaletteName = 'calido';

/** Color por defecto si el índice está fuera de rango. */
const FALLBACK = '#9b8cff';

/** Cambia la paleta activa. La UI debe re-renderizar tras llamarla. */
export function setPalette(name: PaletteName): void {
  if (PALETTES[name]) current = name;
}

/** Nombre de la paleta activa. */
export function getPalette(): PaletteName {
  return current;
}

/** Lista de paletas para poblar un selector. */
export function listPalettes(): { id: PaletteName; label: string; colors: [string, string, string] }[] {
  return (Object.keys(PALETTES) as PaletteName[]).map((id) => ({
    id,
    label: PALETTES[id].label,
    colors: PALETTES[id].colors,
  }));
}

/** Color hex de la variable en el índice canónico dado (0,1,2), según la paleta activa. */
export function varColor(index: number): string {
  return PALETTES[current].colors[index] ?? FALLBACK;
}

/** Igual que varColor pero sin el '#', para usos donde se necesita el hex pelado. */
export function varColorBare(index: number): string {
  return varColor(index).replace('#', '');
}

/** Los tres colores de la paleta activa (por compatibilidad). */
export const VAR_COLORS: readonly [string, string, string] = PALETTES.calido.colors;
