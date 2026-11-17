// Progressão do jogador: desbloqueios, inventário, equipamentos, XP e resultado de partida.
import { getData, byId } from '../data/gameData.js';
import { saveAccount } from './auth.js';
import { skillPoints, pointsSpent } from '../game/stats.js';
import { uid } from './utils.js';

export const SLOTS = ['arma', 'armadura', 'amuleto'];
export const newEskimoProgress = () => ({ xp: 0, skills: [], equip: { arma: null, armadura: null, amuleto: null } });

// Normaliza o progresso e remove referências a conteúdo apagado pelo admin.
export function ensureProgress(acc) {
  const data = getData();
  acc.progress ??= {};
  const p = acc.progress;
  p.unlocked ??= [];
  p.eskimos ??= {};
  p.inventory ??= [];
  p.phases ??= {};
  p.stats ??= { wins: 0, losses: 0, roundsTotal: 0 };

  p.unlocked = p.unlocked.filter((id) => byId(data.eskimos, id));
  p.inventory = p.inventory.filter((inst) => byId(data.items, inst.itemId));
  checkUnlocks(acc);

  for (const id of p.unlocked) {
    const def = byId(data.eskimos, id);
    const ep = (p.eskimos[id] ??= newEskimoProgress());
    ep.equip = { arma: null, armadura: null, amuleto: null, ...ep.equip };
    const nodeIds = new Set(def.tree.map((n) => n.id));
    ep.skills = (ep.skills || []).filter((s) => nodeIds.has(s));
    if (pointsSpent(def, ep) > skillPoints(ep)) ep.skills = [];
    for (const slot of SLOTS) {
      const item = ep.equip[slot] && instanceItem(acc, ep.equip[slot]);
      if (ep.equip[slot] && (!item || item.type !== slot || !canEquip(item, def))) ep.equip[slot] = null;
    }
  }
  return acc;
}

export function unlockMet(def, acc) {
  const u = def.unlock || { type: 'default' };
  const p = acc.progress;
  switch (u.type) {
    case 'wins': return p.stats.wins >= Number(u.value);
    case 'rounds': return p.stats.roundsTotal >= Number(u.value);
    case 'phase': return !!p.phases[u.value]?.completed;
    default: return true;
  }
}

export function unlockText(def) {
  const u = def.unlock || {};
  switch (u.type) {
    case 'wins': return `Vença ${u.value} fase(s)`;
    case 'rounds': return `Complete ${u.value} rodadas no total`;
    case 'phase': return `Complete a fase "${byId(getData().phases, u.value)?.name ?? u.value}"`;
    default: return 'Disponível desde o início';
  }
}

export function checkUnlocks(acc) {
  const fresh = [];
  for (const def of getData().eskimos) {
    if (!acc.progress.unlocked.includes(def.id) && unlockMet(def, acc)) {
      acc.progress.unlocked.push(def.id);
      acc.progress.eskimos[def.id] ??= newEskimoProgress();
      fresh.push(def);
    }
  }
  return fresh;
}

export function phaseUnlocked(acc, index) {
  if (index === 0) return true;
  const prev = getData().phases[index - 1];
  return !!acc.progress.phases[prev.id]?.completed;
}

// ---------- Itens ----------
export function instanceItem(acc, instUid) {
  const inst = acc.progress.inventory.find((i) => i.uid === instUid);
  return inst ? byId(getData().items, inst.itemId) : null;
}

export const canEquip = (item, def) => !item.classRestriction || item.classRestriction === def.classId;

export function equippedItems(acc, eskimoId) {
  const ep = acc.progress.eskimos[eskimoId];
  if (!ep) return [];
  return SLOTS.map((s) => ep.equip[s] && instanceItem(acc, ep.equip[s])).filter(Boolean);
}

export function whoEquips(acc, instUid) {
  for (const [id, ep] of Object.entries(acc.progress.eskimos)) {
    if (Object.values(ep.equip || {}).includes(instUid)) return id;
  }
  return null;
}

export function equip(acc, eskimoId, instUid) {
  const item = instanceItem(acc, instUid);
  const def = byId(getData().eskimos, eskimoId);
  if (!item || !def) throw new Error('Item ou esquimó inválido.');
  if (!canEquip(item, def)) throw new Error('Esse item não serve para essa classe.');
  const owner = whoEquips(acc, instUid);
  if (owner) acc.progress.eskimos[owner].equip[item.type] = null;
  acc.progress.eskimos[eskimoId].equip[item.type] = instUid;
  saveAccount(acc);
}

export function unequip(acc, eskimoId, slot) {
  acc.progress.eskimos[eskimoId].equip[slot] = null;
  saveAccount(acc);
}

export function rollItem(data, rng = Math.random) {
  const pool = data.items.filter((i) => Number(i.dropWeight) > 0);
  const total = pool.reduce((a, i) => a + Number(i.dropWeight), 0);
  if (!total) return null;
  let r = rng() * total;
  for (const i of pool) { r -= Number(i.dropWeight); if (r <= 0) return i; }
  return pool.at(-1);
}

// RBE (Red Bloon Equivalent): quantas "vidas" um inimigo e todas as suas camadas valem.
export function rbe(enemyId, data, memo = {}) {
  if (memo[enemyId] != null) return memo[enemyId];
  const e = byId(data.enemies, enemyId);
  if (!e) return 0;
  memo[enemyId] = 0;
  const v = Math.max(1, Number(e.hp) || 1) + (e.childId ? (Number(e.childCount) || 1) * rbe(e.childId, data, memo) : 0);
  memo[enemyId] = v;
  return v;
}

export function layerChain(enemyId, data) {
  const out = [];
  let cur = byId(data.enemies, enemyId);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.childId ? byId(data.enemies, cur.childId) : null;
  }
  return out;
}

// ---------- Fim de partida ----------
export function applyMatchResult(acc, r) {
  const p = acc.progress;
  const now = new Date().toISOString();
  const gained = r.items.map((itemId) => {
    const inst = { uid: uid('it'), itemId, foundAt: now };
    p.inventory.push(inst);
    return inst;
  });
  p.stats.roundsTotal += r.roundsCompleted;
  if (r.victory) p.stats.wins++; else p.stats.losses++;
  const ph = (p.phases[r.phaseId] ??= { completed: false, bestRound: 0 });
  ph.bestRound = Math.max(ph.bestRound, r.roundsCompleted);
  if (r.victory) ph.completed = true;

  const xp = r.roundsCompleted * 10 + (r.victory ? 50 : 0);
  const levelUps = [];
  for (const id of r.usedEskimos) {
    const ep = p.eskimos[id];
    if (!ep) continue;
    const before = skillPoints(ep);
    ep.xp += xp;
    if (skillPoints(ep) > before) levelUps.push(id);
  }
  const newUnlocks = checkUnlocks(acc);
  saveAccount(acc);
  return { gained, xp, levelUps, newUnlocks };
}
