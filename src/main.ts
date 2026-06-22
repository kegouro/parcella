// Punto de entrada de Parcella.
// Por ahora renderiza un placeholder hasta que los módulos de UI estén listos.
import './style.css';

const app = document.getElementById('app');
if (!app) throw new Error('No se encontró el elemento #app en el DOM.');

app.innerHTML = `
  <div style="
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 16px;
    color: var(--text);
    font-family: 'Inter', system-ui, sans-serif;
  ">
    <div style="
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: linear-gradient(135deg, #1e1060, #14172a);
      border: 2px solid var(--indigo-dim);
      display: grid;
      place-items: center;
      font-size: 32px;
    ">▪</div>
    <h1 style="margin: 0; font-size: 2.5rem; font-weight: 800; color: var(--indigo);">
      Parcella
    </h1>
    <p style="margin: 0; font-size: 1rem; color: var(--muted); text-align: center; max-width: 420px;">
      Visualizador del elemento diferencial (dl · dS · dV)<br>
      para Cálculo Multivariable y Electromagnetismo
    </p>
    <p style="margin: 0; font-size: 0.75rem; color: var(--muted);">
      Inicializando…
    </p>
  </div>
`;
