import { seededRandom } from '../core/utils.js';
import { rbe } from '../core/progression.js';
import { endlessBudget, endlessHp } from './economy.js';
import { hasTrait } from './enemies.js';

export function endlessEnemies(data, wave) {
  const hp = endlessHp(wave);
  const speed = Math.min(1.6, 1 + 0.01 * wave);
  return data.enemies.map((def) => ({ ...def, hp: Math.ceil(def.hp * hp), speed: def.speed * speed }));
}

export function endlessRound(data, wave, seed, canFly = true) {
  const rng = seededRandom(`${seed}:${wave}`);
  const ranked = [...data.enemies].sort((a, b) => rbe(a.id, data) - rbe(b.id, data));
  const ground = ranked.filter((def) => !hasTrait(def, 'aereo') && !hasTrait(def, 'chefe'));
  const boss = wave % 25 === 0 && ranked.find((def) => hasTrait(def, 'chefe') && (canFly || !hasTrait(def, 'aereo')));
  const flying = wave >= 12 && canFly ? ranked.filter((def) => hasTrait(def, 'aereo') && !hasTrait(def, 'chefe')) : [];
  const pool = [...(ground.length ? ground : ranked.filter((def) => canFly || !hasTrait(def, 'aereo'))).slice(0, 3 + Math.floor(wave / 10)), ...flying];
  const memo = Object.create(null);
  let budget = Math.max(0, endlessBudget(wave) - (boss ? rbe(boss.id, data, memo) : 0));
  let airBudget = endlessBudget(wave) * 0.25;
  let delay = 0;
  const groups = [];
  while (budget > 0 && groups.length < 80) {
    const candidates = pool.filter((def) => {
      const cost = rbe(def.id, data, memo);
      return cost <= budget && (!hasTrait(def, 'aereo') || cost <= airBudget);
    });
    if (!candidates.length) break;
    const def = candidates[Math.floor(rng() * candidates.length)];
    const cost = rbe(def.id, data, memo);
    const count = Math.min(4 + Math.floor(rng() * 8), Math.floor(budget / cost),
      hasTrait(def, 'aereo') ? Math.floor(airBudget / cost) : Infinity);
    groups.push({ enemyId: def.id, count, interval: 0.24, delay });
    if (hasTrait(def, 'aereo')) airBudget -= cost * count;
    budget -= cost * count;
    delay += count * 0.24 + 0.3;
  }
  if (boss) groups.push({ enemyId: boss.id, count: 1, interval: 1, delay });
  if (!groups.length && pool.length) groups.push({ enemyId: pool[0].id, count: 1, interval: 1, delay: 0 });
  return { groups };
}

export const endlessGold = (wave) => wave <= 40 ? 100 + wave : Math.max(50, Math.round(140 * 0.98 ** (wave - 40)));
