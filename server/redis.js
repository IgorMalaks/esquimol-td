import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { initialStore, validateStore } from './store.js';

export function redisClient(url, token) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:') throw new Error('Redis requer HTTPS.');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function command(...args) {
    const response = await fetch(endpoint, {
      method: 'POST', headers, body: JSON.stringify(args),
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) throw new Error('Redis indisponível.');
    const data = await response.json();
    if (data.error) throw new Error('Comando Redis recusado.');
    return data.result;
  }
  async function subscribe(channel, { signal, onOpen, receive }) {
    const url = new URL(`/subscribe/${encodeURIComponent(channel)}`, endpoint);
    const response = await fetch(url, {
      method: 'POST', headers: { ...headers, Accept: 'text/event-stream' }, signal,
    });
    if (!response.ok || !response.body) throw new Error('Canal Redis indisponível.');
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let rest = '';
    const prefix = `message,${channel},`;
    const joined = `subscribe,${channel},`;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        rest += value;
        if (rest.length > 512_000) throw new Error('Evento Redis inválido.');
        const lines = rest.split('\n');
        rest = lines.pop();
        for (const source of lines) {
          if (!source.startsWith('data:')) continue;
          const line = source.slice(5).trim();
          if (line.startsWith(joined)) onOpen();
          if (line.startsWith(prefix)) {
            try { receive(JSON.parse(line.slice(prefix.length))); } catch { /* ignora eventos inválidos */ }
          }
        }
      }
    } finally {
      try { await reader.cancel(); } catch { /* conexão encerrada */ }
      reader.releaseLock();
    }
  }
  return { command, subscribe };
}

const FINISH = `
if redis.call("GET", KEYS[2]) ~= ARGV[1] then return 0 end
redis.call("SET", KEYS[1], ARGV[2])
redis.call("DEL", KEYS[2])
return 1`;
const RELEASE = `
if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end
return 0`;

export function sharedStore(redis, namespace) {
  const scope = new AsyncLocalStorage();
  const key = `${namespace}:data`;
  const lock = `${namespace}:lock`;
  let latest = initialStore();
  async function sync() {
    const raw = await redis.command('GET', key);
    const state = raw === null ? initialStore() : validateStore(JSON.parse(raw));
    latest = state;
    return state;
  }
  return {
    async run(work) {
      return scope.run({ state: await sync() }, work);
    },
    read(view = (data) => data) {
      return structuredClone(view(scope.getStore()?.state ?? latest));
    },
    async update(mutation) {
      const token = randomUUID();
      const until = Date.now() + 4500;
      while (await redis.command('SET', lock, token, 'NX', 'PX', 10_000) !== 'OK') {
        if (Date.now() >= until) throw new Error('Banco ocupado. Tente novamente.');
        await delay(45 + Math.random() * 90);
      }
      let committed = false;
      try {
        const next = await sync();
        const result = await mutation(next);
        validateStore(next);
        const written = await redis.command('EVAL', FINISH, 2, key, lock, token, JSON.stringify(next));
        if (Number(written) !== 1) throw new Error('A transação expirou antes de ser gravada.');
        committed = true;
        latest = next;
        if (scope.getStore()) scope.getStore().state = next;
        return structuredClone(result);
      } finally {
        if (!committed) await redis.command('EVAL', RELEASE, 1, lock, token).catch(() => {});
      }
    },
  };
}
