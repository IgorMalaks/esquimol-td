// Motor da arena: loop de passo fixo (ADR-008), mundo lógico 1000x600 (ADR-002),
// inimigos em camadas (ADR-006), input por Pointer Events (ADR-005).
import { Path } from './pathing.js';
import { computeStats, UPGRADE_TRACKS, upgradeCost } from './stats.js';
import { drawFaceCached, drawEskimo, drawItemIcon, drawChest } from '../render/faceRenderer.js';
import { CLASSES, RARITIES } from '../data/defaults.js';
import { rollItem, rbe } from '../core/progression.js';
import { economy } from './economy.js';
import { canHitEnemy, hasTrait } from './enemies.js';
import { endlessEnemies, endlessGold, endlessRound } from './endless.js';
import { seededRandom } from '../core/utils.js';

export const WORLD = { W: 1000, H: 600 };
export const GROUND_TILT = 0.95;
const GROUND_TOP = WORLD.H * (1 - GROUND_TILT) / 2;
export const projectY = (y, height = 0) => GROUND_TOP + y * GROUND_TILT - height;
export const groundY = (y) => (y - GROUND_TOP) / GROUND_TILT;
const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 12;
export const TOWER_R = 20;
const PATH_W = 46;
const ITEM_LIFETIME = 8;
const DROP_HIT_R = 30;
const SELL_RATIO = 0.7;

export const TARGET_MODES = ['primeiro', 'ultimo', 'forte', 'perto'];
export const TARGET_LABEL = { primeiro: 'Primeiro', ultimo: 'Último', forte: 'Mais forte', perto: 'Mais perto' };

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{data, phase, map, roster: Array<{def, nodes, items}>, callbacks}} opts
   * callbacks: onHud(state), onSelect(tower|null), onToast(msg,type), onEnd(result)
   */
  constructor(canvas, { data, phase, map, roster, callbacks }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = data;
    this.phase = phase;
    this.map = map;
    this.roster = roster;
    this.cb = callbacks;
    this.path = new Path(map.points.map(([x, y]) => ({ x: x * WORLD.W, y: y * WORLD.H })));
    this.flightPath = map.flightPath?.length > 1
      ? new Path(map.flightPath.map(([x, y]) => ({ x: x * WORLD.W, y: y * WORLD.H })))
      : this.path;
    this.enemyDefs = new Map(data.enemies.map((e) => [e.id, e]));
    this.roundData = data;
    this.rbeMemo = Object.create(null);
    this.canHitAir = roster.some((entry) => computeStats(entry.def, entry).hitsAir);
    this.bossDrops = [];

    this.gold = Number(phase.startGold);
    this.lives = Number(phase.lives);
    this.round = 0;
    this.roundActive = false;
    this.roundTime = 0;
    this.spawnQueue = [];
    this.speed = 1;
    this.autoStart = false;
    this.over = false;

    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
    this.effects = [];
    this.loot = [];
    this.used = new Set();
    this.seq = 0;

    this.placing = null;
    this.dragging = false;
    this.ghost = null;
    this.selected = null;
    this.time = 0;

    const rnd = seededRandom(`snow${map.id}`);
    this.snow = Array.from({ length: 50 }, () => ({ x: rnd() * WORLD.W, y: rnd() * WORLD.H, s: 1 + rnd() * 2.2, v: 15 + rnd() * 30 }));

    this._hudKey = '';
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas.parentElement);
    this._bindInput();
    this.resize();
    this._last = performance.now();
    this._acc = 0;
    this._raf = requestAnimationFrame(this._frame);
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this._unbind?.();
  }

  // ---------- Loop ----------
  _frame = (now) => {
    if (this._destroyed) return;
    const dt = Math.min(0.25, (now - this._last) / 1000);
    this._last = now;
    if (!this.over) {
      this._acc += dt * this.speed;
      let n = 0;
      while (this._acc >= STEP && n < MAX_STEPS_PER_FRAME) { this.update(STEP); this._acc -= STEP; n++; }
      if (n >= MAX_STEPS_PER_FRAME) this._acc = 0;
    }
    this.time += dt;
    for (const f of this.snow) { f.y += f.v * dt; f.x += Math.sin(this.time + f.y * 0.02) * 8 * dt; if (f.y > WORLD.H) f.y = -5; }
    this.render();
    this._emitHud();
    this._raf = requestAnimationFrame(this._frame);
  };

  update(dt) {
    if (this.roundActive) {
      this.roundTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.roundTime) {
        this.spawnEnemy(this.spawnQueue.shift().def, 0);
      }
    }
    for (const e of this.enemies) this._updateEnemy(e, dt);
    for (const t of this.towers) this._updateTower(t, dt);
    for (const p of this.projectiles) this._updateProjectile(p, dt);
    for (const d of this.drops) { d.t += dt; if (d.t >= d.life) d.dead = true; }
    for (const fx of this.effects) fx.t += dt;

    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.drops = this.drops.filter((d) => !d.dead);
    this.effects = this.effects.filter((fx) => fx.t < fx.dur);

    if (this.over) return;
    if (this.roundActive && !this.spawnQueue.length && !this.enemies.length) this._endRound();
  }

  // ---------- Rodadas ----------
  startRound() {
    if (this.roundActive || this.over) return;
    const r = this.nextRound();
    if (!r?.groups.length) return;
    if (this.phase.endless) {
      const enemies = endlessEnemies(this.data, this.round + 1);
      this.roundData = { ...this.data, enemies };
      this.enemyDefs = new Map(enemies.map((enemy) => [enemy.id, enemy]));
      this.rbeMemo = Object.create(null);
    }
    const queue = [];
    for (const grp of r.groups) {
      const def = this.enemyDefs.get(grp.enemyId);
      if (!def) continue;
      for (let i = 0; i < Number(grp.count); i++) {
        queue.push({ t: Number(grp.delay || 0) + i * Number(grp.interval || 1), def });
      }
    }
    this.spawnQueue = queue.sort((a, b) => a.t - b.t);
    this.roundTime = 0;
    this.roundActive = true;
  }

  nextRound() {
    return this.phase.endless
      ? endlessRound(this.data, this.round + 1, this.phase.endless, this.canHitAir)
      : this.phase.rounds[this.round];
  }

  _endRound() {
    this.roundActive = false;
    this.round++;
    const bonus = this.phase.endless ? endlessGold(this.round) : 100 + this.round;
    this.gold += bonus;
    if (!this.phase.endless && this.round >= this.phase.rounds.length) { this.end(true); return; }
    this.cb.onToast?.(`Rodada ${this.round} concluída! +${bonus} ouro`, 'success');
    if (this.autoStart) this.startRound();
  }

  end(victory) {
    if (this.over) return;
    this.over = true;
    this.roundActive = false;
    if (victory) {
      for (const d of this.drops) if (d.type === 'chest') this.loot.push(...this._openChest());
      this.drops = this.drops.filter((d) => d.type !== 'chest');
    }
    this.cb.onEnd?.({
      victory, phaseId: this.phase.id, roundsCompleted: this.round,
      items: [...this.loot], usedEskimos: [...this.used],
      endless: this.phase.endless, duration: Math.floor(this.time), bossDrops: this.bossDrops,
    });
  }

  // ---------- Inimigos ----------
  spawnEnemy(def, dist) {
    const path = hasTrait(def, 'aereo') ? this.flightPath : this.path;
    const p = path.pointAt(dist);
    const e = {
      id: ++this.seq, def, path, dist, x: p.x, y: p.y, r: Number(def.size) || 15,
      hp: Math.max(1, Number(def.hp) || 1), alive: true, slowPct: 0, slowTimer: 0, phase: Math.random() * 6,
    };
    this.enemies.push(e);
    return e;
  }

  _updateEnemy(e, dt) {
    if (!e.alive) return;
    if (e.slowTimer > 0) { e.slowTimer -= dt; if (e.slowTimer <= 0) e.slowPct = 0; }
    e.dist += Number(e.def.speed) * (1 - e.slowPct) * dt;
    if (e.dist >= e.path.length) {
      e.alive = false;
      this.lives -= rbe(e.def.id, this.roundData, this.rbeMemo);
      if (this.lives <= 0) { this.lives = 0; this.end(false); }
      return;
    }
    const p = e.path.pointAt(e.dist);
    e.x = p.x; e.y = p.y;
  }

  hitEnemy(e, dmg, p) {
    if (!e.alive || (p && !canHitEnemy(e.def, p.hitsAir))) return;
    if (p?.slowPct > 0) {
      const factor = hasTrait(e.def, 'chefe') ? 0.5 : 1;
      e.slowPct = Math.max(e.slowPct, Math.min(0.8, p.slowPct / 100) * factor);
      e.slowTimer = Math.max(e.slowTimer, p.slowDur);
    }
    e.hp -= dmg;
    if (e.hp <= 0) this._popEnemy(e, -e.hp, p);
  }

  // Camadas estilo Bloons: ao morrer, vira N inimigos da camada anterior; dano excedente passa adiante.
  _popEnemy(e, overflow, p) {
    e.alive = false;
    this.gold += Number(e.def.reward) || 0;
    if (p?.tower) p.tower.pops++;
    this.effects.push({ type: 'pop', x: e.x, y: e.y, r: e.r, color: e.def.face.skin, t: 0, dur: 0.3 });
    if (this.phase.endless && hasTrait(e.def, 'chefe')) {
      const reward = rollItem(this.data);
      const drops = reward ? [reward.id] : [];
      this.loot.push(...drops);
      this.bossDrops.push(drops);
    } else {
      this._maybeDrop(e);
    }
    const child = e.def.childId && this.enemyDefs.get(e.def.childId);
    if (!child) return;
    const children = [];
    const n = Math.max(1, Number(e.def.childCount) || 1);
    for (let i = 0; i < n; i++) {
      const childPath = hasTrait(child, 'aereo') ? this.flightPath : this.path;
      const distance = childPath === e.path ? e.dist : e.dist * childPath.length / e.path.length;
      const c = this.spawnEnemy(child, Math.max(0, distance - i * 12));
      c.slowPct = e.slowPct; c.slowTimer = e.slowTimer;
      p?.hit.add(c.id);
      children.push(c);
    }
    if (overflow > 0 && canHitEnemy(child, p?.hitsAir)) this.hitEnemy(children[0], overflow, p && { hitsAir: p.hitsAir });
  }

  // ---------- Drops ----------
  _maybeDrop(e) {
    const settings = economy(this.data);
    if (Math.random() >= (Number(e.def.dropChance) || 0) * settings.dropRateMultiplier) return;
    const item = rollItem(this.data);
    if (!item) return;
    const chest = Math.random() < settings.chestChance;
    const ang = Math.random() * Math.PI * 2;
    const off = PATH_W * 0.7;
    this.drops.push({
      id: ++this.seq, type: chest ? 'chest' : 'item', itemId: item.id,
      x: Math.min(WORLD.W - 20, Math.max(20, e.x + Math.cos(ang) * off)),
      y: Math.min(WORLD.H - 20, Math.max(20, e.y + Math.sin(ang) * off)),
      t: 0, life: chest ? Infinity : ITEM_LIFETIME,
    });
  }

  _openChest() {
    const out = [];
    const n = 1 + (Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) { const it = rollItem(this.data); if (it) out.push(it.id); }
    return out;
  }

  _collectDrop(d) {
    d.dead = true;
    const ids = d.type === 'chest' ? this._openChest() : [d.itemId];
    this.loot.push(...ids);
    const names = ids.map((id) => this.data.items.find((i) => i.id === id)?.name).filter(Boolean).join(', ');
    this.cb.onToast?.(d.type === 'chest' ? `Baú aberto: ${names}` : `Você pegou: ${names}`, 'loot');
    this.effects.push({ type: 'ring', x: d.x, y: d.y, r: 30, color: '#ffd32a', t: 0, dur: 0.4 });
  }

  // ---------- Torres ----------
  rosterEntry(id) {
    return this.roster.find((r) => r.def.id === id);
  }

  towerStats(t) {
    return computeStats(t.def, {
      items: t.entry.items,
      nodes: t.entry.nodes.filter((n) => t.active.has(n.id)),
      upgrades: t.upgrades,
    });
  }

  canPlace(x, y) {
    if (x < TOWER_R || y < TOWER_R || x > WORLD.W - TOWER_R || y > WORLD.H - TOWER_R) return false;
    if (this.path.distanceTo(x, y) < PATH_W / 2 + TOWER_R - 4) return false;
    return !this.towers.some((t) => dist2(t.x, t.y, x, y) < (TOWER_R * 2 - 4) ** 2);
  }

  placeTower(id, x, y) {
    const entry = this.rosterEntry(id);
    if (!entry) return false;
    const cost = Number(entry.def.cost);
    if (this.gold < cost) { this.cb.onToast?.('Ouro insuficiente.', 'error'); return false; }
    if (!this.canPlace(x, y)) { this.cb.onToast?.('Não dá pra posicionar aí.', 'error'); return false; }
    const t = {
      uid: ++this.seq, def: entry.def, entry, x, y, cooldown: 0, angle: -Math.PI / 2,
      targetMode: 'primeiro', upgrades: { dmg: 0, spd: 0, rng: 0 }, active: new Set(), invested: cost, pops: 0,
    };
    t.stats = this.towerStats(t);
    this.towers.push(t);
    this.gold -= cost;
    this.used.add(entry.def.id);
    this.effects.push({ type: 'ring', x, y, r: 28, color: '#ffffff', t: 0, dur: 0.35 });
    return true;
  }

  upgrade(t, track) {
    const lvl = t.upgrades[track];
    if (lvl >= UPGRADE_TRACKS[track].max) return false;
    const cost = upgradeCost(t.def, track, lvl);
    if (this.gold < cost) { this.cb.onToast?.('Ouro insuficiente.', 'error'); return false; }
    this.gold -= cost;
    t.invested += cost;
    t.upgrades[track]++;
    t.stats = this.towerStats(t);
    return true;
  }

  activateNode(t, nodeId) {
    const node = t.entry.nodes.find((n) => n.id === nodeId);
    if (!node || t.active.has(nodeId)) return false;
    const cost = Number(node.gold) || 0;
    if (this.gold < cost) { this.cb.onToast?.('Ouro insuficiente.', 'error'); return false; }
    this.gold -= cost;
    t.invested += cost;
    t.active.add(nodeId);
    t.stats = this.towerStats(t);
    return true;
  }

  sell(t) {
    this.gold += Math.floor(t.invested * SELL_RATIO);
    this.towers = this.towers.filter((x) => x !== t);
    this.select(null);
  }

  sellValue(t) {
    return Math.floor(t.invested * SELL_RATIO);
  }

  cycleTarget(t) {
    t.targetMode = TARGET_MODES[(TARGET_MODES.indexOf(t.targetMode) + 1) % TARGET_MODES.length];
  }

  _findTarget(t) {
    const r = t.stats.range;
    let best = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive || !canHitEnemy(e.def, t.stats.hitsAir) || dist2(t.x, t.y, e.x, e.y) > (r + e.r) ** 2) continue;
      const progress = e.dist / e.path.length;
      let score;
      switch (t.targetMode) {
        case 'ultimo': score = -progress; break;
        case 'forte': score = rbe(e.def.id, this.roundData, this.rbeMemo) * 2 + progress; break;
        case 'perto': score = -dist2(t.x, t.y, e.x, e.y); break;
        default: score = progress;
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  _updateTower(t, dt) {
    t.cooldown -= dt;
    if (t.cooldown > 0) return;
    const target = this._findTarget(t);
    if (!target) return;
    t.cooldown = 1 / t.stats.fireRate;
    const s = t.stats;
    const base = Math.atan2(target.y - t.y, target.x - t.x);
    t.angle = base;
    const kind = CLASSES[t.def.classId]?.projectile || 'flecha';
    const n = 1 + s.multishot;
    const spread = 0.16;
    const flightTime = (s.range * 1.4) / s.projectileSpeed + 0.1;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      this.projectiles.push({
        id: ++this.seq, kind, tower: t,
        x: t.x + Math.cos(a) * TOWER_R, y: t.y + Math.sin(a) * TOWER_R,
        vx: Math.cos(a) * s.projectileSpeed, vy: Math.sin(a) * s.projectileSpeed, angle: a,
        life: flightTime, flightTime, hitsAir: s.hitsAir,
        damage: s.damage, pierce: s.pierce, splash: s.splash, slowPct: s.slowPct, slowDur: s.slowDuration,
        hit: new Set(), r: kind === 'bola' ? 8 : 6,
      });
    }
  }

  _updateProjectile(p, dt) {
    if (p.dead) return;
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0 || p.x < -30 || p.y < -30 || p.x > WORLD.W + 30 || p.y > WORLD.H + 30) { p.dead = true; return; }
    for (const e of this.enemies) {
      if (!e.alive || p.hit.has(e.id) || !canHitEnemy(e.def, p.hitsAir)) continue;
      if (dist2(p.x, p.y, e.x, e.y) > (e.r + p.r) ** 2) continue;
      if (p.splash > 0) { this._explode(p, e.x, e.y); p.dead = true; return; }
      p.hit.add(e.id);
      this.hitEnemy(e, p.damage, p);
      if (--p.pierce <= 0) { p.dead = true; return; }
    }
  }

  _explode(p, x, y) {
    const targets = this.enemies.filter((e) => e.alive && dist2(x, y, e.x, e.y) <= (p.splash + e.r) ** 2);
    for (const e of targets) { p.hit.add(e.id); this.hitEnemy(e, p.damage, p); }
    this.effects.push({ type: 'ring', x, y, r: p.splash, color: p.kind === 'gelo' ? '#7efcff' : '#ffffff', t: 0, dur: 0.3 });
  }

  // ---------- Seleção / input ----------
  select(t) {
    this.selected = t;
    this.cb.onSelect?.(t);
  }

  beginPlacing(id, dragging = false) {
    this.placing = id;
    this.dragging = dragging;
    this.select(null);
  }

  cancelPlacing() {
    this.placing = null;
    this.dragging = false;
    this.ghost = null;
  }

  clientToWorld(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((cx - rect.left) / rect.width) * WORLD.W;
    const y = groundY(((cy - rect.top) / rect.height) * WORLD.H);
    return { x, y, inside: x >= 0 && x <= WORLD.W && y >= 0 && y <= WORLD.H };
  }

  updateGhost(cx, cy) {
    if (!this.placing) { this.ghost = null; return; }
    const w = this.clientToWorld(cx, cy);
    this.ghost = w.inside ? { x: w.x, y: w.y, valid: this.canPlace(w.x, w.y) } : null;
  }

  // Chamado pelo pointerup global quando o arraste começou num card da barra.
  finishDrag(cx, cy, moved) {
    if (!this.dragging) return;
    this.dragging = false;
    const w = this.clientToWorld(cx, cy);
    if (w.inside && moved) {
      if (this.placeTower(this.placing, w.x, w.y)) this.cancelPlacing();
    } else if (moved) {
      this.cancelPlacing();
    }
    // Sem movimento = toque simples no card: continua no modo "toque no mapa para posicionar".
  }

  handleTap(x, y) {
    const drop = this.drops.find((d) => dist2(d.x, d.y - 10 / GROUND_TILT, x, y) <= DROP_HIT_R ** 2);
    if (drop) { this._collectDrop(drop); return; }
    if (this.placing) {
      if (this.placeTower(this.placing, x, y)) this.cancelPlacing();
      return;
    }
    const t = this.towers.filter((tw) =>
      dist2(tw.x, tw.y - TOWER_R * 0.75 / GROUND_TILT, x, y) <= (TOWER_R + 6) ** 2
    ).sort((a, b) => b.y - a.y)[0];
    this.select(t || null);
  }

  _bindInput() {
    const c = this.canvas;
    const move = (e) => { if (!this.dragging) this.updateGhost(e.clientX, e.clientY); };
    const up = (e) => {
      if (this.dragging || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const w = this.clientToWorld(e.clientX, e.clientY);
      this.handleTap(w.x, w.y);
    };
    const leave = () => { if (!this.dragging) this.ghost = null; };
    const ctxMenu = (e) => { e.preventDefault(); this.cancelPlacing(); this.select(null); };
    const key = (e) => {
      if (e.key === 'Escape') { this.cancelPlacing(); this.select(null); }
      else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); this.startRound(); }
    };
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointerleave', leave);
    c.addEventListener('contextmenu', ctxMenu);
    window.addEventListener('keydown', key);
    this._unbind = () => {
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointerleave', leave);
      c.removeEventListener('contextmenu', ctxMenu);
      window.removeEventListener('keydown', key);
    };
  }

  _emitHud() {
    const boss = this.enemies.find((enemy) => enemy.alive && hasTrait(enemy.def, 'chefe'));
    const s = {
      gold: Math.floor(this.gold), lives: this.lives, round: this.round, totalRounds: this.phase.rounds.length,
      roundActive: this.roundActive, speed: this.speed, autoStart: this.autoStart, over: this.over,
      boss: boss ? { name: boss.def.name, hp: Math.ceil(boss.hp), maxHp: boss.def.hp } : null,
    };
    const key = JSON.stringify(s);
    if (key !== this._hudKey) { this._hudKey = key; this.cb.onHud?.(s); }
  }

  // ---------- Render ----------
  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const margin = 8;
    const scale = Math.min((r.width - margin) / WORLD.W, (r.height - margin) / WORLD.H);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.floor(WORLD.W * scale);
    const ch = Math.floor(WORLD.H * scale);
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.width = Math.floor(cw * this.dpr);
    this.canvas.height = Math.floor(ch * this.dpr);
    this.px = (cw / WORLD.W) * this.dpr;
    this.bg = this._buildBackground();
  }

  _buildBackground() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(this.px, 0, 0, this.px, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, WORLD.H);
    grad.addColorStop(0, '#f4fbff');
    grad.addColorStop(1, '#d9eefc');
    g.fillStyle = grad;
    g.fillRect(0, 0, WORLD.W, WORLD.H);
    g.translate(0, GROUND_TOP);
    g.scale(1, GROUND_TILT);

    const rnd = seededRandom(this.map.id);
    g.fillStyle = 'rgba(160,210,240,0.35)';
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse(rnd() * WORLD.W, rnd() * WORLD.H, 30 + rnd() * 50, 12 + rnd() * 20, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 40; i++) {
      const x = rnd() * WORLD.W;
      const y = rnd() * WORLD.H;
      if (this.path.distanceTo(x, y) < PATH_W + 25) continue;
      const s = 12 + rnd() * 10;
      g.fillStyle = 'rgba(0,40,80,0.15)';
      g.beginPath(); g.ellipse(x, y + s * 0.9, s * 0.7, s * 0.25, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2e8b57'; g.strokeStyle = '#1b4d33'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const yy = y - k * s * 0.55;
        const w = s * (1 - k * 0.22);
        g.beginPath(); g.moveTo(x, yy - s * 0.9); g.lineTo(x + w * 0.7, yy + s * 0.2); g.lineTo(x - w * 0.7, yy + s * 0.2); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(x, yy - s * 0.9); g.lineTo(x + w * 0.25, yy - s * 0.5); g.lineTo(x - w * 0.25, yy - s * 0.5); g.closePath(); g.fill();
        g.fillStyle = '#2e8b57';
      }
    }

    const pts = this.path.points;
    const stroke = (w, color) => {
      g.lineWidth = w; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
    };
    stroke(PATH_W + 8, '#6fa8d6');
    stroke(PATH_W, '#bfe0f7');
    g.setLineDash([10, 14]);
    stroke(4, 'rgba(255,255,255,0.8)');
    g.setLineDash([]);
    return c;
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.px, 0, 0, this.px, 0, 0);

    for (const d of this.drops) this._drawDrop(ctx, d);

    if (this.selected) this._drawRange(ctx, this.selected.x, this.selected.y, this.selected.stats.range, true);
    const actors = [...this.enemies, ...this.towers].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.upgrades) this._drawTower(ctx, actor);
      else this._drawEnemy(ctx, actor);
    }

    for (const p of this.projectiles) this._drawProjectile(ctx, p);

    for (const fx of this.effects) {
      const k = fx.t / fx.dur;
      const y = projectY(fx.y, fx.type === 'pop' ? fx.r * 0.45 : 0);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = fx.type === 'pop' ? 4 : 3;
      ctx.beginPath(); ctx.arc(fx.x, y, fx.r * (fx.type === 'pop' ? 0.6 + k : 0.4 + 0.6 * k), 0, Math.PI * 2); ctx.stroke();
      if (fx.type === 'pop') {
        ctx.fillStyle = fx.color;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(fx.x + Math.cos(a) * fx.r * (0.5 + 1.5 * k), y + Math.sin(a) * fx.r * (0.5 + 1.5 * k), 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    if (this.placing && this.ghost) {
      const entry = this.rosterEntry(this.placing);
      if (entry) {
        const st = computeStats(entry.def, { items: entry.items });
        this._drawRange(ctx, this.ghost.x, this.ghost.y, st.range, this.ghost.valid);
        ctx.globalAlpha = 0.7;
        drawEskimo(ctx, entry.def, this.ghost.x, projectY(this.ghost.y), TOWER_R, -Math.PI / 2, this.px);
        ctx.globalAlpha = 1;
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.snow) { ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.fill(); }
  }

  _drawEnemy(ctx, e) {
      const ground = projectY(e.y);
      const altitude = hasTrait(e.def, 'aereo') ? 60 : 0;
      const x = e.x + (altitude ? Math.sin(this.time * 3 + e.phase) * 4 : 0);
      const y = ground - altitude - e.r * 0.55 + Math.sin(this.time * 8 + e.phase) * 1.5;
      ctx.fillStyle = 'rgba(0,40,80,0.18)';
      ctx.beginPath(); ctx.ellipse(e.x, ground, e.r * 0.8, e.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      drawFaceCached(ctx, e.def.face, x, y, e.r, this.px);
      if (e.slowPct > 0) {
        ctx.strokeStyle = 'rgba(126,252,255,0.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, y, e.r + 3, 0, Math.PI * 2); ctx.stroke();
      }
      if (e.def.hp > 1) {
        const w = e.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(e.x - w / 2, y - e.r - 10, w, 4);
        ctx.fillStyle = '#2ed573'; ctx.fillRect(e.x - w / 2, y - e.r - 10, w * (e.hp / e.def.hp), 4);
      }
  }

  _drawTower(ctx, t) {
      const y = projectY(t.y);
      drawEskimo(ctx, t.def, t.x, y, TOWER_R, t.angle, this.px);
      const lv = t.upgrades.dmg + t.upgrades.spd + t.upgrades.rng + t.active.size;
      if (lv) {
        ctx.fillStyle = '#ffd32a'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(t.x + TOWER_R * 0.8, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1b1b1b'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(lv), t.x + TOWER_R * 0.8, y + 0.5);
      }
  }

  _drawRange(ctx, x, y, r, ok) {
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.25)' : 'rgba(255,71,87,0.25)';
    ctx.strokeStyle = ok ? 'rgba(30,60,90,0.5)' : 'rgba(255,71,87,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, projectY(y), r, r * GROUND_TILT, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  _drawDrop(ctx, d) {
    const remaining = d.life - d.t;
    if (remaining < 2 && Math.floor(this.time * 8) % 2) return;
    const bob = Math.sin(this.time * 4 + d.id) * 3;
    const item = this.data.items.find((i) => i.id === d.itemId);
    const glow = d.type === 'chest' ? '#ffd32a' : RARITIES[item?.rarity]?.color || '#ffffff';
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = 16;
    const y = projectY(d.y, 10) + bob;
    if (d.type === 'chest') drawChest(ctx, d.x, y, 13);
    else if (item) drawItemIcon(ctx, item, d.x, y, 12);
    ctx.restore();
  }

  _drawProjectile(ctx, p) {
    ctx.save();
    const progress = 1 - p.life / p.flightTime;
    const height = p.kind === 'bola' ? 16 + Math.sin(progress * Math.PI) * 32 : 16;
    ctx.translate(p.x, projectY(p.y, height));
    ctx.rotate(p.angle);
    ctx.lineCap = 'round';
    switch (p.kind) {
      case 'bola':
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 'arpao':
        ctx.strokeStyle = '#636e72'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = '#dfe6e9';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(6, -5); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill();
        break;
      case 'gelo':
        ctx.shadowColor = '#7efcff'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#c7f9ff'; ctx.strokeStyle = '#0abde3'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -5); ctx.lineTo(-8, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      default:
        ctx.strokeStyle = '#8e5a2b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#b2bec3';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -3.5); ctx.lineTo(4, 3.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
