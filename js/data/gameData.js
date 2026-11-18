// Repositório do conteúdo editável pelo admin (esquimós, inimigos, itens, fases, mapas).
import { storage } from '../core/storage.js';
import { createDefaultData } from './defaults.js';
import { migrateData } from './migrations.js';
import { hasTrait } from '../game/enemies.js';
import { ABILITY_SCALES, ABILITY_TYPES } from '../game/abilities.js';
import { DEFAULT_ECONOMY, economy } from '../game/economy.js';

let cache = null;

export function getData() {
  if (!cache) {
    const saved = storage.get('gamedata');
    if (saved === null) {
      cache = createDefaultData();
      return cache;
    }
    try {
      const next = prepareData(saved);
      if (next !== saved) storage.set('gamedata', next);
      cache = next;
    } catch (error) {
      console.warn('Não foi possível carregar o conteúdo salvo. O original foi preservado.', error);
      cache = createDefaultData();
    }
  }
  return cache;
}

export function prepareData(data) {
  validateData(data);
  const next = migrateData(data);
  for (const key of ['abilities', 'raids', 'biomes']) {
    if (!Array.isArray(next[key])) throw new Error(`Dados inválidos: "${key}" ausente.`);
  }
  for (const ability of next.abilities) {
    if (!Object.hasOwn(ABILITY_TYPES, ability.type) || ['power', 'area', 'duration'].some((key) =>
      ability[key] !== undefined && (!Number.isFinite(ability[key]) || ability[key] < 0))) {
      throw new Error(`Habilidade inválida: "${ability.name}".`);
    }
  }
  for (const item of next.items) {
    if (item.type === 'habilidade' && !byId(next.abilities, item.abilityId)) {
      throw new Error(`O item "${item.name}" precisa de uma habilidade válida.`);
    }
  }
  const settings = economy(next);
  const probability = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
  if (!probability(settings.dropRateMultiplier) || !probability(settings.chestChance) || !probability(settings.fusionChance) ||
      !Number.isInteger(settings.legendaryThreshold) || settings.legendaryThreshold < 1 ||
      !Number.isInteger(settings.raidKeyCap) || settings.raidKeyCap < 1 || settings.raidKeyCap > 100 ||
      [1, 2, 3].some((tier) => !Number.isFinite(settings.legendaryFactors?.[tier]) || settings.legendaryFactors[tier] <= 0) ||
      Object.keys(DEFAULT_ECONOMY.weights).some((source) => {
        const values = Object.values(settings.weights?.[source] ?? {});
        return values.some((weight) => !Number.isFinite(weight) || weight < 0) || !values.some((weight) => weight > 0);
      }) || Object.keys(ABILITY_SCALES).some((rarity) => Object.keys(ABILITY_SCALES[rarity]).some((key) => {
        const value = (settings.abilityScales ?? ABILITY_SCALES)[rarity]?.[key];
        return !Number.isFinite(value) || value <= 0;
      }))) {
    throw new Error('Configuração de economia inválida.');
  }
  for (const raid of next.raids) {
    if (!byId(next.maps, raid.mapId) || !hasTrait(byId(next.enemies, raid.bossId) ?? {}, 'chefe')) {
      throw new Error(`A raide "${raid.name}" precisa de um mapa e de um inimigo com traço Chefe.`);
    }
    if (!Array.isArray(raid.farmRounds) || !raid.farmRounds.length ||
        raid.farmRounds.some((round) => !round.groups?.length || round.groups.some((group) => !byId(next.enemies, group.enemyId)))) {
      throw new Error(`Rodadas de farm inválidas na raide "${raid.name}".`);
    }
    const { bossAbility, bossLoot, bossPhases } = raid;
    if (!Number.isInteger(raid.keyCost) || raid.keyCost < 1 || raid.keyCost > settings.raidKeyCap ||
        !Number.isFinite(raid.prepTime) || raid.prepTime < 0 || !(raid.farmGoldMultiplier > 0) ||
        bossAbility?.type !== 'atordoar' || !(bossAbility.interval > 0) || !(bossAbility.radius > 0) || !(bossAbility.duration > 0) ||
        !Array.isArray(bossPhases) || bossPhases.some((stage, index) =>
          !(stage.hp > 0 && stage.hp < (bossPhases[index - 1]?.hp ?? 1)) ||
          !(stage.speedMultiplier > 0) || !byId(next.enemies, stage.escortId) ||
          !Number.isInteger(stage.escortCount) || stage.escortCount < 0 || stage.escortCount > 40) ||
        bossLoot?.source !== 'raidBoss' || !Number.isInteger(bossLoot.rolls) || bossLoot.rolls < 1 || bossLoot.rolls > 10) {
      throw new Error(`Configuração inválida na raide "${raid.name}".`);
    }
  }
  return next;
}

export function saveData(data, { replace = false } = {}) {
  const saved = storage.get('gamedata');
  if (!replace && saved !== null) prepareData(saved);
  const next = prepareData(data);
  storage.set('gamedata', next);
  cache = next;
}

export function resetData() {
  saveData(createDefaultData(), { replace: true });
  return cache;
}

export const byId = (list, id) => list.find((x) => x.id === id) || null;

export function validateData(d) {
  for (const k of ['eskimos', 'enemies', 'items', 'phases', 'maps']) {
    if (!Array.isArray(d?.[k])) throw new Error(`Dados inválidos: "${k}" ausente.`);
  }
  if (!d.eskimos.some((e) => (e.unlock?.type || 'default') === 'default')) {
    throw new Error('Pelo menos um esquimó precisa estar disponível desde o início.');
  }
  const enemyIds = new Set(d.enemies.map((e) => e.id));
  for (const e of d.enemies) {
    if (e.childId && !enemyIds.has(e.childId)) throw new Error(`"${e.name}" aponta para camada inexistente.`);
    const seen = new Set([e.id]);
    let cur = e;
    while (cur?.childId) {
      if (seen.has(cur.childId)) throw new Error(`Ciclo de camadas detectado em "${e.name}".`);
      seen.add(cur.childId);
      cur = byId(d.enemies, cur.childId);
    }
  }
  const mapIds = new Set(d.maps.map((m) => m.id));
  for (const p of d.phases) {
    if (!mapIds.has(p.mapId)) throw new Error(`Fase "${p.name}" usa mapa inexistente.`);
    if (!p.rounds?.length) throw new Error(`Fase "${p.name}" não tem rodadas.`);
    for (const r of p.rounds) {
      if (!r.groups?.length) throw new Error(`Fase "${p.name}" tem rodada vazia.`);
      for (const grp of r.groups) {
        if (!enemyIds.has(grp.enemyId)) throw new Error(`Fase "${p.name}" usa inimigo inexistente.`);
      }
    }
  }
  return true;
}
