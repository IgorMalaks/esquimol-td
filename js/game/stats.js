// Regras puras de atributos, upgrades e árvore de habilidades (sem DOM, testáveis).
import { CLASSES } from '../data/defaults.js';

const numericEffect = (label, suffix = '') => ({ label, fmt: (v) => `+${v}${suffix} ${label.toLowerCase()}` });
export const EFFECT_KEYS = {
  damage: { label: 'Dano', fmt: (v) => `+${v} dano` },
  pierce: { label: 'Perfuração', fmt: (v) => `+${v} perfuração` },
  rangePct: { label: 'Alcance %', fmt: (v) => `+${v}% alcance` },
  speedPct: { label: 'Vel. de ataque %', fmt: (v) => `+${v}% vel. ataque` },
  splash: { label: 'Área (px)', fmt: (v) => `+${v} área` },
  slowPct: { label: 'Lentidão %', fmt: (v) => `+${v}% lentidão` },
  multishot: { label: 'Projéteis extras', fmt: (v) => `+${v} projétil(eis)` },
  hitsAir: { label: 'Antiaéreo', fmt: () => 'Atinge aéreos' },
  summonCount: numericEffect('Aliados por invocação'),
  maxAllies: numericEffect('Limite de aliados'),
  allyHp: numericEffect('Vida dos aliados'),
  allyDamage: numericEffect('Dano dos aliados'),
  allySpeedPct: numericEffect('Velocidade dos aliados', '%'),
  allyLifetime: numericEffect('Duração dos aliados', ' s'),
  allyKind: { label: 'Aliado (0 pinguim, 1 foca, 2 urso, 3 lobo)', fmt: (v) => ['Pinguins', 'Focas', 'Ursos', 'Lobos'][v] ?? '' },
  allySlowPct: numericEffect('Lentidão dos aliados', '%'),
  allyExplode: numericEffect('Raio de explosão dos aliados'),
  buffDamage: numericEffect('Dano na aura'),
  buffSpeedPct: numericEffect('Velocidade na aura', '%'),
  buffRangePct: numericEffect('Alcance na aura', '%'),
  buffPierce: numericEffect('Perfuração na aura'),
  buffAntiAereo: { label: 'Aura antiaérea', fmt: () => 'Concede antiaéreo' },
  auraRangePct: numericEffect('Raio da aura', '%'),
  auraGold: numericEffect('Ouro por rodada'),
  auraCooldown: { label: 'Recarga ativa na aura', fmt: (v) => `−${v}% de recarga` },
};

export const BASE_STATS = {
  damage: 1, range: 150, fireRate: 1, pierce: 1, projectileSpeed: 600,
  splash: 0, slowPct: 0, slowDuration: 1.5, multishot: 0,
};

export const STAT_LABELS = {
  damage: 'Dano', range: 'Alcance', fireRate: 'Ataques/s', pierce: 'Perfuração',
  splash: 'Área', slowPct: 'Lentidão %', multishot: 'Proj. extras',
};

// Pontos de habilidade: base + 1 a cada XP_PER_POINT de XP, até MAX_POINTS.
export const BASE_POINTS = 2;
export const XP_PER_POINT = 100;
export const MAX_POINTS = 8;

export const UPGRADE_TRACKS = {
  dmg: { label: 'Ataque', max: 4, mult: 0.75, apply: (s, l) => { s.damage += l; } },
  spd: { label: 'Velocidade', max: 4, mult: 0.6, apply: (s, l) => { s.fireRate *= 1 + 0.2 * l; } },
  rng: { label: 'Alcance', max: 4, mult: 0.45, apply: (s, l) => { s.range *= 1 + 0.12 * l; } },
};

export function upgradeCost(def, track, level) {
  return Math.max(25, Math.round((def.cost * UPGRADE_TRACKS[track].mult * (level + 1)) / 5) * 5);
}

export function applyEffect(s, key, value) {
  const v = Number(value) || 0;
  if (!v) return;
  if (key === 'rangePct') s.range *= 1 + v / 100;
  else if (key === 'speedPct') s.fireRate *= 1 + v / 100;
  else if (key in s) s[key] += v;
}

export function effectText(effect) {
  const meta = EFFECT_KEYS[effect?.key];
  return meta ? meta.fmt(effect.value) : '';
}

export function itemStatsText(item) {
  return Object.entries(item.stats || {})
    .filter(([, v]) => Number(v))
    .map(([k, v]) => EFFECT_KEYS[k]?.fmt(v)).filter(Boolean).join(', ');
}

export function computeStats(def, { items = [], nodes = [], upgrades = null } = {}) {
  const s = { ...BASE_STATS, ...def.stats, hitsAir: Number(Boolean(def.hitsAir || CLASSES[def.classId]?.hitsAir)) };
  for (const it of items) for (const [k, v] of Object.entries(it.stats || {})) applyEffect(s, k, v);
  for (const n of nodes) applyEffect(s, n.effect?.key, n.effect?.value);
  if (upgrades) for (const [k, lvl] of Object.entries(upgrades)) UPGRADE_TRACKS[k]?.apply(s, lvl);
  s.slowPct = Math.min(s.slowPct, 80);
  s.fireRate = Math.max(0.1, s.fireRate);
  s.pierce = Math.max(1, Math.round(s.pierce));
  s.multishot = Math.max(0, Math.round(s.multishot));
  return s;
}

// ---------- Árvore de habilidades ----------
export const skillPoints = (ep) => Math.min(MAX_POINTS, BASE_POINTS + Math.floor((ep?.xp || 0) / XP_PER_POINT));

export const pointsSpent = (def, ep) =>
  def.tree.filter((n) => ep.skills.includes(n.id)).reduce((a, n) => a + (Number(n.cost) || 0), 0);

export const pointsFree = (def, ep) => skillPoints(ep) - pointsSpent(def, ep);

const sameBranch = (def, node, tier) => def.tree.find((n) => n.branch === node.branch && n.tier === tier);

export function canLearn(def, ep, node) {
  if (ep.skills.includes(node.id)) return { ok: false, reason: 'Já aprendida' };
  if (node.tier > 1) {
    const prev = sameBranch(def, node, node.tier - 1);
    if (prev && !ep.skills.includes(prev.id)) return { ok: false, reason: 'Aprenda o nível anterior do caminho' };
  }
  if (node.tier === 3) {
    const other = def.tree.find((n) => n.tier === 3 && n.branch !== node.branch && ep.skills.includes(n.id));
    if (other) return { ok: false, reason: `Só um caminho chega ao nível 3 (já tem "${other.name}")` };
  }
  if (pointsFree(def, ep) < node.cost) return { ok: false, reason: 'Pontos insuficientes' };
  return { ok: true };
}

export function canUnlearn(def, ep, node) {
  if (!ep.skills.includes(node.id)) return { ok: false, reason: 'Não aprendida' };
  const next = sameBranch(def, node, node.tier + 1);
  if (next && ep.skills.includes(next.id)) return { ok: false, reason: 'Remova o nível seguinte primeiro' };
  return { ok: true };
}
