export const DAMAGE_LABELS = {
  perfurante: 'Perfurante', impacto: 'Impacto', gelo: 'Gelo', fogo: 'Fogo', raio: 'Raio', arcano: 'Arcano',
};
export const ELEMENT_LABELS = {
  neutro: 'Neutro', gelo: 'Gelo', fogo: 'Fogo', pedra: 'Pedra', natureza: 'Natureza',
  tempestade: 'Tempestade', sombra: 'Sombra',
};

const rows = {
  neutro: [1, 1, 1, 1, 1, 1],
  gelo: [1, 1.25, 0.25, 1.75, 1, 1],
  fogo: [1, 1, 1.75, 0, 1, 1],
  pedra: [0.5, 1.5, 0.75, 1, 1.5, 1],
  natureza: [0.75, 1, 1.25, 1.75, 1, 1],
  tempestade: [1.5, 0.75, 1, 1, 0.25, 1.25],
  sombra: [0.75, 0.75, 0.75, 1, 1, 1.75],
};
const types = Object.keys(DAMAGE_LABELS);
export const DEFAULT_MATRIX = Object.fromEntries(Object.entries(rows).map(([element, values]) =>
  [element, Object.fromEntries(types.map((type, index) => [type, values[index]]))]));

export function damageMultiplier(data, enemy, damageType) {
  const element = enemy.element ?? 'neutro';
  return (data.elements ?? DEFAULT_MATRIX)[element]?.[damageType] ?? 1;
}

export function damageFeedback(multiplier) {
  if (multiplier === 0) return 'IMUNE';
  if (multiplier <= 0.5) return 'RESISTE';
  if (multiplier >= 1.5) return 'EFICAZ';
  return '';
}

export function validateMatrix(matrix) {
  for (const [element, label] of Object.entries(ELEMENT_LABELS)) {
    const row = matrix[element];
    if (!row || types.some((key) => !Number.isFinite(row[key]) || row[key] < 0 || row[key] > 5)) {
      throw new Error(`Use multiplicadores de 0 a 5 na linha ${label}.`);
    }
    if (element !== 'neutro' && !types.some((key) => row[key] >= 1.5)) {
      throw new Error(`${label} precisa de pelo menos uma fraqueza (×1,5 ou maior).`);
    }
  }
  for (const [key, label] of Object.entries(DAMAGE_LABELS)) {
    if (!Object.keys(ELEMENT_LABELS).some((element) => matrix[element][key] >= 1.5)) {
      throw new Error(`${label} precisa ser eficaz contra pelo menos um elemento.`);
    }
  }
}
