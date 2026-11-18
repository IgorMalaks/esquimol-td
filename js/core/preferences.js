import { storage } from './storage.js';
import { el } from './utils.js';

export function applyPreferences() {
  const prefs = storage.get('preferences', {});
  const root = document.documentElement;
  if (prefs.warm !== false) root.dataset.tone = 'warm';
  else delete root.dataset.tone;
  root.dataset.fx = prefs.effects ?? (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'full');
}

export function preferencesButton() {
  const prefs = storage.get('preferences', {});
  const button = el('button', { class: 'btn btn-small', 'aria-pressed': prefs.warm !== false ? 'true' : 'false' });
  const label = () => { button.textContent = prefs.warm !== false ? 'Filtro quente: ligado' : 'Filtro quente: desligado'; };
  label();
  button.addEventListener('click', () => {
    prefs.warm = prefs.warm === false;
    storage.set('preferences', prefs);
    applyPreferences();
    button.setAttribute('aria-pressed', String(prefs.warm));
    label();
  });
  return button;
}
