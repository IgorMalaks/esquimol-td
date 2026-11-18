import { applyEffect } from './stats.js';

export const ALLY_DEFAULTS = {
  summonInterval: 4, summonCount: 1, maxAllies: 4, allyHp: 3, allyDamage: 1,
  allySpeed: 70, allyLifetime: 12, allySlowPct: 0, allyExplode: 0, allyKind: 'pinguim',
};
export const ALLY_OPTIONS = ['pinguim', 'foca', 'urso', 'lobo'];
export const BUFF_KEYS = ['damage', 'speedPct', 'rangePct', 'pierce', 'antiAereo'];

export function summonerStats(def, nodes, upgrades) {
  const stats = { ...ALLY_DEFAULTS, ...def.summon };
  stats.allyDamage += upgrades.dmg;
  stats.summonInterval *= 0.85 ** upgrades.spd;
  stats.allyHp += upgrades.rng;
  for (const { effect } of nodes) {
    const { key, value } = effect;
    if (key === 'allyKind') stats.allyKind = ALLY_OPTIONS[value] ?? stats.allyKind;
    else if (key === 'allySpeedPct') stats.allySpeed *= 1 + value / 100;
    else if (typeof stats[key] === 'number') stats[key] += Number(value) || 0;
  }
  if (stats.allyKind === 'lobo') stats.allySpeed *= 1.6;
  if (stats.allyKind === 'urso') {
    stats.allyHp *= 3;
    stats.allySpeed *= 0.75;
  }
  return stats;
}

export function supportStats(def, nodes, upgrades) {
  const buffs = Object.fromEntries((def.buffs ?? [{ key: 'damage', value: 1 }]).map(({ key, value }) => [key, value]));
  buffs.damage = (buffs.damage ?? 0) + upgrades.dmg;
  buffs.speedPct = (buffs.speedPct ?? 0) + upgrades.spd * 10;
  let range = (def.stats.range ?? 120) * 1.15 ** upgrades.rng;
  let roundGold = 0;
  let cooldownPct = 0;
  for (const { effect: { key, value } } of nodes) {
    if (key === 'auraRangePct') range *= 1 + value / 100;
    else if (key === 'auraGold') roundGold += value;
    else if (key === 'auraCooldown') cooldownPct += value;
    else if (key.startsWith('buff')) {
      const stat = key[4].toLowerCase() + key.slice(5);
      if (BUFF_KEYS.includes(stat)) buffs[stat] = (buffs[stat] ?? 0) + value;
    }
  }
  return { buffs, range, roundGold, cooldownPct };
}

export function applyAuras(tower, supports) {
  const strongest = {};
  for (const support of supports) {
    if ((tower.x - support.x) ** 2 + (tower.y - support.y) ** 2 > support.stats.range ** 2) continue;
    for (const [key, value] of Object.entries(support.stats.buffs)) {
      strongest[key] = Math.max(strongest[key] ?? 0, value);
    }
  }
  for (const [key, value] of Object.entries(strongest)) {
    if (key === 'antiAereo') {
      if (!tower.summon && value) tower.stats.hitsAir = 1;
    } else applyEffect(tower.stats, key, value);
    if (tower.summon && key === 'damage') tower.summon.allyDamage += value;
    if (tower.summon && key === 'speedPct') tower.summon.summonInterval /= 1 + value / 100;
  }
  tower.buffed = Object.values(strongest).some((value) => value > 0);
}
