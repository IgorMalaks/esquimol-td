const biome = (id, name, ground, edge, path, trees, effect, hint, weights) => ({
  id, name, palette: { ground, edge, path, trees }, effect, hint, weights,
});
export const BIOME_DEFAULTS = [
  biome('tundra', 'Tundra', '#e5f5ff', '#76aaca', '#bedff2', '#326952', 'nenhum', '', { neutro: 3, gelo: 1 }),
  biome('floresta', 'Floresta Boreal', '#d1e0cf', '#66816d', '#b4cbae', '#245846', 'neblina',
    'A neblina reduz o alcance das torres em 10%. Árvores bloqueiam algumas posições.', { natureza: 3, neutro: 2 }),
  biome('caverna', 'Caverna de Cristal', '#aeb5d1', '#4e547f', '#bdc5e9', '#525685', 'escuridao',
    'Fora das áreas iluminadas, o alcance das torres cai 15%.', { pedra: 3, sombra: 2 }),
  biome('termais', 'Fontes Termais', '#b4a79d', '#875d57', '#cba395', '#76534a', 'calor',
    'A lentidão aplicada diminui 30% e inimigos de Fogo aceleram nas regiões quentes.', { fogo: 3, pedra: 2 }),
  biome('costa', 'Costa da Tempestade', '#bbcbd0', '#5a7f91', '#adc8d1', '#3d626b', 'vento',
    'Aéreos avançam 20% mais rápido. Raios atordoam uma torre a cada 30 segundos.', { tempestade: 3, neutro: 2 }),
  biome('ruinas', 'Ruínas da Aurora', '#b0bacd', '#596384', '#bdcbe0', '#62547e', 'aurora',
    'Recarga de habilidades 15% menor. Inimigos de Sombra se escondem fora da luz.', { sombra: 3, neutro: 2 }),
];

export const FRAGMENT_DEFAULTS = {
  layerChance: 0.004, firstWin: 5, win: 2, raidMin: 3, raidMax: 5, endlessInterval: 10, xp: 20,
};

export function fragmentReward(settings, { layers, first, victory, raid, endlessRounds }, rng = Math.random) {
  let fragments = 0;
  for (let i = 0; i < layers; i++) fragments += Number(rng() < settings.layerChance);
  if (victory && raid) fragments += settings.raidMin + Math.floor(rng() * (settings.raidMax - settings.raidMin + 1));
  else if (victory) fragments += first ? settings.firstWin : settings.win;
  return fragments + Math.floor(endlessRounds / settings.endlessInterval);
}

export function inLight(map, x, y) {
  return (map.lights ?? []).some(([cx, cy, radius]) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2);
}
