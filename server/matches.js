import { randomInt, randomUUID } from 'node:crypto';
import { byId } from '../js/data/gameData.js';
import { applyMatchResult, ensureProgress } from '../js/core/progression.js';
import { rollItem } from '../js/game/economy.js';
import { endlessRound } from '../js/game/endless.js';
import { hasTrait } from '../js/game/enemies.js';
import { raidPhase } from '../js/game/raids.js';
import { httpError } from './http.js';

const HALF_HOUR = 30 * 60 * 1000;
export const secureRandom = () => randomInt(0x100000000) / 0x100000000;

function selectedMode(data, { mode, id }) {
  if (mode === 'raid') {
    const raid = byId(data.raids, id);
    return raid ? raidPhase(raid) : null;
  }
  if (mode === 'phase') return byId(data.phases, id);
  if (mode === 'endless') {
    const map = data.maps.find((entry) => entry.biome === id);
    return map ? { id: 'infinito', mapId: map.id } : null;
  }
  return null;
}

function serverBiomeUnlocked(account, data, biome) {
  if (!biome || biome === 'tundra') return true;
  const index = data.phases.findIndex((phase) => byId(data.maps, phase.mapId)?.biome === biome);
  return index === 0 || (index > 0 && Boolean(account.progress.phases[data.phases[index - 1].id]?.completed));
}

export function beginMatch(account, snapshot, body, now = Date.now(), deferred = false) {
  const data = snapshot.content;
  const phase = selectedMode(data, body);
  if (!phase) throw httpError(404, 'Modo ou fase inválida.');
  ensureProgress(account, data);
  const previous = data.phases[data.phases.findIndex((ph) => ph.id === phase.id) - 1];
  if (body.mode === 'phase' && previous && !account.progress.phases[previous.id]?.completed) {
    throw httpError(403, 'Conclua a fase anterior primeiro.');
  }
  const biome = byId(data.maps, phase.mapId)?.biome;
  if (body.mode !== 'phase' && !serverBiomeUnlocked(account, data, biome)) throw httpError(403, 'Bioma bloqueado.');
  if (account.match?.startedAt > now - HALF_HOUR) {
    if (account.match.mode !== body.mode || account.match.id !== body.id) throw httpError(409, 'Já existe uma partida em andamento.');
    return account.match;
  }
  if (phase.raid) {
    if (account.progress.raidKeys < phase.raid.keyCost) throw httpError(403, 'Chaves de raide insuficientes.');
    if (!deferred) account.progress.raidKeys -= phase.raid.keyCost;
  }
  account.match = { matchId: randomUUID(), seed: randomUUID(), contentHash: snapshot.hash,
    mode: body.mode, id: body.id, biome, startedAt: now };
  return account.match;
}

function countLayers(data, enemyId) {
  const enemy = byId(data.enemies, enemyId);
  if (!enemy?.childId) return 1;
  const childCount = (Number(enemy.childCount) || 1) * (hasTrait(enemy, 'divisor') ? 2 : 1);
  return 1 + childCount * countLayers(data, enemy.childId);
}

function roundLimits(data, rounds) {
  let layers = 0;
  let seconds = 0;
  const discovered = new Set();
  for (const round of rounds) {
    let duration = 1;
    for (const group of round.groups) {
      discovered.add(group.enemyId);
      layers += group.count * countLayers(data, group.enemyId);
      duration = Math.max(duration, (group.delay ?? 0) + Math.max(0, group.count - 1) * group.interval);
    }
    seconds += duration;
  }
  return { layers, seconds, discovered: [...discovered] };
}

export function finishMatch(account, snapshot, body, now = Date.now(), rng = secureRandom) {
  if (account.lastMatch?.matchId === body.matchId) return account.lastMatch.result;
  const match = account.match;
  if (!match || match.matchId !== body.matchId) throw httpError(404, 'Partida inválida.');
  if (match.contentHash !== snapshot.hash) throw httpError(409, 'O conteúdo mudou desde o início da partida.');
  const data = snapshot.content;
  const phase = selectedMode(data, match);
  const endless = match.mode === 'endless';
  const { roundsCompleted, victory, collected = 0, usedEskimos = [] } = body;
  const interrupted = body.interrupted === true;
  const limit = endless ? 150 : phase.rounds.length;
  if (!Number.isInteger(roundsCompleted) || roundsCompleted < 0 || roundsCompleted > limit ||
      typeof victory !== 'boolean' || (victory && (endless || roundsCompleted !== limit)) ||
      !Number.isInteger(collected) || collected < 0 || collected > 200 || !Array.isArray(usedEskimos) ||
      usedEskimos.length > data.eskimos.length || usedEskimos.some((id) => !account.progress.unlocked.includes(id))) {
    throw httpError(400, 'Resultado da partida inválido.');
  }
  const biome = byId(data.biomes, match.biome);
  const round = (index) => endless ? endlessRound(data, index + 1, match.seed, true, biome?.weights) : phase.rounds[index];
  const rounds = Array.from({ length: roundsCompleted }, (_, index) => round(index));
  const duration = (now - match.startedAt) / 1000;
  const completed = roundLimits(data, rounds);
  const current = !victory && round(roundsCompleted);
  const max = current ? roundLimits(data, [...rounds, current]) : completed;
  const prepTime = phase.raid && victory ? phase.raid.prepTime : 0;
  if (!interrupted && duration + 2 < (completed.seconds + prepTime) / 2) {
    throw httpError(400, 'Resultado incompatível com a duração e as rodadas da partida.');
  }
  const items = [];
  const bossDrops = [];
  const lootSource = phase.raid ? 'raidFarm' : 'normal';
  const boundedDrops = Math.min(collected, max.layers, Math.ceil(max.layers * 0.12), Math.ceil(duration / 2) + 1);
  for (let slot = 0; slot < boundedDrops; slot++) {
    const item = rollItem(data, rng, lootSource);
    if (item) items.push(item.id);
  }
  const bossCount = interrupted ? 0 : endless ? Math.floor(roundsCompleted / 25) : Number(Boolean(phase.raid && victory));
  const rolls = phase.raid?.bossLoot.rolls ?? 1;
  for (let index = 0; index < bossCount; index++) {
    const drops = [];
    for (let slot = 0; slot < rolls; slot++) {
      const item = rollItem(data, rng, phase.raid ? 'raidBoss' : 'normal');
      if (item) drops.push(item.id);
    }
    bossDrops.push(drops);
    items.push(...drops);
  }
  const result = applyMatchResult(account, {
    roundsCompleted, victory, usedEskimos, items, bossDrops, duration: Math.floor(duration),
    phaseId: phase.id, raid: phase.raid?.id, endless: endless ? match.seed : null,
    coop: match.coop, interrupted,
    biome: match.biome, layersPopped: completed.layers, seenEnemies: max.discovered,
  }, { data, persist: () => {}, rng, origin: 'server' });
  account.match = null;
  account.lastMatch = { matchId: match.matchId, result };
  return result;
}
