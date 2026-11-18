import { createServer } from 'node:http';
import { createGameServer } from '../server/index.js';
import { sendJSON } from '../server/http.js';
import { redisClient, sharedStore } from '../server/redis.js';

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const origin = process.env.ETD_ORIGIN ?? (host ? `https://${host}` : null);
const namespace = 'esquimo-td:v1';

function buildServer() {
  if (url && token && origin) {
    const redis = redisClient(url, token);
    return createGameServer({ publicOrigin: origin, store: sharedStore(redis, namespace), cluster: { redis, namespace } });
  }
  return createServer((request, response) => {
    const target = new URL(request.url, 'http://localhost');
    if (target.pathname === '/api/health' || target.searchParams.get('etdPath') === 'health') {
      sendJSON(response, 200, { service: 'esquimo-td', status: 'unavailable' });
    } else sendJSON(response, 503, { error: 'Servidor multiplayer indisponível.' });
  })
    .on('upgrade', (_request, socket) => socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'));
}

export default buildServer();
