/**
 * curvilinear.ts — Herramienta-modal "Coordenadas curvilíneas" de Parcella.
 *
 * Enseña qué es un sistema curvilíneo, de dónde vienen los factores de escala
 * de Lamé (h_u, h_v, h_w) y cómo se obtiene el jacobiano |J| = h_u·h_v·h_w.
 *
 * Llama a makeCurvilinear() de core/coords para calcular h_i y |J| en un punto
 * de muestra por diferencias finitas, sin tocar el estado global de la app.
 */

import katex from 'katex';
import { makeCurvilinear } from '../core/coords.js';

// ---------------------------------------------------------------------------
// Ejemplos precargados
// ---------------------------------------------------------------------------

interface Example {
  label: string;
  xExpr: string;
  yExpr: string;
  zExpr: string;
  u0: number;
  v0: number;
  w0: number;
  note: string;
}

const EXAMPLES: Example[] = [
  {
    label: 'Cartesianas',
    xExpr: 'u',
    yExpr: 'v',
    zExpr: 'w',
    u0: 1, v0: 1, w0: 1,
    note: '|J| = 1 (trivial)',
  },
  {
    label: 'Cilíndricas',
    xExpr: 'u*cos(v)',
    yExpr: 'u*sin(v)',
    zExpr: 'w',
    u0: 2, v0: 0.8, w0: 1,
    note: '|J| = u  (= ρ en notación clásica)',
  },
  {
    label: 'Esféricas',
    xExpr: 'u*sin(v)*cos(w)',
    yExpr: 'u*sin(v)*sin(w)',
    zExpr: 'u*cos(v)',
    u0: 1, v0: 1.0, w0: 0.6,
    note: '|J| = u²·sin(v)  (= r²sinθ, conv. ISO: v=θ polar, w=φ azimutal)',
  },
];

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function createCurvilinearTool(container: HTMLElement): {
  open(): void;
  close(): void;
} {
  injectStyles();

  // ---- Backdrop ----
  const backdrop = document.createElement('div');
  backdrop.className = 'curv-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);

  // ---- Modal ----
  const modal = document.createElement('div');
  modal.className = 'curv-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'curv-title');

  // Header
  const header = document.createElement('div');
  header.className = 'curv-header';

  const titleEl = document.createElement('h2');
  titleEl.id = 'curv-title';
  titleEl.className = 'curv-title';
  titleEl.textContent = 'Coordenadas curvilíneas';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'curv-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.innerHTML = '&times;';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'curv-body';
  modal.appendChild(body);

  container.appendChild(modal);

  // ---- Sección tutorial (HTML estático) ----
  const tutorialDiv = document.createElement('div');
  tutorialDiv.innerHTML = buildTutorialHTML();
  body.appendChild(tutorialDiv);

  // ---- Sección interactiva ----
  const interactive = buildInteractiveSection();
  body.appendChild(interactive.section);

  // ---- Eventos ----
  let katexRendered = false;

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modal.classList.contains('curv-visible')) close();
  });

  function open(): void {
    backdrop.classList.add('curv-visible');
    modal.classList.add('curv-visible');
    closeBtn.focus();
    if (!katexRendered) {
      renderStaticKatex(tutorialDiv);
      katexRendered = true;
    }
    interactive.compute();
  }

  function close(): void {
    backdrop.classList.remove('curv-visible');
    modal.classList.remove('curv-visible');
  }

  return { open, close };
}

// ---------------------------------------------------------------------------
// Sección interactiva
// ---------------------------------------------------------------------------

interface InteractiveSection {
  section: HTMLElement;
  compute(): void;
}

function buildInteractiveSection(): InteractiveSection {
  const section = document.createElement('div');
  section.className = 'curv-section';

  // Título
  const h3 = document.createElement('h3');
  h3.className = 'curv-heading';
  h3.textContent = '2 · Define tu propio sistema';
  section.appendChild(h3);

  // Instrucción
  const intro = document.createElement('p');
  intro.className = 'curv-p';
  intro.innerHTML =
    'Escribe las expresiones mathjs para el mapeo ' +
    '<code class="curv-code">(u,v,w) → (x,y,z)</code>. ' +
    'Puedes usar <code class="curv-code">sin</code>, <code class="curv-code">cos</code>, ' +
    '<code class="curv-code">sqrt</code>, potencias, etc.';
  section.appendChild(intro);

  // Grid de inputs de expresiones
  const grid = document.createElement('div');
  grid.className = 'curv-inputs-grid';

  const xIn = makeTextInput('x(u,v,w) =', 'u');
  const yIn = makeTextInput('y(u,v,w) =', 'v');
  const zIn = makeTextInput('z(u,v,w) =', 'w');

  grid.appendChild(xIn.wrapper);
  grid.appendChild(yIn.wrapper);
  grid.appendChild(zIn.wrapper);
  section.appendChild(grid);

  // Punto de muestra
  const sampleLabel = document.createElement('p');
  sampleLabel.className = 'curv-p curv-p--small';
  sampleLabel.innerHTML =
    'Punto de muestra <span class="curv-muted">(evita ceros que puedan degenerar el jacobiano)</span>:';
  section.appendChild(sampleLabel);

  const sampleGrid = document.createElement('div');
  sampleGrid.className = 'curv-sample-grid';

  const uSample = makeNumberInput('u =', '1');
  const vSample = makeNumberInput('v =', '1');
  const wSample = makeNumberInput('w =', '1');

  sampleGrid.appendChild(uSample.wrapper);
  sampleGrid.appendChild(vSample.wrapper);
  sampleGrid.appendChild(wSample.wrapper);
  section.appendChild(sampleGrid);

  // Caja de resultado
  const resultBox = document.createElement('div');
  resultBox.className = 'curv-result';
  resultBox.setAttribute('aria-live', 'polite');
  section.appendChild(resultBox);

  // Ejemplos precargados
  const exTitle = document.createElement('h3');
  exTitle.className = 'curv-heading curv-heading--mt';
  exTitle.textContent = '3 · Ejemplos precargados';
  section.appendChild(exTitle);

  const exDesc = document.createElement('p');
  exDesc.className = 'curv-p curv-p--small';
  exDesc.textContent =
    'Carga un ejemplo para ver que los jacobianos reproducen los valores clásicos conocidos.';
  section.appendChild(exDesc);

  const exGrid = document.createElement('div');
  exGrid.className = 'curv-examples-grid';

  for (const ex of EXAMPLES) {
    const card = buildExampleCard(ex, () => {
      xIn.input.value = ex.xExpr;
      yIn.input.value = ex.yExpr;
      zIn.input.value = ex.zExpr;
      uSample.input.value = String(ex.u0);
      vSample.input.value = String(ex.v0);
      wSample.input.value = String(ex.w0);
      compute();
    });
    exGrid.appendChild(card);
  }
  section.appendChild(exGrid);

  // Función de cálculo en vivo
  function compute(): void {
    const xExpr = xIn.input.value.trim();
    const yExpr = yIn.input.value.trim();
    const zExpr = zIn.input.value.trim();
    const u0 = parseFloat(uSample.input.value);
    const v0 = parseFloat(vSample.input.value);
    const w0 = parseFloat(wSample.input.value);

    if (!xExpr || !yExpr || !zExpr) {
      resultBox.innerHTML = '';
      resultBox.className = 'curv-result';
      return;
    }

    if (isNaN(u0) || isNaN(v0) || isNaN(w0)) {
      showError(resultBox, 'El punto de muestra contiene valores no numéricos.');
      return;
    }

    try {
      const sys = makeCurvilinear({ xExpr, yExpr, zExpr });
      const [hu, hv, hw] = sys.scaleFactors(u0, v0, w0);
      const J = sys.jacobian(u0, v0, w0);

      if (!isFinite(hu) || !isFinite(hv) || !isFinite(hw) || !isFinite(J)) {
        showError(
          resultBox,
          'Los factores de escala no son finitos en este punto. ' +
          'Prueba con un punto de muestra diferente (evita ceros o singularidades).',
        );
        return;
      }

      showResult(resultBox, hu, hv, hw, J, u0, v0, w0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(resultBox, `Error en la expresión: ${msg}`);
    }
  }

  // Listeners
  for (const inp of [xIn.input, yIn.input, zIn.input,
                     uSample.input, vSample.input, wSample.input]) {
    inp.addEventListener('input', compute);
  }

  return { section, compute };
}

// ---------------------------------------------------------------------------
// Helpers de inputs
// ---------------------------------------------------------------------------

function makeTextInput(
  labelText: string,
  defaultVal: string,
): { wrapper: HTMLElement; input: HTMLInputElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'curv-input-group';

  const lbl = document.createElement('label');
  lbl.className = 'curv-label';
  lbl.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'curv-input';
  input.value = defaultVal;
  input.spellcheck = false;
  input.autocomplete = 'off';

  wrapper.appendChild(lbl);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function makeNumberInput(
  labelText: string,
  defaultVal: string,
): { wrapper: HTMLElement; input: HTMLInputElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'curv-sample-group';

  const lbl = document.createElement('label');
  lbl.className = 'curv-label curv-label--inline';
  lbl.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'curv-input curv-input--small';
  input.value = defaultVal;
  input.step = '0.1';

  lbl.appendChild(input);
  wrapper.appendChild(lbl);
  return { wrapper, input };
}

// ---------------------------------------------------------------------------
// Mostrar resultado / error
// ---------------------------------------------------------------------------

function showResult(
  box: HTMLElement,
  hu: number, hv: number, hw: number, J: number,
  u0: number, v0: number, w0: number,
): void {
  box.innerHTML = '';
  box.className = 'curv-result curv-result--ok';

  // Punto evaluado
  const ptEl = document.createElement('p');
  ptEl.className = 'curv-result-point';
  renderKatexInto(ptEl, `\\text{En }(u,v,w)=(${u0},\\,${v0},\\,${w0}):`);
  box.appendChild(ptEl);

  // Grilla de valores
  const valGrid = document.createElement('div');
  valGrid.className = 'curv-val-grid';

  const pairs: Array<[string, boolean]> = [
    [`h_u = ${hu.toPrecision(4)}`, false],
    [`h_v = ${hv.toPrecision(4)}`, false],
    [`h_w = ${hw.toPrecision(4)}`, false],
    [`|J| = ${J.toPrecision(4)}`, true],
  ];

  for (const [latex, isJ] of pairs) {
    const cell = document.createElement('div');
    cell.className = isJ ? 'curv-val-cell curv-val-cell--J' : 'curv-val-cell';
    renderKatexInto(cell, latex);
    valGrid.appendChild(cell);
  }

  box.appendChild(valGrid);

  // Fórmula dV
  const dvEl = document.createElement('p');
  dvEl.className = 'curv-result-dv';
  renderKatexInto(
    dvEl,
    `dV = h_u \\cdot h_v \\cdot h_w\\;du\\,dv\\,dw = ${J.toPrecision(4)}\\;du\\,dv\\,dw`,
  );
  box.appendChild(dvEl);
}

function showError(box: HTMLElement, msg: string): void {
  box.className = 'curv-result curv-result--error';
  box.textContent = msg;
}

function renderKatexInto(el: HTMLElement, latex: string): void {
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: false });
  } catch {
    el.textContent = latex;
  }
}

// ---------------------------------------------------------------------------
// Tarjeta de ejemplo
// ---------------------------------------------------------------------------

function buildExampleCard(ex: Example, onClick: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'curv-example-card';

  const lbl = document.createElement('div');
  lbl.className = 'curv-example-label';
  lbl.textContent = ex.label;

  const exprs = document.createElement('div');
  exprs.className = 'curv-example-exprs';
  // usamos innerText para evitar inyección
  const lines = [
    `x = ${ex.xExpr}`,
    `y = ${ex.yExpr}`,
    `z = ${ex.zExpr}`,
  ];
  for (const line of lines) {
    const code = document.createElement('code');
    code.textContent = line;
    exprs.appendChild(code);
    exprs.appendChild(document.createElement('br'));
  }

  const note = document.createElement('div');
  note.className = 'curv-example-note';
  note.textContent = ex.note;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'curv-btn curv-btn--ghost curv-btn--sm';
  btn.textContent = 'Cargar';
  btn.addEventListener('click', onClick);

  card.appendChild(lbl);
  card.appendChild(exprs);
  card.appendChild(note);
  card.appendChild(btn);

  return card;
}

// ---------------------------------------------------------------------------
// Tutorial HTML estático (KaTeX se renderiza post-inserción)
// ---------------------------------------------------------------------------

function buildTutorialHTML(): string {
  return `
<div class="curv-section">
  <h3 class="curv-heading">1 · Sistemas de coordenadas curvilíneos</h3>

  <p class="curv-p">
    Un <strong>sistema de coordenadas curvilíneo</strong> define un mapeo diferenciable
    <span data-katex="(u,v,w)\\mapsto(x,y,z)"></span> que "curva" los ejes.
    Las líneas de coordenada constante ya no son rectas sino curvas en el espacio.
    Las coordenadas cilíndricas y esféricas son los ejemplos canónicos.
  </p>

  <p class="curv-p">
    La clave para integrar en estos sistemas es que un pequeño desplazamiento
    <span data-katex="du"></span>
    <em>no produce</em> siempre la misma longitud física: depende del punto.
    El <strong>factor de escala de Lamé</strong>
    <span data-katex="h_i"></span>
    es el factor de conversión:
    <span data-katex="dl_i = h_i\\,du_i"></span>.
  </p>

  <p class="curv-p">
    Dado el vector de posición
    <span data-katex="\\mathbf{r}(u,v,w)=(x,y,z)"></span>, los factores son:
  </p>
  <div data-katex-display="h_u=\\left|\\frac{\\partial\\mathbf{r}}{\\partial u}\\right|,\\quad h_v=\\left|\\frac{\\partial\\mathbf{r}}{\\partial v}\\right|,\\quad h_w=\\left|\\frac{\\partial\\mathbf{r}}{\\partial w}\\right|."></div>

  <p class="curv-p">
    En esta app se calculan por <strong>diferencias finitas centrales</strong>
    con <span data-katex="\\varepsilon=10^{-6}"></span>:
  </p>
  <div data-katex-display="h_u\\approx\\frac{|\\mathbf{r}(u+\\varepsilon,v,w)-\\mathbf{r}(u-\\varepsilon,v,w)|}{2\\varepsilon}."></div>

  <p class="curv-p">
    El <strong>elemento de volumen</strong> resulta del producto de los tres desplazamientos físicos:
  </p>
  <div data-katex-display="dV = (h_u\\,du)\\cdot(h_v\\,dv)\\cdot(h_w\\,dw) = |J|\\;du\\,dv\\,dw,"></div>
  <p class="curv-p">
    donde <span data-katex="|J|=h_u\\cdot h_v\\cdot h_w"></span>
    es el <strong>jacobiano de la transformación</strong>: cuantifica cuánto se amplifica
    o contrae el volumen al cambiar de coordenadas.
  </p>

  <p class="curv-p curv-p--examples">
    Ejemplos clásicos:
    cilíndricas <span data-katex="|J|=\\rho"></span> —
    esféricas <span data-katex="|J|=r^2\\sin\\theta"></span> —
    cartesianas <span data-katex="|J|=1"></span>.
  </p>
</div>
  `.trim();
}

// ---------------------------------------------------------------------------
// Render de KaTeX en contenido estático
// ---------------------------------------------------------------------------

function renderStaticKatex(root: HTMLElement): void {
  // Inline: <span data-katex="...">
  root.querySelectorAll<HTMLElement>('[data-katex]').forEach((el) => {
    const latex = el.getAttribute('data-katex') ?? '';
    try {
      katex.render(latex, el, { throwOnError: false, displayMode: false });
    } catch {
      el.textContent = latex;
    }
  });

  // Display: <div data-katex-display="...">
  root.querySelectorAll<HTMLElement>('[data-katex-display]').forEach((el) => {
    el.className = 'curv-display-math';
    const latex = el.getAttribute('data-katex-display') ?? '';
    try {
      katex.render(latex, el, { throwOnError: false, displayMode: true });
    } catch {
      el.textContent = latex;
    }
  });
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('curv-styles')) return;
  const style = document.createElement('style');
  style.id = 'curv-styles';
  style.textContent = `
    /* Backdrop */
    .curv-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 1200;
    }
    .curv-backdrop.curv-visible { display: block; }

    /* Modal */
    .curv-modal {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1a1a2e;
      border: 1px solid #3d3d60;
      border-radius: 10px;
      width: min(700px, 95vw);
      max-height: 88vh;
      overflow: hidden;
      z-index: 1201;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      flex-direction: column;
      color: #e0e0f0;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
    }
    .curv-modal.curv-visible { display: flex; }

    /* Header */
    .curv-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: #16213e;
      border-bottom: 1px solid #2d2d4a;
      flex-shrink: 0;
    }
    .curv-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #7c5cff;
    }
    .curv-close {
      background: transparent;
      border: none;
      color: #a0a0c0;
      font-size: 22px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .curv-close:hover { color: #e0e0f0; }

    /* Body */
    .curv-body {
      padding: 20px 22px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0;
      line-height: 1.65;
    }

    /* Sections */
    .curv-section {
      border-bottom: 1px solid #2d2d4a;
      padding-bottom: 18px;
      margin-bottom: 18px;
    }
    .curv-section:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
    }
    .curv-heading {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 600;
      color: #7c5cff;
    }
    .curv-heading--mt { margin-top: 18px; }

    /* Texto */
    .curv-p { margin: 0 0 8px; color: #c8c8e8; }
    .curv-p:last-child { margin-bottom: 0; }
    .curv-p--small { font-size: 13px; }
    .curv-p--examples { font-size: 13px; color: #a0a0c8; }
    .curv-muted { color: #6060a0; font-size: 12px; }
    .curv-code {
      background: rgba(124,92,255,0.12);
      color: #b39aff;
      border-radius: 3px;
      padding: 1px 5px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 12px;
    }

    /* Matemáticas display */
    .curv-display-math {
      margin: 8px 0 10px;
      text-align: center;
      overflow-x: auto;
      color: #e0e0f0;
    }

    /* Inputs */
    .curv-inputs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    @media (max-width: 540px) {
      .curv-inputs-grid { grid-template-columns: 1fr; }
    }
    .curv-input-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .curv-label {
      font-size: 12px;
      color: #a0a0c0;
      font-weight: 500;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .curv-label--inline {
      flex-direction: row;
      align-items: center;
      gap: 6px;
    }
    .curv-input {
      background: #0f0f23;
      border: 1px solid #3d3d60;
      border-radius: 5px;
      color: #e0e0f0;
      padding: 6px 9px;
      font-size: 13px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      outline: none;
      transition: border-color 0.15s;
      width: 100%;
      box-sizing: border-box;
    }
    .curv-input:focus { border-color: #7c5cff; }
    .curv-input--small { width: 72px; padding: 5px 7px; }

    /* Muestra */
    .curv-sample-grid {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 14px;
      align-items: center;
    }
    .curv-sample-group { display: flex; align-items: center; }

    /* Resultado */
    .curv-result {
      min-height: 52px;
      border-radius: 7px;
      padding: 10px 14px;
      margin-bottom: 4px;
      font-size: 13px;
      border: 1px solid transparent;
    }
    .curv-result--ok {
      background: rgba(124,92,255,0.08);
      border-color: rgba(124,92,255,0.22);
    }
    .curv-result--error {
      background: rgba(220,50,50,0.1);
      border-color: rgba(220,50,50,0.3);
      color: #f08080;
    }
    .curv-result-point {
      margin: 0 0 8px;
      color: #8080b8;
      font-size: 12px;
    }
    .curv-val-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }
    @media (max-width: 540px) {
      .curv-val-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .curv-val-cell {
      background: rgba(255,255,255,0.04);
      border-radius: 5px;
      padding: 7px 6px;
      text-align: center;
      font-size: 13px;
    }
    .curv-val-cell--J {
      background: rgba(124,92,255,0.16);
      border: 1px solid rgba(124,92,255,0.3);
    }
    .curv-result-dv {
      margin: 4px 0 0;
      color: #a0a0c8;
      font-size: 12px;
    }

    /* Ejemplos */
    .curv-examples-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    @media (max-width: 540px) {
      .curv-examples-grid { grid-template-columns: 1fr; }
    }
    .curv-example-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid #2d2d4a;
      border-radius: 7px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .curv-example-label {
      font-weight: 600;
      color: #a78bff;
      font-size: 13px;
    }
    .curv-example-exprs {
      font-size: 11px;
      color: #a0c0ff;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      line-height: 1.7;
    }
    .curv-example-note {
      font-size: 11px;
      color: #70a070;
      font-style: italic;
      line-height: 1.4;
    }

    /* Botones */
    .curv-btn {
      border-radius: 6px;
      padding: 7px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
      font-family: inherit;
    }
    .curv-btn--ghost {
      background: transparent;
      color: #a78bff;
      border-color: #3d3d60;
    }
    .curv-btn--ghost:hover { border-color: #7c5cff; color: #e0e0f0; }
    .curv-btn--sm { padding: 5px 12px; font-size: 12px; margin-top: 4px; }
  `;
  document.head.appendChild(style);
}
