import { createDefaultData } from '../js/data/defaults.js';
import { BIOME_DEFAULTS, FRAGMENT_DEFAULTS, fragmentReward } from '../js/data/biomes.js';
import { seededRandom } from '../js/core/utils.js';
import { economy, endlessBudget, rollItem } from '../js/game/economy.js';
import { endlessEnemies, endlessRound } from '../js/game/endless.js';
import { layerChain, rbe } from '../js/core/progression.js';

const matches = Number(process.argv[2] ?? 1000);
const seed = process.argv[3] ?? 'esquimo-td';
if (!Number.isSafeInteger(matches) || matches < 1 || matches > 100_000) {
  throw new Error('Informe um número de partidas entre 1 e 100000.');
}
const data = createDefaultData();
const settings = economy(data);
const rng = seededRandom(seed);
const phase = data.phases.at(-1);

function countLayers(id, count, totals) {
  for (const enemy of layerChain(id, data)) {
    totals.set(enemy, (totals.get(enemy) ?? 0) + count);
    count *= Number(enemy.childCount) || 1;
  }
}

const layers = new Map();
for (const { groups } of phase.rounds) {
  for (const group of groups) countLayers(group.enemyId, group.count, layers);
}
const pops = [...layers.values()].reduce((sum, count) => sum + count, 0);
const curve = new Map();
let firstLegendary = null;
const biomes = new Map(BIOME_DEFAULTS.filter((biome) => biome.id !== 'tundra').map((biome) => [biome.id, 0]));
for (let match = 1; match <= matches; match++) {
  for (const [enemy, count] of layers) {
    for (let i = 0; i < count; i++) {
      if (rng() >= enemy.dropChance * settings.dropRateMultiplier) continue;
      const attempts = rng() < settings.chestChance && rng() < 0.3 ? 2 : 1;
      for (let n = 0; n < attempts; n++) {
        if (rollItem(data, rng)?.rarity === 'lendario') firstLegendary ??= match;
      }
    }
  }
  for (const [biome, total] of biomes) {
    const fragments = fragmentReward(FRAGMENT_DEFAULTS, {
      layers: pops, first: match === 1, victory: true, raid: false, endlessRounds: 0,
    }, rng);
    biomes.set(biome, total + fragments);
  }
  if (match === 1 || match % 10 === 0 || match === matches) {
    curve.set(match, Object.fromEntries(biomes));
  }
}
console.log(`Cenário: ${matches} vitórias em ${phase.name}, todas as camadas destruídas e todos os drops coletados.`);
console.log(`Primeiro Lendário: ${firstLegendary ?? 'fora da amostra'}`);
console.log('Fragmentos acumulados por bioma (projeção com a mesma fase em cada bioma)');
console.table([...curve].slice(-20).map(([partidas, amounts]) => ({ partidas, tundra: 0, ...amounts })));
console.log('RBE base e com vida escalada no Infinito');
console.table([1, 10, 15, 20, 25, 30, 40, 50].map((onda) => {
  const { groups } = endlessRound(data, onda, seed);
  const scaled = { ...data, enemies: endlessEnemies(data, onda) };
  return {
    onda,
    orcamento: endlessBudget(onda),
    rbe: groups.reduce((sum, { enemyId, count }) => sum + rbe(enemyId, data) * count, 0),
    danoNecessario: groups.reduce((sum, { enemyId, count }) => sum + rbe(enemyId, scaled) * count, 0),
  };
}));
