export const RARITY_ORDER = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico'];
export const DEFAULT_ECONOMY = {
  dropRateMultiplier: 0.6,
  chestChance: 0.15,
  legendaryThreshold: 8,
  legendaryFactors: { 1: 4, 2: 1.5, 3: 0.5 },
  fusionChance: 0.2,
  weights: {
    normal: { comum: 55, incomum: 25, raro: 13, epico: 6, lendario: 0.9, mitico: 0 },
    raidFarm: { comum: 35, incomum: 30, raro: 20, epico: 12, lendario: 2.8, mitico: 0 },
    raidBoss: { raro: 45, epico: 35, lendario: 17, mitico: 3 },
  },
};

export function economy(data) {
  return data.economy ?? DEFAULT_ECONOMY;
}

export function weightedPick(entries, weight, rng) {
  const eligible = entries.map((entry) => [entry, Number(weight(entry))]).filter(([, w]) => w > 0 && Number.isFinite(w));
  const total = eligible.reduce((sum, [, w]) => sum + w, 0);
  if (!total) return null;
  let remaining = rng() * total;
  for (const [entry, w] of eligible) {
    remaining -= w;
    if (remaining < 0) return entry;
  }
  return eligible.at(-1)[0];
}

export function rollItem(data, rng = Math.random, source = 'normal') {
  const pool = data.items.filter((item) => Number(item.dropWeight) > 0);
  const weights = economy(data).weights[source];
  const available = new Set(pool.map((item) => item.rarity));
  const rarity = weightedPick(RARITY_ORDER, (id) => available.has(id) ? weights[id] : 0, rng);
  return weightedPick(pool.filter((item) => item.rarity === rarity), (item) => item.dropWeight, rng);
}

export function resolveBossLoot(data, pity, drops, rng = Math.random) {
  const settings = economy(data);
  if (drops.some((item) => ['lendario', 'mitico'].includes(item.rarity))) return { pity: 0, bonus: null };
  const next = pity + 1;
  if (next < settings.legendaryThreshold) return { pity: next, bonus: null };
  const legendaries = data.items.filter((item) => item.rarity === 'lendario');
  const bonus = weightedPick(legendaries,
    (item) => item.dropWeight * (settings.legendaryFactors[item.powerTier] ?? 1), rng);
  return { pity: bonus ? 0 : next, bonus };
}

export function fusionPool(data, item) {
  const index = RARITY_ORDER.indexOf(item.rarity);
  if (index < 0 || index >= RARITY_ORDER.indexOf('lendario')) return [];
  const next = data.items.filter((other) =>
    other.rarity === RARITY_ORDER[index + 1] && Number(other.dropWeight) > 0);
  const sameSlot = next.filter((other) => other.type === item.type);
  return sameSlot.length ? sameSlot : next;
}

export const endlessBudget = (wave) => Math.round(20 * wave ** 1.35);
export const endlessHp = (wave) => 1.06 ** Math.max(0, wave - 20);
