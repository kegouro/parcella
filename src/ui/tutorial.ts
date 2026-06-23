/**
 * tutorial.ts — Modal de guía completa y pantalla de bienvenida de Parcella.
 * Explica en español qué hace la app, el elemento diferencial, sistemas de coordenadas y modos.
 */

// ---------------------------------------------------------------------------
// localStorage helpers (exportados para que app.ts los use)
// ---------------------------------------------------------------------------

const WELCOME_KEY = 'parcella.welcomeSeen';

export function hasSeenWelcome(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(WELCOME_KEY) === 'true';
}

export function markWelcomeSeen(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WELCOME_KEY, 'true');
}

// ---------------------------------------------------------------------------
// Factory principal
// ---------------------------------------------------------------------------

export function createTutorial(container: HTMLElement): {
  open(): void;
  close(): void;
  openWelcome(): void;
} {
  injectStyles();

  // ---- Backdrop compartido ----
  const backdrop = document.createElement('div');
  backdrop.className = 'tut-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);

  // ====================== MODAL GUÍA COMPLETA ======================
  const modal = document.createElement('div');
  modal.className = 'tut-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'tut-title');

  const header = document.createElement('div');
  header.className = 'tut-header';
  const title = document.createElement('h2');
  title.id = 'tut-title';
  title.className = 'tut-title';
  title.textContent = 'Guía completa — Parcella';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tut-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar guía');
  closeBtn.innerHTML = '&times;';
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = document.createElement('div');
  body.className = 'tut-body';
  body.innerHTML = buildFullContent();
  modal.appendChild(body);

  container.appendChild(modal);

  // ====================== MODAL INICIO RÁPIDO ======================
  const welcome = document.createElement('div');
  welcome.className = 'tut-modal tut-welcome';
  welcome.setAttribute('role', 'dialog');
  welcome.setAttribute('aria-modal', 'true');
  welcome.setAttribute('aria-labelledby', 'tut-welcome-title');

  const welcomeBody = document.createElement('div');
  welcomeBody.className = 'tut-body';
  welcomeBody.innerHTML = buildWelcomeContent();
  welcome.appendChild(welcomeBody);

  container.appendChild(welcome);

  // ====================== EVENTOS ======================
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  });

  // Botón "Empezar" en welcome
  welcomeBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('[data-action="start"]')) {
      const checkbox = welcomeBody.querySelector<HTMLInputElement>('#tut-noshowinput');
      if (checkbox?.checked) markWelcomeSeen();
      closeWelcome();
    }

    if (target.closest('[data-action="full-guide"]')) {
      const checkbox = welcomeBody.querySelector<HTMLInputElement>('#tut-noshowinput');
      if (checkbox?.checked) markWelcomeSeen();
      closeWelcome();
      open();
    }
  });

  // ====================== FUNCIONES ======================
  function open(): void {
    backdrop.classList.add('tut-visible');
    modal.classList.add('tut-visible');
    welcome.classList.remove('tut-visible');
    closeBtn.focus();
  }

  function close(): void {
    backdrop.classList.remove('tut-visible');
    modal.classList.remove('tut-visible');
    welcome.classList.remove('tut-visible');
  }

  function closeWelcome(): void {
    backdrop.classList.remove('tut-visible');
    welcome.classList.remove('tut-visible');
  }

  function openWelcome(): void {
    backdrop.classList.add('tut-visible');
    welcome.classList.add('tut-visible');
    modal.classList.remove('tut-visible');
    const startBtn = welcomeBody.querySelector<HTMLButtonElement>('[data-action="start"]');
    startBtn?.focus();
  }

  return { open, close, openWelcome };
}

// ---------------------------------------------------------------------------
// Contenido: GUÍA COMPLETA
// ---------------------------------------------------------------------------

function buildFullContent(): string {
  return `
<section class="tut-section">
  <h3 class="tut-heading">1 · ¿Qué es Parcella?</h3>
  <p>
    <strong>Parcella</strong> es un visualizador interactivo de <em>diferenciales geométricos</em>
    e integrales múltiples. Su nombre viene de la palabra italiana/latina para "pequeño trozo":
    la app te permite ver y manipular el elemento diferencial —ese pequeño trozo de línea, área
    o volumen— antes y mientras se integra.
  </p>
  <p>
    Úsala para entender intuitivamente:
  </p>
  <ul>
    <li>Por qué <em>dA = r dr dφ</em> y no simplemente <em>dr dφ</em>.</li>
    <li>Qué significa "integrar sobre un disco" en polares frente a cartesianas.</li>
    <li>Cómo cambia el elemento de volumen entre sistemas de coordenadas.</li>
    <li>La relación visual entre región, orden de integración y barrido.</li>
  </ul>
</section>

<section class="tut-section">
  <h3 class="tut-heading">2 · El elemento diferencial ("la parcella")</h3>
  <p>
    El <strong>elemento diferencial</strong> es el objeto infinitesimal que la integral acumula.
    Dependiendo de cuántas variables se integran, ese objeto tiene distinta dimensión:
  </p>
  <ul>
    <li><strong>0 variables activas →</strong> un punto en el espacio (sin medida).</li>
    <li><strong>1 variable activa →</strong> una curva infinitesimal; mide longitud (<em>dl</em>).</li>
    <li><strong>2 variables activas →</strong> un parche de superficie; mide área (<em>dS</em>).</li>
    <li><strong>3 variables activas →</strong> un ladrillo de volumen; mide volumen (<em>dV</em>).</li>
  </ul>
  <p>
    En la vista 3D verás este trozo resaltado (la parcella) junto al resto de la región
    ya barrida, para que puedas seguir cómo se construye la integral paso a paso.
  </p>
</section>

<section class="tut-section">
  <h3 class="tut-heading">3 · Integrar vs congelar una variable</h3>
  <p>
    Cada variable del sistema de coordenadas puede estar en uno de dos estados:
  </p>
  <ul>
    <li>
      <span class="tut-badge tut-badge--active">activa / integrar</span>
      La variable <strong>barre su rango</strong> completo (de límite inferior a superior).
      Contribuye a la dimensión del elemento diferencial: sube de punto a curva, a superficie, a volumen.
    </li>
    <li>
      <span class="tut-badge tut-badge--frozen">congelada / fijar</span>
      La variable <strong>se queda fija</strong> en el valor del slider correspondiente.
      Posiciona la parcella en el espacio pero no añade dimensión.
    </li>
  </ul>
  <p>
    <strong>Ejemplo en esféricas:</strong> si activas θ y r (pero congelas φ),
    obtienes un arco de anillo plano (2D); si además activas φ, obtienes la esfera completa (3D).
  </p>
</section>

<section class="tut-section">
  <h3 class="tut-heading">4 · El diferencial término a término (factores de escala)</h3>
  <p>
    En coordenadas curvilíneas, el diferencial físico de cada variable no es solo
    <em>d(var)</em>: hay que multiplicar por el <strong>factor de escala de Lamé</strong>
    (<em>h<sub>i</sub></em>), que convierte el incremento de coordenada en longitud real de arco.
  </p>
  <ul>
    <li>Cartesianas: <em>h = 1</em> para todas → <em>dV = dx dy dz</em>.</li>
    <li>Polares 2D: <em>h<sub>φ</sub> = r</em> → <em>dA = r dr dφ</em>. El arco de un ángulo <em>dφ</em> a distancia <em>r</em> mide <em>r dφ</em>.</li>
    <li>Cilíndricas: <em>h<sub>φ</sub> = ρ</em> → <em>dV = ρ dρ dφ dz</em>.</li>
    <li>Esféricas: <em>h<sub>θ</sub> = r sinφ</em>, <em>h<sub>φ</sub> = r</em> → <em>dV = r² sinφ dr dθ dφ</em>.</li>
  </ul>
  <p>
    En la ecuación del panel verás cada factor resaltado por separado, y se ilumina
    el que corresponde a la variable que el barrido está recorriendo en ese instante.
  </p>
</section>

<section class="tut-section">
  <h3 class="tut-heading">5 · La integral acumulada y la barra de progreso</h3>
  <p>
    La <strong>barra de progreso</strong> (panel inferior) controla el avance del barrido:
    a medida que la mueves, la parcella recorre la región y el valor de la integral parcial
    se actualiza en tiempo real.
  </p>
  <p>
    El número mostrado es <em>∫∫…∫ f dV</em> evaluado hasta el punto actual del barrido.
    Si el integrando es <em>1</em> (modo geométrico), obtienes la medida acumulada
    (longitud / área / volumen) de la región ya recorrida.
  </p>
</section>

<section class="tut-section">
  <h3 class="tut-heading">6 · Sistemas de coordenadas</h3>
  <dl class="tut-dl">
    <dt>Cartesianas (x, y, z)</dt>
    <dd>Factores de escala todos 1. <em>dV = dx dy dz</em>. Ideal para cubos, paralelepípedos, regiones rectangulares.</dd>

    <dt>Polares (r, φ) — sistema planar</dt>
    <dd>
      2D en el plano z = 0. <em>r ≥ 0</em>, <em>φ ∈ [0, 2π)</em>.
      Elemento de área: <em>dA = r dr dφ</em>.
      La tercera variable (z) está bloqueada; no se puede integrar en este modo.
    </dd>

    <dt>Cilíndricas (ρ, φ, z)</dt>
    <dd>
      <em>ρ ≥ 0</em>, <em>φ ∈ [0, 2π)</em>, z libre.
      Factor de escala en φ: <em>ρ</em>. <em>dV = ρ dρ dφ dz</em>.
    </dd>

    <dt>Esféricas (r, θ, φ)</dt>
    <dd>
      <em>θ</em> es el ángulo <strong>azimutal</strong> (horizontal, 0…2π);
      <em>φ</em> es el ángulo <strong>polar</strong> medido desde +z (0…π).
      <em>dV = r² sinφ dr dθ dφ</em>.
    </dd>

    <dt>Curvilíneas — Fase 2 🚧</dt>
    <dd>Define tu propio mapeo x(u,v,w), y(u,v,w), z(u,v,w). Los factores de Lamé se calculan automáticamente.</dd>
  </dl>
</section>

<section class="tut-section">
  <h3 class="tut-heading">7 · Modos: Explorar y Derivar</h3>
  <ul>
    <li>
      <strong>Explorar</strong> (modo libre): manipula variables, sistemas, regiones e integrando
      a tu ritmo. Ves el elemento diferencial y la integral en tiempo real sin pasos guiados.
    </li>
    <li>
      <strong>Derivar</strong> (guiado, Fase 2): la app te lleva paso a paso por la construcción
      del diferencial de volumen: primero el factor de cada variable, luego el jacobiano,
      finalmente la integral. Pensado para estudio formal.
    </li>
  </ul>
</section>

<section class="tut-section">
  <h3 class="tut-heading">8 · Región e integrando</h3>
  <p><strong>Región</strong>: el dominio de integración. Puedes definirla de dos formas:</p>
  <ul>
    <li><em>Biblioteca</em>: presets predefinidos (disco, esfera, cubo, cono, etc.) agrupados por sistema.</li>
    <li><em>Manual</em>: edita directamente los límites inferior y superior de cada variable.
        Los límites pueden ser expresiones mathjs que dependan de variables externas
        (p. ej. <code>sqrt(1 - x^2)</code>).</li>
  </ul>
  <p><strong>Integrando</strong>: qué se suma en cada elemento diferencial:</p>
  <ul>
    <li><em>1 (geométrico)</em>: mide la longitud / área / volumen puro de la región.</li>
    <li><em>f escalar</em>: integra un campo escalar definido por expresión mathjs. Puedes usar las variables del sistema activo o x, y, z.</li>
    <li><em>F vectorial</em> (Fase 2): flujo o circulación de un campo vectorial.</li>
  </ul>
</section>
  `.trim();
}

// ---------------------------------------------------------------------------
// Contenido: INICIO RÁPIDO (welcome)
// ---------------------------------------------------------------------------

function buildWelcomeContent(): string {
  return `
<div class="tut-welcome-inner">
  <div class="tut-welcome-logo">∂</div>
  <h2 id="tut-welcome-title" class="tut-welcome-title">Bienvenido a Parcella</h2>
  <p class="tut-welcome-sub">
    Visualiza y entiende los <strong>diferenciales geométricos</strong> e integrales múltiples
    de forma interactiva.
  </p>

  <ul class="tut-welcome-list">
    <li>
      <span class="tut-welcome-icon">⬡</span>
      <span>Observa el <strong>elemento diferencial</strong> (dl, dS, dV) moverse por la región y crecer en tiempo real.</span>
    </li>
    <li>
      <span class="tut-welcome-icon">↕</span>
      <span><strong>Integra o congela</strong> cada variable: decide qué dimensión tiene tu elemento y dónde se posiciona.</span>
    </li>
    <li>
      <span class="tut-welcome-icon">⊙</span>
      <span>Cambia entre <strong>cartesianas, polares, cilíndricas y esféricas</strong> y ve cómo cambia el diferencial.</span>
    </li>
    <li>
      <span class="tut-welcome-icon">∫</span>
      <span>Usa la <strong>barra de progreso</strong> para animar el barrido y ver la integral acumularse.</span>
    </li>
  </ul>

  <div class="tut-welcome-actions">
    <button class="tut-btn tut-btn--primary" type="button" data-action="start">
      Empezar
    </button>
    <button class="tut-btn tut-btn--ghost" type="button" data-action="full-guide">
      Ver guía completa
    </button>
  </div>

  <label class="tut-noshow">
    <input type="checkbox" id="tut-noshowinput" />
    No volver a mostrar
  </label>
</div>
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
    /* ---- INICIO RÁPIDO ---- */
    .tut-welcome {
      width: min(480px, 95vw);
      max-height: 90vh;
    }
    .tut-welcome-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 28px 24px;
      gap: 16px;
      text-align: center;
    }
    .tut-welcome-logo {
      font-size: 48px;
      color: #7c5cff;
      line-height: 1;
      font-weight: 300;
    }
    .tut-welcome-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #e0e0f0;
    }
    .tut-welcome-sub {
      margin: 0;
      color: #a0a0c0;
      font-size: 14px;
      max-width: 340px;
    }
    .tut-welcome-list {
      list-style: none;
      padding: 0;
      margin: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: left;
    }
    .tut-welcome-list li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #c8c8e8;
      font-size: 13px;
      background: rgba(124, 92, 255, 0.06);
      border: 1px solid rgba(124, 92, 255, 0.12);
      border-radius: 6px;
      padding: 8px 12px;
    }
    .tut-welcome-icon {
      color: #7c5cff;
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .tut-welcome-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 4px;
    }
    .tut-btn {
      border-radius: 6px;
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
      font-family: inherit;
    }
    .tut-btn--primary {
      background: #7c5cff;
      color: white;
      border-color: #7c5cff;
    }
    .tut-btn--primary:hover {
      background: #6b4eee;
    }
    .tut-btn--ghost {
      background: transparent;
      color: #a78bff;
      border-color: #3d3d60;
    }
    .tut-btn--ghost:hover {
      border-color: #7c5cff;
      color: #e0e0f0;
    }
    .tut-noshow {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #6060a0;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }
    .tut-noshow input {
      accent-color: #7c5cff;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}
