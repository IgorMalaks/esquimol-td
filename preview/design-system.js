// Interações da página do Design System. Reaproveita os personagens procedurais do jogo.
import { createDefaultData } from '../js/data/defaults.js';
import { eskimoCanvas, faceCanvas } from '../js/render/faceRenderer.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const SVG_NS = 'http://www.w3.org/2000/svg';
const data = createDefaultData();
const fx = () => root.dataset.fx;

function icon(id, cls = 'ds-ico') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', cls);
  const u = document.createElementNS(SVG_NS, 'use');
  u.setAttribute('href', `#${id}`);
  s.append(u);
  return s;
}

// ---------- Intensidade de efeitos ----------
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  root.dataset.fx = 'off';
  $$('[data-seg="fx"] button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.value === 'off')));
}

// ---------- Personagens reais do jogo ----------
const hero = $('#hero-chars');
const e = data.eskimos;
const en = data.enemies;
[eskimoCanvas(e[0], 92), faceCanvas(en[0].face, 64), eskimoCanvas(e[1], 92), faceCanvas(en[6].face, 84),
  eskimoCanvas(e[3], 92), faceCanvas(en[4].face, 64), eskimoCanvas(e[2], 92)].forEach((c) => hero.append(c));

$$('[data-tower]').forEach((slot) => {
  const def = e[Number(slot.dataset.tower)];
  slot.prepend(eskimoCanvas(def, 60));
  $('[data-name]', slot).textContent = def.name;
  const cost = $('[data-cost]', slot);
  cost.append(icon('i-coin'), String(def.cost));
  cost.querySelector('svg').style.cssText = 'width:14px;height:14px;color:#fff';
});

// ---------- Abas segmentadas ----------
function initSeg(seg, onChange) {
  const ind = document.createElement('span');
  ind.className = 'ds-seg__ind';
  seg.prepend(ind);
  const btns = $$('button', seg);
  const place = () => {
    const b = btns.find((x) => x.getAttribute('aria-selected') === 'true') || btns[0];
    ind.style.setProperty('--x', `${b.offsetLeft}px`);
    ind.style.setProperty('--w', `${b.offsetWidth}px`);
  };
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    place();
    onChange?.(b.dataset.value);
  }));
  new ResizeObserver(place).observe(seg);
  place();
}
const SEG_HANDLERS = {
  fx: (v) => { root.dataset.fx = v; },
  tone: (v) => { if (v === 'warm') root.dataset.tone = 'warm'; else delete root.dataset.tone; },
};
$$('.ds-seg').forEach((seg) => initSeg(seg, SEG_HANDLERS[seg.dataset.seg]));

// ---------- Neve de fundo (com parallax no scroll) ----------
const cv = $('#ds-snow');
const cx = cv.getContext('2d');
let flakes = [];
let W = 0;
let H = 0;
let time = 0;
let last = performance.now();
const mkFlake = (anyY) => {
  const z = Math.random();
  return { x: Math.random() * W, y: anyY ? Math.random() * H : -10, z, r: 1 + z * 2.6, v: 12 + z * 40, ph: Math.random() * 6 };
};
function sizeSnow() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  flakes = Array.from({ length: Math.min(140, Math.round((W * H) / 14000)) }, () => mkFlake(true));
}
function snowFrame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  cx.clearRect(0, 0, W, H);
  const mode = fx();
  if (mode !== 'off' && !document.hidden) {
    const n = mode === 'subtle' ? Math.ceil(flakes.length / 3) : flakes.length;
    cx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const f = flakes[i];
      f.y += f.v * dt;
      f.x += Math.sin(time * 0.8 + f.ph) * (6 + f.z * 10) * dt;
      if (f.y > H + 10) Object.assign(f, mkFlake(false));
      const py = ((((f.y - scrollY * f.z * 0.3) % (H + 20)) + H + 20) % (H + 20)) - 10;
      cx.globalAlpha = 0.35 + f.z * 0.55;
      cx.beginPath(); cx.arc(f.x, py, f.r, 0, 6.283); cx.fill();
    }
    cx.globalAlpha = 1;
  }
  requestAnimationFrame(snowFrame);
}
addEventListener('resize', sizeSnow);
sizeSnow();
requestAnimationFrame(snowFrame);

// ---------- Toasts, números flutuantes, modal ----------
const TOAST_ICON = { info: 'i-snow', success: 'i-check', error: 'i-x', loot: 'i-gem' };
function toast(msg, type = 'info', ms = 2600) {
  const t = document.createElement('div');
  t.className = `ds-toast ds-toast--${type}`;
  t.style.setProperty('--dur', `${ms}ms`);
  const ico = document.createElement('span');
  ico.className = 'ds-toast__ico';
  ico.append(icon(TOAST_ICON[type] || 'i-snow', 'ds-ico ds-ico--line'));
  const text = document.createElement('span');
  text.textContent = msg;
  t.append(ico, text);
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 260); }, ms);
}

function floatText(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = `ds-float ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 950);
}
const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

const TOAST_DEMO = {
  info: ['Rodada 4 começou. Cuidado com os voadores!', 'info'],
  success: ['Esquimó posicionado!', 'success'],
  error: ['Ouro insuficiente.', 'error'],
  loot: ['Drop Lendário: Cajado Boreal!', 'loot'],
};
$$('[data-toast]').forEach((b) => b.addEventListener('click', () => toast(...TOAST_DEMO[b.dataset.toast])));

const modal = $('#modal');
let lastFocus = null;
function openModal() {
  lastFocus = document.activeElement;
  modal.hidden = false;
  $('[data-close]:last-of-type', modal)?.focus();
}
function closeModal() {
  modal.hidden = true;
  lastFocus?.focus();
}
$('#open-modal').addEventListener('click', openModal);
modal.addEventListener('click', (ev) => { if (ev.target === modal || ev.target.closest('[data-close]')) closeModal(); });
addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modal.hidden) closeModal(); });

$('#float-demo').addEventListener('click', (ev) => {
  const [x, y] = centerOf(ev.currentTarget);
  const crit = Math.random() < 0.35;
  floatText(crit ? '-24 CRIT' : '-12', x, y - 20, crit ? 'ds-float--crit' : '');
});

// ---------- Botão carregando ----------
$('#btn-load').addEventListener('click', (ev) => {
  const b = ev.currentTarget;
  if (b.classList.contains('is-loading')) return;
  const sp = document.createElement('span');
  sp.className = 'ds-spin';
  b.append(sp);
  b.classList.add('is-loading');
  setTimeout(() => { b.classList.remove('is-loading'); sp.remove(); toast('Conteúdo salvo!', 'success'); }, 1200);
});

// ---------- Formulário ----------
const user = $('#f-user');
const userErr = $('#f-user-err');
const userOk = () => !user.value || /^[a-zA-Z0-9_.-]{3,20}$/.test(user.value);
user.addEventListener('input', () => {
  const ok = userOk();
  user.setAttribute('aria-invalid', String(!ok));
  userErr.textContent = ok ? '' : 'Use 3 a 20 caracteres: letras, números, _ . -';
});
user.addEventListener('blur', () => {
  if (userOk()) return;
  user.classList.remove('is-shake'); void user.offsetWidth; user.classList.add('is-shake');
});
$$('.ds-range').forEach((r) => {
  const upd = () => {
    r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
    const out = $(`output[for="${r.id}"]`);
    if (out) out.textContent = Number(r.value).toFixed(2);
  };
  r.addEventListener('input', upd);
  upd();
});

// ---------- Movimento ----------
$$('.pg-track').forEach((tr) => {
  const toggle = () => tr.classList.toggle('is-on');
  tr.addEventListener('click', toggle);
  tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
});
$('#motion-all').addEventListener('click', () => $$('.pg-track').forEach((tr) => tr.classList.toggle('is-on')));

// ---------- Arena: chefe, ouro, habilidades ----------
const boss = $('#boss');
const bossBar = $('.ds-boss__bar', boss);
let hp = 1;
const setBoss = () => {
  boss.style.setProperty('--hp', hp);
  boss.style.setProperty('--trail', hp);
  $('#boss-pct').textContent = `${Math.round(hp * 100)}%`;
};
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
$('#boss-hit').addEventListener('click', () => {
  if (hp === 0) return;
  const crit = Math.random() < 0.25;
  const dmg = (0.05 + Math.random() * 0.07) * (crit ? 2 : 1);
  const before = hp;
  hp = Math.max(0, hp - dmg);
  setBoss();
  const r = bossBar.getBoundingClientRect();
  floatText(`-${Math.round(dmg * 6000)}${crit ? ' CRIT' : ''}`, r.left + r.width * hp, r.top - 6, crit ? 'ds-float--crit' : '');
  restart(bossBar, 'is-hit');
  if ((before > 0.66 && hp <= 0.66) || (before > 0.33 && hp <= 0.33)) {
    restart(bossBar, 'is-phase');
    toast('O Rei Iceberg ficou furioso: +25% de velocidade!', 'error');
  }
  if (hp === 0) {
    toast('Rei Iceberg derrotado! Baú Lendário', 'loot', 3200);
    setTimeout(() => { hp = 1; setBoss(); }, 1600);
  }
});

let gold = 650;
const goldVal = $('#gold-val');
$('#gold-add').addEventListener('click', () => {
  const from = gold;
  gold += 25 + Math.floor(Math.random() * 40);
  const to = gold;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 400);
    goldVal.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  const stat = $('#gold-stat');
  restart(stat, 'is-bump');
  const [x, y] = centerOf(stat);
  floatText(`+${to - from}`, x, y - 18, 'ds-float--gold');
});

const skills = $$('.ds-skill').map((el) => ({ el, total: Number(el.dataset.cd), left: Number(el.dataset.start) || 0, name: el.dataset.name }));
function useSkill(s) {
  if (s.left > 0) { toast(`${s.name} recarregando: ${Math.ceil(s.left)} s`, 'error', 1600); return; }
  s.left = s.total;
  const [x, y] = centerOf(s.el);
  floatText(s.name, x, y - 40, 'ds-float--gold');
}
skills.forEach((s) => s.el.addEventListener('click', () => useSkill(s)));
addEventListener('keydown', (ev) => {
  if (ev.target.closest('input, select, textarea')) return;
  if (ev.key.toLowerCase() === 'q') useSkill(skills[0]);
  if (ev.key.toLowerCase() === 'e') useSkill(skills[1]);
});
let lastSk = performance.now();
(function skillLoop(now) {
  const dt = Math.min(0.1, (now - lastSk) / 1000);
  lastSk = now;
  for (const s of skills) {
    s.left = Math.max(0, s.left - dt);
    s.el.style.setProperty('--p', (s.left / s.total).toFixed(4));
    $('.ds-skill__cd', s.el).textContent = s.left > 0 ? String(Math.ceil(s.left)) : '';
    s.el.classList.toggle('is-ready', s.left === 0);
  }
  requestAnimationFrame(skillLoop);
}(lastSk));

// ---------- Progressão ----------
let xp = 0.35;
const xpBar = $('#xp');
$('#xp-add').addEventListener('click', () => {
  xp = Math.min(1, xp + 0.22);
  xpBar.style.setProperty('--v', xp);
  $('#xp-label').textContent = `${Math.round(xp * 100)}/100`;
  if (xp >= 1) {
    setTimeout(() => {
      toast('Nanuk subiu de nível: +1 ponto de habilidade!', 'success');
      xp = 0; xpBar.style.setProperty('--v', 0); $('#xp-label').textContent = '0/100';
    }, 500);
  }
});

const PITY_MAX = 8;
let pity = 5;
function renderPity() {
  const box = $('#pips');
  box.replaceChildren(...Array.from({ length: PITY_MAX }, (_, i) => {
    const pip = document.createElement('i');
    if (i < pity) pip.className = 'on';
    else if (i === pity) pip.className = 'next';
    return pip;
  }));
  $('#pity-label').textContent = `${pity}/${PITY_MAX}`;
}
$('#pity-add').addEventListener('click', () => {
  pity++;
  if (pity >= PITY_MAX) {
    renderPity();
    setTimeout(() => { toast('Garantia ativada: Lendário garantido!', 'loot', 3000); pity = 0; renderPity(); }, 350);
    return;
  }
  renderPity();
});
renderPity();

$$('#tree .ds-node').forEach((node) => node.addEventListener('click', () => {
  if (node.classList.contains('is-blocked')) { toast(node.dataset.reason, 'error', 1800); return; }
  if (!node.classList.contains('is-available')) return;
  node.classList.replace('is-available', 'is-learned');
  const next = node.nextElementSibling;
  if (next?.classList.contains('is-blocked') && next.dataset.reason.startsWith('Aprenda')) next.classList.replace('is-blocked', 'is-available');
  toast(`${$('b', node).textContent} aprendida!`, 'success', 1600);
}));

// ---------- Inclinação 3D dos itens ----------
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  $$('.ds-item').forEach((card) => {
    card.addEventListener('pointermove', (ev) => {
      if (fx() !== 'full') return;
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width;
      const y = (ev.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(x - 0.5) * 18}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 18}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); });
  });
}

// ---------- Paleta ----------
const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
$$('[data-swatches]').forEach((grid) => {
  grid.dataset.swatches.split(' ').forEach((v) => {
    const b = document.createElement('button');
    b.className = 'pg-swatch';
    b.type = 'button';
    b.style.setProperty('--c', `var(${v})`);
    const chip = document.createElement('span');
    chip.className = 'pg-swatch__chip';
    const meta = document.createElement('span');
    meta.className = 'pg-swatch__meta';
    const name = document.createElement('b');
    name.textContent = v.replace('--', '');
    const hex = document.createElement('code');
    hex.textContent = cssVar(v);
    meta.append(name, hex);
    b.append(chip, meta);
    b.addEventListener('click', () => {
      navigator.clipboard?.writeText(`var(${v})`)
        .then(() => toast(`Copiado: var(${v})`, 'success', 1500))
        .catch(() => toast(`var(${v})`, 'info', 1500));
    });
    grid.append(b);
  });
});

// ---------- Contraste (WCAG) calculado dos tokens ----------
const hexToRgb = (h) => { const n = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); };
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const resolve = (c) => (c.startsWith('--') ? cssVar(c) : c);
const ratio = (fg, bg) => { const a = lum(hexToRgb(resolve(fg))); const b = lum(hexToRgb(resolve(bg))); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const PAIRS = [
  ['Texto principal', '--ink', '--snow', 'Texto'],
  ['Texto secundário', '--ink-2', '--frost-50', 'Texto'],
  ['Texto apagado', '--ink-3', '--snow', 'Texto'],
  ['Botão azul (topo)', '#ffffff', '--frost-500', 'Botão'],
  ['Botão azul (base)', '#ffffff', '--frost-700', 'Botão'],
  ['Botão verde (topo)', '#ffffff', '--go-500', 'Botão'],
  ['Botão vermelho (topo)', '#ffffff', '--danger-500', 'Botão'],
  ['Botão dourado', '--ink', '--gold-500', 'Botão'],
  ['Selo Comum', '--ink', '--r-common', 'Selo'],
  ['Selo Incomum', '--ink', '--r-uncommon', 'Selo'],
  ['Selo Raro', '--ink', '--r-rare', 'Selo'],
  ['Selo Épico', '--ink', '--r-epic', 'Selo'],
  ['Selo Lendário', '--ink', '--r-legendary', 'Selo'],
  ['Selo Mítico', '--ink', '--r-mythic', 'Selo'],
];
function renderContrast() {
$('#contrast tbody').replaceChildren(...PAIRS.map(([label, fg, bg]) => {
  const r = ratio(fg, bg);
  const tr = document.createElement('tr');
  const sample = document.createElement('span');
  sample.className = 'pg-sample';
  sample.textContent = 'Aa 123';
  sample.style.color = resolve(fg);
  sample.style.background = resolve(bg);
  const verdict = r >= 4.5 ? ['AA', 'ds-badge--go'] : r >= 3 ? ['AA texto grande / UI', 'ds-badge--gold'] : ['Falha', 'ds-badge--danger'];
  const badge = document.createElement('span');
  badge.className = `ds-badge ${verdict[1]}`;
  badge.textContent = verdict[0];
  [label, sample, r.toFixed(2), badge].forEach((c) => { const td = document.createElement('td'); td.append(c); tr.append(td); });
  return tr;
}));
}
renderContrast();

// ---------- Elementos ----------
$('#golem')?.replaceWith(faceCanvas({ ...en[5].face, skin: '#a9cbe0', eyeColor: '#1d4f73' }, 56));
$$('[data-hit]').forEach((b) => b.addEventListener('click', () => {
  const m = Number(b.dataset.hit);
  const [x, y] = centerOf(b);
  const dmg = Math.round(10 * m);
  if (m >= 1.5) floatText(`-${dmg} EFICAZ`, x, y - 24, 'ds-float--weak');
  else if (m <= 0.5) floatText(`-${dmg} RESISTE`, x, y - 24, 'ds-float--resist');
  else floatText(`-${dmg}`, x, y - 24);
}));

// ---------- Navegação ativa ----------
const links = new Map($$('.pg-nav a').map((a) => [a.getAttribute('href').slice(1), a]));
const navObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    links.forEach((a) => a.classList.remove('is-active'));
    links.get(entry.target.id)?.classList.add('is-active');
  }
}, { rootMargin: '-40% 0px -55% 0px' });
$$('.pg-sec').forEach((s) => navObserver.observe(s));
