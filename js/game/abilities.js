export const ABILITY_TYPES = {
  chuva_flechas: { name: 'Chuva de Flechas', target: 'area', power: 2, area: 90, duration: 1.2 },
  nevasca: { name: 'Nevasca', target: 'global', power: 40, area: 0, duration: 5 },
  avalanche: { name: 'Avalanche', target: 'caminho', power: 3, area: 200, duration: 0 },
  bloco_gelo: { name: 'Bloco de Gelo', target: 'area', power: 100, area: 70, duration: 2.5 },
  chamado_matilha: { name: 'Chamado da Matilha', target: 'global', power: 6, area: 0, duration: 12 },
  fogueira: { name: 'Fogueira', target: 'global', power: 50, area: 0, duration: 10 },
};

export const ABILITY_SCALES = {
  comum: { cooldown: 120, power: 0.5, area: 0.6, duration: 0.6 },
  incomum: { cooldown: 105, power: 0.65, area: 0.7, duration: 0.7 },
  raro: { cooldown: 90, power: 0.8, area: 0.8, duration: 0.8 },
  epico: { cooldown: 75, power: 1, area: 1, duration: 1 },
  lendario: { cooldown: 60, power: 1.3, area: 1.2, duration: 1.2 },
  mitico: { cooldown: 45, power: 1.7, area: 1.5, duration: 1.5 },
};

export function abilityStats(data, item) {
  const definition = data.abilities.find((entry) => entry.id === item.abilityId);
  const base = ABILITY_TYPES[definition?.type];
  const scale = (data.economy?.abilityScales ?? ABILITY_SCALES)[item.rarity];
  if (!base || !scale) return null;
  return {
    ...base, type: definition.type, name: item.name,
    cooldown: scale.cooldown,
    power: (definition.power ?? base.power) * scale.power * (0.9 + 0.1 * ((item.powerTier ?? 2) - 1)),
    area: (definition.area ?? base.area) * scale.area,
    duration: (definition.duration ?? base.duration) * scale.duration,
  };
}
