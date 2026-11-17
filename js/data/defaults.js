// Conteúdo padrão do jogo. Tudo aqui é editável pelo Painel Admin;
// este arquivo só é usado na primeira execução ou em "Restaurar padrões".
import { migrateData } from './migrations.js';
export { DATA_VERSION } from './migrations.js';

// Classes = comportamento (código). Esquimós = instâncias (dados) — ver ADR-007.
export const CLASSES = {
  arqueiro: { name: 'Arqueiro', projectile: 'flecha', desc: 'Tiros rápidos e precisos.' },
  bolanev: { name: 'Lançador de Bolas de Neve', projectile: 'bola', desc: 'Dano em área.' },
  arpoador: { name: 'Arpoador', projectile: 'arpao', desc: 'Atravessa vários inimigos.' },
  mago: { name: 'Mago do Gelo', projectile: 'gelo', desc: 'Desacelera os inimigos.' },
};

export const FACE_OPTIONS = {
  shape: ['redondo', 'oval', 'quadrado', 'coracao', 'gota'],
  eyes: ['pontos', 'bravos', 'felizes', 'sonolentos', 'ciclope', 'estrelas'],
  mouth: ['sorriso', 'triste', 'aberta', 'dentes', 'reta', 'lingua'],
  headwear: ['nenhum', 'capuz', 'gorro', 'chifres', 'coroa', 'cabelo', 'orelhas'],
  accessory: ['nenhum', 'cachecol', 'oculos', 'bigode', 'cicatriz', 'bochechas'],
};

export const DEFAULT_FACE = {
  shape: 'redondo', skin: '#f2c79b', eyes: 'pontos', eyeColor: '#222222', mouth: 'sorriso',
  headwear: 'capuz', headwearColor: '#3a7bd5', accessory: 'nenhum', accessoryColor: '#d63a3a', outline: '#1b1b1b',
};

export const ITEM_TYPES = { arma: 'Arma', armadura: 'Armadura', amuleto: 'Amuleto' };
export const RARITIES = {
  comum: { name: 'Comum', color: '#9aa5ab', weight: 60 },
  incomum: { name: 'Incomum', color: '#187542', weight: 25 },
  raro: { name: 'Raro', color: '#0984e3', weight: 25 },
  epico: { name: 'Épico', color: '#a55eea', weight: 12 },
  lendario: { name: 'Lendário', color: '#f39c12', weight: 3 },
  mitico: { name: 'Mítico', color: '#c32351', weight: 1 },
};

const face = (o) => ({ ...DEFAULT_FACE, ...o });
const TIER_COST = { 1: 1, 2: 1, 3: 2 };
const TIER_GOLD = { 1: 150, 2: 300, 3: 600 };

// rows: [branch, tier, nome, chave do efeito, valor]
function tree(prefix, rows) {
  return rows.map(([branch, tier, name, key, value]) => ({
    id: `${prefix}_b${branch}t${tier}`, branch, tier, name, desc: '',
    cost: TIER_COST[tier], gold: TIER_GOLD[tier], effect: { key, value },
  }));
}

function eskimos() {
  return [
    {
      id: 'nanuk', name: 'Nanuk', classId: 'arqueiro', bodyColor: '#3a7bd5', cost: 200,
      face: face({ headwearColor: '#3a7bd5' }),
      stats: { damage: 1, range: 150, fireRate: 1.6, pierce: 1, projectileSpeed: 650, splash: 0, slowPct: 0, slowDuration: 1.5 },
      unlock: { type: 'default', value: '' },
      branches: ['Flechas Perfurantes', 'Chuva de Flechas', 'Flechas Congelantes'],
      tree: tree('nanuk', [
        [1, 1, 'Ponta Afiada', 'pierce', 1], [1, 2, 'Flecha Lança', 'pierce', 2], [1, 3, 'Flecha Suprema', 'damage', 2],
        [2, 1, 'Disparo Duplo', 'multishot', 1], [2, 2, 'Mãos Rápidas', 'speedPct', 30], [2, 3, 'Chuva de Flechas', 'multishot', 2],
        [3, 1, 'Ponta Gelada', 'slowPct', 15], [3, 2, 'Olho de Águia', 'rangePct', 25], [3, 3, 'Flecha Congelante', 'slowPct', 30],
      ]),
    },
    {
      id: 'aput', name: 'Aput', classId: 'bolanev', bodyColor: '#e84118', cost: 300,
      face: face({ skin: '#e0ac7e', eyes: 'felizes', mouth: 'dentes', headwearColor: '#e84118', accessory: 'bochechas', accessoryColor: '#ff9ff3' }),
      stats: { damage: 1, range: 130, fireRate: 0.9, pierce: 1, projectileSpeed: 420, splash: 40, slowPct: 0, slowDuration: 1.5 },
      unlock: { type: 'default', value: '' },
      branches: ['Bola Gigante', 'Rajada', 'Avalanche'],
      tree: tree('aput', [
        [1, 1, 'Bola Grande', 'splash', 15], [1, 2, 'Bola Enorme', 'splash', 25], [1, 3, 'Bola Colossal', 'damage', 2],
        [2, 1, 'Arremesso Rápido', 'speedPct', 25], [2, 2, 'Braço Forte', 'rangePct', 20], [2, 3, 'Metralhadora de Neve', 'speedPct', 60],
        [3, 1, 'Neve Pesada', 'damage', 1], [3, 2, 'Neve Úmida', 'slowPct', 20], [3, 3, 'Avalanche', 'multishot', 2],
      ]),
    },
    {
      id: 'siku', name: 'Siku', classId: 'arpoador', bodyColor: '#636e72', cost: 400,
      face: face({ skin: '#c68a5a', eyes: 'bravos', mouth: 'reta', headwearColor: '#2d3436', accessory: 'bigode', accessoryColor: '#3b2a1a' }),
      stats: { damage: 3, range: 190, fireRate: 0.6, pierce: 5, projectileSpeed: 850, splash: 0, slowPct: 0, slowDuration: 1.5 },
      unlock: { type: 'rounds', value: 15 },
      branches: ['Arpão Longo', 'Arpão Duplo', 'Arpão de Gelo'],
      tree: tree('siku', [
        [1, 1, 'Corda Longa', 'pierce', 3], [1, 2, 'Mira Distante', 'rangePct', 25], [1, 3, 'Arpão Abissal', 'pierce', 8],
        [2, 1, 'Dois Arpões', 'multishot', 1], [2, 2, 'Recarga Ágil', 'speedPct', 25], [2, 3, 'Saraivada', 'multishot', 2],
        [3, 1, 'Ponta de Gelo', 'damage', 1], [3, 2, 'Gancho Frio', 'slowPct', 20], [3, 3, 'Arpão Glacial', 'damage', 3],
      ]),
    },
    {
      id: 'ila', name: 'Ila', classId: 'mago', bodyColor: '#8c7ae6', cost: 350,
      face: face({ skin: '#f5d0b0', eyes: 'estrelas', eyeColor: '#00a8ff', headwearColor: '#8c7ae6', accessory: 'oculos', accessoryColor: '#00d2d3' }),
      stats: { damage: 1, range: 140, fireRate: 1.0, pierce: 2, projectileSpeed: 500, splash: 0, slowPct: 35, slowDuration: 1.5 },
      unlock: { type: 'phase', value: 'fase1' },
      branches: ['Nevasca', 'Raio Glacial', 'Coração do Inverno'],
      tree: tree('ila', [
        [1, 1, 'Flocos', 'splash', 20], [1, 2, 'Nevasca', 'splash', 20], [1, 3, 'Era do Gelo', 'slowPct', 20],
        [2, 1, 'Raio Gélido', 'damage', 1], [2, 2, 'Foco Arcano', 'speedPct', 30], [2, 3, 'Raio Glacial', 'damage', 2],
        [3, 1, 'Brisa', 'slowPct', 10], [3, 2, 'Visão Boreal', 'rangePct', 20], [3, 3, 'Coração do Inverno', 'multishot', 2],
      ]),
    },
  ];
}

const enemyFace = (skin, o = {}) => face({ skin, eyes: 'bravos', mouth: 'triste', headwear: 'nenhum', ...o });

function enemies() {
  return [
    { id: 'vermelho', name: 'Carinha Vermelha', hp: 1, speed: 80, size: 15, reward: 1, dropChance: 0.01, childId: '', childCount: 0, face: enemyFace('#ff4757') },
    { id: 'azul', name: 'Carinha Azul', hp: 1, speed: 100, size: 15, reward: 1, dropChance: 0.015, childId: 'vermelho', childCount: 1, face: enemyFace('#1e90ff', { mouth: 'reta' }) },
    { id: 'verde', name: 'Carinha Verde', hp: 1, speed: 120, size: 16, reward: 1, dropChance: 0.02, childId: 'azul', childCount: 1, face: enemyFace('#2ed573', { mouth: 'dentes' }) },
    { id: 'amarelo', name: 'Carinha Amarela', hp: 1, speed: 170, size: 16, reward: 1, dropChance: 0.03, childId: 'verde', childCount: 1, face: enemyFace('#ffd32a', { mouth: 'aberta', shape: 'oval' }) },
    { id: 'rosa', name: 'Carinha Rosa', hp: 1, speed: 200, size: 16, reward: 1, dropChance: 0.04, childId: 'amarelo', childCount: 1, face: enemyFace('#ff6b9d', { mouth: 'lingua', accessory: 'bochechas', accessoryColor: '#c44569' }) },
    { id: 'pedra', name: 'Cara de Pedra', hp: 6, speed: 55, size: 22, reward: 5, dropChance: 0.1, childId: 'rosa', childCount: 2, face: enemyFace('#95a5a6', { shape: 'quadrado', mouth: 'dentes', accessory: 'cicatriz', accessoryColor: '#2d3436' }) },
    { id: 'chefe', name: 'Chefão Glacial', hp: 60, speed: 35, size: 40, reward: 50, dropChance: 0.8, childId: 'pedra', childCount: 4, traits: ['chefe'], face: enemyFace('#74b9ff', { shape: 'gota', eyes: 'ciclope', eyeColor: '#c0392b', mouth: 'dentes', headwear: 'coroa', headwearColor: '#f1c40f' }) },
    { id: 'corvo_gelo', name: 'Corvo de Gelo', hp: 1, speed: 145, size: 13, reward: 2, dropChance: 0.03, childId: '', childCount: 0, traits: ['aereo'], face: enemyFace('#b1dcf1', { shape: 'gota', headwear: 'orelhas' }) },
    { id: 'dirigivel_glacial', name: 'Dirigível Glacial', hp: 20, speed: 58, size: 25, reward: 15, dropChance: 0.18, childId: 'pedra', childCount: 3, traits: ['aereo'], face: enemyFace('#daf2ff', { shape: 'oval', headwear: 'gorro' }) },
  ];
}

function items() {
  const it = (id, name, type, rarity, stats, classRestriction = '') =>
    ({ id, name, type, rarity, stats, classRestriction, dropWeight: RARITIES[rarity].weight });
  return [
    it('luva_gelo', 'Luvas de Pele de Foca', 'armadura', 'comum', { speedPct: 10 }),
    it('bola_compacta', 'Neve Compactada', 'arma', 'comum', { splash: 15 }, 'bolanev'),
    it('luvas_costuradas', 'Luvas Costuradas', 'armadura', 'incomum', { speedPct: 15 }),
    it('pingente_cristal', 'Pingente de Cristal', 'amuleto', 'incomum', { rangePct: 8 }),
    it('dente_morsa', 'Dente de Morsa', 'amuleto', 'raro', { damage: 1 }),
    it('arco_runico', 'Arco Rúnico', 'arma', 'raro', { damage: 1, rangePct: 10 }, 'arqueiro'),
    it('amuleto_aurora', 'Amuleto da Aurora', 'amuleto', 'epico', { rangePct: 15, speedPct: 10 }),
    it('arpao_narval', 'Arpão de Narval', 'arma', 'epico', { pierce: 3 }, 'arpoador'),
    it('cajado_boreal', 'Cajado Boreal', 'arma', 'lendario', { slowPct: 15, damage: 1 }, 'mago'),
    { ...it('estrela_polar', 'Estrela Polar', 'amuleto', 'lendario', { damage: 1, rangePct: 12 }), powerTier: 2 },
    { ...it('coroa_glacial', 'Coroa Glacial', 'armadura', 'mitico', { speedPct: 25, rangePct: 20 }), powerTier: 3 },
  ];
}

function maps() {
  return [
    { id: 'serpente', name: 'Serpente de Gelo', points: [[-0.03, 0.15], [0.25, 0.15], [0.25, 0.8], [0.5, 0.8], [0.5, 0.25], [0.75, 0.25], [0.75, 0.7], [1.03, 0.7]] },
    { id: 'zigue', name: 'Zigue-Zague de Cristal', points: [[-0.03, 0.5], [0.15, 0.5], [0.15, 0.12], [0.4, 0.12], [0.4, 0.88], [0.62, 0.88], [0.62, 0.3], [0.85, 0.3], [0.85, 0.65], [1.03, 0.65]] },
  ];
}

const g = (enemyId, count, interval, delay = 0) => ({ enemyId, count, interval, delay });

function phases() {
  return [
    {
      id: 'fase1', name: 'Vila Congelada', mapId: 'serpente', startGold: 650, lives: 100,
      rounds: [
        [g('vermelho', 12, 0.8)],
        [g('vermelho', 20, 0.6)],
        [g('vermelho', 10, 0.6), g('azul', 6, 0.9, 4)],
        [g('azul', 15, 0.6)],
        [g('azul', 10, 0.5), g('verde', 6, 0.9, 3)],
        [g('verde', 14, 0.6), g('vermelho', 20, 0.3)],
        [g('amarelo', 6, 1.2), g('azul', 20, 0.4)],
        [g('amarelo', 10, 0.8), g('rosa', 4, 1.5, 5)],
      ].map((groups) => ({ groups })),
    },
    {
      id: 'fase2', name: 'Caverna de Cristal', mapId: 'zigue', startGold: 750, lives: 80,
      rounds: [
        [g('azul', 15, 0.6)],
        [g('verde', 15, 0.6)],
        [g('amarelo', 10, 0.7)],
        [g('rosa', 8, 0.8), g('verde', 15, 0.4)],
        [g('pedra', 2, 3), g('amarelo', 12, 0.5)],
        [g('rosa', 15, 0.5)],
        [g('pedra', 5, 2), g('rosa', 10, 0.6)],
        [g('amarelo', 30, 0.3)],
        [g('pedra', 8, 1.5), g('rosa', 20, 0.4)],
        [g('chefe', 1, 1), g('pedra', 4, 2, 6), g('dirigivel_glacial', 1, 1, 10)],
      ].map((groups) => ({ groups })),
    },
  ];
}

export function createDefaultData() {
  return migrateData({ version: 1, eskimos: eskimos(), enemies: enemies(), items: items(), maps: maps(), phases: phases() });
}
