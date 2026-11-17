// Prévia do Admin · aba Esquimós (design system + 2.5D). Não grava no jogo: "Salvar" guarda só nesta página.
// Quando virar tela real (T1.17/T1.18), drawStanding e os helpers de UI vão para módulos compartilhados.
import { createDefaultData, CLASSES, FACE_OPTIONS, DEFAULT_FACE } from '../js/data/defaults.js';
import { drawFace } from '../js/render/faceRenderer.js';
import { EFFECT_KEYS, effectText } from '../js/game/stats.js';
import { el, clone, slugify } from '../js/core/utils.js';

const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const TAU = Math.PI * 2;
const INK = '#10233a';
const SVG_NS = 'http://www.w3.org/2000/svg';
const data = createDefaultData();

// ---------- Catálogos ----------
const ROLE_LABEL = { atacante: 'Atacante', invocador: 'Invocador', suporte: 'Suporte' };
const CLASS_UI = {
  arqueiro: { name: CLASSES.arqueiro.name, role: 'atacante', dmg: 'perfurante' },
  bolanev: { name: CLASSES.bolanev.name, role: 'atacante', dmg: 'impacto' },
  arpoador: { name: CLASSES.arpoador.name, role: 'atacante', dmg: 'perfurante', air: true },
  mago: { name: CLASSES.mago.name, role: 'atacante', dmg: 'gelo', air: true },
  domador: { name: 'Domador', role: 'invocador', dmg: 'impacto' },
  xama: { name: 'Xamã', role: 'suporte', dmg: null },
};
const DMG = { perfurante: 'Perfurante', impacto: 'Impacto', gelo: 'Gelo', fogo: 'Fogo', raio: 'Raio', arcano: 'Arcano' };
const BIOMES = { floresta: 'Floresta Boreal', caverna: 'Caverna de Cristal', termais: 'Fontes Termais', costa: 'Costa da Tempestade', ruinas: 'Ruínas da Aurora' };
const BIOME_COLOR = { floresta: '--el-natureza', caverna: '--el-pedra', termais: '--el-fogo', costa: '--el-tempestade', ruinas: '--el-sombra' };
const MILESTONES = [['default', 'Disponível desde o início'], ['wins', 'Número de vitórias'], ['rounds', 'Rodadas completadas'], ['phase', 'Concluir uma fase']];
const FACE_LABEL = { shape: 'Formato do rosto', eyes: 'Olhos', mouth: 'Boca', headwear: 'Capuz / cabelo', accessory: 'Acessório' };
const COLOR_LABEL = { skin: 'Pele', eyeColor: 'Cor dos olhos', headwearColor: 'Cor do capuz', accessoryColor: 'Cor do acessório' };
const WORD_FIX = { coracao: 'Coração', lingua: 'Língua', oculos: 'Óculos', ciclope: 'Ciclope' };
const nice = (w) => WORD_FIX[w] || w.charAt(0).toUpperCase() + w.slice(1);
const SKINS = ['#f2c79b', '#f5d0b0', '#e0ac7e', '#c68a5a', '#8d5524', '#5c3a21'];
const BRIGHT = ['#3a7bd5', '#d9534f', '#2e8b57', '#8c7ae6', '#e1a23a', '#636e72', '#00a8a8'];
const ALLY_KINDS = { pinguim: 'Pinguim', foca: 'Foca', urso: 'Urso', lobo: 'Lobo' };
const EFFECT_OPTS = Object.entries(EFFECT_KEYS).map(([k, v]) => [k, v.label]);
const ROLE_DEFAULTS = {
  atacante: { damage: 1, range: 150, fireRate: 1, pierce: 1, projectileSpeed: 600, splash: 0, slowPct: 0, slowDuration: 1.5 },
  invocador: { summonInterval: 4, summonCount: 1, maxAllies: 4, allyHp: 3, allyDamage: 1, allySpeed: 70, allyLifetime: 12, allyKind: 'pinguim' },
  suporte: { range: 120, buffDamage: 1, buffSpeedPct: 0, buffRangePct: 0, antiAereo: false },
};
const STAT_DEFS = {
  atacante: [['damage', 'Dano', 1, 0], ['range', 'Alcance (px)', 5, 0], ['fireRate', 'Ataques por segundo', 0.1, 0], ['pierce', 'Perfuração', 1, 1],
    ['projectileSpeed', 'Velocidade do projétil', 10, 50], ['splash', 'Área (px)', 5, 0], ['slowPct', 'Lentidão (%)', 5, 0], ['slowDuration', 'Duração da lentidão (s)', 0.1, 0]],
  invocador: [['summonInterval', 'Intervalo entre invocações (s)', 0.5, 0], ['summonCount', 'Aliados por invocação', 1, 1], ['maxAllies', 'Máx. de aliados vivos', 1, 1],
    ['allyHp', 'Vida do aliado (acertos)', 1, 1], ['allyDamage', 'Dano por contato', 1, 0], ['allySpeed', 'Velocidade do aliado (px/s)', 5, 5], ['allyLifetime', 'Duração do aliado (s)', 1, 1]],
  suporte: [['range', 'Raio da aura (px)', 5, 0], ['buffDamage', 'Buff de dano (+)', 1, 0], ['buffSpeedPct', 'Buff de velocidade (%)', 5, 0], ['buffRangePct', 'Buff de alcance (%)', 5, 0]],
};

// ---------- Dados da prévia ----------
function treeFor(prefix) {
  const t = [];
  for (let b = 1; b <= 3; b++) {
    for (let tier = 1; tier <= 3; tier++) {
      t.push({ id: `${prefix}_b${b}t${tier}`, branch: b, tier, name: `Habilidade ${b}.${tier}`, desc: '', cost: tier === 3 ? 2 : 1, gold: 150 * 2 ** (tier - 1), effect: { key: 'damage', value: 1 } });
    }
  }
  return t;
}

function normalize(src) {
  const d = clone(src);
  const ui = CLASS_UI[d.classId] || CLASS_UI.arqueiro;
  d.role = ui.role;
  d.damageType = d.damageType ?? ui.dmg;
  d.stats = { ...ROLE_DEFAULTS[ui.role], ...d.stats };
  d.unlock = d.unlock || { type: 'default', value: '' };
  d.variantOf = d.variantOf || '';
  d.branches = d.branches || ['Caminho 1', 'Caminho 2', 'Caminho 3'];
  d.tree = d.tree?.length === 9 ? d.tree : treeFor(d.id || 'novo');
  d.face = { ...DEFAULT_FACE, ...d.face };
  return d;
}

const nanuk = data.eskimos.find((e) => e.id === 'nanuk');
const samples = [
  { ...clone(nanuk), id: 'nanuk_chama', name: 'Nanuk da Chama', bodyColor: '#c4552d', damageType: 'fogo', variantOf: 'nanuk',
    face: { ...nanuk.face, headwearColor: '#c4552d', accessory: 'cicatriz', accessoryColor: '#5c3a21' },
    unlock: { type: 'fragments', biome: 'termais', amount: 50 }, branches: ['Brasas', 'Incêndio', 'Cinzas'] },
  { id: 'tuktu', name: 'Tuktu', classId: 'domador', bodyColor: '#6d4c41', cost: 320,
    face: { ...DEFAULT_FACE, skin: '#c68a5a', eyes: 'felizes', headwear: 'gorro', headwearColor: '#2e8b57', accessory: 'cachecol', accessoryColor: '#e1a23a' },
    stats: {}, unlock: { type: 'wins', value: 3 }, branches: ['Matilha', 'Urso Polar', 'Foca Gelada'] },
  { id: 'aaju', name: 'Aaju', classId: 'xama', bodyColor: '#7a5c9e', cost: 280,
    face: { ...DEFAULT_FACE, skin: '#e0ac7e', eyes: 'sonolentos', mouth: 'reta', headwear: 'cabelo', headwearColor: '#2d2d2d', accessory: 'bochechas', accessoryColor: '#d9534f' },
    stats: {}, unlock: { type: 'rounds', value: 40 }, branches: ['Tambor de Guerra', 'Luneta Polar', 'Totem'] },
];
let items = [...data.eskimos, ...samples].map(normalize);
let draft = clone(items[0]);
let selected = draft.id;
let isNew = false;
let dirty = false;
let facing = 1;
let showRange = true;
let errors = [];

// ---------- Helpers de UI ----------
function icon(id) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', 'ds-ico ds-ico--line');
  const u = document.createElementNS(SVG_NS, 'use');
  u.setAttribute('href', `#${id}`);
  s.append(u);
  return s;
}

function toast(msg, type = 'info', ms = 2600) {
  const ico = el('span', { class: 'ds-toast__ico' });
  ico.append(icon(type === 'success' ? 'i-check' : type === 'error' ? 'i-x' : 'i-snow'));
  const t = el('div', { class: `ds-toast ds-toast--${type}`, style: `--dur:${ms}ms` }, ico, el('span', { text: msg }));
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 260); }, ms);
}

const field = (label, input, help) => el('label', { class: 'ds-field' }, el('span', { class: 'ds-label', text: label }), input, help && el('span', { class: 'ds-help', text: help }));
const block = (label, ...kids) => el('div', { class: 'ds-field' }, el('span', { class: 'ds-label', text: label }), ...kids);

function select(options, value, onChange, cls = 'ds-input') {
  return el('select', { class: cls, value: value ?? '', onchange: (e) => onChange(e.target.value) },
    options.map(([v, l]) => el('option', { value: v, text: l })));
}

function numberInput(value, step, min, onInput, cls = 'ds-input') {
  return el('input', {
    class: cls, type: 'number', step, min, value: String(value ?? 0),
    oninput: (e) => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) onInput(n); },
  });
}

function makeSeg(options, value, onChange, label) {
  const ind = el('span', { class: 'ds-seg__ind' });
  const seg = el('div', { class: 'ds-seg', role: 'tablist', 'aria-label': label }, ind);
  const place = () => {
    const b = seg.querySelector('[aria-selected="true"]');
    if (!b) return;
    ind.style.setProperty('--x', `${b.offsetLeft}px`);
    ind.style.setProperty('--w', `${b.offsetWidth}px`);
  };
  for (const [v, l] of options) {
    seg.append(el('button', {
      type: 'button', role: 'tab', 'aria-selected': String(v === value), text: l,
      onclick: (e) => {
        seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget)));
        place();
        onChange(v);
      },
    }));
  }
  new ResizeObserver(place).observe(seg);
  return seg;
}

const sec = (n, title, ...kids) => el('section', { class: 'ds-card ds-card--frost ad-sec' },
  el('h2', { class: 'ad-sec__title' }, el('span', { class: 'pg-sec__num', text: String(n).padStart(2, '0') }), title), ...kids);

// ---------- Esquimó em pé (2.5D, mesmo traço da prévia aprovada) ----------
function drawGear(ctx, d, r, top, u, t) {
  ctx.lineCap = 'round';
  switch (d.classId) {
    case 'arqueiro': {
      ctx.strokeStyle = d.damageType === 'fogo' ? '#c4552d' : '#8e5a2b'; ctx.lineWidth = 3.5 * u;
      ctx.beginPath(); ctx.arc(r * 0.55, top + r * 0.85, r * 0.8, -1.15, 1.15); ctx.stroke();
      const bx = r * 0.55 + Math.cos(1.15) * r * 0.8;
      ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1.2 * u;
      ctx.beginPath(); ctx.moveTo(bx, top + r * 0.85 - Math.sin(1.15) * r * 0.8); ctx.lineTo(bx, top + r * 0.85 + Math.sin(1.15) * r * 0.8); ctx.stroke();
      break;
    }
    case 'bolanev':
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(r, top + r * 0.05, r * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    case 'arpoador':
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(-r * 0.4, top + r * 1.35); ctx.lineTo(r * 1.7, top + r * 0.05); ctx.stroke();
      ctx.fillStyle = '#dfe6e9'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.moveTo(r * 2.05, top - r * 0.17); ctx.lineTo(r * 1.55, top - r * 0.05); ctx.lineTo(r * 1.75, top + r * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'mago':
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(r * 1.05, top + r * 1.65); ctx.lineTo(r * 1.05, top - r * 0.3); ctx.stroke();
      ctx.save(); ctx.shadowColor = '#7efcff'; ctx.shadowBlur = 12 * u;
      ctx.fillStyle = '#48dbfb'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.arc(r * 1.05, top - r * 0.5, r * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      break;
    case 'domador': {
      const px = r * 1.45;
      const py = -Math.abs(Math.sin(t * 5)) * r * 0.12;
      ctx.strokeStyle = INK; ctx.lineWidth = 2 * u;
      ctx.fillStyle = '#1f2a36'; ctx.beginPath(); ctx.ellipse(px, py - r * 0.4, r * 0.32, r * 0.42, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(px + r * 0.06, py - r * 0.32, r * 0.19, r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px + r * 0.12, py - r * 0.62, r * 0.045, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.moveTo(px + r * 0.26, py - r * 0.57); ctx.lineTo(px + r * 0.46, py - r * 0.52); ctx.lineTo(px + r * 0.26, py - r * 0.47); ctx.closePath(); ctx.fill();
      break;
    }
    case 'xama':
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(r * 1.05, top + r * 1.65); ctx.lineTo(r * 1.05, top - r * 0.45); ctx.stroke();
      ctx.save(); ctx.shadowColor = '#ffc93c'; ctx.shadowBlur = 10 * u;
      ctx.strokeStyle = '#ffc93c'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(r * 1.05, top - r * 0.68, r * 0.22, 0, TAU); ctx.stroke();
      ctx.restore();
      for (const [dx, c] of [[0.18, '#d9534f'], [0.3, '#3a7bd5']]) {
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(r * (1.05 + dx), top - r * 0.2 + dx * r, r * 0.07, r * 0.22, 0.3, 0, TAU); ctx.fill();
      }
      break;
    default: break;
  }
}

function drawStanding(ctx, d, x, y, r, dir = 1, t = 0) {
  const u = r / 17;
  const top = -r * 1.75 + Math.sin(t * 3) * r * 0.04;
  ctx.save();
  ctx.fillStyle = 'rgba(16,35,58,.22)';
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r * 0.36, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y);
  ctx.lineWidth = 2.5 * u; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.fillStyle = '#5d4037';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.42, -2 * u, r * 0.32, r * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = d.bodyColor;
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, -r * 0.25);
  ctx.quadraticCurveTo(-r, top + r * 0.2, 0, top);
  ctx.quadraticCurveTo(r, top + r * 0.2, r * 0.95, -r * 0.25);
  ctx.quadraticCurveTo(0, r * 0.15, -r * 0.95, -r * 0.25);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-r * 0.1, top + r * 0.35, r * 0.2, r);
  ctx.fillStyle = '#fbfdff';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.25, r * 0.98, r * 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.scale(dir, 1);
  drawGear(ctx, d, r, top, u, t);
  ctx.fillStyle = '#fbfdff'; ctx.strokeStyle = INK; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.arc(r * 0.85, top + r * 0.75, r * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  drawFace(ctx, d.face, x, y + top - r * 0.45, r * 0.95);
}

function standingCanvas(d, size) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = el('canvas', { width: Math.round(size * dpr), height: Math.round(size * dpr), style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawStanding(ctx, d, size / 2 - size * 0.06, size * 0.9, size * 0.22, 1, 0);
  return c;
}

// Palco animado
const stage = el('canvas', { 'aria-label': 'Prévia do esquimó' });
function drawStage(t) {
  const w = stage.clientWidth;
  const hgt = stage.clientHeight;
  if (!w || !hgt) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (stage.width !== Math.round(w * dpr)) { stage.width = Math.round(w * dpr); stage.height = Math.round(hgt * dpr); }
  const ctx = stage.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  const s = w / 300;
  const cx = w / 2;
  const gy = hgt * 0.76;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(16,35,58,.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, gy + 6 * s, 122 * s, 34 * s, 0, 0, TAU); ctx.fill(); ctx.stroke();
  const range = Number(draft.stats.range) || 0;
  if (showRange && range > 0 && draft.role !== 'invocador') {
    const rr = Math.min(140, range * 0.6) * s;
    const pulse = draft.role === 'suporte' ? 0.15 + Math.sin(t * 2.5) * 0.05 : 0.12;
    ctx.fillStyle = draft.role === 'suporte' ? `rgba(255,201,60,${pulse})` : 'rgba(34,128,200,.12)';
    ctx.strokeStyle = draft.role === 'suporte' ? 'rgba(201,138,0,.7)' : 'rgba(34,128,200,.55)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.ellipse(cx, gy, rr, rr * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }
  drawStanding(ctx, draft, cx, gy, 46 * s, facing, t);
}
(function loop(now) { drawStage(now / 1000); requestAnimationFrame(loop); }(performance.now()));

// ---------- Caixas que re-renderizam sozinhas ----------
const badgesBox = el('div', { class: 'ad-badges' });
const statsBox = el('div', { style: 'display:grid;gap:14px' });
const metricBox = el('div', { class: 'ad-metric' });
const unlockBox = el('div');
const playerCard = el('div', { class: 'ds-card ad-locked' });
const treeBox = el('div', { style: 'display:grid;gap:12px' });
const treeCostBox = el('div', { class: 'pg-row' });
const list = $('#list');
const search = $('#search');

function unlockText(u) {
  switch (u.type) {
    case 'wins': return `Vença ${u.value} fase(s)`;
    case 'rounds': return `Complete ${u.value} rodadas no total`;
    case 'phase': return `Conclua "${data.phases.find((p) => p.id === u.value)?.name ?? u.value}"`;
    case 'fragments': return `${u.amount} fragmentos de ${BIOMES[u.biome]}`;
    default: return 'Disponível desde o início';
  }
}
function unlockShort(u) {
  switch (u.type) {
    case 'wins': return `${u.value} vitórias`;
    case 'rounds': return `${u.value} rodadas`;
    case 'phase': return 'fase concluída';
    case 'fragments': return `${u.amount} fragmentos`;
    default: return 'inicial';
  }
}

function touch(refreshList = false) {
  dirty = true;
  validate();
  renderBadges();
  if (refreshList) renderList();
}

function renderBadges() {
  const ui = CLASS_UI[draft.classId];
  const kids = [el('span', { class: 'ds-badge ds-badge--dark', text: ROLE_LABEL[draft.role] })];
  if (draft.damageType) kids.push(el('span', { class: 'ds-el', style: `--ec:var(--el-${draft.damageType})`, text: `Dano: ${DMG[draft.damageType]}` }));
  if (ui.air || (draft.role === 'suporte' && draft.stats.antiAereo)) kids.push(el('span', { class: 'ds-badge ds-badge--info', text: draft.role === 'suporte' ? 'Dá antiaéreo' : 'Atinge aéreos' }));
  kids.push(el('span', { class: 'ds-badge ds-badge--gold', text: unlockShort(draft.unlock) }));
  if (draft.variantOf) kids.push(el('span', { class: 'ds-badge', text: `Variante de ${items.find((e) => e.id === draft.variantOf)?.name ?? '?'}` }));
  badgesBox.replaceChildren(...kids);
}

// ---------- Seções ----------
function setClass(v) {
  const ui = CLASS_UI[v];
  draft.classId = v;
  draft.role = ui.role;
  draft.damageType = ui.dmg;
  draft.stats = Object.fromEntries(Object.entries(ROLE_DEFAULTS[ui.role]).map(([k, d]) => [k, draft.stats[k] ?? d]));
  touch(true);
  renderEditor();
}

function heroBlock() {
  const dmgSelect = draft.role === 'suporte'
    ? select([['', 'Não causa dano']], '', () => {})
    : select(Object.entries(DMG), draft.damageType, (v) => { draft.damageType = v; touch(); }, 'ds-input');
  if (draft.role === 'suporte') dmgSelect.disabled = true;
  const ident = el('div', { class: 'ad-fields' },
    field('Nome', el('input', { class: 'ds-input', maxlength: 24, value: draft.name, placeholder: 'ex.: Nanuk da Chama', oninput: (e) => { draft.name = e.target.value; touch(true); } })),
    field('Classe', select(Object.entries(CLASS_UI).map(([k, c]) => [k, `${c.name} · ${ROLE_LABEL[c.role]}`]), draft.classId, setClass)),
    field('Tipo de dano', dmgSelect, 'Ver matriz de elementos (SPEC-017)'),
    field('Cor da parka', el('input', { class: 'ds-input', type: 'color', value: draft.bodyColor, oninput: (e) => { draft.bodyColor = e.target.value; touch(true); } })),
    field('Custo na partida (ouro)', numberInput(draft.cost, 5, 0, (v) => { draft.cost = Math.round(v); touch(true); renderMetric(); })));
  const controls = el('div', { class: 'pg-row', style: 'justify-content:center' },
    el('button', { type: 'button', class: 'ds-btn ds-btn--sm', text: 'Virar', onclick: () => { facing *= -1; } }),
    el('button', { type: 'button', class: 'ds-btn ds-btn--sm', text: 'Rosto aleatório', onclick: randomize }),
    el('label', { class: 'ad-tone' }, el('input', { type: 'checkbox', class: 'ds-switch', role: 'switch', checked: showRange, onchange: (e) => { showRange = e.target.checked; } }), 'Alcance'));
  return el('div', { class: 'ad-hero' },
    el('div', { class: 'ad-stage' }, stage, controls),
    el('div', { style: 'display:grid;gap:14px;min-width:0' }, ident, badgesBox));
}

function randomize() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  for (const [k, opts] of Object.entries(FACE_OPTIONS)) draft.face[k] = pick(opts);
  draft.face.skin = pick(SKINS);
  draft.face.headwearColor = pick(BRIGHT);
  draft.face.accessoryColor = pick(BRIGHT);
  touch(true);
  renderEditor();
}

function faceBlock() {
  const selects = Object.entries(FACE_OPTIONS).map(([k, opts]) =>
    field(FACE_LABEL[k] || k, select(opts.map((o) => [o, nice(o)]), draft.face[k], (v) => { draft.face[k] = v; touch(true); })));
  const colors = Object.entries(COLOR_LABEL).map(([k, l]) =>
    field(l, el('input', { class: 'ds-input', type: 'color', value: draft.face[k], oninput: (e) => { draft.face[k] = e.target.value; touch(true); } })));
  const swatches = el('div', { class: 'ad-swatches' }, SKINS.map((c) => el('button', {
    type: 'button', class: `ad-swatch${draft.face.skin === c ? ' is-on' : ''}`, style: `background:${c}`, 'aria-label': `Pele ${c}`,
    onclick: () => { draft.face.skin = c; touch(true); renderEditor(); },
  })));
  return el('div', { style: 'display:grid;gap:14px' },
    el('p', { class: 'ds-help', style: 'margin:0', text: 'O mesmo criador serve para os rostos inimigos. Tudo atualiza o palco ao lado na hora.' }),
    el('div', { class: 'ad-face' }, selects, colors),
    block('Tons de pele rápidos', swatches));
}

const dpsOf = (s) => (s.damage || 0) * (s.fireRate || 0) * (1 + 0.25 * Math.min(Math.max((s.pierce || 1) - 1, 0), 6)) * ((s.splash || 0) > 0 ? 1 + s.splash / 60 : 1);
const AVG_PER_COST = (() => {
  const v = data.eskimos.map((e) => (dpsOf(e.stats) / Math.max(1, e.cost)) * 100);
  return v.reduce((a, b) => a + b, 0) / v.length;
})();

function renderMetric() {
  const s = draft.stats;
  metricBox.className = 'ad-metric';
  if (draft.role === 'invocador') {
    metricBox.replaceChildren(el('span', { class: 'ds-label', text: 'Ritmo' }),
      el('b', { text: `${Math.round((60 / Math.max(0.5, s.summonInterval)) * s.summonCount)} aliados/min` }),
      el('span', { class: 'ds-help', text: `Até ${s.maxAllies} ao mesmo tempo. Aliados saem da base e andam contra os inimigos.` }));
    return;
  }
  if (draft.role === 'suporte') {
    metricBox.replaceChildren(el('span', { class: 'ds-label', text: 'Suporte' }),
      el('span', { class: 'ds-help', text: 'Não ataca. O valor dele aparece nas torres dentro da aura; buffs do mesmo tipo não somam entre Xamãs.' }));
    return;
  }
  const per = (dpsOf(s) / Math.max(1, draft.cost)) * 100;
  const ratio = per / AVG_PER_COST;
  const note = ratio > 2 ? ' · muito forte para o custo' : ratio < 0.5 ? ' · fraco para o custo' : '';
  metricBox.classList.toggle('is-warn', Boolean(note));
  metricBox.replaceChildren(
    el('span', { class: 'ds-label', text: 'Força estimada (dano/s a cada 100 de ouro)' }),
    el('b', { text: per.toFixed(2).replace('.', ',') }),
    el('div', { class: 'ds-progress', style: `--v:${Math.min(1, ratio / 2).toFixed(3)}` }, el('div', { class: 'ds-progress__fill' })),
    el('span', { class: 'ds-help', text: `${ratio.toFixed(2).replace('.', ',')}× a média dos esquimós padrão${note}. Estimativa grosseira: ignora lentidão e tipo de dano.` }));
}

function renderStats() {
  const grid = el('div', { class: 'ad-fields' }, STAT_DEFS[draft.role].map(([k, l, step, min]) =>
    field(l, numberInput(draft.stats[k], step, min, (v) => { draft.stats[k] = v; touch(); renderMetric(); }))));
  if (draft.role === 'invocador') grid.append(field('Tipo de aliado', select(Object.entries(ALLY_KINDS), draft.stats.allyKind, (v) => { draft.stats.allyKind = v; touch(); })));
  if (draft.role === 'suporte') {
    grid.append(el('label', { class: 'ds-field' }, el('span', { class: 'ds-label', text: 'Dá antiaéreo na aura' }),
      el('input', { type: 'checkbox', class: 'ds-switch', role: 'switch', checked: Boolean(draft.stats.antiAereo), onchange: (e) => { draft.stats.antiAereo = e.target.checked; touch(); } })));
  }
  statsBox.replaceChildren(grid, metricBox);
  renderMetric();
}

function renderPlayerCard() {
  const u = draft.unlock;
  const kids = [el('span', { class: 'ds-label', text: 'Como o jogador vê no Quartel' }), standingCanvas(draft, 104), el('b', { text: draft.name || 'Sem nome' })];
  if (u.type === 'fragments') {
    const have = Math.round(u.amount * 0.32);
    kids.push(
      el('span', { class: 'ds-el', style: `--ec:var(${BIOME_COLOR[u.biome]})`, text: BIOMES[u.biome] }),
      el('div', { class: 'ds-progress', style: `--v:${(have / Math.max(1, u.amount)).toFixed(3)};width:100%` }, el('div', { class: 'ds-progress__fill' })),
      el('small', { class: 'ds-help', text: `${have}/${u.amount} fragmentos (exemplo)` }),
      el('button', { type: 'button', class: 'ds-btn ds-btn--gold ds-btn--sm', disabled: true, text: 'Recrutar' }));
  } else {
    kids.push(el('small', { class: 'ds-help', text: unlockText(u) }));
  }
  playerCard.replaceChildren(...kids);
  playerCard.classList.toggle('is-locked', u.type !== 'default');
}

function renderUnlock() {
  const u = draft.unlock;
  const isFrag = u.type === 'fragments';
  const seg = makeSeg([['marco', 'Marco'], ['fragments', 'Fragmentos de bioma']], isFrag ? 'fragments' : 'marco', (v) => {
    draft.unlock = v === 'fragments' ? { type: 'fragments', biome: 'caverna', amount: 50 } : { type: 'default', value: '' };
    if (v !== 'fragments') draft.variantOf = '';
    touch(true);
    renderUnlock();
  }, 'Forma de desbloqueio');
  const body = el('div', { class: 'ad-fields' });
  if (isFrag) {
    body.append(
      field('Bioma dos fragmentos', select(Object.entries(BIOMES), u.biome, (v) => { u.biome = v; touch(true); renderUnlock(); })),
      field('Fragmentos necessários', numberInput(u.amount, 5, 1, (v) => { u.amount = Math.round(v); touch(true); renderPlayerCard(); })),
      field('Variante de', select([['', '— esquimó próprio —'], ...items.filter((e) => e.id !== draft.id && !e.variantOf).map((e) => [e.id, e.name])], draft.variantOf,
        (v) => { draft.variantOf = v; touch(); })));
  } else {
    body.append(field('Condição', select(MILESTONES, u.type, (v) => {
      draft.unlock = { type: v, value: v === 'phase' ? data.phases[0].id : v === 'default' ? '' : 5 };
      touch(true);
      renderUnlock();
    })));
    if (u.type === 'wins' || u.type === 'rounds') body.append(field(u.type === 'wins' ? 'Vitórias' : 'Rodadas', numberInput(u.value, 1, 1, (v) => { u.value = Math.round(v); touch(true); renderPlayerCard(); })));
    if (u.type === 'phase') body.append(field('Fase', select(data.phases.map((p) => [p.id, p.name]), u.value, (v) => { u.value = v; touch(true); renderPlayerCard(); })));
  }
  const hint = el('p', { class: 'ds-help', style: 'margin:0', text: isFrag
    ? `Fragmentos de ${BIOMES[u.biome]} caem só nesse bioma: fases (chance baixa por estouro, +2 por vitória), chefe da raide (3 a 5 garantidos) e Infinito (+1 a cada 10 waves). Não são negociáveis. O jogador gasta com o botão Recrutar.`
    : 'Marco é para classes base: todo jogador precisa conseguir montar o esquadrão sem depender de sorte.' });
  unlockBox.replaceChildren(el('div', { class: 'ad-unlock' }, el('div', { style: 'display:grid;gap:14px;min-width:0' }, seg, body, hint), playerCard));
  renderPlayerCard();
}

const nodeAt = (b, t) => draft.tree.find((n) => n.branch === b && n.tier === t);

function renderTreeCost() {
  const c = (b, t) => Number(nodeAt(b, t).cost) || 0;
  const best = [1, 2, 3].reduce((a, b) => a + c(b, 1) + c(b, 2), 0) + Math.max(...[1, 2, 3].map((b) => c(b, 3)));
  treeCostBox.replaceChildren(
    el('span', { class: `ds-badge ${best > 8 ? 'ds-badge--gold' : 'ds-badge--go'}`, text: `Árvore máxima permitida: ${best} pontos · o jogador tem até 8` }),
    best > 8 ? el('span', { class: 'ds-help', text: 'Ninguém consegue montar tudo que a regra permite. Ok se for intencional.' }) : null);
}

function nodeEditor(n) {
  const fx = el('span', { class: 'ad-node__fx', text: effectText(n.effect) });
  const sm = 'ds-input ds-input--sm';
  return el('div', { class: 'ad-node' },
    el('div', { class: 'ad-node__head' }, el('span', { class: 'ds-badge ds-badge--info', text: `Nível ${n.tier}` }), fx),
    el('input', { class: sm, maxlength: 30, value: n.name, placeholder: 'Nome da habilidade', 'aria-label': `Nome da habilidade nível ${n.tier}`, oninput: (e) => { n.name = e.target.value; touch(); } }),
    el('div', { class: 'ad-node__row' },
      select(EFFECT_OPTS, n.effect.key, (v) => { n.effect.key = v; fx.textContent = effectText(n.effect); touch(); }, sm),
      numberInput(n.effect.value, 1, null, (v) => { n.effect.value = v; fx.textContent = effectText(n.effect); touch(); }, sm)),
    el('div', { class: 'ad-node__row ad-node__row--2' },
      field('Pontos', numberInput(n.cost, 1, 0, (v) => { n.cost = Math.round(v); touch(); renderTreeCost(); }, sm)),
      field('Ouro p/ ativar', numberInput(n.gold, 10, 0, (v) => { n.gold = Math.round(v); touch(); }, sm))));
}

function renderTree() {
  const cols = [1, 2, 3].map((b) => el('div', { class: 'ds-branch' },
    el('input', { class: 'ds-input ds-input--sm', maxlength: 30, value: draft.branches[b - 1], 'aria-label': `Nome do caminho ${b}`, style: 'font-weight:800;text-align:center',
      oninput: (e) => { draft.branches[b - 1] = e.target.value; touch(); } }),
    [1, 2, 3].map((t) => nodeEditor(nodeAt(b, t)))));
  treeBox.replaceChildren(
    el('p', { class: 'ds-help', style: 'margin:0', text: '3 caminhos × 3 níveis. O jogador compra em ordem e só um caminho chega ao nível 3. Pontos liberam no Quartel; ouro ativa na partida.' }),
    el('div', { class: 'ad-tree' }, cols), treeCostBox);
  renderTreeCost();
}

function renderEditor() {
  $('#editor').replaceChildren(
    sec(1, 'Identidade', heroBlock()),
    sec(2, 'Rosto e cores', faceBlock()),
    sec(3, 'Atributos', statsBox),
    sec(4, 'Como o jogador ganha', unlockBox),
    sec(5, 'Árvore de habilidades', treeBox));
  renderBadges();
  renderStats();
  renderUnlock();
  renderTree();
  validate();
}

// ---------- Lista ----------
function renderList() {
  const q = search.value.trim().toLowerCase();
  const rows = items.filter((e) => !q || e.name.toLowerCase().includes(q)).map((e) => {
    const shown = !isNew && e.id === draft.id ? draft : e;
    return el('button', { type: 'button', class: `ad-item${!isNew && e.id === selected ? ' is-active' : ''}`, onclick: () => load(e.id) },
      standingCanvas(shown, 52),
      el('span', {}, el('b', { text: shown.name || 'Sem nome' }), el('small', { text: `${CLASS_UI[shown.classId].name} · ${unlockShort(shown.unlock)}` })));
  });
  if (isNew) {
    rows.unshift(el('button', { type: 'button', class: 'ad-item is-active' }, standingCanvas(draft, 52),
      el('span', {}, el('b', { text: draft.name || 'Novo esquimó' }), el('small', { text: 'não salvo' }))));
  }
  list.replaceChildren(...rows);
}

const canLeave = () => !dirty || window.confirm('Descartar as alterações não salvas?');

function load(id) {
  if (id === selected && !isNew) return;
  if (!canLeave()) return;
  draft = clone(items.find((e) => e.id === id));
  selected = id;
  isNew = false;
  dirty = false;
  renderList();
  renderEditor();
}

function createNew() {
  if (!canLeave()) return;
  draft = normalize({
    id: '', name: '', classId: 'arqueiro', bodyColor: '#5b7fa6', cost: 250, face: { ...DEFAULT_FACE }, stats: {},
    unlock: { type: 'fragments', biome: 'caverna', amount: 50 }, branches: ['Caminho 1', 'Caminho 2', 'Caminho 3'], tree: [],
  });
  isNew = true;
  selected = null;
  dirty = true;
  renderList();
  renderEditor();
}

// ---------- Validação e rodapé ----------
function validate() {
  const errs = [];
  const warns = [];
  const s = draft.stats;
  const name = draft.name.trim();
  if (!name) errs.push('Dê um nome ao esquimó.');
  else if (items.some((e) => e.id !== draft.id && e.name.trim().toLowerCase() === name.toLowerCase())) errs.push('Já existe um esquimó com esse nome.');
  if (draft.role === 'atacante') {
    if (!(s.fireRate > 0)) errs.push('Ataques por segundo precisa ser maior que zero.');
    if (!(s.range > 0)) errs.push('Alcance precisa ser maior que zero.');
    if (s.slowPct > 80) warns.push('Lentidão acima de 80% é cortada no jogo.');
  }
  if (draft.role === 'invocador' && !(s.summonInterval > 0)) errs.push('Intervalo de invocação precisa ser maior que zero.');
  if (draft.role === 'suporte' && !(s.range > 0)) errs.push('Raio da aura precisa ser maior que zero.');
  if (draft.unlock.type === 'fragments' && !(draft.unlock.amount >= 1)) errs.push('Fragmentos necessários precisa ser pelo menos 1.');
  if (draft.branches.some((b) => !b.trim())) errs.push('Todo caminho da árvore precisa de nome.');
  if (draft.tree.some((n) => !n.name.trim())) errs.push('Toda habilidade precisa de nome.');
  errors = errs;

  const chips = [
    ...errs.slice(0, 2).map((t) => el('span', { class: 'ds-badge ds-badge--danger', text: t })),
    errs.length > 2 ? el('span', { class: 'ds-badge ds-badge--danger', text: `+${errs.length - 2}` }) : null,
    ...warns.map((t) => el('span', { class: 'ds-badge ds-badge--gold', text: t })),
  ].filter(Boolean);
  if (!errs.length && !warns.length) chips.push(el('span', { class: 'ds-badge ds-badge--go', text: 'Tudo certo para salvar' }));
  $('#issues').replaceChildren(...chips);
  $('#save').disabled = errs.length > 0;
  $('#dirty').textContent = dirty ? 'Alterações não salvas' : '';
}

$('#save').addEventListener('click', () => {
  if (errors.length) return;
  if (!draft.id) draft.id = slugify(draft.name, 'esq');
  const i = items.findIndex((e) => e.id === draft.id);
  if (i >= 0) items[i] = clone(draft); else items.push(clone(draft));
  selected = draft.id;
  isNew = false;
  dirty = false;
  renderList();
  renderEditor();
  toast('Salvo nesta prévia. Ainda não grava no jogo (entra na T1.17).', 'success', 3200);
});

$('#discard').addEventListener('click', () => {
  if (!dirty) return;
  dirty = false;
  const src = isNew ? items[0] : items.find((e) => e.id === selected);
  draft = clone(src);
  selected = src.id;
  isNew = false;
  renderList();
  renderEditor();
  toast('Alterações descartadas.');
});

$('#export').addEventListener('click', () => {
  const out = clone(draft);
  delete out.role;
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${draft.id || slugify(draft.name || 'novo', 'esq')}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#new').addEventListener('click', createNew);
search.addEventListener('input', renderList);
$('#tone').addEventListener('change', (e) => { if (e.target.checked) root.dataset.tone = 'warm'; else delete root.dataset.tone; });
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// ---------- Abas (só Esquimós montada nesta prévia) ----------
const TABS = ['Esquimós', 'Inimigos', 'Biomas', 'Elementos', 'Fases', 'Raides', 'Itens', 'Habilidades', 'Economia'];
$('#tabs').replaceChildren(...TABS.map((t, i) => el('button', {
  type: 'button', class: `ad-tab${i ? ' is-soon' : ''}`, role: 'tab', 'aria-selected': String(i === 0), text: t,
  onclick: () => { if (i) toast(`Nesta prévia só a aba Esquimós está montada. "${t}" segue o mesmo padrão.`); },
})));

renderList();
renderEditor();
