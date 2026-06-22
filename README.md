<p align="right">🇪🇸 Español · <a href="README.en.md">🇬🇧 English</a></p>

# ▪ Parcella

**Mira el diferencial. Integra lo que ves.**

![Parcella](docs/screenshot.png)

Parcella es un visualizador web 3D interactivo del **elemento diferencial** (`dl`, `dS`, `dV`) para Cálculo multivariable y Electromagnetismo. Resuelve un problema concreto de enseñanza: resulta difícil mostrar **qué pinta tiene `dV`** en esféricas, o qué significa integrar "en `θ` sí, en `φ` no, en `r` sí". Parcella lo vuelve visual: un trocito infinitesimal que **barre** la región según las variables que se integran y las que se congelan, construyendo geometría en tiempo real y acumulando la integral mientras avanza.

---

## ✨ Características

- **Elemento diferencial animado** — el trocito barre la región según qué variables están activas: punto → curva (`dl`) → parche (`dS`) → sólido (`dV`). Congelar una variable baja la dimensión del elemento.
- **Diferencial construido término a término** — KaTeX ensambla la expresión en vivo, por ejemplo `dV = r² sinφ · dr dθ dφ`, resaltando el factor de cada variable activa.
- **Integral acumulada con barra de progreso** — el valor se calcula numéricamente mientras el barrido avanza, con control de play/pausa/velocidad.
- **Tres sistemas de coordenadas** — cartesianas (`x, y, z`), cilíndricas (`ρ, φ, z`) y esféricas (`r, θ, φ`); curvilíneas generales en Fase 2.
- **Tres modos de definir la región:**
  - **Biblioteca de 12 presets** — bola sólida, cascarón esférico, semiesfera, casquete esférico, cilindro, cono, caja rectangular, toroide, paraboloide, cuña, disco (2D) y anillo (annulus).
  - **Límites manuales** — constantes o expresiones que dependen de variables externas (p. ej. `rho^2 / c`).
  - **Desigualdades** — deducción automática de límites (Fase 2).
- **Integrando geométrico o escalar** — integra `1` (volumen/área/longitud) o una función escalar `f(x,y,z)`. Vectorial `F·dS`, `F·dl` para EM en Fase 2.
- **Orden de integración configurable** — cambia el orden (`dφ dθ dr` ⇄) y observa cómo varía el barrido.
- **Compartir por URL** — el estado completo se serializa en la URL.
- **Exportar PNG** — captura de la escena 3D con un clic.
- **Tema "pizarra"** — fondo oscuro con acento violeta/índigo.
- **Web + escritorio** — desplegado en GitHub Pages; también disponible como app Electron para macOS, Windows y Linux.

---

## 🏗️ Arquitectura

La misma disciplina del proyecto hermano Curvana: **`core/` puro y testeable** (sin DOM ni Three.js) desacoplado de `render/` y `ui/`. La regla de dependencia es estricta: `ui/` y `render/` pueden importar de `core/`, pero `core/` nunca importa de ellos.

```
src/
  core/
    types.ts          # tipos compartidos
    parser.ts         # mathjs con los nombres de variable del sistema
    coords.ts         # sistemas de coordenadas: mapeo (u,v,w)→(x,y,z), factores de escala, jacobiano
    region.ts         # región = sistema + 3 variables con sus límites
    library.ts        # 12 presets de regiones
    inequalities.ts   # desigualdades → deduce límites (Fase 2)
    differential.ts   # geometría barrida + expresión KaTeX + medida
    fields.ts         # campo escalar/vectorial; flujo F·dS, circulación F·dl
    integrate.ts      # integración numérica acumulativa
    state.ts          # estado serializable (URL)
  render/             # Three.js
    scene.ts          # escena, cámara, luces, ejes, grid
    elementMesh.ts    # el trocito diferencial resaltado
    sweepMesh.ts      # geometría barrida incremental
    coordGrid.ts      # iso-superficies del sistema
    fieldViz.ts       # escalar como color; vectorial como flechas
  ui/                 # DOM + KaTeX
    controlPanel.ts   # sistema · región · integrando · orden · toggles + sliders
    equationView.ts   # KaTeX en vivo (diferencial + integral + valor acumulado)
    transportBar.ts   # play/pausa/velocidad del barrido
    tutorial.ts       # onboarding
  services/
    share.ts          # serializar/deserializar estado en URL
    exporter.ts       # export PNG
  app.ts              # orquesta ui ↔ core ↔ render
  main.ts
  style.css
electron/             # app de escritorio (macOS · Windows · Linux)
```

El motor (`core/`) está validado contra **SymPy** (jacobianos, factores de escala, integrales en forma cerrada de los presets) y cuenta con **~300 tests** ejecutados con Vitest.

---

## 🚀 Desarrollo

```bash
npm install       # instala dependencias

npm run dev       # servidor de desarrollo (Vite, HMR)
npm run build     # compila TypeScript + bundle de producción
npm test          # ejecuta los tests (Vitest)

npm run app       # build + lanza la app Electron
npm run dist:mac  # empaqueta para macOS (.dmg, .zip)
npm run dist:win  # empaqueta para Windows (.exe, portable)
npm run dist:linux # empaqueta para Linux (.AppImage, .deb)
```

---

## 📐 La matemática

El diferencial de volumen varía según el sistema de coordenadas:

| Sistema | `dV` |
|---|---|
| Cartesianas | `dx dy dz` |
| Cilíndricas | `ρ dρ dφ dz` |
| Esféricas | `r² sinφ dr dθ dφ` |

> Convención esférica usada: `θ` es el ángulo **azimutal** `∈ [0, 2π)` y `φ` es el ángulo **polar** desde `+z`, `∈ [0, π]`.

La idea central de Parcella es que **congelar una variable reduce la dimensión del elemento**:

- Las 3 activas → `dV` (sólido).
- 2 activas, 1 congelada → `dS` (parche de superficie).
- 1 activa, 2 congeladas → `dl` (segmento de curva).

Cambiar qué variables se integran y cuáles se congelan es, literalmente, elegir qué parte de la región se acumula.

---

## Licencia

MIT — ver [LICENSE](LICENSE).

Hecho por **José Labarca** · hermano de [Curvana](https://github.com/kegouro/curvana).
