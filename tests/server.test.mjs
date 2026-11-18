import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createGameServer } from '../server/index.js';
import { openStore, restoreBackup } from '../server/store.js';
import { createDefaultData } from '../js/data/defaults.js';
import { advanceTrades, changeTrade, reservedItem } from '../server/trade.js';
import { roomHub } from '../server/rooms.js';

async function temporaryStore(context) {
  const directory = await mkdtemp(join(tmpdir(), 'esquimo-test-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, 'data.json');
  return { directory, filename, store: await openStore(filename) };
}

test('fila grava transações concorrentes e conserva somente sete backups válidos', async (context) => {
  const { directory, filename, store } = await temporaryStore(context);
  await Promise.all(Array.from({ length: 8 }, (_, index) => store.update((data) => { data.history.push(index); })));
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')).history, [0, 1, 2, 3, 4, 5, 6, 7]);
  await assert.rejects(store.update((data) => { data.version = 99; }), /esquema/);
  assert.equal(store.read().version, 1);
  let backup;
  for (let day = 1; day <= 9; day++) backup = await store.backup(new Date(Date.UTC(2026, 10, day)));
  assert.equal((await readdir(join(directory, 'backups'))).length, 7);
  const restored = join(directory, 'restored.json');
  await restoreBackup(backup, restored);
  assert.deepEqual((await openStore(restored)).read(), store.read());
  await assert.rejects(restoreBackup(backup, filename), { code: 'EEXIST' });
});

test('API protege sessões, valida origem e registra amizades', async (context) => {
  const { store } = await temporaryStore(context);
  const server = createGameServer({ store });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (path, { body, method = body ? 'POST' : 'GET', cookie, source = origin } = {}) =>
    fetch(origin + path, {
      method,
      headers: { Origin: source, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  const player = { username: 'Nanuk', password: 'test-password' };
  const rejected = await request('/api/register', { body: player, source: 'https://example.test' });
  assert.equal(rejected.status, 403);
  const registered = await request('/api/register', { body: player });
  assert.equal(registered.status, 201);
  const setCookie = registered.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly; SameSite=Strict/);
  const cookie = setCookie.split(';')[0];
  const account = await registered.json();
  assert.equal(account.username, player.username);
  assert.equal(account.hash, undefined);
  assert.equal(store.read().sessions[cookie.split('=')[1]], undefined);
  assert.equal((await request('/api/me')).status, 401);
  assert.equal((await (await request('/api/me', { cookie })).json()).username, player.username);
  assert.equal((await request('/api/login', { body: { ...player, password: 'errada' } })).status, 401);
  const other = await request('/api/register', { body: { username: 'Aput', password: 'test-12345' } });
  const otherCookie = other.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/friends', { cookie, body: { username: 'Aput', action: 'request' } })).status, 200);
  assert.deepEqual((await (await request('/api/friends', { cookie: otherCookie })).json()).inbound, ['Nanuk']);
  assert.equal((await request('/api/friends', { cookie: otherCookie, body: { username: 'Nanuk', action: 'accept' } })).status, 200);
  assert.deepEqual((await (await request('/api/friends', { cookie })).json()).friends, [{ username: 'Aput', presence: 'offline' }]);
  const socket = await new Promise((resolve, reject) => {
    const handshake = httpRequest(origin + '/ws', { headers: {
      Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': randomBytes(16).toString('base64'), Origin: origin, Cookie: otherCookie,
    } });
    handshake.once('upgrade', (_response, socket) => resolve(socket));
    handshake.once('response', (response) => reject(new Error(`Upgrade HTTP ${response.statusCode}`)));
    handshake.once('error', reject);
    handshake.end();
  });
  try {
    assert.deepEqual((await (await request('/api/friends', { cookie })).json()).friends, [{ username: 'Aput', presence: 'online' }]);
  } finally {
    socket.destroy();
  }
  assert.equal((await request('/api/admin/content', { method: 'PUT', cookie, body: {} })).status, 403);
  assert.equal((await request('/var/data.json')).status, 404);
  assert.equal((await request('/api/match/start', { cookie, body: { mode: 'raid', id: 'rei_iceberg' } })).status, 403);
  const started = await request('/api/match/start', { cookie, body: { mode: 'phase', id: 'fase1' } });
  assert.equal(started.status, 200);
  const { matchId } = await started.json();
  const invalid = await request('/api/match/result', { cookie, body: { matchId, victory: true, roundsCompleted: 8 } });
  assert.equal(invalid.status, 400);
  const finish = { matchId, victory: false, roundsCompleted: 0 };
  assert.equal((await request('/api/match/result', { cookie, body: finish })).status, 200);
  assert.equal((await request('/api/match/result', { cookie, body: finish })).status, 200);
  assert.equal((await (await request('/api/me', { cookie })).json()).progress.stats.losses, 1);
  assert.equal((await request('/api/me', { method: 'DELETE', cookie: otherCookie, body: { password: 'test-12345' } })).status, 200);
  assert.deepEqual((await (await request('/api/friends', { cookie })).json()).friends, []);
  assert.equal((await request('/api/logout', { cookie, method: 'POST' })).status, 200);
  assert.equal((await request('/api/me', { cookie })).status, 401);
});

test('trade trava ofertas e só executa uma vez depois da confirmação dupla', () => {
  const content = createDefaultData();
  const instance = (uid, itemId, origin = 'server') => ({ uid, itemId, origin });
  const left = 'u:nanuk';
  const right = 'u:aput';
  const data = { accounts: {
    [left]: { username: 'Nanuk', friends: [right], progress: { inventory: [
      instance('a', 'luva_gelo'), instance('b', 'dente_morsa'), instance('local', 'luva_gelo', 'local'),
    ], eskimos: {} } },
    [right]: { username: 'Aput', friends: [left], progress: { inventory: [
      instance('c', 'arco_runico'), instance('mythic', 'coroa_glacial'),
    ], eskimos: {} } },
  }, history: [] };
  const present = () => true;
  const change = (who, body, time = 1000) => changeTrade(data, content, who, body, present, time);
  const trade = change(left, { action: 'invite', username: 'Aput' });
  const id = trade.id;
  change(right, { id, action: 'accept' });
  assert.throws(() => change(left, { id, action: 'offer', uids: ['local'] }), /indisponível/);
  assert.throws(() => change(right, { id, action: 'offer', uids: ['mythic'] }), /indisponível/);
  change(left, { id, action: 'offer', uids: ['a'] });
  assert.equal(reservedItem(data, 'a'), true);
  change(right, { id, action: 'offer', uids: ['c'] });
  change(left, { id, action: 'confirm' });
  change(left, { id, action: 'offer', uids: ['a', 'b'] });
  assert.deepEqual(trade.confirmed, {});
  change(left, { id, action: 'confirm' });
  change(right, { id, action: 'confirm' });
  assert.equal(trade.status, 'countdown');
  advanceTrades(data, content, present, 3999);
  assert.equal(data.history.length, 0);
  advanceTrades(data, content, present, 4000);
  advanceTrades(data, content, present, 5000);
  assert.equal(data.history.length, 1);
  assert.deepEqual(data.accounts[left].progress.inventory.map((it) => it.uid), ['local', 'c']);
  assert.deepEqual(data.accounts[right].progress.inventory.map((it) => it.uid), ['mythic', 'a', 'b']);
});

test('desconexão antes da troca mantém os inventários', () => {
  const content = createDefaultData();
  const left = 'u:nanuk', right = 'u:aput';
  const item = { uid: 'single', itemId: 'luva_gelo', origin: 'server' };
  const data = {
    accounts: {
      [left]: { username: 'Nanuk', friends: [right], progress: { inventory: [item], eskimos: {} } },
      [right]: { username: 'Aput', friends: [left], progress: { inventory: [], eskimos: {} } },
    },
    history: [],
  };
  const present = () => true;
  const { id } = changeTrade(data, content, left, { action: 'invite', username: 'Aput' }, present, 1000);
  for (const [member, command] of [[right, { action: 'accept' }], [left, { action: 'offer', uids: ['single'] }],
    [left, { action: 'confirm' }], [right, { action: 'confirm' }]]) {
    changeTrade(data, content, member, { ...command, id }, present, 1000);
  }
  advanceTrades(data, content, (member) => member === left, 3000);
  assert.equal(data.trades[id].status, 'cancelled');
  assert.deepEqual(data.accounts[left].progress.inventory, [item]);
  assert.deepEqual(data.accounts[right].progress.inventory, []);
});

test('sala exige prontidão, encaminha comandos e oculta drops de outros jogadores', async () => {
  const content = createDefaultData();
  const state = { accounts: {
    'u:dono': { username: 'Dono', friends: ['u:visita'], progress: null },
    'u:visita': { username: 'Visita', friends: ['u:dono'], progress: null },
  } };
  const store = { read: (read = (value) => value) => read(structuredClone(state)), update: async (mutate) => mutate(state) };
  const sent = [];
  const hub = roomHub({ store, contentSnapshot: () => ({ content, hash: 'qa' }), present: () => true,
    send: (player, message) => sent.push([player, message]) });
  const owner = 'u:dono', guest = 'u:visita';
  const room = await hub.command(owner, { action: 'create', mode: 'phase', target: 'fase1' });
  await hub.command(owner, { action: 'invite', username: 'Visita' });
  await hub.command(guest, { action: 'join', id: room.id });
  await assert.rejects(hub.command(owner, { action: 'start' }), /prontos/);
  await assert.rejects(hub.command(guest, { action: 'ready', contentHash: 'velho', ready: true }), /Recarregue/);
  for (const player of [owner, guest]) await hub.command(player, { action: 'ready', contentHash: 'qa', ready: true });
  await hub.command(owner, { action: 'start' });
  assert.equal(hub.view(guest).status, 'playing');
  await hub.command(owner, { action: 'round-one' });
  const command = { kind: 'place', id: 'nanuk', x: 300, y: 250 };
  hub.relay(guest, { type: 'room/command', action: command });
  assert.deepEqual(sent.at(-1), [owner, { type: 'room/command', from: guest, action: command }]);
  const drops = [{ id: 1, owner }, { id: 2, owner: guest }];
  hub.relay(owner, { type: 'room/snapshot', state: { towers: [], enemies: [], drops } });
  assert.deepEqual(sent.at(-1)[1].state.drops, [drops[1]]);
  const count = sent.length;
  hub.relay(guest, { type: 'room/snapshot', state: { towers: [], enemies: [], drops } });
  assert.equal(sent.length, count);
  await hub.command(owner, { action: 'finish', victory: false, roundsCompleted: 0 });
  assert.equal(hub.view(guest).id, null);
  assert.equal(state.accounts[guest].progress.stats.losses, 1);
});
