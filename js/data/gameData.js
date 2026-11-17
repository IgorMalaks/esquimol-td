// Repositório do conteúdo editável pelo admin (esquimós, inimigos, itens, fases, mapas).
import { storage } from '../core/storage.js';
import { createDefaultData, DATA_VERSION } from './defaults.js';

let cache = null;

export function getData() {
  if (!cache) {
    const saved = storage.get('gamedata');
    if (saved?.version === DATA_VERSION) {
      cache = saved;
    } else {
      // Sem migrações ainda (ver docs/MELHORIAS.md). Versão diferente => volta ao padrão.
      if (saved) console.warn('gamedata com versão diferente; restaurando padrão.');
      cache = createDefaultData();
      storage.set('gamedata', cache);
    }
  }
  return cache;
}

export function saveData(data) {
  validateData(data);
  cache = data;
  storage.set('gamedata', data);
}

export function resetData() {
  cache = createDefaultData();
  storage.set('gamedata', cache);
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
