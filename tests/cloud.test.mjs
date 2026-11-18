import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createGameServer } from '../server/index.js';
import { sharedStore } from '../server/redis.js';

function memoryRedis() {
  const values = new Map();
  const subscribers = new Map();
  return {
    async command(action, ...args) {
      if (action === 'GET') return values.get(args[0]) ?? null;
      if (action === 'SET') {
        if (args[2] === 'NX' && values.has(args[0])) return null;
        values.set(args[0], args[1]);
        return 'OK';
      }
      if (action === 'EVAL') {
        const [, keys, first, second, token, state] = args;
        if (keys === 2) {
          if (values.get(second) !== token) return 0;
          values.set(first, state);
          values.delete(second);
          return 1;
        }
        return Number(values.get(first) === second && values.delete(first));
      }
      if (action === 'PUBLISH') {
        const listeners = [...(subscribers.get(args[0]) ?? [])];
        for (const receive of listeners) queueMicrotask(() => receive(JSON.parse(args[1])));
        return listeners.length;
      }
      throw new Error(`Comando inesperado: ${action}`);
    },
    async subscribe(channel, { signal, onOpen, receive }) {
      if (signal.aborted) return;
      if (!subscribers.has(channel)) subscribers.set(channel, new Set());
      const listeners = subscribers.get(channel);
      listeners.add(receive);
      onOpen();
      try { await once(signal, 'abort'); }
      finally { listeners.delete(receive); }
    },
  };
}

async function connect(origin, cookie) {
  const { socket, head } = await new Promise((resolve, reject) => {
    const req = httpRequest(origin + '/ws', { signal: AbortSignal.timeout(4000), headers: {
      Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': randomBytes(16).toString('base64'), Origin: origin, Cookie: cookie,
    } });
    req.once('upgrade', (_response, socket, head) => resolve({ socket, head }));
    req.once('response', (response) => reject(new Error(`Upgrade HTTP ${response.statusCode}`)));
    req.once('error', reject);
    req.end();
  });
  const messages = [];
  let pending = Buffer.alloc(0);
  function append(bytes) {
    pending = Buffer.concat([pending, bytes]);
    while (pending.length >= 2) {
      const type = pending[0] & 15;
      const count = pending[1] & 127;
      const offset = count < 126 ? 2 : count === 126 ? 4 : 10;
      if (pending.length < offset) break;
      const length = count < 126 ? count : count === 126 ? pending.readUInt16BE(2) : Number(pending.readBigUInt64BE(2));
      if (pending.length < offset + length) break;
      if (type === 1) messages.push(JSON.parse(pending.subarray(offset, offset + length).toString('utf8')));
      pending = pending.subarray(offset + length);
    }
  }
  socket.on('data', append);
  socket.on('error', () => {});
  if (head.length) append(head);
  return {
    close: () => socket.destroy(),
    send(value) {
      const payload = Buffer.from(JSON.stringify(value));
      assert.ok(payload.length < 126);
      const mask = randomBytes(4);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      socket.write(Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, payload]));
    },
    async waitFor(predicate) {
      for (let i = 0; i < 80; i++) {
        const match = messages.find(predicate);
        if (match) return match;
        await delay(25);
      }
      assert.fail('Evento WebSocket não recebido.');
    },
  };
}

test('duas instâncias preservam as gravações concorrentes no Redis', async () => {
  const redis = memoryRedis();
  const a = sharedStore(redis, 'atomic');
  const b = sharedStore(redis, 'atomic');
  await Promise.all([a.update((data) => data.history.push('A')), b.update((data) => data.history.push('B'))]);
  assert.deepEqual(await a.run(() => a.read((state) => [...state.history].sort())), ['A', 'B']);
  await assert.rejects(a.update((data) => { data.version = 15; }), /esquema/);
  assert.equal(await b.run(() => b.read((state) => state.version)), 1);
});

test('convidado e dono em funções separadas compartilham sala, comandos e resultado', { timeout: 15_000 }, async (context) => {
  const redis = memoryRedis();
  const namespace = 'cloud-qa';
  const servers = [0, 1].map(() => createGameServer({ cluster: { redis, namespace }, store: sharedStore(redis, namespace) }));
  const sockets = [];
  const transports = new Set();
  for (const server of servers) server.on('connection', (socket) => {
    transports.add(socket);
    socket.once('close', () => transports.delete(socket));
  });
  context.after(async () => {
    for (const socket of sockets) socket.close();
    for (const transport of transports) transport.destroy();
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });
  for (const server of servers) server.listen(0, '127.0.0.1');
  await Promise.all(servers.map((server) => once(server, 'listening')));

  async function actor(server, username) {
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function call(path, body, cookie) {
      const response = await fetch(origin + path, {
        signal: AbortSignal.timeout(4000),
        method: body ? 'POST' : 'GET',
        headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${path}: ${await response.text()}`);
      return response;
    }
    const login = await call('/api/register', { username, password: 'somente-teste-45' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const socket = await connect(origin, cookie);
    sockets.push(socket);
    await socket.waitFor((message) => message.type === 'room');
    return { socket, request: async (path, body) => (await call(path, body, cookie)).json() };
  }
  const [owner, guest] = await Promise.all([actor(servers[0], 'DonoQa'), actor(servers[1], 'VisitaQa')]);
  await owner.request('/api/friends', { action: 'request', username: 'VisitaQa' });
  await guest.request('/api/friends', { action: 'accept', username: 'DonoQa' });
  const room = await owner.request('/api/etd?etdPath=rooms', { action: 'create', mode: 'phase', target: 'fase1' });
  await owner.request('/api/rooms', { action: 'invite', username: 'VisitaQa' });
  await guest.socket.waitFor((message) => message.type === 'room' && message.room.invitations.some((entry) => entry.id === room.id));
  await guest.request('/api/rooms', { action: 'join', id: room.id });
  for (const player of [owner, guest]) await player.request('/api/rooms', { action: 'ready', ready: true, contentHash: room.contentHash });
  await owner.request('/api/rooms', { action: 'start' });
  await Promise.all([owner, guest].map((p) => p.socket.waitFor((event) => event.type === 'room/start')));
  await owner.request('/api/rooms', { action: 'round-one' });
  guest.socket.send({ type: 'room/command', action: { kind: 'place', id: 'nanuk', x: 300, y: 255 } });
  assert.equal((await owner.socket.waitFor((message) => message.type === 'room/command')).from, 'u:visitaqa');
  owner.socket.send({ type: 'room/snapshot', state: { towers: [], enemies: [], drops: [] } });
  await guest.socket.waitFor((message) => message.type === 'room/snapshot');
  await owner.request('/api/rooms', { action: 'finish', victory: false, roundsCompleted: 0 });
  const result = await guest.socket.waitFor((message) => message.type === 'room/result');
  assert.equal(result.progress.stats.losses, 1);
});
