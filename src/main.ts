// Punto de entrada de Parcella.
import './style.css';
import { bootstrap } from './app.js';

const app = document.getElementById('app');
if (!app) throw new Error('No se encontró el elemento #app en el DOM.');

bootstrap(app);
