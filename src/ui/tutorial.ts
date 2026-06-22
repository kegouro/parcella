/**
 * tutorial.ts — Modal/panel de mini-guía de Parcella.
 * Explica en español: diferencial, congelar vs integrar, coordenadas curvilíneas (Fase 2).
 */

export function createTutorial(container: HTMLElement): { open(): void; close(): void } {
  injectStyles();

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'tut-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);

  // Modal
  const modal = document.createElement('div');
  modal.className = 'tut-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'tut-title');

  // Header
  const header = document.createElement('div');
  header.className = 'tut-header';
  const title = document.createElement('h2');
  title.id = 'tut-title';
  title.className = 'tut-title';
  title.textContent = 'Guía rápida — Parcella';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tut-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar guía');
  closeBtn.innerHTML = '&times;';
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'tut-body';
  body.innerHTML = buildContent();
  modal.appendChild(body);

  container.appendChild(modal);

  // Events
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  });

  function open(): void {
    backdrop.classList.add('tut-visible');
    modal.classList.add('tut-visible');
    closeBtn.focus();
  }

  function close(): void {
    backdrop.classList.remove('tut-visible');
    modal.classList.remove('tut-visible');
  }

  return { open, close };
}

// ---------------------------------------------------------------------------
// Content (static HTML — no user data, safe innerHTML)
// ---------------------------------------------------------------------------

function buildContent(): string {
  return `
<section class="tut-section">
  <h3 class="tut-heading">¿Qué es el elemento diferencial?</h3>
  <p>
    El <strong>elemento diferencial</strong> (d<em>l</em>, d<em>S</em>, d<em>V</em>) es la
    unidad infinitesimal de longitud, área o volumen según el número de variables que se integran.
    En Parcella lo llamas <em>la parcella</em>: el pequeño trozo de geometría que barre el espacio.
  </p>
  <ul>
    <li><strong>0 variables activas →</strong> punto (no mide nada).</li>
    <li><strong>1 variable activa →</strong> curva; mide <em>dl</em> (longitud).</li>
    <li><strong>2 variables activas →</strong> parche de superficie; mide <em>dS</em> (área).</li>
    <li><strong>3 variables activas →</strong> sólido; mide <em>dV</em> (volumen).</li>
  </ul>
  <p>
    El diferencial incluye los <strong>factores de escala de Lamé</strong> (h<sub>i</sub>), que
    corrigen la geometría del sistema de coordenadas. Por ejemplo, en cilíndricas el factor de
    d<em>φ</em> es ρ·dφ (un arco, no solo un ángulo).
  </p>
</section>

<section class="tut-section">
  <h3 class="tut-heading">Colores: activo vs congelado</h3>
  <p>
    Cada factor del diferencial aparece en uno de dos estados:
  </p>
  <ul>
    <li>
      <span class="tut-badge tut-badge--active">índigo</span>
      <strong>Activo</strong>: la variable se integra sobre su rango. Contribuye a la medida
      del elemento (dl, dS, dV).
    </li>
    <li>
      <span class="tut-badge tut-badge--frozen">gris</span>
      <strong>Congelado</strong>: la variable está fijada en un valor puntual controlado
      por el slider. No se integra, pero posiciona la parcella en el espacio.
    </li>
  </ul>
  <p>
    Puedes <strong>animar</strong> el barrido con la barra de transporte inferior: el slider
    de progreso mueve la parcella a lo largo de las variables activas y la vista de ecuaciones
    muestra el valor acumulado en tiempo real.
  </p>
</section>

<section class="tut-section">
  <h3 class="tut-heading">Orden de integración</h3>
  <p>
    En una integral múltiple se integra variable a variable (Fubini). El <strong>orden</strong>
    determina qué variable es la más interna (se integra primero, con límites potencialmente
    dependientes de las demás) y cuál es la más externa (límites siempre constantes).
  </p>
  <p>
    Cambia el orden en la sección <em>"Orden de integración"</em> del panel de control.
    El valor numérico de la integral no cambia (Fubini), pero la visualización del barrido sí.
  </p>
</section>

<section class="tut-section">
  <h3 class="tut-heading">Sistemas de coordenadas</h3>
  <dl class="tut-dl">
    <dt>Cartesianas (x, y, z)</dt>
    <dd>Los factores de escala son todos 1. dV = dx dy dz.</dd>

    <dt>Cilíndricas (ρ, φ, z)</dt>
    <dd>Factor de escala para φ: ρ. dV = ρ dρ dφ dz.</dd>

    <dt>Esféricas (r, θ, φ)</dt>
    <dd>
      θ es el ángulo azimutal (0…2π); φ es el ángulo polar desde +z (0…π).
      dV = r² sin φ dr dθ dφ.
    </dd>
  </dl>
</section>

<section class="tut-section tut-phase2">
  <h3 class="tut-heading">Coordenadas curvilíneas — Fase 2 🚧</h3>
  <p>
    En Fase 2 podrás definir tu propio sistema de coordenadas mediante expresiones
    x(u,v,w), y(u,v,w), z(u,v,w). Los factores de escala se calcularán automáticamente
    por diferencias finitas (método de Lamé numérico).
  </p>
  <p>
    Esta función aún no está disponible en la versión actual.
  </p>
</section>
  `.trim();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('tut-styles')) return;
  const style = document.createElement('style');
  style.id = 'tut-styles';
  style.textContent = `
    .tut-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 999;
    }
    .tut-backdrop.tut-visible {
      display: block;
    }
    .tut-modal {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1a1a2e;
      border: 1px solid #3d3d60;
      border-radius: 10px;
      width: min(680px, 95vw);
      max-height: 85vh;
      overflow: hidden;
      z-index: 1000;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      flex-direction: column;
      color: #e0e0f0;
      font-family: 'Inter', sans-serif;
    }
    .tut-modal.tut-visible {
      display: flex;
    }
    .tut-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: #16213e;
      border-bottom: 1px solid #2d2d4a;
      flex-shrink: 0;
    }
    .tut-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #7c5cff;
    }
    .tut-close {
      background: transparent;
      border: none;
      color: #a0a0c0;
      font-size: 22px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .tut-close:hover {
      color: #e0e0f0;
    }
    .tut-body {
      padding: 18px 20px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-size: 14px;
      line-height: 1.6;
    }
    .tut-section {
      border-bottom: 1px solid #2d2d4a;
      padding-bottom: 14px;
    }
    .tut-section:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .tut-heading {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      color: #7c5cff;
    }
    .tut-body p {
      margin: 0 0 6px;
      color: #c8c8e8;
    }
    .tut-body ul {
      margin: 4px 0;
      padding-left: 20px;
      color: #c8c8e8;
    }
    .tut-body li {
      margin-bottom: 4px;
    }
    .tut-dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin: 4px 0;
    }
    .tut-dl dt {
      font-weight: 600;
      color: #a78bff;
    }
    .tut-dl dd {
      color: #c8c8e8;
      margin: 0;
    }
    .tut-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 3px;
      font-size: 12px;
      margin-right: 6px;
    }
    .tut-badge--active {
      background: rgba(124, 92, 255, 0.3);
      color: #b39aff;
      border: 1px solid rgba(124, 92, 255, 0.4);
    }
    .tut-badge--frozen {
      background: rgba(255,255,255,0.07);
      color: #8080b0;
      border: 1px solid rgba(255,255,255,0.12);
    }
    .tut-phase2 {
      background: rgba(124, 92, 255, 0.04);
      border-radius: 6px;
      border: 1px dashed #3d3d60 !important;
      padding: 10px 12px !important;
    }
    .tut-phase2 .tut-heading {
      color: #6b5ccc;
    }
  `;
  document.head.appendChild(style);
}
