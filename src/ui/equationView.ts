/**
 * equationView.ts — Vista de ecuaciones con KaTeX.
 * Muestra el diferencial término a término, el planteo de la integral, y el valor acumulado.
 */

import type { AppState } from '../core/types.js';
import { getSystem } from '../core/coords.js';
import { differentialLatex } from '../core/differential.js';
import { integratePartial, integrateTotal, progressFraction, measureLabel } from '../core/integrate.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderKatex(latex: string, displayMode = false): HTMLElement {
  const span = document.createElement('span');
  try {
    katex.render(latex, span, { throwOnError: false, displayMode });
  } catch {
    span.textContent = latex;
  }
  return span;
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs === 0) return '0';
  if (abs >= 1e4 || (abs < 1e-3 && abs > 0)) {
    return n.toExponential(4);
  }
  return n.toPrecision(5).replace(/\.?0+$/, '');
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEquationView(container: HTMLElement): { update(state: AppState): void } {
  injectStyles();

  const root = document.createElement('div');
  root.className = 'eq-root';
  container.appendChild(root);

  // --- Section: diferencial ---
  const diffSection = buildSection(root, 'Elemento diferencial');
  const diffSymbolRow = document.createElement('div');
  diffSymbolRow.className = 'eq-row eq-center';
  const diffExprRow = document.createElement('div');
  diffExprRow.className = 'eq-row eq-center eq-factors';
  diffSection.appendChild(diffSymbolRow);
  diffSection.appendChild(diffExprRow);

  // --- Section: integral planteada ---
  const intSection = buildSection(root, 'Integral planteada');
  const intExprRow = document.createElement('div');
  intExprRow.className = 'eq-row eq-center';
  intSection.appendChild(intExprRow);

  // --- Section: valor acumulado ---
  const valSection = buildSection(root, 'Valor acumulado');
  const valRow = document.createElement('div');
  valRow.className = 'eq-row eq-center';
  const barRow = document.createElement('div');
  barRow.className = 'eq-progress-wrap';
  const barFill = document.createElement('div');
  barFill.className = 'eq-progress-fill';
  const barTrack = document.createElement('div');
  barTrack.className = 'eq-progress-track';
  barTrack.appendChild(barFill);
  const barLabel = document.createElement('span');
  barLabel.className = 'eq-progress-label';
  barRow.appendChild(barTrack);
  barRow.appendChild(barLabel);
  valSection.appendChild(valRow);
  valSection.appendChild(barRow);

  function update(state: AppState): void {
    const sys = getSystem(state.region.system);
    const sweep = state.sweep;
    const region = state.region;
    const integrand = state.integrand;

    // ---- 1. Diferencial ----
    const diffResult = differentialLatex(sys, sweep);
    diffSymbolRow.innerHTML = '';
    diffExprRow.innerHTML = '';

    // Symbol (dV, dS, dl, point)
    const symbolMap: Record<string, string> = {
      dV: 'dV', dS: 'dS', dl: 'dl', point: '\\bullet',
    };
    const symbolLatex = symbolMap[diffResult.symbol] ?? diffResult.symbol;
    diffSymbolRow.appendChild(renderKatex(symbolLatex + ' =', true));

    // Factors term by term
    if (diffResult.factors.length === 0 || diffResult.symbol === 'point') {
      const msg = document.createElement('span');
      msg.className = 'eq-muted';
      msg.textContent = '(punto — ninguna variable activa)';
      diffExprRow.appendChild(msg);
    } else {
      for (let i = 0; i < diffResult.factors.length; i++) {
        const f = diffResult.factors[i];
        const factorEl = document.createElement('span');
        factorEl.className = `eq-factor${f.active ? ' eq-factor--active' : ' eq-factor--frozen'}`;
        factorEl.appendChild(renderKatex(f.latex));
        factorEl.title = f.active ? `${f.varName} (integrada)` : `${f.varName} (congelada)`;
        diffExprRow.appendChild(factorEl);
        if (i < diffResult.factors.length - 1) {
          const dot = document.createElement('span');
          dot.className = 'eq-dot';
          dot.appendChild(renderKatex('\\cdot'));
          diffExprRow.appendChild(dot);
        }
      }
    }

    // ---- 2. Integral planteada ----
    intExprRow.innerHTML = '';
    const activeCount = sweep.active.filter(Boolean).length;
    const intLatex = buildIntegralLatex(state, sys, activeCount);
    intExprRow.appendChild(renderKatex(intLatex, true));

    // ---- 3. Valor acumulado ----
    valRow.innerHTML = '';

    let partial = 0;
    let total = 0;
    let fraction = 0;

    try {
      partial = integratePartial(region, sys, integrand, sweep, { res: 20 });
      total = integrateTotal(region, sys, integrand, sweep, { res: 20 });
      fraction = progressFraction(region, sys, integrand, sweep, 20);
    } catch {
      // ignore integration errors (e.g. parse errors in scalar expr)
    }

    const mLabel = integrand.mode === 'geometric' ? measureLabel(activeCount) : '';
    const labelText = mLabel ? `${mLabel}: ` : '';
    const valueLatex = `${labelText}${formatNumber(partial)}`;

    valRow.appendChild(renderKatex(valueLatex, true));

    // Progress bar
    const pct = Math.min(1, Math.max(0, isFinite(fraction) ? fraction : 0));
    barFill.style.width = `${(pct * 100).toFixed(1)}%`;
    barLabel.textContent = `${(pct * 100).toFixed(0)}% de ${formatNumber(total)}`;
  }

  return { update };
}

// ---------------------------------------------------------------------------
// Build integral LaTeX from state
// ---------------------------------------------------------------------------

function buildIntegralLatex(state: AppState, sys: ReturnType<typeof getSystem>, activeCount: number): string {
  const { region, integrand, sweep } = state;

  if (activeCount === 0) {
    return '\\text{(sin variables activas)}';
  }

  // Build nested integral signs with limits per active variable, in integration order (outermost = last)
  // order[0] = innermost, order[2] = outermost
  // We wrap from outermost to innermost
  const activeLevels: number[] = [];
  for (let level = 0; level < 3; level++) {
    const c = region.order[level];
    if (sweep.active[c]) activeLevels.push(level);
  }

  // Integrand expression
  let integrandLatex: string;
  if (integrand.mode === 'geometric') {
    integrandLatex = '1';
  } else if (integrand.mode === 'scalar') {
    integrandLatex = integrand.scalar ?? 'f';
  } else {
    integrandLatex = '\\mathbf{F} \\cdot d\\mathbf{S}';
  }

  // Differential part: product of active jacobian factors
  const diffParts: string[] = [];
  for (let level = 0; level < 3; level++) {
    const c = region.order[level];
    if (sweep.active[c]) {
      diffParts.push(sys.jacobianFactorsLatex[c]);
    }
  }
  const diffLatex = diffParts.join('\\,');

  // Build integral signs (outermost first in LaTeX wrapping)
  // activeLevels is innermost-first; we wrap from outermost
  let inner = integrandLatex + '\\,' + diffLatex;

  // Build from innermost (activeLevels[0]) outward
  // We'll show integral signs in order from outermost to innermost visually
  // Collect from outermost to innermost: activeLevels reversed
  for (let i = activeLevels.length - 1; i >= 0; i--) {
    const level = activeLevels[i];
    const lower = boundToLatex(region.bounds[level].lower);
    const upper = boundToLatex(region.bounds[level].upper);
    inner = `\\int_{${lower}}^{${upper}} ${inner}`;
  }

  return inner;
}

function boundToLatex(bound: number | string): string {
  if (typeof bound === 'number') return String(bound);
  // Basic conversions of mathjs to LaTeX
  return bound
    .replace(/\bpi\b/g, '\\pi')
    .replace(/\bsqrt\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/\*/g, ' \\cdot ');
}

// ---------------------------------------------------------------------------
// Section helper
// ---------------------------------------------------------------------------

function buildSection(parent: HTMLElement, title: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'eq-section';
  const h = document.createElement('h4');
  h.className = 'eq-section-title';
  h.textContent = title;
  const body = document.createElement('div');
  body.className = 'eq-section-body';
  section.appendChild(h);
  section.appendChild(body);
  parent.appendChild(section);
  return body;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('eq-styles')) return;
  const style = document.createElement('style');
  style.id = 'eq-styles';
  style.textContent = `
    .eq-root {
      background: #1a1a2e;
      color: #e0e0f0;
      font-family: 'Inter', sans-serif;
      padding: 12px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .eq-section {
      border: 1px solid #2d2d4a;
      border-radius: 6px;
      overflow: hidden;
    }
    .eq-section-title {
      background: #16213e;
      color: #7c5cff;
      margin: 0;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .eq-section-body {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .eq-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .eq-center {
      justify-content: center;
    }
    .eq-factors {
      flex-wrap: wrap;
      gap: 4px;
    }
    .eq-factor {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .eq-factor--active {
      background: rgba(124, 92, 255, 0.25);
      color: #b39aff;
      border: 1px solid rgba(124, 92, 255, 0.4);
    }
    .eq-factor--frozen {
      background: rgba(255,255,255,0.05);
      color: #6060a0;
      border: 1px solid rgba(255,255,255,0.1);
      opacity: 0.55;
    }
    .eq-dot {
      color: #5050a0;
    }
    .eq-muted {
      color: #5050a0;
      font-size: 12px;
      font-style: italic;
    }
    .eq-progress-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .eq-progress-track {
      flex: 1;
      height: 6px;
      background: #2d2d4a;
      border-radius: 3px;
      overflow: hidden;
    }
    .eq-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #7c5cff, #a78bff);
      border-radius: 3px;
      transition: width 0.2s ease;
    }
    .eq-progress-label {
      color: #8080a0;
      font-size: 11px;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}
