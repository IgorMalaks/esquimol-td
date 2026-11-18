import { randomUUID } from 'node:crypto';
import { byId } from '../js/data/gameData.js';
import { canEquip, ensureProgress, newEskimoProgress, SLOTS } from '../js/core/progression.js';
import { canLearn } from '../js/game/stats.js';
import { httpError } from './http.js';

export function updateProfile(account, data, body) {
  ensureProgress(account, data);
  const { activeAbilities = [], eskimos = {}, tutorialDone, fragmentTargets = {} } = body;
  if (!Array.isArray(activeAbilities) || activeAbilities.length > 2 || !eskimos || typeof eskimos !== 'object') {
    throw httpError(400, 'Configuração de esquadrão inválida.');
  }
  const byUid = new Map(account.progress.inventory.map((instance) => [instance.uid, byId(data.items, instance.itemId)]));
  const equipped = new Set();
  function checked(uid, type, def = null) {
    if (uid == null) return null;
    const item = byUid.get(uid);
    if (!item || item.type !== type || equipped.has(uid) || (def && !canEquip(item, def))) {
      throw httpError(400, 'Um item equipado é inválido.');
    }
    equipped.add(uid);
    return uid;
  }
  for (const id of account.progress.unlocked) {
    const entry = eskimos[id];
    if (!entry) continue;
    if (!Array.isArray(entry.skills) || entry.skills.length > 9 || !entry.equip || typeof entry.equip !== 'object') {
      throw httpError(400, 'Configuração de esquimó inválida.');
    }
    const def = byId(data.eskimos, id);
    const progress = { ...newEskimoProgress(), xp: account.progress.eskimos[id].xp };
    const skills = entry.skills.map((id) => byId(def.tree, id)).sort((a, b) => (a?.tier ?? 0) - (b?.tier ?? 0));
    for (const node of skills) {
      if (!node || !canLearn(def, progress, node).ok) throw httpError(400, 'Árvore de habilidades inválida.');
      progress.skills.push(node.id);
    }
    for (const slot of SLOTS) progress.equip[slot] = checked(entry.equip[slot], slot, def);
    account.progress.eskimos[id] = progress;
  }
  account.progress.activeAbilities = [0, 1].map((slot) => checked(activeAbilities[slot], 'habilidade'));
  if (tutorialDone === true) account.progress.tutorialDone = true;
  for (const id of account.progress.unlocked) {
    const unlock = byId(data.eskimos, id)?.unlock;
    if (unlock?.type === 'fragments' && fragmentTargets[unlock.biome] === id) {
      account.progress.fragmentTargets[unlock.biome] = id;
    }
  }
}

const bounded = (value, maximum) => Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : 0;

export function importLocal(account, data, progress) {
  if (account.localImported) throw httpError(409, 'Esta conta já importou progresso local.');
  if (!progress || !Array.isArray(progress.inventory) || progress.inventory.length > 5000) {
    throw httpError(400, 'Progresso local inválido.');
  }
  ensureProgress(account, data);
  for (const [field, max] of [['wins', 100_000], ['losses', 100_000], ['roundsTotal', 1_000_000]]) {
    account.progress.stats[field] = Math.max(account.progress.stats[field], bounded(progress.stats?.[field], max));
  }
  for (const phase of data.phases) {
    const value = progress.phases?.[phase.id];
    if (!value) continue;
    const current = account.progress.phases[phase.id] ?? { completed: false, bestRound: 0 };
    current.completed ||= value.completed === true;
    current.bestRound = Math.max(current.bestRound, bounded(value.bestRound, phase.rounds.length));
    account.progress.phases[phase.id] = current;
  }
  ensureProgress(account, data);
  for (const id of account.progress.unlocked) {
    const current = account.progress.eskimos[id];
    current.xp = Math.max(current.xp, bounded(progress.eskimos?.[id]?.xp, 10_000_000));
  }
  for (const instance of progress.inventory) {
    if (!byId(data.items, instance?.itemId)) continue;
    account.progress.inventory.push({ uid: randomUUID(), itemId: instance.itemId, origin: 'local', foundAt: new Date().toISOString() });
  }
  account.localImported = true;
}
