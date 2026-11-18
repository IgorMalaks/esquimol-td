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
import { ALLY_DEFAULTS, applyAuras, summonerStats, supportStats } from './roles.js';
import { SpatialGrid } from './spatialGrid.js';
import { damageFeedback, damageMultiplier, ELEMENT_LABELS } from './elements.js';
import { inLight } from '../data/biomes.js';
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
const ALLY_FACES = {
  pinguim: { shape: 'oval', skin: '#536374', eyes: 'pontos', mouth: 'sorriso', headwear: 'nenhum', accessory: 'nenhum' },
  lobo: { shape: 'gota', skin: '#858b9d', eyes: 'bravos', mouth: 'dentes', headwear: 'orelhas', headwearColor: '#596176', accessory: 'nenhum' },
  urso: { shape: 'redondo', skin: '#f8f2e4', eyes: 'bravos', mouth: 'reta', headwear: 'orelhas', headwearColor: '#dfd9ce', accessory: 'nenhum' },
  foca: { shape: 'oval', skin: '#8db2c3', eyes: 'felizes', mouth: 'sorriso', headwear: 'nenhum', accessory: 'bigode' },
};

export const TARGET_MODES = ['primeiro', 'ultimo', 'forte', 'perto', 'eficaz'];
export const TARGET_LABEL = { primeiro: 'Primeiro', ultimo: 'Último', forte: 'Mais forte', perto: 'Mais perto', eficaz: 'Eficaz' };

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{data, phase, map, roster: Array<{def, nodes, items}>, callbacks}} opts
   * callbacks: onHud(state), onSelect(tower|null), onToast(msg,type), onEnd(result)
   */
  constructor(canvas, { data, phase, map, roster, abilities = [], callbacks }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = data;
    this.phase = phase;
    this.map = map;
    this.biome = data.biomes.find((biome) => biome.id === map.biome);
    this.layersPopped = 0;
    this.weatherTimer = 30;
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
    this.raidReward = null;
    this.seenEnemies = new Set();
    this.preparation = null;
    this.abilities = abilities.map((ability) => ability && { ...ability, remaining: ability.cooldown / 2 });
    this.abilityTarget = null;
    this.abilityBursts = [];
    this.goldBoost = null;

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
    this.enemyGrid = new SpatialGrid();
    this.allies = [];
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
    this.simTime = 0;

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
    this.simTime += dt;
    if (this.biome?.effect === 'vento' && this.simTime >= this.weatherTimer) {
      this.weatherTimer += 30;
      const tower = this.towers[Math.floor(Math.random() * this.towers.length)];
      if (tower) {
        tower.stunnedUntil = this.simTime + 2;
        this.effects.push({ type: 'ring', x: tower.x, y: tower.y, r: 45, color: '#7d88ff', t: 0, dur: 0.7 });
      }
    }
    if (this.preparation !== null) {
      this.preparation = Math.max(0, this.preparation - dt);
      if (this.preparation === 0) {
        this.preparation = null;
        this.startRound();
      }
    }
    if (this.roundActive) {
      this.roundTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.roundTime) {
        this.spawnEnemy(this.spawnQueue.shift().def, 0);
      }
    }
    for (const e of this.enemies) this._updateEnemy(e, dt);
    this.enemyGrid.clear();
    for (const e of this.enemies) if (e.alive) this.enemyGrid.add(e);
    if (this.over) return;
    this._updateAbilities(dt);
    for (const t of this.towers) this._updateTower(t, dt);
    for (const ally of this.allies) this._updateAlly(ally, dt);
    this.allies = this.allies.filter((ally) => !ally.dead);
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
    if (this.roundActive || this.over || this.preparation !== null) return;
    const r = this.nextRound();
    if (!r?.groups.length) return;
    if (this.phase.raid && !this.raidStarted) {
      if (this.cb.onRaidStart?.() === false) return;
      this.raidStarted = true;
    }
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
    this.cb.onAction?.('round');
  }

  nextRound() {
    return this.phase.endless
      ? endlessRound(this.data, this.round + 1, this.phase.endless, this.canHitAir, this.biome?.weights)
      : this.phase.rounds[this.round];
  }

  _endRound() {
    this.roundActive = false;
    this.round++;
    const bonus = (this.phase.endless ? endlessGold(this.round) : 100 + this.round) +
      this.towers.reduce((sum, tower) => sum + (tower.stats.roundGold ?? 0), 0);
    this.gold += bonus;
    if (!this.phase.endless && this.round >= this.phase.rounds.length) { this.end(true); return; }
    if (this.phase.raid && this.round === this.phase.raid.farmRounds.length) {
      this.preparation = this.phase.raid.prepTime;
      this.cb.onToast?.('O chefe está chegando. Prepare as defesas!', 'info');
      return;
    }
    this.cb.onToast?.(`Rodada ${this.round} concluída! +${bonus} ouro`, 'success');
    if (this.autoStart) this.startRound();
  }

  end(victory) {
    if (this.over) return;
    this.over = true;
    this.roundActive = false;
    if (victory) {
      for (const d of this.drops) if (d.type === 'chest') this.loot.push(...this._openChest(d.source));
      this.drops = this.drops.filter((d) => d.type !== 'chest');
      if (this.raidReward) {
        this.loot.push(...this.raidReward);
        this.bossDrops.push(this.raidReward);
      }
    }
    this.cb.onEnd?.({
      victory, phaseId: this.phase.id, roundsCompleted: this.round,
      items: [...this.loot], usedEskimos: [...this.used],
      endless: this.phase.endless, duration: Math.floor(this.simTime), bossDrops: this.bossDrops,
      raid: this.phase.raid && this.raidStarted ? this.phase.raid.id : null,
      seenEnemies: [...this.seenEnemies],
      biome: this.biome?.id, layersPopped: this.layersPopped,
    });
  }

  // ---------- Inimigos ----------
  spawnEnemy(def, dist) {
    const path = hasTrait(def, 'aereo') ? this.flightPath : this.path;
    const p = path.pointAt(dist);
    const e = {
      id: ++this.seq, def, path, dist, x: p.x, y: p.y, r: Number(def.size) || 15,
      hp: Math.max(0.1, Number(def.hp) || 1), alive: true, slowPct: 0, slowTimer: 0, phase: Math.random() * 6,
      lastHit: this.simTime, healAt: this.simTime + 4, shield: hasTrait(def, 'escudo') ? 6 : 0,
    };
    if (this.phase.raid && def.id === this.phase.raid.bossId && this.round >= this.phase.raid.farmRounds.length) {
      e.raidBoss = { timer: this.phase.raid.bossAbility.interval, stage: 0, speed: 1 };
    }
    this.enemies.push(e);
    this.seenEnemies.add(def.id);
    this.enemyGrid.add(e);
    return e;
  }

  _updateEnemy(e, dt) {
    if (!e.alive) return;
    if (e.slowTimer > 0) { e.slowTimer -= dt; if (e.slowTimer <= 0) e.slowPct = 0; }
    if (hasTrait(e.def, 'regenera') && this.simTime - e.lastHit >= 3) e.hp = e.def.hp;
    if (hasTrait(e.def, 'curandeiro') && this.simTime >= e.healAt) {
      e.healAt += 4;
      for (const other of this.enemies) {
        if (other.alive && other !== e && dist2(e.x, e.y, other.x, other.y) <= 80 ** 2) {
          other.hp = Math.min(other.def.hp, other.hp + 1);
        }
      }
    }
    if (e.raidBoss) this._updateRaidBoss(e, dt);
    const exposed = (this.biome?.effect === 'vento' && hasTrait(e.def, 'aereo')) ||
      (this.biome?.effect === 'calor' && e.def.element === 'fogo' && inLight(this.map, e.x, e.y));
    e.dist += Number(e.def.speed) * (e.raidBoss?.speed ?? 1) * (hasTrait(e.def, 'rapido') ? 1.8 : 1) *
      (exposed ? 1.2 : 1) * (1 - e.slowPct) * dt;
    if (e.dist >= e.path.length) {
      e.alive = false;
      if (hasTrait(e.def, 'ladrao')) this.gold = Math.max(0, this.gold - Math.ceil(this.gold * 0.05));
      this.lives -= rbe(e.def.id, this.roundData, this.rbeMemo);
      if (this.lives <= 0 || e.raidBoss) { this.lives = Math.max(0, this.lives); this.end(false); }
      return;
    }
    const p = e.path.pointAt(e.dist);
    e.x = p.x; e.y = p.y;
  }

  hitEnemy(e, dmg, p) {
    if (!e.alive || (p && !canHitEnemy(e.def, p.hitsAir, p.detection))) return;
    if (e.shield > 0 && Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
      const before = e.path.pointAt(Math.max(0, e.dist - 1));
      const after = e.path.pointAt(e.dist + 1);
      if ((p.x - e.x) * (after.x - before.x) + (p.y - e.y) * (after.y - before.y) > 0) {
        e.shield--;
        return;
      }
    }
    const elementMultiplier = damageMultiplier(this.data, e.def, p?.damageType);
    const multiplier = elementMultiplier * (hasTrait(e.def, 'blindado') && dmg < 2 ? 0.25 : 1);
    const feedback = damageFeedback(multiplier);
    if (feedback) this.effects.push({ type: 'text', x: e.x, y: e.y, text: feedback, t: 0, dur: 0.65 });
    if (!multiplier) return;
    if (p?.slowPct > 0 && !hasTrait(e.def, 'imune_gelo')) {
      const factor = hasTrait(e.def, 'chefe') ? 0.5 : 1;
      const heat = this.biome?.effect === 'calor' ? 0.7 : 1;
      e.slowPct = Math.max(e.slowPct, Math.min(0.8, p.slowPct / 100) * factor * heat);
      e.slowTimer = Math.max(e.slowTimer, p.slowDur);
    }
    e.lastHit = this.simTime;
    e.hp -= dmg * multiplier;
    if (e.raidBoss && e.hp > 0) this._triggerRaidStages(e);
    if (e.hp <= 0) this._popEnemy(e, -e.hp / multiplier, p);
  }

  // Camadas estilo Bloons: ao morrer, vira N inimigos da camada anterior; dano excedente passa adiante.
  _popEnemy(e, overflow, p) {
    e.alive = false;
    this.layersPopped++;
    if (!this.practiceDrop && this.cb.needsPracticeDrop?.()) {
      this.practiceDrop = true;
      this.drops.push({ id: ++this.seq, type: 'practice', x: e.x, y: e.y, t: 0, life: Infinity });
    }
    const raid = this.phase.raid;
    const inFarm = raid && this.round < raid.farmRounds.length;
    const boost = this.goldBoost?.until > this.simTime ? this.goldBoost.multiplier : 1;
    this.gold += (Number(e.def.reward) || 0) * (inFarm ? raid.farmGoldMultiplier : 1) * boost;
    if (p?.tower) p.tower.pops++;
    this.effects.push({ type: 'pop', x: e.x, y: e.y, r: e.r, color: e.def.face.skin, t: 0, dur: 0.3 });
    if (e.raidBoss || (this.phase.endless && hasTrait(e.def, 'chefe'))) {
      const count = e.raidBoss ? raid.bossLoot.rolls : 1;
      const source = e.raidBoss ? raid.bossLoot.source : 'normal';
      const drops = [];
      for (let i = 0; i < count; i++) {
        const reward = rollItem(this.data, Math.random, source);
        if (reward) drops.push(reward.id);
      }
      if (e.raidBoss) this.raidReward = drops;
      else {
        this.loot.push(...drops);
        this.bossDrops.push(drops);
      }
    } else {
      this._maybeDrop(e);
    }
    const child = e.def.childId && this.enemyDefs.get(e.def.childId);
    if (!child) return;
    const children = [];
    const n = Math.max(1, Number(e.def.childCount) || 1) * (hasTrait(e.def, 'divisor') ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const childPath = hasTrait(child, 'aereo') ? this.flightPath : this.path;
      const distance = childPath === e.path ? e.dist : e.dist * childPath.length / e.path.length;
      const c = this.spawnEnemy(child, Math.max(0, distance - i * 12));
      c.slowPct = e.slowPct; c.slowTimer = e.slowTimer;
      p?.hit?.add(c.id);
      children.push(c);
    }
    if (overflow > 0 && canHitEnemy(child, p?.hitsAir, p?.detection)) {
      this.hitEnemy(children[0], overflow, p && { hitsAir: p.hitsAir, detection: p.detection, damageType: p.damageType });
    }
  }

  // ---------- Drops ----------
  _maybeDrop(e) {
    const settings = economy(this.data);
    if (Math.random() >= (Number(e.def.dropChance) || 0) * settings.dropRateMultiplier) return;
    const source = this.phase.raid && this.round < this.phase.raid.farmRounds.length ? 'raidFarm' : 'normal';
    const item = rollItem(this.data, Math.random, source);
    if (!item) return;
    const chest = Math.random() < settings.chestChance;
    const ang = Math.random() * Math.PI * 2;
    const off = PATH_W * 0.7;
    this.drops.push({
      id: ++this.seq, type: chest ? 'chest' : 'item', itemId: item.id, source,
      x: Math.min(WORLD.W - 20, Math.max(20, e.x + Math.cos(ang) * off)),
      y: Math.min(WORLD.H - 20, Math.max(20, e.y + Math.sin(ang) * off)),
      t: 0, life: chest ? Infinity : ITEM_LIFETIME,
    });
  }

  _openChest(source) {
    const out = [];
    const n = 1 + (Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) { const it = rollItem(this.data, Math.random, source); if (it) out.push(it.id); }
    return out;
  }

  _collectDrop(d) {
    d.dead = true;
    this.cb.onAction?.('drop');
    if (d.type === 'practice') return;
    const ids = d.type === 'chest' ? this._openChest(d.source) : [d.itemId];
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
    const nodes = t.entry.nodes.filter((n) => t.active.has(n.id));
    const role = CLASSES[t.def.classId]?.role;
    if (role === 'suporte') return supportStats(t.def, nodes, t.upgrades);
    t.summon = role === 'invocador' ? summonerStats(t.def, nodes, t.upgrades) : null;
    return computeStats(t.def, {
      items: t.entry.items,
      nodes,
      upgrades: t.upgrades,
    });
  }

  refreshTowerStats() {
    for (const tower of this.towers) {
      tower.stats = this.towerStats(tower);
      if (this.biome?.effect === 'neblina') tower.stats.range *= 0.9;
      if (this.biome?.effect === 'escuridao' && !inLight(this.map, tower.x, tower.y)) tower.stats.range *= 0.85;
    }
    const supports = this.towers.filter((tower) => tower.stats.buffs);
    for (const tower of this.towers) if (!tower.stats.buffs) applyAuras(tower, supports);
  }

  canPlace(x, y) {
    if (x < TOWER_R || y < TOWER_R || x > WORLD.W - TOWER_R || y > WORLD.H - TOWER_R) return false;
    if (this.path.distanceTo(x, y) < PATH_W / 2 + TOWER_R - 4) return false;
    if (this.map.obstacles?.some(([ox, oy, radius]) => dist2(x, y, ox, oy) < (radius + TOWER_R) ** 2)) return false;
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
    this.towers.push(t);
    this.refreshTowerStats();
    this.gold -= cost;
    this.used.add(entry.def.id);
    this.cb.onAction?.('place');
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
    this.refreshTowerStats();
    this.cb.onAction?.('upgrade');
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
    this.refreshTowerStats();
    return true;
  }

  sell(t) {
    this.gold += Math.floor(t.invested * SELL_RATIO);
    this.towers = this.towers.filter((x) => x !== t);
    this.refreshTowerStats();
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
    for (const e of this.enemyGrid.near(t.x, t.y, r)) {
      if (!e.alive || !canHitEnemy(e.def, t.stats.hitsAir, t.stats.detection) ||
          dist2(t.x, t.y, e.x, e.y) > (r + e.r) ** 2) continue;
      const progress = e.dist / e.path.length;
      let score;
      switch (t.targetMode) {
        case 'ultimo': score = -progress; break;
        case 'forte': score = rbe(e.def.id, this.roundData, this.rbeMemo) * 2 + progress; break;
        case 'perto': score = -dist2(t.x, t.y, e.x, e.y); break;
        case 'eficaz': score = damageMultiplier(this.data, e.def, t.stats.damageType) * 2 + progress; break;
        default: score = progress;
      }
      if (!best || score > bestScore || (score === bestScore && e.id < best.id)) { bestScore = score; best = e; }
    }
    return best;
  }

  _updateTower(t, dt) {
    if ((t.stunnedUntil ?? 0) > this.simTime) return;
    if (t.stats.buffs) return;
    t.cooldown -= dt;
    if (t.cooldown > 0) return;
    if (t.summon) {
      if (this.roundActive && this.enemies.some((enemy) => enemy.alive)) this._summon(t);
      return;
    }
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
        life: flightTime, flightTime, hitsAir: s.hitsAir, detection: s.detection, damageType: s.damageType,
        damage: s.damage, pierce: s.pierce, splash: s.splash, slowPct: s.slowPct, slowDur: s.slowDuration,
        hit: new Set(), r: kind === 'bola' ? 8 : 6,
      });
    }
  }

  _updateProjectile(p, dt) {
    if (p.dead) return;
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0 || p.x < -30 || p.y < -30 || p.x > WORLD.W + 30 || p.y > WORLD.H + 30) { p.dead = true; return; }
    const nearby = [...this.enemyGrid.near(p.x, p.y, p.r)].sort((a, b) => a.id - b.id);
    for (const e of nearby) {
      if (!e.alive || p.hit.has(e.id) || !canHitEnemy(e.def, p.hitsAir, p.detection)) continue;
      if (dist2(p.x, p.y, e.x, e.y) > (e.r + p.r) ** 2) continue;
      if (p.splash > 0) { this._explode(p, e.x, e.y); p.dead = true; return; }
      p.hit.add(e.id);
      this.hitEnemy(e, p.damage, p);
      if (--p.pierce <= 0) { p.dead = true; return; }
    }
  }

  _explode(p, x, y) {
    const targets = [...this.enemyGrid.near(x, y, p.splash)].filter((e) =>
      e.alive && canHitEnemy(e.def, p.hitsAir, p.detection) && dist2(x, y, e.x, e.y) <= (p.splash + e.r) ** 2);
    for (const e of targets) { p.hit.add(e.id); this.hitEnemy(e, p.damage, p); }
    this.effects.push({ type: 'ring', x, y, r: p.splash, color: p.kind === 'gelo' ? '#7efcff' : '#ffffff', t: 0, dur: 0.3 });
  }

  _summon(tower) {
    const stats = tower.summon;
    const living = this.allies.filter((ally) => ally.tower === tower && !ally.dead).length;
    const count = Math.max(0, Math.min(stats.summonCount, stats.maxAllies - living));
    if (!count) return;
    tower.cooldown = Math.max(0.2, stats.summonInterval);
    for (let i = 0; i < count; i++) this._spawnAlly(tower, stats, i);
  }

  _spawnAlly(tower, stats, index) {
    const dist = Math.max(0, this.path.length - 28 - index * 16);
    this.allies.push({
      ...this.path.pointAt(dist), dist, tower, stats: { ...stats },
      hp: stats.allyHp, life: stats.allyLifetime, r: 12, contacts: new Map(),
    });
  }

  _updateAlly(ally, dt) {
    ally.life -= dt;
    ally.dist -= ally.stats.allySpeed * dt;
    Object.assign(ally, this.path.pointAt(Math.max(0, ally.dist)));
    if (ally.life <= 0 || ally.dist <= 0) { this._expireAlly(ally); return; }
    for (const [id, time] of ally.contacts) if (time <= this.simTime) ally.contacts.delete(id);
    for (const enemy of this.enemyGrid.near(ally.x, ally.y, ally.r)) {
      if (!enemy.alive || !canHitEnemy(enemy.def, false) || ally.contacts.has(enemy.id) ||
          dist2(ally.x, ally.y, enemy.x, enemy.y) > (ally.r + enemy.r) ** 2) continue;
      ally.contacts.set(enemy.id, this.simTime + 0.25);
      this.hitEnemy(enemy, ally.stats.allyDamage, {
        tower: ally.tower, hitsAir: false, damageType: 'impacto', slowPct: ally.stats.allySlowPct, slowDur: 1,
      });
      if (--ally.hp <= 0) { this._expireAlly(ally); return; }
    }
  }

  _expireAlly(ally) {
    ally.dead = true;
    if (!ally.stats.allyExplode) return;
    this._explode({ tower: ally.tower, splash: ally.stats.allyExplode, hitsAir: false,
      damage: ally.stats.allyDamage, damageType: 'gelo', hit: new Set() }, ally.x, ally.y);
  }

  _updateRaidBoss(enemy, dt) {
    const ability = this.phase.raid.bossAbility;
    enemy.raidBoss.timer -= dt;
    if (enemy.raidBoss.timer > 0) return;
    enemy.raidBoss.timer += ability.interval;
    for (const tower of this.towers) {
      if (dist2(tower.x, tower.y, enemy.x, enemy.y) <= ability.radius ** 2) {
        tower.stunnedUntil = this.simTime + ability.duration;
      }
    }
    this.effects.push({ type: 'ring', x: enemy.x, y: enemy.y, r: ability.radius, color: '#49a9eb', t: 0, dur: 0.7 });
  }

  _triggerRaidStages(enemy) {
    const stages = this.phase.raid.bossPhases;
    while (stages[enemy.raidBoss.stage] && enemy.hp <= enemy.def.hp * stages[enemy.raidBoss.stage].hp) {
      const stage = stages[enemy.raidBoss.stage++];
      enemy.raidBoss.speed *= stage.speedMultiplier;
      const escort = this.enemyDefs.get(stage.escortId);
      if (!escort || escort === enemy.def) continue;
      for (let i = 0; i < stage.escortCount; i++) this.spawnEnemy(escort, Math.max(0, enemy.dist - (i + 1) * 16));
    }
  }

  // ---------- Seleção / input ----------
  select(t) {
    this.selected = t;
    this.cb.onSelect?.(t);
  }

  beginPlacing(id, dragging = false) {
    this.abilityTarget = null;
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
    if (!this.placing && this.abilityTarget === null) { this.ghost = null; return; }
    const w = this.clientToWorld(cx, cy);
    this.ghost = w.inside ? { x: w.x, y: w.y, valid: this.abilityTarget !== null || this.canPlace(w.x, w.y) } : null;
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
    if (this.abilityTarget !== null) {
      if (x >= 0 && x <= WORLD.W && y >= 0 && y <= WORLD.H) this._useAbility(this.abilityTarget, x, y);
      this.abilityTarget = null;
      this.ghost = null;
      return;
    }
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
    const ctxMenu = (e) => { e.preventDefault(); this.abilityTarget = null; this.cancelPlacing(); this.select(null); };
    const outside = (e) => {
      if (this.abilityTarget === null || e.target === this.canvas || e.target.closest?.('.ability-button')) return;
      this.abilityTarget = null;
      this.ghost = null;
    };
    const key = (e) => {
      if (e.key === 'Escape') { this.abilityTarget = null; this.cancelPlacing(); this.select(null); }
      else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); this.startRound(); }
      else if (!e.repeat && ['q', 'e'].includes(e.key.toLowerCase())) this.selectAbility(e.key.toLowerCase() === 'q' ? 0 : 1);
    };
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointerleave', leave);
    c.addEventListener('contextmenu', ctxMenu);
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', outside);
    this._unbind = () => {
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointerleave', leave);
      c.removeEventListener('contextmenu', ctxMenu);
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', outside);
    };
  }

  _emitHud() {
    const boss = this.enemies.find((enemy) => enemy.alive && hasTrait(enemy.def, 'chefe'));
    const s = {
      gold: Math.floor(this.gold), lives: this.lives, round: this.round, totalRounds: this.phase.rounds.length,
      roundActive: this.roundActive, speed: this.speed, autoStart: this.autoStart, over: this.over,
      boss: boss ? { name: boss.def.name, hp: Math.ceil(boss.hp), maxHp: boss.def.hp } : null,
      preparation: this.preparation === null ? null : Math.ceil(this.preparation),
      abilities: this.abilities.map((ability) => ability && Math.ceil(ability.remaining)),
      abilityTarget: this.abilityTarget,
    };
    const key = JSON.stringify(s);
    if (key !== this._hudKey) { this._hudKey = key; this.cb.onHud?.(s); }
  }

  selectAbility(slot) {
    const ability = this.abilities[slot];
    if (!ability || ability.remaining > 0 || this.over) return;
    this.cancelPlacing();
    if (ability.target === 'global') { this.abilityTarget = null; this._useAbility(slot); }
    else {
      this.abilityTarget = this.abilityTarget === slot ? null : slot;
      if (this.abilityTarget !== null) this.cb.onToast?.('Escolha o ponto da habilidade na arena.', 'info');
    }
  }

  _useAbility(slot, x, y) {
    const ability = this.abilities[slot];
    if (!ability || ability.remaining > 0 || this.over) return;
    ability.remaining = ability.cooldown;
    const mark = { type: 'ring', x, y, r: ability.area, color: '#609de7', t: 0, dur: 0.5 };
    switch (ability.type) {
      case 'chuva_flechas':
        for (let index = 0; index < 3; index++) {
          this.abilityBursts.push({ x, y, power: ability.power, area: ability.area,
            when: this.simTime + (index * ability.duration) / 2 });
        }
        break;
      case 'avalanche': {
        const distance = this.path.distanceAlong(x, y);
        for (const enemy of [...this.enemies]) {
          if (enemy.path === this.path && Math.abs(enemy.dist - distance) <= ability.area / 2) {
            this.hitEnemy(enemy, ability.power, { hitsAir: true, detection: true, damageType: 'impacto' });
          }
        }
        this.effects.push(mark);
        break;
      }
      case 'nevasca':
      case 'bloco_gelo':
        for (const enemy of this.enemies) {
          if (!hasTrait(enemy.def, 'imune_gelo') &&
              (ability.target === 'global' || dist2(x, y, enemy.x, enemy.y) <= ability.area ** 2)) {
            const resistance = hasTrait(enemy.def, 'chefe') ? 0.5 : 1;
            const limit = ability.type === 'bloco_gelo' ? 1 : 0.8;
            enemy.slowPct = Math.max(enemy.slowPct, Math.min(limit, ability.power / 100) * resistance);
            enemy.slowTimer = Math.max(enemy.slowTimer, ability.duration);
          }
        }
        if (ability.target === 'area') this.effects.push(mark);
        break;
      case 'chamado_matilha':
        for (let index = 0; index < Math.max(1, Math.round(ability.power)); index++) {
          this._spawnAlly(null, { ...ALLY_DEFAULTS, allyKind: 'lobo', allySpeed: 112, allyLifetime: ability.duration }, index);
        }
        break;
      case 'fogueira':
        this.goldBoost = { until: this.simTime + ability.duration, multiplier: 1 + ability.power / 100 };
        break;
    }
  }

  _updateAbilities(dt) {
    const cooldownPct = this.towers.reduce((max, tower) => Math.max(max, tower.stats.cooldownPct ?? 0), 0) +
      (this.biome?.effect === 'aurora' ? 15 : 0);
    for (const ability of this.abilities) {
      if (ability) ability.remaining = Math.max(0, ability.remaining - dt / Math.max(0.1, 1 - cooldownPct / 100));
    }
    this.abilityBursts = this.abilityBursts.filter((burst) => {
      if (burst.when > this.simTime) return true;
      this._explode({ splash: burst.area, damage: burst.power, hitsAir: true, detection: true,
        damageType: 'perfurante', hit: new Set() }, burst.x, burst.y);
      return false;
    });
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
    const palette = this.biome?.palette;
    grad.addColorStop(0, palette?.ground ?? '#f4fbff');
    grad.addColorStop(1, palette?.path ?? '#d9eefc');
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
      g.fillStyle = palette?.trees ?? '#2e8b57'; g.strokeStyle = '#1b4d33'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const yy = y - k * s * 0.55;
        const w = s * (1 - k * 0.22);
        g.beginPath(); g.moveTo(x, yy - s * 0.9); g.lineTo(x + w * 0.7, yy + s * 0.2); g.lineTo(x - w * 0.7, yy + s * 0.2); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(x, yy - s * 0.9); g.lineTo(x + w * 0.25, yy - s * 0.5); g.lineTo(x - w * 0.25, yy - s * 0.5); g.closePath(); g.fill();
        g.fillStyle = palette?.trees ?? '#2e8b57';
      }
    }

    const pts = this.path.points;
    const stroke = (w, color) => {
      g.lineWidth = w; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
    };
    stroke(PATH_W + 8, palette?.edge ?? '#6fa8d6');
    stroke(PATH_W, palette?.path ?? '#bfe0f7');
    g.setLineDash([10, 14]);
    stroke(4, 'rgba(255,255,255,0.8)');
    g.setLineDash([]);
    for (const [x, y, radius] of this.map.lights ?? []) {
      const glow = g.createRadialGradient(x, y, 3, x, y, radius);
      glow.addColorStop(0, 'rgba(218,250,255,.9)');
      glow.addColorStop(1, 'rgba(198,232,255,0)');
      g.fillStyle = glow; g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (const [x, y, radius] of this.map.obstacles ?? []) {
      g.fillStyle = palette?.trees ?? '#245846'; g.strokeStyle = '#1b463d'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y, radius, radius * 0.7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    return c;
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.px, 0, 0, this.px, 0, 0);

    for (const d of this.drops) this._drawDrop(ctx, d);

    if (this.selected) this._drawRange(ctx, this.selected.x, this.selected.y, this.selected.stats.range, true);
    for (const tower of this.towers) {
      if (!tower.stats.buffs) continue;
      ctx.globalAlpha = 0.32 + Math.sin(this.time * 3) * 0.12;
      this._drawRange(ctx, tower.x, tower.y, tower.stats.range, true, true);
      ctx.globalAlpha = 1;
    }
    const actors = [...this.enemies, ...this.towers, ...this.allies].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.upgrades) this._drawTower(ctx, actor);
      else if (actor.contacts) drawFaceCached(ctx, ALLY_FACES[actor.stats.allyKind] ?? ALLY_FACES.pinguim,
        actor.x, projectY(actor.y, 6), actor.r, this.px);
      else this._drawEnemy(ctx, actor);
    }

    for (const p of this.projectiles) this._drawProjectile(ctx, p);

    for (const fx of this.effects) {
      const k = fx.t / fx.dur;
      if (fx.type === 'text') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = fx.text === 'EFICAZ' ? '#70420b' : '#223654';
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(fx.text, fx.x, projectY(fx.y, 24 + 22 * k));
        ctx.globalAlpha = 1;
        continue;
      }
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
    if (this.abilityTarget !== null && this.ghost) {
      this._drawRange(ctx, this.ghost.x, this.ghost.y, this.abilities[this.abilityTarget].area, true, true);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.snow) { ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.fill(); }
  }

  _drawEnemy(ctx, e) {
      const ground = projectY(e.y);
      const altitude = hasTrait(e.def, 'aereo') ? 60 : 0;
      const x = e.x + (altitude ? Math.sin(this.time * 3 + e.phase) * 4 : 0);
      const y = ground - altitude - e.r * 0.55 + Math.sin(this.time * 8 + e.phase) * 1.5;
      ctx.save();
      if (hasTrait(e.def, 'camuflado')) ctx.globalAlpha = 0.45;
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
      if (e.def.element && e.def.element !== 'neutro') {
        ctx.fillStyle = '#10233a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(ELEMENT_LABELS[e.def.element] ?? '', x, y + e.r + 10);
      }
      if (e.shield > 0) {
        ctx.strokeStyle = '#4d79d5'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, e.r + 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
  }

  _drawTower(ctx, t) {
      const y = projectY(t.y);
      drawEskimo(ctx, t.def, t.x, y, TOWER_R, t.angle, this.px);
      if ((t.stunnedUntil ?? 0) > this.simTime) {
        ctx.fillStyle = 'rgba(102,214,255,0.55)';
        ctx.beginPath(); ctx.roundRect(t.x - TOWER_R, y - TOWER_R * 2, TOWER_R * 2, TOWER_R * 2, 7); ctx.fill();
      }
      if (t.buffed) {
        ctx.fillStyle = '#006c67'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('+', t.x, y - TOWER_R * 2.4);
      }
      const lv = t.upgrades.dmg + t.upgrades.spd + t.upgrades.rng + t.active.size;
      if (lv) {
        ctx.fillStyle = '#ffd32a'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(t.x + TOWER_R * 0.8, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1b1b1b'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(lv), t.x + TOWER_R * 0.8, y + 0.5);
      }
  }

  _drawRange(ctx, x, y, r, ok, aura = false) {
    ctx.fillStyle = aura ? '#72cfc6' : ok ? 'rgba(255,255,255,0.25)' : 'rgba(255,71,87,0.25)';
    ctx.strokeStyle = aura ? '#0b807a' : ok ? 'rgba(30,60,90,0.5)' : 'rgba(255,71,87,0.8)';
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
    if (d.type === 'chest' || d.type === 'practice') drawChest(ctx, d.x, y, 13);
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
