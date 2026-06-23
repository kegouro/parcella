/**
 * colors.ts — Color por variable de coordenada (índice canónico 0,1,2).
 *
 * Cada una de las tres coordenadas de un sistema tiene un color fijo que se usa
 * de forma CONSISTENTE en toda la app: el factor del diferencial en la ecuación,
 * el signo/limite de su integral, su slider de barrido, y la zona que esa integral
 * construye en el visor 3D. Así el estudiante ve "qué integral arma qué parte".
 *
 * Convención de colores por slot (índice canónico de la variable):
 *   0 → ámbar   (radial / x / ρ)
 *   1 → cian    (polar θ / y)
 *   2 → verde   (azimutal φ / z)   ← el azimut sale verde, como en esféricas.
 */

export const VAR_COLORS: readonly [string, string, string] = [
  '#f5a524', // 0 — ámbar
  '#38bdf8', // 1 — cian
  '#34d399', // 2 — verde
];

/** Color hex de la variable en el índice canónico dado (0,1,2). */
export function varColor(index: number): string {
  return VAR_COLORS[index] ?? '#9b8cff';
}

/** Igual que varColor pero sin el '#', para usos donde se necesita el hex pelado. */
export function varColorBare(index: number): string {
  return varColor(index).replace('#', '');
}
