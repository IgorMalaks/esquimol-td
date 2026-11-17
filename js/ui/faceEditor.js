// Criador Visual de Rostos — reutilizado para esquimós e inimigos.
import { el } from '../core/utils.js';
import { FACE_OPTIONS, DEFAULT_FACE } from '../data/defaults.js';
import { drawFace } from '../render/faceRenderer.js';

const LABELS = {
  shape: 'Formato', eyes: 'Olhos', mouth: 'Boca', headwear: 'Cabeça (capuz/cabelo)', accessory: 'Acessório',
  skin: 'Pele', eyeColor: 'Cor dos olhos', headwearColor: 'Cor da cabeça', accessoryColor: 'Cor do acessório',
};
const COLOR_KEYS = ['skin', 'eyeColor', 'headwearColor', 'accessoryColor'];
const PRESET_SKINS = ['#f2c79b', '#e0ac7e', '#c68a5a', '#8d5524', '#ff4757', '#1e90ff', '#2ed573', '#ffd32a', '#ff6b9d', '#95a5a6'];

const randomColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createFaceEditor(initial, { onChange, extraPreview } = {}) {
  let face = { ...DEFAULT_FACE, ...initial };
  const inputs = {};
  const preview = el('canvas', { class: 'face-preview', width: 320, height: 320, 'aria-label': 'Pré-visualização' });

  function redraw() {
    const ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, 320, 320);
    if (extraPreview) extraPreview(ctx, face);
    else drawFace(ctx, face, 160, 175, 95);
  }

  function update(key, value) {
    face = { ...face, [key]: value };
    redraw();
    onChange?.(face);
  }

  const optionFields = Object.entries(FACE_OPTIONS).map(([key, opts]) => {
    const select = el('select', { onchange: (e) => update(key, e.target.value) },
      opts.map((o) => el('option', { value: o, text: o })));
    select.value = face[key];
    inputs[key] = select;
    return el('label', { class: 'field' }, el('span', { text: LABELS[key] }), select);
  });

  const colorFields = COLOR_KEYS.map((key) => {
    const input = el('input', { type: 'color', value: face[key], oninput: (e) => update(key, e.target.value) });
    inputs[key] = input;
    return el('label', { class: 'field field-color' }, el('span', { text: LABELS[key] }), input);
  });

  const swatches = el('div', { class: 'swatches' }, PRESET_SKINS.map((c) =>
    el('button', {
      type: 'button', class: 'swatch', title: c, style: { background: c },
      onclick: () => { inputs.skin.value = c; update('skin', c); },
    })));

  function setFace(f) {
    face = { ...DEFAULT_FACE, ...f };
    for (const [k, input] of Object.entries(inputs)) input.value = face[k];
    redraw();
  }

  const randomBtn = el('button', {
    type: 'button', class: 'btn btn-small', text: 'Aleatório',
    onclick: () => {
      const f = { ...face };
      for (const [k, opts] of Object.entries(FACE_OPTIONS)) f[k] = pick(opts);
      for (const k of COLOR_KEYS) f[k] = k === 'skin' ? pick(PRESET_SKINS) : randomColor();
      setFace(f);
      onChange?.(face);
    },
  });

  const node = el('div', { class: 'face-editor' },
    el('div', { class: 'face-editor-preview' }, preview, randomBtn),
    el('div', { class: 'face-editor-fields' },
      el('div', { class: 'grid-2' }, optionFields),
      el('div', { class: 'grid-2' }, colorFields),
      el('div', { class: 'field' }, el('span', { text: 'Cores rápidas de pele' }), swatches)),
  );

  redraw();
  return { node, getFace: () => ({ ...face }), setFace, redraw };
}
