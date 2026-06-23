/**
 * index.ts — Punto de entrada de la capa UI de Parcella.
 * Exporta todos los componentes y sus tipos.
 */

export { createControlPanel } from './controlPanel.js';
export type { PanelHandlers } from './controlPanel.js';

export { createEquationView } from './equationView.js';

export { createTransportBar } from './transportBar.js';
export type { TransportHandlers } from './transportBar.js';

export { createTutorial, hasSeenWelcome, markWelcomeSeen } from './tutorial.js';

export { createDerivationMode } from './derivation.js';
export type { ViewerLike } from './derivation.js';

export { createCurvilinearTool } from './curvilinear.js';

export { createViewControls } from './viewControls.js';
export type { ViewControlsHandlers } from './viewControls.js';
