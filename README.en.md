<p align="right"><a href="README.md">🇪🇸 Español</a> · 🇬🇧 English</p>

# ▪ Parcella

**See the differential. Integrate what you see.**

![Parcella](docs/screenshot.png)

Parcella is an interactive 3D web visualizer for the **differential element** (`dl`, `dS`, `dV`), built for Multivariable Calculus and Electromagnetism. It solves a concrete teaching problem: it is hard to show **what `dV` looks like** in spherical coordinates, or what it means to integrate "in `θ` yes, in `φ` no, in `r` yes". Parcella makes it visual: a tiny infinitesimal piece that **sweeps** the region according to which variables are active and which are frozen, building geometry in real time and accumulating the integral as it goes.

---

## ✨ Features

- **Animated differential element** — the piece sweeps the region based on active variables: point → curve (`dl`) → patch (`dS`) → solid (`dV`). Freezing a variable lowers the dimension of the element.
- **Differential built term by term** — KaTeX assembles the expression live, for example `dV = r² sinφ · dr dθ dφ`, highlighting the factor contributed by each active variable.
- **Live accumulated integral with progress bar** — the value is computed numerically as the sweep advances, with play/pause/speed controls.
- **Three coordinate systems** — Cartesian (`x, y, z`), cylindrical (`ρ, φ, z`), and spherical (`r, θ, φ`); general curvilinear coordinates in Phase 2.
- **Three ways to define the region:**
  - **Library of 12 presets** — solid sphere, spherical shell, hemisphere, spherical cap, cylinder, cone, rectangular box, torus, paraboloid, wedge, disk (2D), and annulus.
  - **Manual bounds** — constants or expressions depending on outer variables (e.g. `rho^2 / c`).
  - **Inequalities** — automatic bound deduction (Phase 2).
- **Geometric or scalar integrand** — integrate `1` (volume/area/length) or a scalar function `f(x,y,z)`. Vector field `F·dS`, `F·dl` for EM in Phase 2.
- **Configurable integration order** — change the order (`dφ dθ dr` ⇄) and watch how the sweep changes.
- **Share by URL** — the full state is serialized into the URL.
- **Export PNG** — capture the 3D scene with one click.
- **"Blackboard" theme** — dark background with violet/indigo accent.
- **Web + desktop** — deployed on GitHub Pages; also available as an Electron app for macOS, Windows, and Linux.

---

## 🏗️ Architecture

The same discipline as the sibling project Curvana: **pure and testable `core/`** (no DOM, no Three.js) decoupled from `render/` and `ui/`. The dependency rule is strict: `ui/` and `render/` may import from `core/`, but `core/` never imports from them.

```
src/
  core/
    types.ts          # shared types
    parser.ts         # mathjs with coordinate system variable names
    coords.ts         # coordinate systems: (u,v,w)→(x,y,z) mapping, scale factors, jacobian
    region.ts         # region = system + 3 variables with bounds
    library.ts        # 12 region presets
    inequalities.ts   # inequalities → deduce bounds (Phase 2)
    differential.ts   # swept geometry + KaTeX expression + measure
    fields.ts         # scalar/vector field; flux F·dS, circulation F·dl
    integrate.ts      # cumulative numerical integration
    state.ts          # serializable state (URL)
  render/             # Three.js
    scene.ts          # scene, camera, lights, axes, grid
    elementMesh.ts    # highlighted differential element
    sweepMesh.ts      # incremental swept geometry
    coordGrid.ts      # coordinate iso-surfaces
    fieldViz.ts       # scalar as color; vector as arrows
  ui/                 # DOM + KaTeX
    controlPanel.ts   # system · region · integrand · order · toggles + sliders
    equationView.ts   # live KaTeX (differential + integral + accumulated value)
    transportBar.ts   # play/pause/speed
    tutorial.ts       # onboarding
  services/
    share.ts          # serialize/deserialize state to/from URL
    exporter.ts       # PNG export
  app.ts              # orchestrates ui ↔ core ↔ render
  main.ts
  style.css
electron/             # desktop app (macOS · Windows · Linux)
```

The engine (`core/`) is validated against **SymPy** (jacobians, scale factors, closed-form integrals for all presets) and has **~300 tests** run with Vitest.

---

## 🚀 Development

```bash
npm install        # install dependencies

npm run dev        # development server (Vite, HMR)
npm run build      # TypeScript check + production bundle
npm test           # run tests (Vitest)

npm run app        # build + launch Electron app
npm run dist:mac   # package for macOS (.dmg, .zip)
npm run dist:win   # package for Windows (.exe, portable)
npm run dist:linux # package for Linux (.AppImage, .deb)
```

---

## 📐 The math

The volume differential element varies by coordinate system:

| System | `dV` |
|---|---|
| Cartesian | `dx dy dz` |
| Cylindrical | `ρ dρ dφ dz` |
| Spherical | `r² sinφ dr dθ dφ` |

> Spherical convention used: `θ` is the **azimuthal** angle `∈ [0, 2π)` and `φ` is the **polar** angle from `+z`, `∈ [0, π]`.

The core idea of Parcella is that **freezing a variable reduces the dimension of the element**:

- All 3 active → `dV` (solid).
- 2 active, 1 frozen → `dS` (surface patch).
- 1 active, 2 frozen → `dl` (curve segment).

Choosing which variables to integrate and which to freeze is, literally, choosing which part of the region gets accumulated.

---

## License

MIT — see [LICENSE](LICENSE).

Made by **José Labarca** · sibling of [Curvana](https://github.com/kegouro/curvana).
