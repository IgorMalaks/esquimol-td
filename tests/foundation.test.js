import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultData } from '../js/data/defaults.js';
import { prepareData } from '../js/data/gameData.js';
import { applyMatchResult, ensureProgress, fuseItems, migrateProgress, setAbilitySlot, spendRaidKeys } from '../js/core/progression.js';
import { canHitEnemy, roundsHaveAir } from '../js/game/enemies.js';
import { computeStats } from '../js/game/stats.js';
import { projectY, groundY } from '../js/game/game.js';
import { endlessRound } from '../js/game/endless.js';
import { resolveBossLoot, rollItem } from '../js/game/economy.js';
import { seededRandom } from '../js/core/utils.js';
import { abilityStats } from '../js/game/abilities.js';
import { applyAuras, summonerStats } from '../js/game/roles.js';
import { raidPhase } from '../js/game/raids.js';
import { SpatialGrid } from '../js/game/spatialGrid.js';

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    data: new Map(),
    getItem(key) { return this.data.get(key) ?? null; },
    setItem(key, value) { this.data.set(key, value); },
  },
});

test('migra conteúdo antigo mantendo IDs, alterações e referências', () => {
  const data = createDefaultData();
  data.version = 1;
  data.eskimos[0].cost = 315;
  delete data.eskimos[0].damageType;
  delete data.abilities;
  data.items = data.items.filter((item) => item.type !== 'habilidade');
  const migrated = prepareData(data);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.eskimos[0].id, data.eskimos[0].id);
  assert.equal(migrated.eskimos[0].cost, 315);
  assert.equal(migrated.eskimos[0].damageType, 'perfurante');
  assert.deepEqual(migrated.abilities, []);
  assert.equal(data.version, 1);
  assert.throws(() => prepareData({ ...data, version: 3 }), /incompatível/);
});

test('ensureProgress preserva XP e equipamentos válidos de contas antigas', () => {
  const account = { progress: {
    unlocked: ['nanuk', 'removido'],
    eskimos: { nanuk: { xp: 230, skills: ['nanuk_b1t1', 'removida'], equip: { arma: 'a', amuleto: 'b' } } },
    inventory: [{ uid: 'a', itemId: 'arco_runico' }, { uid: 'b', itemId: 'removido' }],
  } };
  ensureProgress(account);
  assert.equal(account.progress.version, 2);
  assert.deepEqual(account.progress.unlocked, ['nanuk', 'aput']);
  assert.deepEqual(account.progress.eskimos.nanuk, {
    xp: 230, skills: ['nanuk_b1t1'], equip: { arma: 'a', armadura: null, amuleto: null },
  });
  assert.deepEqual(account.progress.inventory, [{ uid: 'a', itemId: 'arco_runico', origin: 'local' }]);
  assert.throws(() => migrateProgress({ version: 3 }), /incompatível/);
});

test('applyMatchResult registra XP, itens e desbloqueio da primeira fase', () => {
  const account = ensureProgress({ username: 'Teste' });
  const result = applyMatchResult(account, {
    victory: true, phaseId: 'fase1', roundsCompleted: 8, usedEskimos: ['nanuk', 'nanuk'], items: ['dente_morsa'],
  });
  assert.equal(account.progress.eskimos.nanuk.xp, 130);
  assert.deepEqual(result.newUnlocks.map((def) => def.id), ['ila']);
  assert.deepEqual(account.progress.phases.fase1, { completed: true, bestRound: 8 });
  assert.equal(JSON.parse(localStorage.getItem('etd.v1.accounts')).teste.progress.inventory[0].origin, 'local');
});

test('a projeção de toque volta à coordenada lógica do chão', () => {
  for (const y of [0, 100, 300, 600]) assert.ok(Math.abs(groundY(projectY(y)) - y) < 1e-9);
});

test('aéreos exigem classe, nó ou item com antiaéreo', () => {
  const data = createDefaultData();
  const air = data.enemies.find((def) => def.id === 'corvo_gelo');
  const [archer, , harpoon] = data.eskimos;
  assert.equal(canHitEnemy(air, computeStats(archer).hitsAir), false);
  assert.equal(canHitEnemy(air, computeStats(harpoon).hitsAir), true);
  assert.equal(canHitEnemy(air, computeStats(archer, { nodes: [{ effect: { key: 'hitsAir', value: 1 } }] }).hitsAir), true);
  assert.equal(roundsHaveAir(data.phases[1].rounds, data.enemies), true);
});

test('pesos de raridade, garantia e fonte do item Mítico', () => {
  const data = createDefaultData();
  const rng = seededRandom('pesos');
  const counts = {};
  for (let i = 0; i < 10000; i++) {
    const { rarity } = rollItem(data, rng);
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }
  assert.ok(Math.abs(counts.comum - 5500) < 550);
  assert.ok(Math.abs(counts.incomum - 2500) < 250);
  assert.ok(Math.abs(counts.raro - 1300) < 130);
  assert.ok(Math.abs(counts.epico - 600) < 60);
  assert.equal(counts.mitico, undefined);
  assert.equal(rollItem(data, () => 0.9999, 'raidBoss').rarity, 'mitico');
  assert.deepEqual(resolveBossLoot(data, 6, []), { pity: 7, bonus: null });
  const result = resolveBossLoot(data, 7, [], () => 0);
  assert.equal(result.pity, 0);
  assert.equal(result.bonus.id, 'cajado_boreal');
});

test('fusão salva o resultado antes de devolver e preserva uma cópia se falhar', () => {
  const account = ensureProgress({ username: 'Fusao' });
  const copies = ['a', 'b', 'c'].map((uid) => ({ uid, itemId: 'luva_gelo' }));
  account.progress.inventory = [...copies];
  account.progress.eskimos.nanuk.equip.armadura = 'a';
  assert.throws(() => fuseItems(account, ['a', 'b', 'c']), /desequipadas/);
  account.progress.eskimos.nanuk.equip.armadura = null;
  assert.equal(fuseItems(account, ['a', 'b', 'c'], () => 0.2), null);
  assert.deepEqual(account.progress.inventory, [copies[0]]);
  account.progress.inventory = [...copies];
  assert.equal(fuseItems(account, ['a', 'b', 'c'], () => 0).id, 'luvas_costuradas');
  assert.equal(JSON.parse(localStorage.getItem('etd.v1.accounts')).fusao.progress.inventory[0].itemId, 'luvas_costuradas');
});

test('a seed do Infinito reproduz a rodada e inclui chefes a cada 25', () => {
  const data = createDefaultData();
  const wave = endlessRound(data, 25, 'qa');
  assert.deepEqual(wave, endlessRound(data, 25, 'qa'));
  assert.notDeepEqual(wave, endlessRound(data, 25, 'outra'));
  assert.equal(wave.groups.at(-1).enemyId, 'chefe');
});

test('suporte aplica apenas o maior bônus por tipo', () => {
  const archer = createDefaultData().eskimos[0];
  const tower = { x: 0, y: 0, stats: computeStats(archer) };
  const support = (x, buffs) => ({ x, y: 0, stats: { range: 120, buffs } });
  applyAuras(tower, [support(10, { damage: 1 }), support(20, { damage: 2, antiAereo: 1 }), support(130, { damage: 9 })]);
  assert.equal(tower.stats.damage, 3);
  assert.equal(tower.stats.hitsAir, 1);
  assert.equal(tower.buffed, true);
});

test('upgrades do Domador alteram dano, intervalo e vida do aliado', () => {
  const domador = createDefaultData().eskimos.find((eskimo) => eskimo.classId === 'domador');
  const stats = summonerStats(domador, [], { dmg: 1, spd: 1, rng: 1 });
  assert.equal(stats.allyDamage, 2);
  assert.equal(stats.summonInterval, 3.4);
  assert.equal(stats.allyHp, 4);
});

test('a grade considera raios grandes próximos a fronteiras entre células', () => {
  const grid = new SpatialGrid(80);
  const giant = { x: 82, y: -1, r: 40 };
  const far = { x: 800, y: 0, r: 3 };
  grid.add(giant);
  grid.add(far);
  assert.deepEqual([...grid.near(74, 1, 4)], [giant]);
  grid.clear();
  assert.deepEqual([...grid.near(74, 1, 4)], []);
});

test('chaves do Infinito são limitadas e gastas por raide', () => {
  const acc = ensureProgress({ username: 'Raide' });
  const data = createDefaultData();
  const raid = data.raids[0];
  assert.throws(() => spendRaidKeys(acc, raid), /insuficientes/);
  applyMatchResult(acc, { endless: 'qa', duration: 120, roundsCompleted: 90, items: [], usedEskimos: [] });
  assert.equal(acc.progress.raidKeys, 5);
  assert.equal(acc.progress.endlessBest.melhorWave, 90);
  spendRaidKeys(acc, raid);
  assert.equal(acc.progress.raidKeys, 4);
  assert.equal(raidPhase(raid).rounds.at(-1).groups[0].enemyId, raid.bossId);
  assert.equal(prepareData(data).raids.length, 1);
});

test('escala habilidades por raridade e impede equipar a mesma cópia em dois slots', () => {
  const data = createDefaultData();
  const common = abilityStats(data, data.items.find((item) => item.id === 'nevasca_comum'));
  const legendary = abilityStats(data, data.items.find((item) => item.id === 'nevasca_lendario'));
  assert.deepEqual([common.cooldown, common.power, common.duration], [120, 20, 3]);
  assert.deepEqual([legendary.cooldown, legendary.power, legendary.duration], [60, 52, 6]);
  const account = ensureProgress({ username: 'Habilidade' });
  account.progress.inventory = [{ uid: 'nevasca', itemId: 'nevasca_comum' }];
  setAbilitySlot(account, 0, 'nevasca');
  setAbilitySlot(account, 1, 'nevasca');
  assert.deepEqual(account.progress.activeAbilities, [null, 'nevasca']);
});
