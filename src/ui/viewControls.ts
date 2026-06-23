/**
 * viewControls.ts — Controles de vista 3D estilo GeoGebra.
 *
 * La cámara del visor está FIJA (no se arrastra); se orienta solo con estos
 * sliders: girar (azimut), inclinar (elevación) y zoom. Emite los valores por
 * un callback; app.ts los conecta a viewer.setView.
 */

export interface ViewControlsHandlers {
  onView(azimuthDeg: number, elevationDeg: number, zoom: number): void;
}

export function createViewControls(
  container: HTMLElement,
  handlers: ViewControlsHandlers,
): { current(): { az: number; el: number; zoom: number } } {
  injectStyles();

  let az = 35;
  let el = 20;
  let zoom = 1;

  const root = document.createElement('div');
  root.className = 'vc-root';
  container.appendChild(root);

  const title = document.createElement('div');
  title.className = 'vc-title';
  title.textContent = 'Vista 3D';
  root.appendChild(title);

  const make = (
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    fmt: (v: number) => string,
    set: (v: number) => void,
  ): void => {
    const row = document.createElement('div');
    row.className = 'vc-row';

    const lbl = document.createElement('span');
    lbl.className = 'vc-label';
    lbl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'vc-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    slider.setAttribute('aria-label', label);

    const val = document.createElement('span');
    val.className = 'vc-val';
    val.textContent = fmt(value);

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      set(v);
      val.textContent = fmt(v);
      handlers.onView(az, el, zoom);
    });

    row.append(lbl, slider, val);
    root.appendChild(row);
  };

  make('Girar', 0, 360, 1, az, (v) => `${v | 0}°`, (v) => (az = v));
  make('Inclinar', -89, 89, 1, el, (v) => `${v | 0}°`, (v) => (el = v));
  make('Zoom', 0.4, 2.5, 0.05, zoom, (v) => `×${v.toFixed(2)}`, (v) => (zoom = v));

  // Emitir la vista inicial.
  handlers.onView(az, el, zoom);

  return { current: () => ({ az, el, zoom }) };
}

function injectStyles(): void {
  if (document.getElementById('vc-styles')) return;
  const style = document.createElement('style');
  style.id = 'vc-styles';
  style.textContent = `
    .vc-root {
      background: var(--panel, #14172a);
      border: 1px solid var(--line, #252a44);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .vc-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--muted, #7a759e);
      margin-bottom: 2px;
    }
    .vc-row {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .vc-label {
      width: 56px;
      flex-shrink: 0;
      font-size: 12px;
      color: var(--text, #dcd8f5);
    }
    .vc-slider {
      flex: 1;
      accent-color: var(--indigo, #7c5cff);
      cursor: pointer;
      min-width: 0;
    }
    .vc-val {
      width: 42px;
      flex-shrink: 0;
      text-align: right;
      font-size: 11px;
      font-family: ui-monospace, monospace;
      color: var(--lavender, #c4b5fd);
    }
  `;
  document.head.appendChild(style);
}
