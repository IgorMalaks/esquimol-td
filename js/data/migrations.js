export const DATA_VERSION = 2;
export const CLASS_DAMAGE = { arqueiro: 'perfurante', bolanev: 'impacto', arpoador: 'perfurante', mago: 'gelo' };

const migrations = {
  1: (data) => ({
    ...data,
    version: 2,
    eskimos: data.eskimos.map((eskimo) => ({
      damageType: CLASS_DAMAGE[eskimo.classId] ?? 'impacto', hitsAir: false, variantOf: null, ...eskimo,
    })),
    enemies: data.enemies.map((enemy) => ({
      traits: [], element: 'neutro', ...enemy,
    })),
    items: data.items.map((item) => ({
      powerTier: 1, damageType: null, ...item,
    })),
    maps: data.maps.map((map) => ({ biome: null, ...map })),
    abilities: data.abilities ?? [],
    raids: data.raids ?? [],
    biomes: data.biomes ?? [],
  }),
};

export function migrateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Conteúdo inválido.');
  }
  const version = data.version === undefined ? 1 : data.version;
  if (!Number.isInteger(version) || version < 1 || version > DATA_VERSION) {
    throw new Error('Versão de conteúdo incompatível com este jogo.');
  }
  let next = data;
  for (let current = version; current < DATA_VERSION; current++) {
    next = migrations[current](next);
  }
  return next;
}
