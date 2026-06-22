# Parcella — Diseño

> *Parcella* (latín, "cosita pequeña"): un visualizador interactivo del **elemento diferencial**
> (`dl`, `dS`, `dV`) y de cómo se integra una región según qué variables se integran y cuáles se
> congelan. Para Cálculo multivariable y Electromagnetismo. Hermano de **Curvana**.
>
> Autor: **José Labarca** · repo: `github.com/kegouro/parcella` · licencia MIT.

## 1. Problema

Al enseñar integrales múltiples, sólidos en revolución y EM (∫ E·dS, ∮ B·dl, ∫∫∫ ρ dV), cuesta
mostrar **qué pinta tiene el diferencial** y qué significa integrar "solo en θ y no en φ pero sí en r".
Parcella lo vuelve visual: un trocito infinitesimal que **barre** la región según las variables activas.

## 2. Experiencia central (hero)

Escena 3D con un **elemento diferencial** resaltado dentro de la región. Cada variable del sistema
(`x,y,z` / `ρ,φ,z` / `r,θ,φ` / `u,v,w`) tiene un toggle **integrar** y un **slider**:

- **Congelada** → fija en su valor de muestra.
- **Activa** → el trocito **barre** esa dirección, construyendo geometría:
  punto → curva (`dl`) → parche (`dS`) → sólido (`dV`).

Sincronizado en vivo:
- **KaTeX** arma el diferencial término a término, p. ej. `dV = r² sinφ · dr dθ dφ`, resaltando qué
  factor aporta cada variable activa.
- La **integral se acumula** con barra de progreso mientras el barrido avanza.
- El **orden de integración** es elegible (`dφ dθ dr` ⇄) y se ve cómo cambia el barrido.

Caso "θ sí, φ no, r sí": activar `r,θ`, congelar `φ` → se forma el anillo.

## 3. Arquitectura

Disciplina de Curvana: **`core/` puro (sin DOM ni Three.js, 100% testeable)** ↔ `render/` ↔ `ui/`.
Regla de dependencia: `ui/` y `render/` dependen de `core/`, **nunca al revés**.

```
src/
  core/
    types.ts          # tipos compartidos
    parser.ts         # mathjs con los nombres de variable del sistema
    coords.ts         # sistemas: cartesianas, cilíndricas, esféricas, curvilíneas generales.
                      #   cada uno: mapeo (u,v,w)->(x,y,z), factores de escala h_i, jacobiano, diferenciales
    region.ts         # región = sistema + 3 variables, cada una con límites (constantes o f(vars externas))
    library.ts        # presets: esfera, casquete, cilindro, cono, caja, toroide, paraboloide, cuña, disco…
    inequalities.ts   # desigualdades/superficies -> deduce límites (casos canónicos; degrada con gracia)
    differential.ts   # (activas/congeladas) -> geometría barrida + expresión KaTeX del diferencial + medida
    fields.ts         # campo escalar f(x,y,z) y vectorial F(x,y,z); flujo F·dS y circulación F·dl
    integrate.ts      # integración numérica acumulativa de (1 | f | F·n) sobre las variables activas
    state.ts          # estado serializable (compartir por URL)
  render/             # Three.js
    scene.ts          # escena, cámara, luces, ejes, grid
    elementMesh.ts    # el trocito diferencial resaltado
    sweepMesh.ts      # geometría barrida (curva/superficie/sólido) construida incrementalmente
    coordGrid.ts      # iso-superficies del sistema (r=cte, θ=cte, φ=cte…)
    fieldViz.ts       # escalar como color; vectorial como flechas; normales dS, tangentes dl
  ui/                 # DOM
    controlPanel.ts   # sistema · región[biblioteca|manual|desigualdades] · integrando · orden · toggles+sliders
    equationView.ts   # KaTeX en vivo (diferencial + integral + valor acumulado)
    transportBar.ts   # play/pausa/velocidad del barrido
    tutorial.ts       # onboarding (en especial curvilíneas generales)
  services/
    share.ts          # serializar/deserializar estado en URL
    exporter.ts       # export PNG (y GIF en Fase 2)
  app.ts              # orquesta ui <-> core <-> render
  main.ts, style.css
electron/             # app de escritorio mac/win/linux (igual que Curvana)
```

## 4. Stack

TypeScript + Vite · Three.js (3D) · KaTeX (ecuaciones) · mathjs (parser/eval) · Vitest (tests) ·
Electron + electron-builder (escritorio). Web en GitHub Pages. Bilingüe ES/EN. Tema "pizarra" con
acento violeta/índigo (para distinguir de Curvana). Estado compartible por URL; export PNG.

## 5. Fases

**Fase 1 (v1):**
- Coordenadas: cartesianas, cilíndricas, esféricas (polares 2D como caso de cilíndricas).
- Región: **biblioteca + límites manuales** (constantes o funciones de variables externas).
- Integrando: **geométrico (1) + escalar (f)** con integral acumulada.
- Hero completo: barrido + diferencial KaTeX + integral acumulada + orden de integración.
- 3D, compartir URL, export PNG, ES/EN, web + Electron, repo en GitHub.

**Fase 2:**
- Campo **vectorial** F: flujo `∫∫F·dS` y circulación `∮F·dl` (Gauss/Stokes, EM).
- Región por **desigualdades/superficies** -> deduce límites.
- **Curvilíneas generales** (mapeo del usuario, jacobiano automático) + **tutorial** integrado.
- Export GIF.

La arquitectura deja las costuras de Fase 2 listas desde el día 1 (p. ej. `coords.ts` modela el
sistema curvilíneo general como caso base del que cartesianas/cilíndricas/esféricas son instancias).

## 6. Verificación matemática

El motor simbólico/numérico se valida contra **SymPy** (jacobianos, factores de escala, integrales en
forma cerrada de los presets) generando fixtures de test. SymPy se usa localmente vía Python para
ahorrar tokens; el MCP de SymPy queda configurado en `.mcp.json` para sesiones futuras.

## 7. Calidad

- `core/` con **TDD** (Vitest), sin dependencias de DOM/Three.
- README bilingüe ES/EN, capturas, LICENSE MIT.
- CI mínima (build + test) en `.github/workflows`.
