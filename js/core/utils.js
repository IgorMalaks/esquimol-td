// Construtor de DOM seguro: textos sempre via textContent (sem innerHTML com dados do usuário).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'value') value = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (typeof v === 'boolean') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  if (value !== undefined) node.value = value;
  return node;
}

export const clone = (o) => structuredClone(o);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function uid(prefix = 'id') {
  const r = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${prefix}_${Date.now().toString(36)}${r}`;
}

export function slugify(text, prefix) {
  const base = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
  return `${prefix}_${base || 'novo'}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) { o[k] ??= {}; o = o[k]; }
  o[ks.at(-1)] = val;
}

export function seededRandom(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function toast(msg, type = 'info', ms = 2600) {
  const box = document.getElementById('toasts');
  const t = el('div', { class: `toast toast-${type}`, text: msg });
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

// Modal genérico. actions: [{label, class, onClick}] — onClick retornando false mantém aberto.
export function modal({ title, body, actions = [{ label: 'OK', class: 'btn-primary' }], dismissable = true }) {
  const close = () => overlay.remove();
  const overlay = el('div', { class: 'modal-overlay' },
    el('div', { class: 'modal card', role: 'dialog', 'aria-modal': 'true' },
      title && el('h2', { text: title }),
      el('div', { class: 'modal-body' }, body),
      el('div', { class: 'modal-actions' }, actions.map((a) =>
        el('button', {
          class: `btn ${a.class || ''}`, text: a.label,
          onclick: async () => { if ((await a.onClick?.()) !== false) close(); },
        }))),
    ));
  if (dismissable) overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  return close;
}

export function confirmDialog(message, { okLabel = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    modal({
      title: 'Confirmar', body: el('p', { text: message }), dismissable: false,
      actions: [
        { label: 'Cancelar', onClick: () => resolve(false) },
        { label: okLabel, class: danger ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true) },
      ],
    });
  });
}
