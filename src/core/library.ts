/**
 * library.ts — Presets de regiones de integración para Parcella.
 *
 * Convenciones (compartidas):
 *   Cilíndricas: vars [ρ, φ, z] índices [0,1,2].
 *   Esféricas:   vars [r, θ, φ] índices [0,1,2].
 *                θ azimutal ∈ [0,2π), φ polar ∈ [0,π] desde +z.
 *
 * `order`: de MÁS INDEPENDIENTE (order[0]) a MÁS DEPENDIENTE (order[2]).
 */

import type { Region, SystemId, SweepState, Integrand } from './types.js';

// ---------------------------------------------------------------------------
// Interfaz Preset
// ---------------------------------------------------------------------------

export interface Preset {
  /** Identificador único del preset. */
  id: string;
  /** Nombre corto para mostrar en UI. */
  label: string;
  /** Descripción didáctica breve (español). */
  description: string;
  /** Sistema de coordenadas recomendado. */
  system: SystemId;
  /** Construye la Region del preset (parametrizable con valores por defecto). */
  build(): Region;
  /** Estado de barrido por defecto (todas las variables activas). */
  defaultSweep(): SweepState;
  /** Integrando por defecto (opcional; si se omite se integra 1 = volumen). */
  defaultIntegrand?(): Integrand;
}

// ---------------------------------------------------------------------------
// Helper: SweepState con todas las variables activas
// ---------------------------------------------------------------------------
function fullSweep(): SweepState {
  return {
    active: [true, true, true],
    frozen: [0, 0, 0],
    progress: [0, 0, 0],
  };
}

// ---------------------------------------------------------------------------
// PRESETS
// ---------------------------------------------------------------------------

export const PRESETS: Preset[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. BOLA SÓLIDA (esféricas)
  //    r ∈ [0,R], θ ∈ [0,2π), φ ∈ [0,π]
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'solid-sphere',
    label: 'Bola sólida',
    description:
      'Esfera sólida de radio R. Integra r desde 0 hasta R, ' +
      'ángulo azimutal θ en [0,2π) y ángulo polar φ en [0,π].',
    system: 'spherical',
    build(): Region {
      const R = 1;
      return {
        system: 'spherical',
        // order: r (0) más independiente → θ (1) → φ (2) más dependiente
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: R },           // r
          { lower: 0, upper: `2 * pi` },    // θ
          { lower: 0, upper: `pi` },         // φ
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CASCARÓN ESFÉRICO (esféricas)
  //    r ∈ [R1,R2], θ ∈ [0,2π), φ ∈ [0,π]
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'spherical-shell',
    label: 'Cascarón esférico',
    description:
      'Región entre dos esferas concéntricas de radios R₁ y R₂. ' +
      'Útil para distribuciones de carga con simetría esférica.',
    system: 'spherical',
    build(): Region {
      const R1 = 0.5;
      const R2 = 1;
      return {
        system: 'spherical',
        order: [0, 1, 2],
        bounds: [
          { lower: R1, upper: R2 },
          { lower: 0, upper: `2 * pi` },
          { lower: 0, upper: `pi` },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. SEMIESFERA (esféricas)
  //    r ∈ [0,R], θ ∈ [0,2π), φ ∈ [0,π/2]  (mitad superior z ≥ 0)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'hemisphere',
    label: 'Semiesfera',
    description:
      'Mitad superior de una esfera sólida (z ≥ 0). ' +
      'El ángulo polar φ recorre solo [0,π/2].',
    system: 'spherical',
    build(): Region {
      const R = 1;
      return {
        system: 'spherical',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: R },
          { lower: 0, upper: `2 * pi` },
          { lower: 0, upper: `pi / 2` },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. CASQUETE ESFÉRICO (esféricas)
  //    r ∈ [0,R], θ ∈ [0,2π), φ ∈ [0,α]  (casquete de ángulo α desde el polo)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'spherical-cap',
    label: 'Casquete esférico',
    description:
      'Sólido en forma de casquete: la porción de la esfera de radio R ' +
      'delimitada por el ángulo polar φ ≤ α (desde el polo norte).',
    system: 'spherical',
    build(): Region {
      const R = 1;
      const alpha = Math.PI / 4; // 45°
      return {
        system: 'spherical',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: R },
          { lower: 0, upper: `2 * pi` },
          { lower: 0, upper: alpha },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. CILINDRO (cilíndricas)
  //    ρ ∈ [0,R], φ ∈ [0,2π), z ∈ [0,H]
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cylinder',
    label: 'Cilindro',
    description:
      'Cilindro recto de radio R y altura H. ' +
      'Las variables son independientes entre sí.',
    system: 'cylindrical',
    build(): Region {
      const R = 1;
      const H = 2;
      return {
        system: 'cylindrical',
        // order: ρ (0) → φ (1) → z (2)  (todos independientes)
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: R },
          { lower: 0, upper: `2 * pi` },
          { lower: 0, upper: H },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CONO (cilíndricas)
  //    z ∈ [0,H] (más independiente), φ ∈ [0,2π), ρ ∈ [0, z*tan(α)]
  //    Convención task: order de más independiente a más dependiente.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cone',
    label: 'Cono',
    description:
      'Cono recto de semiángulo α y altura H. ' +
      'El radio ρ depende de la altura z: ρ ∈ [0, z·tan(α)].',
    system: 'cylindrical',
    build(): Region {
      const H = 2;
      const alpha = Math.PI / 4; // 45° → tan(α)=1
      const tanAlpha = Math.tan(alpha);
      return {
        system: 'cylindrical',
        // order: z (2) más independiente → φ (1) → ρ (0) más dependiente
        // bounds[k] corresponde a la variable order[k]
        order: [2, 1, 0],
        bounds: [
          { lower: 0, upper: H },                     // bounds[0] → order[0]=z → z ∈ [0,H]
          { lower: 0, upper: `2 * pi` },               // bounds[1] → order[1]=φ
          { lower: 0, upper: `z * ${tanAlpha}` },      // bounds[2] → order[2]=ρ → depende de z
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CAJA (cartesianas)
  //    x ∈ [x1,x2], y ∈ [y1,y2], z ∈ [z1,z2]
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'box',
    label: 'Caja rectangular',
    description:
      'Paralelepípedo (caja) con límites fijos en x, y, z. ' +
      'El ejemplo usa el cubo unitario [0,1]³.',
    system: 'cartesian',
    build(): Region {
      return {
        system: 'cartesian',
        // order: x (0) → y (1) → z (2)
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: 1 },
          { lower: 0, upper: 1 },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. TOROIDE (cilíndricas)
  //    φ ∈ [0,2π) más independiente → θ_toroidal ∈ [0,2π) → ρ ∈ [R-a, R+a]
  //    Aquí usamos una aproximación: ρ ∈ [R-a, R+a], z ∈ [-√(a²-(ρ-R)²), +√(...)]
  //    Simplificación: ρ ∈ [R-a,R+a], φ ∈ [0,2π), z ∈ [-√(a²-(ρ-R)²), √(a²-(ρ-R)²)]
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'torus',
    label: 'Toroide',
    description:
      'Región interior de un toro con radio mayor R y radio menor a. ' +
      'En cilíndricas: ρ ∈ [R−a, R+a], φ ∈ [0,2π), z ∈ [−√(a²−(ρ−R)²), √(a²−(ρ−R)²)].',
    system: 'cylindrical',
    build(): Region {
      const R = 2;   // radio mayor
      const a = 0.5; // radio menor
      return {
        system: 'cylindrical',
        // order: ρ (0) más independiente → φ (1) → z (2) depende de ρ
        order: [0, 1, 2],
        bounds: [
          { lower: R - a, upper: R + a },
          { lower: 0, upper: `2 * pi` },
          {
            lower: `-(sqrt(${a}^2 - (rho - ${R})^2))`,
            upper: `sqrt(${a}^2 - (rho - ${R})^2)`,
          },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. PARABOLOIDE (cilíndricas)
  //    ρ ∈ [0,R] más independiente → φ ∈ [0,2π) → z ∈ [0, ρ²/c]
  //    Paraboloide z = ρ²/c (apunta hacia +z), base en z=0 hasta z=R²/c.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'paraboloid',
    label: 'Paraboloide',
    description:
      'Región bajo el paraboloide de revolución z = ρ²/c, ' +
      'con ρ ∈ [0,R]. El techo depende de ρ.',
    system: 'cylindrical',
    build(): Region {
      const R = 1;
      const c = 1; // curvatura: z_max = R²/c
      return {
        system: 'cylindrical',
        // order: ρ (0) → φ (1) → z (2) depende de ρ
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: R },
          { lower: 0, upper: `2 * pi` },
          { lower: 0, upper: `rho^2 / ${c}` },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. CUÑA (cartesianas)
  //     x ∈ [0,L], y ∈ [0,W], z ∈ [0, H*(1 - x/L)]
  //     Prisma triangular (cuña): la altura decrece linealmente con x.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'wedge',
    label: 'Cuña',
    description:
      'Prisma triangular (cuña): x ∈ [0,L], y ∈ [0,W], ' +
      'z ∈ [0, H·(1−x/L)]. La altura decrece linealmente.',
    system: 'cartesian',
    build(): Region {
      const L = 2;
      const W = 1;
      const H = 1;
      return {
        system: 'cartesian',
        // order: x (0) más independiente → y (1) → z (2) depende de x
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: L },
          { lower: 0, upper: W },
          { lower: 0, upper: `${H} * (1 - x / ${L})` },
        ],
      };
    },
    defaultSweep: fullSweep,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. DISCO (cilíndricas, 2D)
  //     ρ ∈ [0,R], φ ∈ [0,2π), z = 0 (congelado)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'disk',
    label: 'Disco (2D)',
    description:
      'Disco plano de radio R en el plano z=0. ' +
      'Solo se integran ρ y φ; z está congelada en 0.',
    system: 'cylindrical',
    build(): Region {
      const R = 1;
      return {
        system: 'cylindrical',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: R },
          { lower: 0, upper: `2 * pi` },
          { lower: 0, upper: 0 },   // z congelada en 0
        ],
      };
    },
    defaultSweep(): SweepState {
      return {
        active: [true, true, false],
        frozen: [0, 0, 0],
        progress: [0, 0, 0],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 12. ANILLO / ANNULUS (cilíndricas, 2D)
  //     ρ ∈ [R1,R2], φ ∈ [0,2π), z = 0
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'annulus',
    label: 'Anillo (annulus)',
    description:
      'Región anular plana entre radios R₁ y R₂ en el plano z=0. ' +
      'Ejemplo clásico de integración en coordenadas polares.',
    system: 'cylindrical',
    build(): Region {
      const R1 = 0.5;
      const R2 = 1;
      return {
        system: 'cylindrical',
        order: [0, 1, 2],
        bounds: [
          { lower: R1, upper: R2 },
          { lower: 0, upper: `2 * pi` },
          { lower: 0, upper: 0 },   // z congelada en 0
        ],
      };
    },
    defaultSweep(): SweepState {
      return {
        active: [true, true, false],
        frozen: [0, 0, 0],
        progress: [0, 0, 0],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 13. DISCO POLAR (polares, 2D)
  //     r ∈ [0,1], φ ∈ [0,2π), z = 0
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'polar-disk',
    label: 'Disco polar',
    description:
      'Disco unitario en coordenadas polares. ' +
      'r ∈ [0,1], φ ∈ [0,2π); z está congelada en el plano z=0.',
    system: 'polar',
    build(): Region {
      return {
        system: 'polar',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },          // r
          { lower: 0, upper: `2 * pi` },   // φ
          { lower: 0, upper: 0 },          // z congelada en 0
        ],
      };
    },
    defaultSweep(): SweepState {
      return {
        active: [true, true, false],
        frozen: [0, 0, 0],
        progress: [0, 0, 0],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 14. CORONA POLAR (polares, 2D)
  //     r ∈ [0.5,1], φ ∈ [0,2π), z = 0
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'polar-annulus',
    label: 'Corona polar',
    description:
      'Anillo plano (corona) en coordenadas polares: r ∈ [0.5,1], φ ∈ [0,2π). ' +
      'z congelada en el plano z=0.',
    system: 'polar',
    build(): Region {
      return {
        system: 'polar',
        order: [0, 1, 2],
        bounds: [
          { lower: 0.5, upper: 1 },        // r
          { lower: 0, upper: `2 * pi` },   // φ
          { lower: 0, upper: 0 },          // z congelada en 0
        ],
      };
    },
    defaultSweep(): SweepState {
      return {
        active: [true, true, false],
        frozen: [0, 0, 0],
        progress: [0, 0, 0],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 15. SECTOR POLAR (polares, 2D)
  //     r ∈ [0,1], φ ∈ [0,π/2), z = 0
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'polar-sector',
    label: 'Sector polar',
    description:
      'Sector circular de 90° en coordenadas polares: r ∈ [0,1], φ ∈ [0,π/2). ' +
      'z congelada en el plano z=0.',
    system: 'polar',
    build(): Region {
      return {
        system: 'polar',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },          // r
          { lower: 0, upper: `pi / 2` },   // φ
          { lower: 0, upper: 0 },          // z congelada en 0
        ],
      };
    },
    defaultSweep(): SweepState {
      return {
        active: [true, true, false],
        frozen: [0, 0, 0],
        progress: [0, 0, 0],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Utilidad: buscar preset por id
// ---------------------------------------------------------------------------

/**
 * Devuelve el preset con el id dado, o undefined si no existe.
 */
export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
