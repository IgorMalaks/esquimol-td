// Repositório do conteúdo editável pelo admin (esquimós, inimigos, itens, fases, mapas).
import { storage } from '../core/storage.js';
import { createDefaultData } from './defaults.js';
import { migrateData } from './migrations.js';

let cache = null;

export function getData() {
  if (!cache) {
    const saved = storage.get('gamedata');
    if (saved === null) {
      cache = createDefaultData();
      return cache;
    }
    try {
      const next = prepareData(saved);
      if (next !== saved) storage.set('gamedata', next);
      cache = next;
    } catch (error) {
      console.warn('Não foi possível carregar o conteúdo salvo. O original foi preservado.', error);
      cache = createDefaultData();
    }
  }
  return cache;
}

export function prepareData(data) {
  validateData(data);
  const next = migrateData(data);
  for (const key of ['abilities', 'raids', 'biomes']) {
    if (!Array.isArray(next[key])) throw new Error(`Dados inválidos: "${key}" ausente.`);
  }
  return next;
}

export function saveData(data, { replace = false } = {}) {
  const saved = storage.get('gamedata');
  if (!replace && saved !== null) prepareData(saved);
  const next = prepareData(data);
  storage.set('gamedata', next);
  cache = next;
}

export function resetData() {
  saveData(createDefaultData(), { replace: true });
  return cache;
}

export const byId = (list, id) => list.find((x) => x.id === id) || null;

export function validateData(d) {
  for (const k of ['eskimos', 'enemies', 'items', 'phases', 'maps']) {
    if (!Array.isArray(d?.[k])) throw new Error(`Dados inválidos: "${k}" ausente.`);
  }
  if (!d.eskimos.some((e) => (e.unlock?.type || 'default') === 'default')) {
    throw new Error('Pelo menos um esquimó precisa estar disponível desde o início.');
  }
  const enemyIds = new Set(d.enemies.map((e) => e.id));
  for (const e of d.enemies) {
    if (e.childId && !enemyIds.has(e.childId)) throw new Error(`"${e.name}" aponta para camada inexistente.`);
    const seen = new Set([e.id]);
    let cur = e;
    while (cur?.childId) {
      if (seen.has(cur.childId)) throw new Error(`Ciclo de camadas detectado em "${e.name}".`);
      seen.add(cur.childId);
      cur = byId(d.enemies, cur.childId);
    }
  }
  const mapIds = new Set(d.maps.map((m) => m.id));
  for (const p of d.phases) {
    if (!mapIds.has(p.mapId)) throw new Error(`Fase "${p.name}" usa mapa inexistente.`);
    if (!p.rounds?.length) throw new Error(`Fase "${p.name}" não tem rodadas.`);
    for (const r of p.rounds) {
      if (!r.groups?.length) throw new Error(`Fase "${p.name}" tem rodada vazia.`);
      for (const grp of r.groups) {
        if (!enemyIds.has(grp.enemyId)) throw new Error(`Fase "${p.name}" usa inimigo inexistente.`);
      }
    }
  }
  return true;
}
