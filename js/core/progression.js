// Progressão do jogador: desbloqueios, inventário, equipamentos, XP e resultado de partida.
import { getData, byId } from '../data/gameData.js';
import { saveAccount } from './auth.js';
import { skillPoints, pointsSpent } from '../game/stats.js';
import { uid } from './utils.js';
import { economy, fusionPool, resolveBossLoot, weightedPick } from '../game/economy.js';
import { raidAvailable } from '../game/raids.js';
export { rollItem } from '../game/economy.js';

export const SLOTS = ['arma', 'armadura', 'amuleto'];
export const newEskimoProgress = () => ({ xp: 0, skills: [], equip: { arma: null, armadura: null, amuleto: null } });

export const PROGRESS_VERSION = 2;
const migrations = {
  1: (progress) => ({
    fragments: {}, raidKeys: 0, legendaryPity: 0, ...progress,
    version: 2,
    inventory: (progress.inventory ?? []).map((item) => ({ origin: 'local', ...item })),
  }),
};

export function migrateProgress(progress) {
  const version = progress?.version === undefined ? 1 : progress.version;
  if (!Number.isInteger(version) || version < 1 || version > PROGRESS_VERSION) {
    throw new Error('Versão de progresso incompatível com este jogo.');
  }
  let next = progress ?? {};
  for (let current = version; current < PROGRESS_VERSION; current++) {
    next = migrations[current](next);
  }
  return next;
}

// Normaliza o progresso e remove referências a conteúdo apagado pelo admin.
export function ensureProgress(acc) {
  const data = getData();
  acc.progress = migrateProgress(acc.progress);
  const p = acc.progress;
  p.unlocked ??= [];
  p.eskimos ??= {};
  p.inventory ??= [];
  p.phases ??= {};
  p.activeAbilities = [0, 1].map((slot) => {
    const uid = p.activeAbilities?.[slot];
    return uid && instanceItem(acc, uid)?.type === 'habilidade' ? uid : null;
  });
  p.stats = { wins: 0, losses: 0, roundsTotal: 0, ...p.stats };

  p.unlocked = p.unlocked.filter((id) => byId(data.eskimos, id));
  p.inventory = p.inventory.filter((inst) => byId(data.items, inst.itemId));
  checkUnlocks(acc);

  for (const id of p.unlocked) {
    const def = byId(data.eskimos, id);
    const ep = (p.eskimos[id] ??= newEskimoProgress());
    ep.xp ??= 0;
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
  if (acc.progress.activeAbilities?.includes(instUid)) return 'perfil';
  for (const [id, ep] of Object.entries(acc.progress.eskimos)) {
    if (Object.values(ep.equip || {}).includes(instUid)) return id;
  }
  return null;
}

export function equip(acc, eskimoId, instUid) {
  const item = instanceItem(acc, instUid);
  const def = byId(getData().eskimos, eskimoId);
  if (!item || !def || !SLOTS.includes(item.type)) throw new Error('Item ou esquimó inválido.');
  if (!canEquip(item, def)) throw new Error('Esse item não serve para essa classe.');
  const owner = whoEquips(acc, instUid);
  if (owner) acc.progress.eskimos[owner].equip[item.type] = null;
  acc.progress.eskimos[eskimoId].equip[item.type] = instUid;
  saveAccount(acc);
}

export function setAbilitySlot(account, slot, instUid) {
  if ((slot !== 0 && slot !== 1) || (instUid && instanceItem(account, instUid)?.type !== 'habilidade')) {
    throw new Error('Habilidade inválida.');
  }
  const slots = account.progress.activeAbilities.map((uid) => uid === instUid ? null : uid);
  slots[slot] = instUid;
  const progress = { ...account.progress, activeAbilities: slots };
  saveAccount({ ...account, progress });
  account.progress = progress;
}

export function unequip(acc, eskimoId, slot) {
  acc.progress.eskimos[eskimoId].equip[slot] = null;
  saveAccount(acc);
}

export function spendRaidKeys(account, raid) {
  if (!raidAvailable(account, raid)) throw new Error('Chaves de raide insuficientes.');
  const progress = { ...account.progress, raidKeys: account.progress.raidKeys - raid.keyCost };
  saveAccount({ ...account, progress });
  account.progress = progress;
}

export function fuseItems(acc, uids, rng = Math.random) {
  const data = getData();
  const progress = acc.progress;
  const inventory = progress.inventory;
  const selected = new Set(uids);
  const ingredients = inventory.filter((item) => selected.has(item.uid));
  if (uids.length !== 3 || selected.size !== 3 || ingredients.length !== 3 ||
      ingredients.some((item) => item.itemId !== ingredients[0].itemId || whoEquips(acc, item.uid))) {
    throw new Error('Escolha três cópias do mesmo item, todas desequipadas.');
  }
  const item = byId(data.items, ingredients[0].itemId);
  const pool = item ? fusionPool(data, item) : [];
  if (!pool.length) throw new Error('Este item não pode ser fundido.');
  const result = rng() < economy(data).fusionChance ? weightedPick(pool, (entry) => entry.dropWeight, rng) : null;
  if (!result) selected.delete(ingredients[0].uid);
  const next = {
    ...progress,
    inventory: inventory.filter((entry) => !selected.has(entry.uid)),
    fusionStats: {
      attempts: (progress.fusionStats?.attempts ?? 0) + 1,
      successes: (progress.fusionStats?.successes ?? 0) + Number(Boolean(result)),
    },
  };
  if (result) {
    next.inventory.push({ uid: uid('it'), itemId: result.id, foundAt: new Date().toISOString(), origin: 'local' });
  }
  saveAccount({ ...acc, progress: next });
  acc.progress = next;
  return result;
}

// RBE (Red Bloon Equivalent): quantas "vidas" um inimigo e todas as suas camadas valem.
export function rbe(enemyId, data, memo = Object.create(null)) {
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
  const data = getData();
  const items = [...r.items];
  for (const drops of r.bossDrops ?? []) {
    const bossLoot = resolveBossLoot(data, p.legendaryPity ?? 0, drops.map((id) => byId(data.items, id)).filter(Boolean));
    p.legendaryPity = bossLoot.pity;
    if (bossLoot.bonus) items.push(bossLoot.bonus.id);
  }
  const now = new Date().toISOString();
  const gained = items.map((itemId) => {
    const inst = { uid: uid('it'), itemId, foundAt: now, origin: 'local' };
    p.inventory.push(inst);
    return inst;
  });
  p.stats.roundsTotal += r.roundsCompleted;
  if (r.endless) {
    p.raidKeys = Math.min(economy(data).raidKeyCap, (p.raidKeys ?? 0) + Math.floor(r.roundsCompleted / 15));
    if (r.roundsCompleted > (p.endlessBest?.melhorWave ?? 0)) {
      p.endlessBest = { melhorWave: r.roundsCompleted, data: now, duracaoSeg: r.duration,
        esquadrao: [...r.usedEskimos], seed: r.endless, modo: 'solo' };
    }
  } else if (r.raid) {
    p.raids ??= {};
    const raid = (p.raids[r.raid] ??= { wins: 0, losses: 0 });
    raid[r.victory ? 'wins' : 'losses']++;
  } else {
    if (r.victory) p.stats.wins++; else p.stats.losses++;
    const ph = (p.phases[r.phaseId] ??= { completed: false, bestRound: 0 });
    ph.bestRound = Math.max(ph.bestRound, r.roundsCompleted);
    if (r.victory) ph.completed = true;
  }
  p.lastMatchDrops = {};
  for (const itemId of items) {
    const rarity = byId(data.items, itemId)?.rarity;
    if (rarity) p.lastMatchDrops[rarity] = (p.lastMatchDrops[rarity] ?? 0) + 1;
  }

  const xp = r.roundsCompleted * 10 + (r.victory ? 50 : 0);
  const levelUps = [];
  for (const id of new Set(r.usedEskimos)) {
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
