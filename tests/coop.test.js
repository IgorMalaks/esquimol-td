import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultData } from '../js/data/defaults.js';
import { Game } from '../js/game/game.js';

Object.assign(globalThis, {
  window: { addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class { observe() {} disconnect() {} },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
});

const canvas = () => ({
  getContext: () => ({}),
  parentElement: { getBoundingClientRect: () => ({ width: 0, height: 0 }) },
  addEventListener() {},
  removeEventListener() {},
});

test('coop sincroniza uma fase inteira e valida os comandos do convidado', () => {
  const data = createDefaultData();
  const phase = data.phases[0];
  const map = data.maps[0];
  const roster = data.eskimos.slice(0, 2).map((def) => ({ def, nodes: [], items: [] }));
  const teams = {
    owner: { roster, abilities: [] },
    guest: { roster, abilities: [] },
  };
  let result;
  const host = new Game(canvas(), { data, phase, map, roster, coop: { room: { owner: 'owner', me: 'owner' }, teams },
    callbacks: { onEnd: (outcome) => { result = outcome; } } });
  const client = new Game(canvas(), { data, phase, map, roster, coop: { room: { owner: 'owner', me: 'guest' }, teams },
    callbacks: { onCommand: (action) => host.remoteAction('guest', action) } });

  assert.equal(client.placeTower('nanuk', 300, 255), true);
  assert.equal(client.placeTower('aput', 340, 426), true);
  assert.equal(client.placeTower('nanuk', 650, 350), false);
  assert.equal(host.gold, 650);
  assert.equal(host.wallet.guest, 150);
  assert.equal(host.placeTower('nanuk', 160, 142), true);
  assert.equal(host.placeTower('aput', 440, 426), true);
  assert.equal(host.remoteAction('guest', { kind: 'sell', tower: host.towers[2].uid }), false);
  assert.equal(host.remoteAction('guest', { kind: 'place', id: 'nanuk', x: NaN, y: 100 }), false);

  host.autoStart = true;
  host.startRound();
  let sequence = 0;
  for (let i = 0; i < 15_000 && !host.over; i++) {
    host.update(1 / 60);
    if (i % 4) continue;
    client.applySnapshot(JSON.parse(JSON.stringify(host.snapshot())), ++sequence);
    assert.equal(client.lives, host.lives);
    assert.equal(client.gold, host.wallet.guest);
    assert.deepEqual(client.towers.map((tower) => tower.uid), host.towers.map((tower) => tower.uid));
  }
  assert.equal(result?.victory, true);
  assert.equal(result.roundsCompleted, 8);
  assert.deepEqual(result.players.guest.usedEskimos, ['nanuk', 'aput']);
  client.applySnapshot(JSON.parse(JSON.stringify(host.snapshot())), ++sequence);
  assert.equal(client.over, true);
  assert.equal(client.lives, host.lives);
  host.destroy();
  client.destroy();
});
