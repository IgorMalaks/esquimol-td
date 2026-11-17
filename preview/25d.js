// Prévia isolada da vista 2.5D (3/4). Não altera o jogo: reaproveita dados, caminho e rostos.
// Ideia central: simulação continua em coordenadas do mundo (x, y); só a projeção muda:
//   tela.x = x ; tela.y = TOP + y * tilt - altura
import { drawFaceCached, drawItemIcon, drawChest } from '../js/render/faceRenderer.js';
import { createDefaultData, CLASSES } from '../js/data/defaults.js';
import { Path } from '../js/game/pathing.js';
import { seededRandom } from '../js/core/utils.js';

const W = 1000, H = 600, TOP = 90, SLAB = 18, PATH_W = 46;
const TAU = Math.PI * 2, INK = '#1b1b1b';
const ENEMY_HOVER = 20;

const data = createDefaultData();
const map = data.maps[0];
const path = new Path(map.points.map(([x, y]) => ({ x: x * W, y: y * H })));
const enemyById = new Map(data.enemies.map((e) => [e.id, e]));

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const ground = document.createElement('canvas');
const $ = (id) => document.getElementById(id);

let tilt = Number($('tilt').value);
let paused = false;
let showRange = true;
let scale = 1, dpr = 1, time = 0;

const proj = (x, y, z = 0) => ({ x, y: TOP + y * tilt - z });
const logicalH = () => TOP + H * tilt + SLAB + 4;

// ---------- Cena ----------
const towers = [
  [150, 330, 'nanuk'], [380, 250, 'nanuk'], [380, 555, 'aput'], [625, 300, 'ila'], [620, 75, 'siku'], [880, 300, 'aput'],
].map(([x, y, id]) => ({ x, y, def: data.eskimos.find((e) => e.id === id), cd: Math.random(), facing: 1, recoil: 0 }));

const RATE = { arqueiro: 1.4, bolanev: 0.8, arpoador: 0.6, mago: 1.0 };
const SPEED = { flecha: 650, bola: 380, arpao: 800, gelo: 450 };
const RANGE = 185;

const rnd = seededRandom('preview25d');
const decor = [];
for (let i = 0; i < 70 && decor.length < 26; i++) {
  const x = 30 + rnd() * (W - 60), y = 30 + rnd() * (H - 50);
  if (path.distanceTo(x, y) < 60) continue;
  if (towers.some((t) => Math.hypot(t.x - x, t.y - y) < 55)) continue;
  if (decor.some((d) => Math.hypot(d.x - x, d.y - y) < 50)) continue;
  const k = rnd();
  decor.push({ x, y, kind: k < 0.55 ? 'tree' : k < 0.85 ? 'block' : 'snowman', s: 0.8 + rnd() * 0.5 });
}
decor.push({ x: 965, y: 420, kind: 'igloo', s: 1 });

let enemies = [], projectiles = [], effects = [], drops = [];
let spawnT = 0, seq = 0;
const SPAWN_POOL = ['vermelho', 'azul', 'verde', 'amarelo', 'rosa', 'azul', 'verde', 'pedra'];

function spawn(def, dist = 0) {
  const p = path.pointAt(dist);
  const e = { id: ++seq, def, dist, x: p.x, y: p.y, r: Number(def.size) || 15, hp: def.hp, slow: 0, ph: Math.random() * 6 };
  enemies.push(e);
  return e;
}

function addDrop(x, y, chest) {
  const item = data.items[Math.floor(Math.random() * data.items.length)];
  drops.push({ id: ++seq, x, y, chest, item, t: 0, life: chest ? 12 : 7 });
}

// ---------- Simulação (só para animar a prévia) ----------
function update(dt) {
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = 0.75;
    spawn(enemyById.get(SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)]));
  }

  for (const e of enemies) {
    if (e.slow > 0) e.slow -= dt;
    e.dist += e.def.speed * 0.55 * (e.slow > 0 ? 0.6 : 1) * dt;
    const p = path.pointAt(e.dist);
    e.x = p.x; e.y = p.y;
  }
  enemies = enemies.filter((e) => !e.dead && e.dist < path.length - 75);

  for (const t of towers) {
    t.cd -= dt;
    t.recoil = Math.max(0, t.recoil - dt * 6);
    if (t.cd > 0) continue;
    let target = null;
    for (const e of enemies) {
      if (Math.hypot(e.x - t.x, e.y - t.y) <= RANGE + e.r && (!target || e.dist > target.dist)) target = e;
    }
    if (!target) continue;
    t.cd = 1 / RATE[t.def.classId];
    t.facing = target.x >= t.x ? 1 : -1;
    t.recoil = 1;
    const kind = CLASSES[t.def.classId].projectile;
    const d = Math.hypot(target.x - t.x, target.y - t.y);
    projectiles.push({ kind, sx: t.x + t.facing * 14, sy: t.y, target, tx: target.x, ty: target.y, t: 0, dur: Math.max(0.12, d / SPEED[kind]), prev: null });
  }

  for (const p of projectiles) {
    p.t += dt / p.dur;
    if (!p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
    if (p.t >= 1) { p.done = true; if (!p.target.dead) hit(p.target, p.kind); }
  }
  projectiles = projectiles.filter((p) => !p.done);

  for (const fx of effects) fx.t += dt;
  effects = effects.filter((fx) => fx.t < fx.dur);
  for (const d of drops) d.t += dt;
  drops = drops.filter((d) => d.t < d.life);
}

function hit(e, kind) {
  if (kind === 'gelo') e.slow = 1.5;
  if (--e.hp > 0) return;
  e.dead = true;
  effects.push({ x: e.x, y: e.y, z: ENEMY_HOVER + e.r, r: e.r, color: e.def.face.skin, t: 0, dur: 0.35 });
  if (Math.random() < 0.05) addDrop(e.x + (Math.random() - 0.5) * 70, e.y + 35, Math.random() < 0.3);
  const child = e.def.childId && enemyById.get(e.def.childId);
  if (!child) return;
  for (let i = 0; i < Math.max(1, e.def.childCount); i++) {
    const c = spawn(child, Math.max(0, e.dist - i * 12));
    c.slow = e.slow;
  }
}

// ---------- Chão (pré-renderizado) ----------
function trace(g) {
  g.beginPath();
  path.points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
}

function buildGround() {
  ground.width = canvas.width;
  ground.height = canvas.height;
  const g = ground.getContext('2d');
  g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

  // céu + montanhas no horizonte
  const sky = g.createLinearGradient(0, 0, 0, TOP);
  sky.addColorStop(0, '#8fd3ff'); sky.addColorStop(1, '#e6f6ff');
  g.fillStyle = sky; g.fillRect(0, 0, W, TOP + 2);
  const mr = seededRandom('mountains');
  for (const [color, h0] of [['#b9d9f0', 75], ['#9cc7e6', 55]]) {
    g.fillStyle = color; g.strokeStyle = INK; g.lineWidth = 2;
    for (let x = -60; x < W + 60; x += 110 + mr() * 60) {
      const h = h0 * (0.6 + mr() * 0.5), w = 90 + mr() * 70;
      g.beginPath(); g.moveTo(x - w, TOP + 1); g.lineTo(x, TOP - h); g.lineTo(x + w, TOP + 1); g.closePath(); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(x, TOP - h); g.lineTo(x - w * 0.28, TOP - h * 0.7); g.lineTo(x + w * 0.28, TOP - h * 0.7); g.closePath(); g.fill();
      g.fillStyle = color;
    }
  }

  // plano do chão (achatado pela inclinação)
  g.save();
  g.translate(0, TOP);
  g.scale(1, tilt);
  const snow = g.createLinearGradient(0, 0, 0, H);
  snow.addColorStop(0, '#eef8ff'); snow.addColorStop(1, '#ffffff');
  g.fillStyle = snow; g.fillRect(0, 0, W, H);
  const pr = seededRandom('patches');
  g.fillStyle = 'rgba(150,200,235,0.28)';
  for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(pr() * W, pr() * H, 30 + pr() * 60, 14 + pr() * 22, 0, 0, TAU); g.fill(); }

  // caminho como vala: borda clara, parede escura (fundo visível), piso rebaixado
  g.lineJoin = 'round'; g.lineCap = 'round';
  trace(g); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = PATH_W + 14; g.stroke();
  trace(g); g.strokeStyle = '#5f93bf'; g.lineWidth = PATH_W + 6; g.stroke();
  g.save();
  g.translate(0, 7 / tilt);
  trace(g); g.strokeStyle = '#bfe0f7'; g.lineWidth = PATH_W - 2; g.stroke();
  g.setLineDash([10, 16]); trace(g); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; g.stroke();
  g.restore();
  g.restore();

  // espessura frontal do "diorama"
  const y0 = TOP + H * tilt;
  const slab = g.createLinearGradient(0, y0, 0, y0 + SLAB);
  slab.addColorStop(0, '#8cc3e8'); slab.addColorStop(1, '#5f93bf');
  g.fillStyle = slab; g.fillRect(0, y0, W, SLAB);
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0); g.stroke();
}

// ---------- Desenho de objetos ----------
function shadow(x, y, rx, a = 0.2) {
  const p = proj(x, y);
  ctx.fillStyle = `rgba(0,40,80,${a})`;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, rx * tilt * 0.55, 0, 0, TAU); ctx.fill();
}

function weapon(classId, r, top) {
  ctx.lineCap = 'round';
  switch (classId) {
    case 'arqueiro':
      ctx.strokeStyle = '#8e5a2b'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(r * 0.55, top + r * 0.85, r * 0.8, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(r * 0.55 + Math.cos(1.15) * r * 0.8, top + r * 0.85 - Math.sin(1.15) * r * 0.8);
      ctx.lineTo(r * 0.55 + Math.cos(1.15) * r * 0.8, top + r * 0.85 + Math.sin(1.15) * r * 0.8); ctx.stroke();
      break;
    case 'bolanev':
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r * 1.0, top + r * 0.05, r * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    case 'arpoador':
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-r * 0.4, top + r * 1.35); ctx.lineTo(r * 1.7, top + r * 0.05); ctx.stroke();
      ctx.fillStyle = '#dfe6e9'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(r * 2.05, top - r * 0.17); ctx.lineTo(r * 1.55, top - r * 0.05); ctx.lineTo(r * 1.75, top + r * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'mago':
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(r * 1.05, top + r * 1.65); ctx.lineTo(r * 1.05, top - r * 0.3); ctx.stroke();
      ctx.save(); ctx.shadowColor = '#7efcff'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#48dbfb'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(r * 1.05, top - r * 0.5, r * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      break;
  }
}

function drawTower(t) {
  const p = proj(t.x, t.y);
  const r = 17;
  const top = -r * 1.75 + Math.sin(time * 3 + t.x) * 0.8;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.fillStyle = '#5d4037';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.42, -2, r * 0.32, r * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = t.def.bodyColor;
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, -r * 0.25);
  ctx.quadraticCurveTo(-r * 1.0, top + r * 0.2, 0, top);
  ctx.quadraticCurveTo(r * 1.0, top + r * 0.2, r * 0.95, -r * 0.25);
  ctx.quadraticCurveTo(0, r * 0.15, -r * 0.95, -r * 0.25);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-r * 0.1, top + r * 0.35, r * 0.2, r * 1.0);
  ctx.fillStyle = '#fbfdff';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.25, r * 0.98, r * 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.scale(t.facing, 1);
  ctx.translate(-t.recoil * 3, 0);
  weapon(t.def.classId, r, top);
  ctx.fillStyle = '#fbfdff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(r * 0.85, top + r * 0.75, r * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  drawFaceCached(ctx, t.def.face, p.x, p.y + top - r * 0.45, r * 0.95, scale * dpr);
}

function drawEnemy(e) {
  const p = proj(e.x, e.y);
  const bob = Math.sin(time * 8 + e.ph) * 2;
  const cy = p.y - ENEMY_HOVER - e.r * 0.3 - bob;
  drawFaceCached(ctx, e.def.face, p.x, cy, e.r, scale * dpr);
  if (e.slow > 0) {
    ctx.strokeStyle = 'rgba(126,252,255,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, cy, e.r + 3, 0, TAU); ctx.stroke();
  }
}

function drawDecor(d) {
  const p = proj(d.x, d.y);
  const s = d.s;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  if (d.kind === 'tree') {
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(-3 * s, -10 * s, 6 * s, 10 * s); ctx.strokeRect(-3 * s, -10 * s, 6 * s, 10 * s);
    for (let k = 0; k < 3; k++) {
      const by = -8 * s - k * 13 * s, w = (20 - k * 5) * s;
      ctx.fillStyle = '#2e8b57';
      ctx.beginPath(); ctx.moveTo(-w, by); ctx.lineTo(0, by - 22 * s); ctx.lineTo(w, by); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-w * 0.35, by - 14 * s); ctx.lineTo(0, by - 22 * s); ctx.lineTo(w * 0.35, by - 14 * s); ctx.closePath(); ctx.fill();
    }
  } else if (d.kind === 'block') {
    const w = 34 * s, h = 18 * s, dep = w * tilt;
    ctx.fillStyle = '#9fd3f5'; ctx.fillRect(-w / 2, -h, w, h); ctx.strokeRect(-w / 2, -h, w, h);
    ctx.fillStyle = '#e3f5ff'; ctx.fillRect(-w / 2, -h - dep, w, dep); ctx.strokeRect(-w / 2, -h - dep, w, dep);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-w / 2 + 4, -h + 3, 5, h - 6);
  } else if (d.kind === 'snowman') {
    ctx.fillStyle = '#ffffff';
    for (const [y, r] of [[-12, 13], [-32, 9]]) { ctx.beginPath(); ctx.arc(0, y * s, r * s, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = INK; for (const x of [-3, 3]) { ctx.beginPath(); ctx.arc(x * s, -34 * s, 1.5 * s, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.moveTo(0, -31 * s); ctx.lineTo(9 * s, -30 * s); ctx.lineTo(0, -29 * s); ctx.fill();
    ctx.fillStyle = '#d63a3a'; ctx.fillRect(-9 * s, -25 * s, 18 * s, 4 * s);
  } else if (d.kind === 'igloo') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, 44, 44 * tilt * 0.55, 0, Math.PI, 0); ctx.lineTo(44, 0);
    ctx.ellipse(0, 0, 44, 46, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#b8d8ec'; ctx.lineWidth = 1.5;
    for (const y of [-14, -28]) { ctx.beginPath(); ctx.moveTo(-40 + Math.abs(y) * 0.4, y); ctx.lineTo(40 - Math.abs(y) * 0.4, y); ctx.stroke(); }
    ctx.fillStyle = '#3b5b75'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-8, 0, 14, 18, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawDrop(d) {
  if (d.life - d.t < 2 && Math.floor(time * 8) % 2) return;
  const p = proj(d.x, d.y);
  const bob = Math.sin(time * 4 + d.id) * 3;
  ctx.save();
  ctx.shadowColor = '#ffd32a'; ctx.shadowBlur = 16;
  if (d.chest) drawChest(ctx, p.x, p.y - 14 - bob, 13);
  else drawItemIcon(ctx, d.item, p.x, p.y - 18 - bob, 12);
  ctx.restore();
}

function drawProjectile(pr) {
  const t = Math.min(1, pr.t);
  const x = pr.sx + (pr.tx - pr.sx) * t;
  const y = pr.sy + (pr.ty - pr.sy) * t;
  const arc = pr.kind === 'bola' ? 55 : pr.kind === 'gelo' ? 25 : 10;
  const z = 32 + (ENEMY_HOVER + 8 - 32) * t + Math.sin(Math.PI * t) * arc;
  shadow(x, y, 5, 0.15);
  const p = proj(x, y, z);
  const ang = pr.prev ? Math.atan2(p.y - pr.prev.y, p.x - pr.prev.x) : 0;
  pr.prev = p;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  if (pr.kind === 'bola') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (pr.kind === 'gelo') {
    ctx.shadowColor = '#7efcff'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#c7f9ff'; ctx.strokeStyle = '#0abde3'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -5); ctx.lineTo(-8, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    const len = pr.kind === 'arpao' ? 16 : 10;
    ctx.strokeStyle = pr.kind === 'arpao' ? '#636e72' : '#8e5a2b'; ctx.lineWidth = pr.kind === 'arpao' ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.fillStyle = '#dfe6e9';
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------- Frame ----------
const flakes = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * 700, s: 1 + Math.random() * 2, v: 15 + Math.random() * 30 }));

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(ground, 0, 0);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

  if (showRange) {
    const t = towers[1];
    const p = proj(t.x, t.y);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.strokeStyle = 'rgba(30,60,90,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, RANGE, RANGE * tilt, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }

  for (const t of towers) shadow(t.x, t.y, 20, 0.22);
  for (const e of enemies) shadow(e.x, e.y, e.r * 0.85, 0.18);
  for (const d of drops) shadow(d.x, d.y, 11, 0.18);
  for (const d of decor) if (d.kind !== 'igloo') shadow(d.x, d.y, 16 * d.s, 0.16);

  // ordenação por profundidade: quem está mais embaixo na tela é desenhado por cima
  const objs = [
    ...decor.map((d) => ({ y: d.y, draw: () => drawDecor(d) })),
    ...towers.map((t) => ({ y: t.y, draw: () => drawTower(t) })),
    ...enemies.map((e) => ({ y: e.y, draw: () => drawEnemy(e) })),
    ...drops.map((d) => ({ y: d.y + 1, draw: () => drawDrop(d) })),
  ].sort((a, b) => a.y - b.y);
  for (const o of objs) o.draw();

  for (const pr of projectiles) drawProjectile(pr);

  for (const fx of effects) {
    const k = fx.t / fx.dur;
    const p = proj(fx.x, fx.y, fx.z);
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = fx.color; ctx.fillStyle = fx.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, fx.r * (0.6 + k), 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, rr = fx.r * (0.5 + 1.5 * k);
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const f of flakes) { ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, TAU); ctx.fill(); }
}

function resize() {
  const box = canvas.parentElement.getBoundingClientRect();
  const lh = logicalH();
  scale = Math.max(0.1, Math.min((box.width - 10) / W, (box.height - 10) / lh));
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${lh * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(lh * scale * dpr);
  buildGround();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    update(dt);
    time += dt;
    for (const f of flakes) { f.y += f.v * dt; f.x += Math.sin(time + f.y * 0.02) * 8 * dt; if (f.y > logicalH()) f.y = -5; }
  }
  render();
  requestAnimationFrame(frame);
}

// ---------- Controles ----------
$('tiltVal').textContent = tilt.toFixed(2);
$('tilt').addEventListener('input', (e) => { tilt = Number(e.target.value); $('tiltVal').textContent = tilt.toFixed(2); resize(); });
$('range').addEventListener('change', (e) => { showRange = e.target.checked; });
$('pause').addEventListener('click', (e) => { paused = !paused; e.currentTarget.textContent = paused ? 'Continuar' : 'Pausar'; });
new ResizeObserver(resize).observe(canvas.parentElement);

// cena já povoada ao abrir
addDrop(300, 140, true);
addDrop(560, 545, false);
drops.forEach((d) => { d.life = 9999; });
for (let i = 0; i < 480; i++) update(1 / 60);
time = 8;
resize();
requestAnimationFrame(frame);
