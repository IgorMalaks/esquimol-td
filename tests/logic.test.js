// Testes de lógica pura (sem DOM). Rodar: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultData } from '../js/data/defaults.js';
import { validateData } from '../js/data/gameData.js';
import { Path } from '../js/game/pathing.js';
import { computeStats, canLearn, canUnlearn, skillPoints, pointsFree, upgradeCost } from '../js/game/stats.js';
import { rbe, layerChain, rollItem } from '../js/core/progression.js';

const data = () => createDefaultData();
const nanuk = (d) => d.eskimos.find((e) => e.id === 'nanuk');
const node = (def, b, t) => def.tree.find((n) => n.branch === b && n.tier === t);

describe('Path', () => {
  const p = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  it('calcula comprimento e posição por distância', () => {
    assert.equal(p.length, 200);
    assert.deepEqual(p.pointAt(150), { x: 100, y: 50 });
    assert.deepEqual(p.pointAt(-5), { x: 0, y: 0 });
  });
  it('calcula distância de um ponto ao caminho', () => {
    assert.equal(p.distanceTo(50, 10), 10);
  });
});

describe('computeStats', () => {
  it('aplica bônus de item', () => {
    const def = nanuk(data());
    assert.equal(computeStats(def, { items: [{ stats: { damage: 1 } }] }).damage, def.stats.damage + 1);
  });
  it('aplica alcance percentual e limita lentidão em 80%', () => {
    const def = nanuk(data());
    const s = computeStats(def, { items: [{ stats: { rangePct: 50, slowPct: 200 } }] });
    assert.equal(s.range, def.stats.range * 1.5);
    assert.equal(s.slowPct, 80);
  });
});

describe('Árvore de habilidades', () => {
  it('começa com 2 pontos e exige o nível anterior', () => {
    const def = nanuk(data());
    const ep = { xp: 0, skills: [] };
    assert.equal(skillPoints(ep), 2);
    assert.equal(canLearn(def, ep, node(def, 1, 2)).ok, false);
    assert.equal(canLearn(def, ep, node(def, 1, 1)).ok, true);
  });
  it('só um caminho chega ao nível 3', () => {
    const def = nanuk(data());
    const ep = { xp: 600, skills: [] };
    for (const [b, t] of [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2]]) ep.skills.push(node(def, b, t).id);
    assert.equal(pointsFree(def, ep), 2);
    const r = canLearn(def, ep, node(def, 2, 3));
    assert.equal(r.ok, false);
    assert.match(r.reason, /Só um caminho/);
  });
  it('não remove nível com o seguinte aprendido', () => {
    const def = nanuk(data());
    const ep = { xp: 600, skills: [node(def, 1, 1).id, node(def, 1, 2).id] };
    assert.equal(canUnlearn(def, ep, node(def, 1, 1)).ok, false);
    assert.equal(canUnlearn(def, ep, node(def, 1, 2)).ok, true);
  });
});

describe('upgradeCost', () => {
  it('é múltiplo de 5, no mínimo 25, e cresce com o nível', () => {
    const def = nanuk(data());
    const c0 = upgradeCost(def, 'dmg', 0);
    const c1 = upgradeCost(def, 'dmg', 1);
    assert.equal(c0 % 5, 0);
    assert.ok(c0 >= 25);
    assert.ok(c1 > c0);
  });
});

describe('validateData', () => {
  it('aceita o conteúdo padrão', () => {
    assert.equal(validateData(data()), true);
  });
  it('recusa ciclo de camadas', () => {
    const d = data();
    d.enemies.find((e) => e.id === 'vermelho').childId = 'azul';
    assert.throws(() => validateData(d), /Ciclo/);
  });
  it('recusa conteúdo sem esquimó inicial', () => {
    const d = data();
    d.eskimos.forEach((e) => { e.unlock = { type: 'wins', value: 1 }; });
    assert.throws(() => validateData(d), /desde o início/);
  });
});

describe('Camadas e RBE', () => {
  it('soma vida das camadas', () => {
    const d = data();
    assert.equal(rbe('vermelho', d), 1);
    assert.equal(rbe('azul', d), 2);
    assert.equal(rbe('rosa', d), 5);
    assert.equal(rbe('pedra', d), 16);
  });
  it('lista a cadeia de camadas', () => {
    assert.deepEqual(layerChain('verde', data()).map((e) => e.id), ['verde', 'azul', 'vermelho']);
  });
});

describe('rollItem', () => {
  it('é determinístico com rng fixo', () => {
    const d = data();
    assert.equal(rollItem(d, () => 0).id, d.items[0].id);
    assert.equal(rollItem(d, () => 0.999999).id, 'estrela_polar');
  });
  it('ignora itens com peso 0', () => {
    const d = data();
    d.items.forEach((i, k) => { i.dropWeight = k === 2 ? 5 : 0; });
    for (let k = 0; k < 20; k++) assert.equal(rollItem(d).id, d.items[2].id);
  });
});
