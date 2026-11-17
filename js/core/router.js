// Roteador de telas mínimo: cada tela é uma função (root, params) => cleanup?
const screens = new Map();
let cleanup = null;

export function registerScreen(name, render) {
  screens.set(name, render);
}

export function go(name, params = {}) {
  if (cleanup) {
    try { cleanup(); } catch (e) { console.error(e); }
    cleanup = null;
  }
  const app = document.getElementById('app');
  app.replaceChildren();
  app.dataset.screen = name;
  const render = screens.get(name);
  if (!render) throw new Error(`Tela desconhecida: ${name}`);
  const res = render(app, params);
  cleanup = typeof res === 'function' ? res : null;
  window.scrollTo(0, 0);
}
