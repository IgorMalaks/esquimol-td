import { BIOME_DEFAULTS } from './biomes.js';

export function addBiomeContent(data) {
  const enemy = (id, name, baseId, element, traits, changes = {}) => {
    const base = data.enemies.find((entry) => entry.id === baseId);
    return { ...base, id, name, element, traits, ...changes,
      face: { ...base.face, skin: changes.skin ?? base.face.skin },
    };
  };
  data.enemies.push(
    enemy('broto', 'Broto Corredor', 'verde', 'natureza', ['rapido'], { hp: 1, speed: 64, skin: '#69c47e' }),
    enemy('cogumelo', 'Cogumelo Curandeiro', 'vermelho', 'natureza', ['curandeiro'], { hp: 4, speed: 52, skin: '#d4b269' }),
    enemy('lobo_cinzento', 'Lobo Cinzento', 'vermelho', 'neutro', ['enxame'], { speed: 108, size: 12, skin: '#a1b1bf' }),
    enemy('casca', 'Casca Partida', 'pedra', 'natureza', ['divisor'], { childId: 'broto', skin: '#789557' }),
    enemy('anciao', 'Ancião Musgoso', 'chefe', 'natureza', ['chefe'], { hp: 90, childId: 'casca', childCount: 2, skin: '#91b473' }),
    enemy('golem_frio', 'Golem de Gelo', 'pedra', 'gelo', ['blindado'], { hp: 8, childId: 'pedra', childCount: 3, skin: '#8ebffa' }),
    enemy('morcego', 'Morcego de Cristal', 'corvo_gelo', 'sombra', ['aereo'], { hp: 2, skin: '#bb9bee' }),
    enemy('espreitador', 'Espreitador', 'verde', 'sombra', ['camuflado'], { hp: 3, skin: '#9c89c3' }),
    enemy('guardiao', 'Guardião de Cristal', 'pedra', 'pedra', ['escudo', 'regenera'], { hp: 9, skin: '#9ea4ba' }),
    enemy('prismatico', 'Golem Prismático', 'chefe', 'pedra', ['chefe', 'escudo'], { hp: 140, childId: 'golem_frio', childCount: 2, skin: '#9f9ce8' }),
  );
  data.biomes = structuredClone(BIOME_DEFAULTS);
  data.maps[0].biome = 'tundra';
  data.maps[1].biome = 'tundra';
  const forest = { id: 'trilha_boreal', name: 'Trilha Boreal', biome: 'floresta',
    points: [[-0.03, 0.28], [0.26, 0.28], [0.38, 0.78], [0.65, 0.78], [0.68, 0.25], [1.03, 0.25]],
    obstacles: [[125, 410, 28], [510, 330, 35], [810, 402, 28], [905, 510, 32]],
  };
  const cave = { id: 'galeria', name: 'Galeria de Cristal', biome: 'caverna',
    points: [[-0.03, 0.62], [0.24, 0.62], [0.32, 0.19], [0.66, 0.22], [0.73, 0.76], [1.03, 0.76]],
    lights: [[229, 319, 133], [511, 201, 140], [767, 390, 124]],
  };
  data.maps.push(forest, cave);
  const addPhases = (map, encounters) => {
    encounters.forEach(([id, name, groups], index) => data.phases.push({
      id, name, mapId: map.id, startGold: 750 + index * 125, lives: 100,
      rounds: groups.map((group) => ({ groups: group.map(([enemyId, count, delay = 0]) => ({ enemyId, count, delay, interval: 0.55 })) })),
    }));
  };
  addPhases(forest, [
    ['bosque', 'Bosque da Neblina', [[['lobo_cinzento', 8]], [['broto', 12]], [['cogumelo', 4], ['broto', 12, 3]],
      [['casca', 5], ['lobo_cinzento', 10, 3]], [['cogumelo', 8], ['casca', 6, 5]]]],
    ['copa', 'Copa Boreal', [[['broto', 18]], [['casca', 10]], [['cogumelo', 8], ['lobo_cinzento', 10, 3]],
      [['broto', 22], ['casca', 8, 5]], [['anciao', 1], ['cogumelo', 6, 9]]]],
  ]);
  addPhases(cave, [
    ['galeria_escura', 'Galeria Escura', [[['pedra', 6]], [['morcego', 8]], [['golem_frio', 7]],
      [['guardiao', 9], ['morcego', 10, 4]], [['espreitador', 2], ['golem_frio', 8, 3]]]],
    ['prisma', 'Salão Prismático', [[['morcego', 12]], [['guardiao', 10]], [['golem_frio', 14]],
      [['guardiao', 7], ['morcego', 12, 4]], [['prismatico', 1], ['guardiao', 4, 9]]]],
  ]);
  const firstRaid = data.raids[0];
  for (const [id, name, map, bossId, early] of [
    ['anciao_musgoso', 'Ninho do Ancião Musgoso', forest, 'anciao', 'broto'],
    ['golem_prismatico', 'Covil Prismático', cave, 'prismatico', 'golem_frio'],
  ]) {
    data.raids.push({ ...structuredClone(firstRaid), id, name, mapId: map.id, bossId, keyCost: 2,
      farmRounds: [12, 16].map((count) => ({ groups: [{ enemyId: early, count, interval: 0.5, delay: 0 }] })),
      bossPhases: firstRaid.bossPhases.map((stage) => ({ ...stage, escortId: early })),
    });
  }
  for (const [id, baseId, name, biome, damageType, color] of [
    ['nanuk_boreal', 'nanuk', 'Nanuk do Bosque', 'floresta', 'arcano', '#286454'],
    ['ila_cristal', 'ila', 'Ila Prismática', 'caverna', 'raio', '#6746a5'],
  ]) {
    const base = structuredClone(data.eskimos.find((entry) => entry.id === baseId));
    data.eskimos.push({ ...base, id, name, variantOf: baseId, damageType, bodyColor: color,
      face: { ...base.face, headwearColor: color },
      tree: base.tree.map((node) => ({ ...node, id: node.id.replace(baseId, id) })),
      unlock: { type: 'fragments', biome, amount: 50 },
    });
  }
  data.items.push(
    { id: 'arco_incendiario', name: 'Arco Incendiário', type: 'arma', rarity: 'epico', powerTier: 2,
      damageType: 'fogo', classRestriction: 'arqueiro', dropWeight: 5, stats: { damage: 1 } },
    { id: 'cajado_prismatico', name: 'Cajado Prismático', type: 'arma', rarity: 'lendario', powerTier: 2,
      damageType: 'raio', classRestriction: 'mago', dropWeight: 2, stats: { detection: 1 } },
  );
  return data;
}
