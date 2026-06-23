/**
 * controlPanel.ts — Panel de control de Parcella.
 * Estética: pizarra (fondo oscuro) + acento índigo (#7c5cff), etiquetas en español.
 * DOM puro, sin frameworks. onChange siempre entrega un AppState nuevo.
 */

import type { AppState, SystemId, Region, Integrand } from '../core/types.js';
import { getSystem } from '../core/coords.js';
import { PRESETS } from '../core/library.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface PanelHandlers {
  onChange(next: AppState): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function label(text: string, forId?: string): HTMLLabelElement {
  const lbl = el('label', 'pc-label');
  lbl.textContent = text;
  if (forId) lbl.htmlFor = forId;
  return lbl;
}

function renderLatex(latex: string): HTMLSpanElement {
  const span = el('span', 'pc-latex');
  try {
    katex.render(latex, span, { throwOnError: false, displayMode: false });
  } catch {
    span.textContent = latex;
  }
  return span;
}

/** Genera un ID único para labels */
let _uid = 0;
function uid(): string {
  return `pc-${++_uid}`;
}

// Regiones por defecto sensatas para cada sistema al cambiar
function defaultRegionForSystem(sysId: SystemId): Region {
  switch (sysId) {
    case 'cylindrical':
      return {
        system: 'cylindrical',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: '2 * pi' },
          { lower: 0, upper: 2 },
        ],
      };
    case 'spherical':
      return {
        system: 'spherical',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: '2 * pi' },
          { lower: 0, upper: 'pi' },
        ],
      };
    default:
      return {
        system: 'cartesian',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: 1 },
          { lower: 0, upper: 1 },
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Factory principal
// ---------------------------------------------------------------------------

export function createControlPanel(
  container: HTMLElement,
  handlers: PanelHandlers,
  initial: AppState,
): { update(state: AppState): void } {
  let state: AppState = initial;

  // ------------------------------------------------------------------ styles
  injectStyles();

  // ------------------------------------------------------------------ root
  const root = el('div', 'pc-panel');
  container.appendChild(root);

  // ====================== 1. SISTEMA DE COORDENADAS ======================
  const sysSection = buildSection('Sistema de coordenadas');
  root.appendChild(sysSection.el);

  const sysSelect = el('select', 'pc-select');
  sysSelect.id = uid();

  const systemOpts: Array<{ id: SystemId; label: string; disabled?: boolean }> = [
    { id: 'cartesian', label: 'Cartesianas' },
    { id: 'cylindrical', label: 'Cilíndricas' },
    { id: 'spherical', label: 'Esféricas' },
    { id: 'curvilinear', label: 'Curvilíneas — Fase 2', disabled: true },
  ];

  for (const opt of systemOpts) {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.disabled) {
      o.disabled = true;
      o.title = 'Disponible en Fase 2';
    }
    sysSelect.appendChild(o);
  }
  sysSelect.value = state.region.system;

  const sysLabel = label('Sistema:', sysSelect.id);
  const sysRow = el('div', 'pc-row');
  sysRow.appendChild(sysLabel);
  sysRow.appendChild(sysSelect);
  sysSection.body.appendChild(sysRow);

  sysSelect.addEventListener('change', () => {
    const newSysId = sysSelect.value as SystemId;
    if (newSysId === 'curvilinear') {
      sysSelect.value = state.region.system; // revert
      return;
    }
    const newRegion = defaultRegionForSystem(newSysId);
    const newState: AppState = {
      ...state,
      region: newRegion,
      sweep: {
        active: [true, true, true],
        frozen: [0.5, 0.5, 0.5],
        progress: [1, 1, 1],
      },
    };
    handlers.onChange(newState);
  });

  // ====================== 2. REGIÓN ======================
  const regionSection = buildSection('Región de integración');
  root.appendChild(regionSection.el);

  // Tabs: Biblioteca | Manual | Desigualdades
  const tabBar = el('div', 'pc-tabs');
  const tabBib = buildTab('Biblioteca', true);
  const tabMan = buildTab('Manual', false);
  const tabDes = buildTab('Desigualdades (Fase 2)', false, true);

  tabBar.appendChild(tabBib.btn);
  tabBar.appendChild(tabMan.btn);
  tabBar.appendChild(tabDes.btn);
  regionSection.body.appendChild(tabBar);

  // --- Pestaña: Biblioteca ---
  const bibPane = el('div', 'pc-pane');
  const bibSelect = el('select', 'pc-select');
  bibSelect.id = uid();

  // Grupo por sistema
  const systemLabels: Record<SystemId, string> = {
    cartesian: 'Cartesianas',
    polar: 'Polares',
    cylindrical: 'Cilíndricas',
    spherical: 'Esféricas',
    curvilinear: 'Curvilíneas',
  };

  const presetsGrouped: Partial<Record<SystemId, typeof PRESETS>> = {};
  for (const p of PRESETS) {
    if (!presetsGrouped[p.system]) presetsGrouped[p.system] = [];
    presetsGrouped[p.system]!.push(p);
  }

  // Opción vacía
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '— Selecciona una región —';
  bibSelect.appendChild(emptyOpt);

  for (const [sysId, presets] of Object.entries(presetsGrouped) as [SystemId, typeof PRESETS][]) {
    const group = document.createElement('optgroup');
    group.label = systemLabels[sysId] ?? sysId;
    for (const p of presets) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.label;
      group.appendChild(o);
    }
    bibSelect.appendChild(group);
  }

  const bibDesc = el('p', 'pc-desc');
  bibDesc.textContent = 'Elige un preset para explorar distintas regiones de integración.';

  const bibLabel = label('Preset:', bibSelect.id);
  const bibRow = el('div', 'pc-row');
  bibRow.appendChild(bibLabel);
  bibRow.appendChild(bibSelect);
  bibPane.appendChild(bibRow);
  bibPane.appendChild(bibDesc);

  bibSelect.addEventListener('change', () => {
    const id = bibSelect.value;
    if (!id) return;
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    bibDesc.textContent = preset.description;
    const newRegion = preset.build();
    const newSweep = preset.defaultSweep();
    const newIntegrand: Integrand = preset.defaultIntegrand
      ? preset.defaultIntegrand()
      : { mode: 'geometric' };
    const newState: AppState = {
      region: newRegion,
      sweep: newSweep,
      integrand: newIntegrand,
    };
    handlers.onChange(newState);
  });

  // --- Pestaña: Manual ---
  const manPane = el('div', 'pc-pane');
  manPane.style.display = 'none';

  // Se construirá dinámicamente en update()
  let manualInputs: ReturnType<typeof buildManualInputs> | null = null;

  function rebuildManualInputs(s: AppState): void {
    manPane.innerHTML = '';
    manualInputs = buildManualInputs(manPane, s, handlers, () => state);
  }

  rebuildManualInputs(state);

  // --- Pestaña: Desigualdades ---
  const desPane = el('div', 'pc-pane');
  desPane.style.display = 'none';
  const desMsg = el('p', 'pc-phase2');
  desMsg.textContent = 'Disponible en Fase 2. Esta pestaña permitirá definir la región mediante desigualdades implícitas.';
  desPane.appendChild(desMsg);

  regionSection.body.appendChild(bibPane);
  regionSection.body.appendChild(manPane);
  regionSection.body.appendChild(desPane);

  // Tab switching
  tabBib.btn.addEventListener('click', () => {
    switchTab([tabBib, tabMan, tabDes], [bibPane, manPane, desPane], 0);
  });
  tabMan.btn.addEventListener('click', () => {
    switchTab([tabBib, tabMan, tabDes], [bibPane, manPane, desPane], 1);
  });
  tabDes.btn.addEventListener('click', () => {
    // Fase 2: no switch, mostrar tooltip
  });

  // ====================== 3. ORDEN DE INTEGRACIÓN ======================
  const orderSection = buildSection('Orden de integración');
  root.appendChild(orderSection.el);

  let orderSelects: HTMLSelectElement[] = [];
  const orderContainer = el('div', 'pc-order-container');
  orderSection.body.appendChild(orderContainer);

  function buildOrderSelects(s: AppState): void {
    orderContainer.innerHTML = '';
    orderSelects = [];
    const sys = getSystem(s.region.system);
    const desc = el('p', 'pc-small');
    desc.textContent = 'Selecciona el orden interno → externo de integración:';
    orderContainer.appendChild(desc);

    const levels = ['Más interno (1°)', 'Intermedio (2°)', 'Más externo (3°)'];

    for (let level = 0; level < 3; level++) {
      const row = el('div', 'pc-row');
      const id = uid();
      const lbl = label(`${levels[level]}:`, id);
      const sel = el('select', 'pc-select');
      sel.id = id;

      for (let c = 0; c < 3; c++) {
        const o = document.createElement('option');
        o.value = String(c);
        o.textContent = `${sys.vars[c].label} (${sys.vars[c].name})`;
        sel.appendChild(o);
      }
      sel.value = String(s.region.order[level]);
      row.appendChild(lbl);
      row.appendChild(sel);
      orderContainer.appendChild(row);
      orderSelects.push(sel);

      sel.addEventListener('change', () => {
        const newOrder = orderSelects.map((s2) => parseInt(s2.value)) as [number, number, number];
        // Validate no duplicates
        const set = new Set(newOrder);
        if (set.size < 3) return; // ignore invalid
        const newState: AppState = {
          ...state,
          region: { ...state.region, order: newOrder },
        };
        handlers.onChange(newState);
      });
    }
  }

  buildOrderSelects(state);

  // ====================== 4. VARIABLES ======================
  const varsSection = buildSection('Variables');
  root.appendChild(varsSection.el);

  let varRows: ReturnType<typeof buildVarRows> | null = null;
  const varsContainer = el('div', 'pc-vars-container');
  varsSection.body.appendChild(varsContainer);

  function buildVarRows(s: AppState): {
    update(s2: AppState): void;
  } {
    varsContainer.innerHTML = '';
    const sys = getSystem(s.region.system);
    const rows: Array<{
      toggleInput: HTMLInputElement;
      slider: HTMLInputElement;
    }> = [];

    for (let c = 0; c < 3; c++) {
      const varSpec = sys.vars[c];
      const row = el('div', 'pc-var-row');

      // LaTeX label
      const latexSpan = renderLatex(varSpec.latex);
      latexSpan.className = 'pc-var-latex';

      // Toggle "integrar"
      const toggleId = uid();
      const toggleInput = el('input', 'pc-toggle');
      toggleInput.type = 'checkbox';
      toggleInput.id = toggleId;
      toggleInput.checked = s.sweep.active[c];
      const toggleLabel = label('Integrar', toggleId);
      toggleLabel.className = 'pc-toggle-label';

      // Slider para valor congelado
      const sliderId = uid();
      const sliderInput = el('input', 'pc-slider');
      sliderInput.type = 'range';
      sliderInput.id = sliderId;
      sliderInput.min = '0';
      sliderInput.max = '1';
      sliderInput.step = '0.01';
      sliderInput.value = String(s.sweep.frozen[c]);
      sliderInput.disabled = s.sweep.active[c];
      const sliderLabel = label('Posición:', sliderId);
      sliderLabel.className = 'pc-small';

      const sliderRow = el('div', 'pc-slider-row');
      sliderRow.appendChild(sliderLabel);
      sliderRow.appendChild(sliderInput);

      rows.push({ toggleInput, slider: sliderInput });

      const idx = c;
      toggleInput.addEventListener('change', () => {
        const newActive = [...state.sweep.active] as [boolean, boolean, boolean];
        newActive[idx] = toggleInput.checked;
        sliderInput.disabled = toggleInput.checked;
        const newState: AppState = {
          ...state,
          sweep: { ...state.sweep, active: newActive },
        };
        handlers.onChange(newState);
      });

      sliderInput.addEventListener('input', () => {
        const newFrozen = [...state.sweep.frozen] as [number, number, number];
        newFrozen[idx] = parseFloat(sliderInput.value);
        const newState: AppState = {
          ...state,
          sweep: { ...state.sweep, frozen: newFrozen },
        };
        handlers.onChange(newState);
      });

      row.appendChild(latexSpan);
      row.appendChild(toggleInput);
      row.appendChild(toggleLabel);
      row.appendChild(sliderRow);
      varsContainer.appendChild(row);
    }

    return {
      update(s2: AppState) {
        for (let c = 0; c < 3; c++) {
          rows[c].toggleInput.checked = s2.sweep.active[c];
          rows[c].slider.value = String(s2.sweep.frozen[c]);
          rows[c].slider.disabled = s2.sweep.active[c];
        }
      },
    };
  }

  varRows = buildVarRows(state);

  // ====================== 5. INTEGRANDO ======================
  const intSection = buildSection('Integrando');
  root.appendChild(intSection.el);

  const intContainer = el('div', 'pc-int-container');
  intSection.body.appendChild(intContainer);

  let intControls: ReturnType<typeof buildIntegrandControls> | null = null;

  function buildIntegrandControls(s: AppState): {
    update(s2: AppState): void;
  } {
    intContainer.innerHTML = '';

    const radioGroup = el('div', 'pc-radio-group');
    const modes: Array<{ value: string; labelText: string; disabled?: boolean }> = [
      { value: 'geometric', labelText: '1 (geométrico)' },
      { value: 'scalar', labelText: 'f escalar' },
      { value: 'vector', labelText: 'F⃗ vectorial (Fase 2)', disabled: true },
    ];

    const radios: HTMLInputElement[] = [];
    const groupName = uid();

    for (const m of modes) {
      const radioId = uid();
      const radio = el('input', 'pc-radio');
      radio.type = 'radio';
      radio.name = groupName;
      radio.id = radioId;
      radio.value = m.value;
      radio.checked = s.integrand.mode === m.value;
      if (m.disabled) {
        radio.disabled = true;
      }

      const lbl = label(m.labelText, radioId);
      if (m.disabled) {
        lbl.className = 'pc-label pc-phase2-label';
        lbl.title = 'Disponible en Fase 2';
      }

      const radioRow = el('div', 'pc-radio-row');
      radioRow.appendChild(radio);
      radioRow.appendChild(lbl);
      radioGroup.appendChild(radioRow);
      radios.push(radio);
    }

    intContainer.appendChild(radioGroup);

    // Scalar expression input
    const scalarRow = el('div', 'pc-row');
    const scalarId = uid();
    const scalarLabel = label('Expresión f:', scalarId);
    const scalarInput = el('input', 'pc-input');
    scalarInput.type = 'text';
    scalarInput.id = scalarId;
    scalarInput.placeholder = 'ej. x^2 + y^2 + z^2';
    scalarInput.value = s.integrand.scalar ?? '';
    scalarInput.disabled = s.integrand.mode !== 'scalar';
    scalarInput.setAttribute('aria-label', 'Expresión del campo escalar f');

    scalarRow.appendChild(scalarLabel);
    scalarRow.appendChild(scalarInput);
    intContainer.appendChild(scalarRow);

    function updateScalarInputState(mode: string): void {
      scalarInput.disabled = mode !== 'scalar';
    }

    for (const radio of radios) {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        const mode = radio.value;
        updateScalarInputState(mode);
        const newIntegrand: Integrand = {
          mode: mode as Integrand['mode'],
          scalar: mode === 'scalar' ? (scalarInput.value || '1') : state.integrand.scalar,
        };
        const newState: AppState = {
          ...state,
          integrand: newIntegrand,
        };
        handlers.onChange(newState);
      });
    }

    scalarInput.addEventListener('change', () => {
      const newState: AppState = {
        ...state,
        integrand: { ...state.integrand, scalar: scalarInput.value },
      };
      handlers.onChange(newState);
    });

    return {
      update(s2: AppState) {
        for (const radio of radios) {
          radio.checked = s2.integrand.mode === radio.value;
        }
        scalarInput.value = s2.integrand.scalar ?? '';
        updateScalarInputState(s2.integrand.mode);
      },
    };
  }

  intControls = buildIntegrandControls(state);

  // ====================== UPDATE ======================
  function update(newState: AppState): void {
    const prevSystem = state.region.system;
    state = newState;

    // Update system selector
    sysSelect.value = newState.region.system;

    // Rebuild order and manual inputs if system changed
    if (newState.region.system !== prevSystem) {
      buildOrderSelects(newState);
      rebuildManualInputs(newState);
      varRows = buildVarRows(newState);
      intControls = buildIntegrandControls(newState);
    } else {
      // Update order selects
      for (let i = 0; i < 3; i++) {
        if (orderSelects[i]) orderSelects[i].value = String(newState.region.order[i]);
      }
      // Update manual inputs
      if (manualInputs) manualInputs.update(newState);
      // Update var rows
      if (varRows) varRows.update(newState);
      // Update integrand controls
      if (intControls) intControls.update(newState);
    }
  }

  return { update };
}

// ---------------------------------------------------------------------------
// Manual inputs builder
// ---------------------------------------------------------------------------

function buildManualInputs(
  container: HTMLElement,
  initialState: AppState,
  handlers: PanelHandlers,
  getState: () => AppState,
): { update(s: AppState): void } {
  const sys = getSystem(initialState.region.system);
  const inputPairs: Array<{ lowerInput: HTMLInputElement; upperInput: HTMLInputElement }> = [];

  const desc = document.createElement('p');
  desc.className = 'pc-small';
  desc.textContent = 'Edita los límites de integración (expresiones mathjs, pueden depender de variables externas).';
  container.appendChild(desc);

  for (let level = 0; level < 3; level++) {
    const c = initialState.region.order[level];
    const varSpec = sys.vars[c];

    const group = document.createElement('fieldset');
    group.className = 'pc-fieldset';
    const legend = document.createElement('legend');
    legend.className = 'pc-legend';
    // Render LaTeX inline in legend
    try {
      legend.appendChild(renderLatex(varSpec.latex));
    } catch {
      legend.textContent = varSpec.label;
    }
    group.appendChild(legend);

    const lowerRow = document.createElement('div');
    lowerRow.className = 'pc-row';
    const lowerId = `pc-low-${level}-${Date.now()}`;
    const lowerLbl = label('Inferior:', lowerId);
    const lowerInput = document.createElement('input');
    lowerInput.className = 'pc-input';
    lowerInput.type = 'text';
    lowerInput.id = lowerId;
    const rawLow = initialState.region.bounds[level].lower;
    lowerInput.value = String(rawLow);
    lowerInput.setAttribute('aria-label', `Límite inferior de ${varSpec.label}`);
    lowerRow.appendChild(lowerLbl);
    lowerRow.appendChild(lowerInput);

    const upperRow = document.createElement('div');
    upperRow.className = 'pc-row';
    const upperId = `pc-up-${level}-${Date.now()}`;
    const upperLbl = label('Superior:', upperId);
    const upperInput = document.createElement('input');
    upperInput.className = 'pc-input';
    upperInput.type = 'text';
    upperInput.id = upperId;
    const rawUp = initialState.region.bounds[level].upper;
    upperInput.value = String(rawUp);
    upperInput.setAttribute('aria-label', `Límite superior de ${varSpec.label}`);
    upperRow.appendChild(upperLbl);
    upperRow.appendChild(upperInput);

    group.appendChild(lowerRow);
    group.appendChild(upperRow);
    container.appendChild(group);

    inputPairs.push({ lowerInput, upperInput });

    function emitChange(): void {
      const state = getState();
      const newBounds = state.region.bounds.map((b, i) => {
        const pair = inputPairs[i];
        if (!pair) return b;
        const lower = parseBound(pair.lowerInput.value);
        const upper = parseBound(pair.upperInput.value);
        return { lower, upper };
      }) as [{ lower: number | string; upper: number | string }, { lower: number | string; upper: number | string }, { lower: number | string; upper: number | string }];

      const newState: AppState = {
        ...state,
        region: { ...state.region, bounds: newBounds },
      };
      handlers.onChange(newState);
    }

    lowerInput.addEventListener('change', emitChange);
    upperInput.addEventListener('change', emitChange);
  }

  return {
    update(s: AppState) {
      for (let level = 0; level < 3; level++) {
        const pair = inputPairs[level];
        if (!pair) continue;
        pair.lowerInput.value = String(s.region.bounds[level].lower);
        pair.upperInput.value = String(s.region.bounds[level].upper);
      }
    },
  };
}

function parseBound(value: string): number | string {
  const trimmed = value.trim();
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') return num;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Section builder
// ---------------------------------------------------------------------------

function buildSection(title: string): { el: HTMLElement; body: HTMLElement } {
  const section = document.createElement('section');
  section.className = 'pc-section';
  const h = document.createElement('h3');
  h.className = 'pc-section-title';
  h.textContent = title;
  const body = document.createElement('div');
  body.className = 'pc-section-body';
  section.appendChild(h);
  section.appendChild(body);
  return { el: section, body };
}

// ---------------------------------------------------------------------------
// Tab builder
// ---------------------------------------------------------------------------

function buildTab(
  text: string,
  active: boolean,
  disabled = false,
): { btn: HTMLButtonElement } {
  const btn = document.createElement('button');
  btn.className = `pc-tab${active ? ' pc-tab--active' : ''}${disabled ? ' pc-tab--disabled' : ''}`;
  btn.textContent = text;
  if (disabled) {
    btn.disabled = true;
    btn.title = 'Disponible en Fase 2';
    btn.setAttribute('aria-disabled', 'true');
  }
  return { btn };
}

function switchTab(
  tabs: Array<{ btn: HTMLButtonElement }>,
  panes: HTMLElement[],
  activeIdx: number,
): void {
  for (let i = 0; i < tabs.length; i++) {
    const isActive = i === activeIdx;
    tabs[i].btn.classList.toggle('pc-tab--active', isActive);
    panes[i].style.display = isActive ? '' : 'none';
  }
}

// ---------------------------------------------------------------------------
// Styles injection
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('pc-styles')) return;
  const style = document.createElement('style');
  style.id = 'pc-styles';
  style.textContent = `
    .pc-panel {
      background: #1a1a2e;
      color: #e0e0f0;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      padding: 16px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
    }
    .pc-section {
      border: 1px solid #2d2d4a;
      border-radius: 6px;
      overflow: hidden;
    }
    .pc-section-title {
      background: #16213e;
      color: #7c5cff;
      margin: 0;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pc-section-body {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pc-label {
      color: #a0a0c0;
      font-size: 12px;
      min-width: 80px;
    }
    .pc-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pc-select, .pc-input {
      background: #0f0f23;
      border: 1px solid #3d3d60;
      color: #e0e0f0;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 13px;
      flex: 1;
      min-width: 0;
      outline: none;
    }
    .pc-select:focus, .pc-input:focus {
      border-color: #7c5cff;
      box-shadow: 0 0 0 2px rgba(124, 92, 255, 0.2);
    }
    .pc-select option:disabled {
      color: #555580;
    }
    .pc-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
    }
    .pc-tab {
      background: transparent;
      border: 1px solid #3d3d60;
      color: #a0a0c0;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pc-tab:hover:not(:disabled) {
      border-color: #7c5cff;
      color: #e0e0f0;
    }
    .pc-tab--active {
      background: #7c5cff;
      border-color: #7c5cff;
      color: white;
    }
    .pc-tab--disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .pc-pane {
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .pc-desc {
      color: #8080a0;
      font-size: 12px;
      font-style: italic;
      margin: 4px 0 0;
    }
    .pc-small {
      color: #8080a0;
      font-size: 12px;
      margin: 0 0 4px;
    }
    .pc-phase2 {
      color: #6060a0;
      font-size: 12px;
      font-style: italic;
    }
    .pc-phase2-label {
      color: #6060a0;
    }
    .pc-fieldset {
      border: 1px solid #2d2d4a;
      border-radius: 4px;
      padding: 6px 10px;
      margin: 0;
    }
    .pc-legend {
      color: #7c5cff;
      font-size: 13px;
      padding: 0 4px;
    }
    .pc-order-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pc-var-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-bottom: 1px solid #2d2d4a;
    }
    .pc-var-row:last-child {
      border-bottom: none;
    }
    .pc-var-latex {
      min-width: 28px;
      text-align: center;
    }
    .pc-toggle {
      accent-color: #7c5cff;
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .pc-toggle-label {
      color: #a0a0c0;
      font-size: 12px;
      cursor: pointer;
      min-width: 55px;
    }
    .pc-slider-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
    }
    .pc-slider {
      flex: 1;
      accent-color: #7c5cff;
      cursor: pointer;
    }
    .pc-slider:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .pc-radio-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pc-radio-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pc-radio {
      accent-color: #7c5cff;
    }
    .pc-int-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `;
  document.head.appendChild(style);
}
