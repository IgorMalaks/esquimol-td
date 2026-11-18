import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDefaultData } from '../js/data/defaults.js';
import { prepareData } from '../js/data/gameData.js';
import { ensureProgress, fuseItems, recruitVariant, whoEquips } from '../js/core/progression.js';
import {
  accountKey, cookie, createSession, loginLimiter, passwordRecord, readCredentials, readSession, validPassword,
} from './auth.js';
import { openStore } from './store.js';
import { changeFriend, friendsView } from './friends.js';
import { httpError, jsonBody, sendJSON } from './http.js';
import { acceptSocket } from './ws.js';
import { beginMatch, finishMatch, secureRandom } from './matches.js';
import { importLocal, updateProfile } from './profile.js';
import { advanceTrades, affectedTrades, cancelTradesFor, changeTrade, reservedItem, tradeView } from './trade.js';
import { roomHub } from './rooms.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ASSET = /^\/(?:index\.html|(?:js|css|preview)\/(?:[\w-]+\/)*[\w.-]+\.(?:html|js|css))$/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const freshProgress = () => ({
  version: 2, unlocked: [], eskimos: {}, inventory: [], phases: {}, stats: { wins: 0, losses: 0, roundsTotal: 0 },
  fragments: {}, raidKeys: 0, legendaryPity: 0, activeAbilities: [null, null],
});
const publicAccount = ({ username, role, progress, createdAt, localImported }) =>
  ({ username, role, progress, createdAt, localImported: Boolean(localImported) });
const authorized = (data, session) => {
  const current = data.sessions[session.hash];
  if (!current || current.account !== session.id || current.expires <= Date.now()) {
    throw httpError(401, 'A sessão expirou.');
  }
  return data.accounts[session.id];
};

function contentSnapshot(data) {
  const content = data.content ?? createDefaultData();
  return { content, hash: createHash('sha256').update(JSON.stringify(content)).digest('hex') };
}

async function serveAsset(request, response, path) {
  if (request.method !== 'GET' && request.method !== 'HEAD') throw httpError(405, 'Método inválido.');
  const asset = path === '/' ? '/index.html' : path;
  if (!ASSET.test(asset)) throw httpError(404, 'Arquivo não encontrado.');
  let contents;
  try { contents = await readFile(resolve(ROOT, `.${asset}`)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; throw httpError(404, 'Arquivo não encontrado.'); }
  if (asset === '/index.html') {
    contents = Buffer.from(contents.toString('utf8').replace('<html lang="pt-BR">', '<html lang="pt-BR" data-backend="node">'));
  }
  response.writeHead(200, { 'Content-Type': TYPES[extname(asset)], 'Content-Length': contents.length });
  response.end(request.method === 'HEAD' ? undefined : contents);
}

export function createGameServer({ store, publicOrigin }) {
  const checkLogin = loginLimiter();
  const peers = new Map();
  const configuredURL = publicOrigin && new URL(publicOrigin);
  const secure = configuredURL?.protocol === 'https:';
  const expectedOrigin = (request) => {
    const host = request.headers.host;
    if (configuredURL) return configuredURL.origin;
    if (!/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host ?? '')) throw httpError(403, 'Host inválido.');
    return `http://${host}`;
  };
  const presence = (id) => {
    const connections = peers.get(id);
    if (!connections?.size) return 'offline';
    return [...connections].some((connection) => connection.playing) ? 'em partida' : 'online';
  };
  const present = (id) => presence(id) !== 'offline';
  const rooms = roomHub({ store, contentSnapshot, present, send: (id, message) => {
    for (const socket of peers.get(id) ?? []) socket.send(message);
  } });
  const broadcastFriends = () => {
    const roster = store.read();
    for (const [id, connections] of peers) {
      if (!Object.hasOwn(roster.accounts, id)) continue;
      const payload = { type: 'friends', ...friendsView(roster, id, presence) };
      for (const connection of connections) connection.send(payload);
    }
  };
  const disconnect = (hash) => {
    for (const connections of peers.values()) {
      for (const connection of connections) if (connection.session === hash) connection.close(1008);
    }
  };
  const broadcastTrades = () => {
    const data = store.read();
    const content = data.content ?? createDefaultData();
    for (const [id, connections] of peers) {
      if (!Object.hasOwn(data.accounts, id)) continue;
      const payload = tradeView(data, content, id);
      for (const connection of connections) connection.send(payload);
    }
  };
  let advancing = false;
  async function settleTrades() {
    if (advancing || !store.read((data) => affectedTrades(data, Date.now(), present))) return;
    advancing = true;
    try {
      await store.update((data) => advanceTrades(data, data.content ?? createDefaultData(), present));
      broadcastTrades();
    } catch (error) {
      console.error('Falha ao concluir trocas.', error.code ?? error.name);
    } finally {
      advancing = false;
    }
  }

  async function route(request, response) {
    const path = new URL(request.url, 'http://localhost').pathname;
    const method = request.method;
    const origin = expectedOrigin(request);
    if (['POST', 'PUT', 'DELETE'].includes(method) && request.headers.origin !== origin) {
      throw httpError(403, 'Origem não autorizada.');
    }
    if (!path.startsWith('/api/')) return serveAsset(request, response, path);
    if (method === 'GET' && path === '/api/health') return sendJSON(response, 200, { service: 'esquimo-td', status: 'ok' });
    if (method === 'GET' && path === '/api/content') return sendJSON(response, 200, store.read(contentSnapshot));

    if (method === 'POST' && (path === '/api/register' || path === '/api/login')) {
      const { username, password } = readCredentials(await jsonBody(request));
      const id = accountKey(username);
      checkLogin(request.socket.remoteAddress, username);
      let result;
      if (path === '/api/register') {
        const credentials = await passwordRecord(password);
        result = await store.update((data) => {
          if (Object.hasOwn(data.accounts, id)) throw httpError(409, 'Esse usuário já existe.');
          const account = { username, ...credentials, role: 'player', createdAt: new Date().toISOString(),
            progress: freshProgress(), friends: [], inbound: [], blocked: [] };
          ensureProgress(account, data.content ?? createDefaultData());
          data.accounts[id] = account;
          return { account: publicAccount(account), token: createSession(data, id) };
        });
      } else {
        const snapshot = store.read((data) => data.accounts[id]);
        if (!(await validPassword(snapshot, password))) throw httpError(401, 'Usuário ou senha inválidos.');
        result = await store.update((data) => {
          const account = data.accounts[id];
          if (!account || account.hash !== snapshot.hash) throw httpError(401, 'Usuário ou senha inválidos.');
          return { account: publicAccount(account), token: createSession(data, id) };
        });
      }
      return sendJSON(response, path === '/api/register' ? 201 : 200, result.account, { 'Set-Cookie': cookie(result.token, secure) });
    }

    const session = readSession(request, store);
    if (!session) throw httpError(401, 'Faça login para continuar.');
    if (method === 'GET' && path === '/api/me') return sendJSON(response, 200, publicAccount(session.account));
    if (method === 'GET' && path === '/api/inventory') return sendJSON(response, 200, session.account.progress.inventory);
    if (method === 'PUT' && path === '/api/profile') {
      const body = await jsonBody(request);
      const account = await store.update((data) => {
        const account = authorized(data, session);
        updateProfile(account, data.content ?? createDefaultData(), body);
        if (account.progress.inventory.some((it) => reservedItem(data, it.uid) && whoEquips(account, it.uid))) {
          throw httpError(409, 'Um item está reservado em uma troca.');
        }
        return publicAccount(account);
      });
      return sendJSON(response, 200, account);
    }
    if (method === 'POST' && path === '/api/import-local') {
      const body = await jsonBody(request, 2_000_000);
      const account = await store.update((data) => {
        const account = authorized(data, session);
        importLocal(account, data.content ?? createDefaultData(), body.progress);
        return publicAccount(account);
      });
      return sendJSON(response, 200, account);
    }
    if (method === 'GET' && path === '/api/me/export') {
      return sendJSON(response, 200, {
        ...publicAccount(session.account),
        ...store.read((data) => friendsView(data, session.id)),
      }, { 'Content-Disposition': 'attachment; filename="esquimo-dados.json"' });
    }
    if (method === 'DELETE' && path === '/api/me') {
      const { password } = readCredentials({ ...await jsonBody(request), username: session.account.username });
      checkLogin(request.socket.remoteAddress, session.account.username);
      if (!(await validPassword(session.account, password))) throw httpError(401, 'Senha inválida.');
      const hashes = await store.update((data) => {
        authorized(data, session);
        const removed = [];
        for (const [hash, stored] of Object.entries(data.sessions)) {
          if (stored.account !== session.id) continue;
          delete data.sessions[hash];
          removed.push(hash);
        }
        for (const account of Object.values(data.accounts)) {
          for (const key of ['friends', 'inbound', 'blocked']) account[key] = account[key].filter((id) => id !== session.id);
        }
        const anonymized = `deleted:${randomUUID()}`;
        for (const entry of data.history) {
          if (!entry.players?.includes(session.id)) continue;
          entry.players = entry.players.map((id) => id === session.id ? anonymized : id);
          entry.items[anonymized] = entry.items[session.id];
          delete entry.items[session.id];
        }
        cancelTradesFor(data, session.id);
        delete data.accounts[session.id];
        return removed;
      });
      for (const hash of hashes) disconnect(hash);
      broadcastFriends();
      broadcastTrades();
      return sendJSON(response, 200, { ok: true }, { 'Set-Cookie': cookie('', secure) });
    }
    if (method === 'POST' && path === '/api/logout') {
      await store.update((data) => { delete data.sessions[session.hash]; });
      disconnect(session.hash);
      return sendJSON(response, 200, { ok: true }, { 'Set-Cookie': cookie('', secure) });
    }
    if (path === '/api/friends') {
      if (method === 'POST') {
        const body = await jsonBody(request);
        await store.update((data) => {
          authorized(data, session);
          changeFriend(data, session.id, body);
        });
        broadcastFriends();
      } else if (method !== 'GET') throw httpError(405, 'Método inválido.');
      return sendJSON(response, 200, store.read((data) => friendsView(data, session.id, presence)));
    }
    if (path === '/api/trade') {
      if (method === 'POST') {
        const body = await jsonBody(request);
        await store.update((data) => {
          authorized(data, session);
          const content = data.content ?? createDefaultData();
          advanceTrades(data, content, present);
          changeTrade(data, content, session.id, body, present);
        });
        broadcastTrades();
      } else if (method !== 'GET') throw httpError(405, 'Método inválido.');
      return sendJSON(response, 200, store.read((data) => tradeView(data, data.content ?? createDefaultData(), session.id)));
    }
    if (path === '/api/rooms') {
      if (method === 'GET') return sendJSON(response, 200, rooms.view(session.id));
      if (method !== 'POST') throw httpError(405, 'Método inválido.');
      const body = await jsonBody(request);
      if (!readSession(request, store) || !present(session.id)) throw httpError(409, 'Conecte-se à sala para continuar.');
      return sendJSON(response, 200, await rooms.command(session.id, body));
    }
    if (method === 'POST' && path === '/api/match/start') {
      const body = await jsonBody(request);
      const match = await store.update((data) => beginMatch(authorized(data, session), contentSnapshot(data), body));
      return sendJSON(response, 200, match);
    }
    if (method === 'POST' && path === '/api/match/result') {
      const body = await jsonBody(request);
      const payload = await store.update((data) => {
        const account = authorized(data, session);
        const result = finishMatch(account, contentSnapshot(data), { ...body, interrupted: false });
        return { result, account: publicAccount(account) };
      });
      return sendJSON(response, 200, payload);
    }
    if (method === 'POST' && path === '/api/fusion') {
      const body = await jsonBody(request);
      if (!Array.isArray(body.uids) || body.uids.length !== 3 || body.uids.some((uid) => typeof uid !== 'string')) {
        throw httpError(400, 'Escolha três itens para fundir.');
      }
      const payload = await store.update((data) => {
        const account = authorized(data, session);
        if (body.uids.some((uid) => reservedItem(data, uid))) throw httpError(409, 'Um item está reservado em uma troca.');
        try {
          const result = fuseItems(account, body.uids, secureRandom, {
            data: data.content ?? createDefaultData(), persist: () => {}, origin: 'server',
          });
          return { result, account: publicAccount(account) };
        } catch (error) { throw httpError(400, error.message); }
      });
      return sendJSON(response, 200, payload);
    }
    if (method === 'POST' && path === '/api/recruit') {
      const { id } = await jsonBody(request);
      const payload = await store.update((data) => {
        const account = authorized(data, session);
        try { recruitVariant(account, id, { data: data.content ?? createDefaultData(), persist: () => {} }); }
        catch (error) { throw httpError(400, error.message); }
        return { account: publicAccount(account) };
      });
      return sendJSON(response, 200, payload);
    }
    if (method === 'GET' && path === '/api/ranking/infinite') {
      const params = new URL(request.url, 'http://localhost').searchParams;
      const biome = params.get('biome');
      const ranking = store.read(({ accounts }) => {
        const entries = [session.id, ...accounts[session.id].friends].map((id) => accounts[id]).filter(Boolean);
        const order = (left, right) => right.melhorWave - left.melhorWave || left.duracaoSeg - right.duracaoSeg;
        const collect = (best, byBiome) => entries.flatMap((account) => {
          const record = biome ? account.progress[byBiome]?.[biome] : account.progress[best];
          return record ? [{ username: account.username, ...record }] : [];
        }).sort(order);
        const solo = collect('endlessBest', 'endlessByBiome');
        const coop = [...new Map(collect('endlessCoopBest', 'endlessCoopByBiome').map((entry) => [entry.seed, entry])).values()];
        return { solo, coop };
      });
      return sendJSON(response, 200, ranking);
    }
    if (method === 'PUT' && path === '/api/admin/content') {
      if (session.account.role !== 'admin') throw httpError(403, 'Apenas administradores podem editar o conteúdo.');
      const body = await jsonBody(request, 2_000_000);
      let content;
      try { content = prepareData(body); } catch (error) { throw httpError(400, error.message); }
      const snapshot = await store.update((data) => {
        if (authorized(data, session).role !== 'admin') throw httpError(403, 'Acesso administrativo revogado.');
        data.content = content;
        return contentSnapshot(data);
      });
      return sendJSON(response, 200, snapshot);
    }
    throw httpError(404, 'Rota não encontrada.');
  }

  const server = createServer({ requestTimeout: 15_000, maxHeaderSize: 8192 }, (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    route(request, response).catch((error) => {
      if (response.headersSent) { response.destroy(); return; }
      const status = error.status ?? 500;
      if (status === 500) console.error('Falha interna do servidor.', error.code ?? error.name);
      sendJSON(response, status, { error: status < 500 ? error.message : 'Falha interna do servidor.' });
    });
  });
  const tradeTimer = setInterval(settleTrades, 500);
  tradeTimer.unref();
  server.once('close', () => clearInterval(tradeTimer));
  server.on('upgrade', (request, socket, head) => {
    let session;
    try {
      if (request.url === '/ws' && request.headers.origin === expectedOrigin(request)) {
        session = readSession(request, store);
      }
    } catch { /* requisição sem origem válida */ }
    if (!session) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const connections = peers.get(session.id) ?? new Set();
    if (connections.size >= 4) { socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return; }
    const connection = acceptSocket(request, socket, head, {
      onMessage(payload) {
        const valid = store.read((data) => data.sessions[session.hash]?.account === session.id &&
          data.sessions[session.hash].expires > Date.now());
        if (!valid) { connection.close(1008); return; }
        let message;
        try { message = JSON.parse(payload); } catch { connection.close(1007); return; }
        if (typeof message?.type === 'string' && message.type.startsWith('room/')) rooms.relay(session.id, message);
        if (message?.type === 'presence' && typeof message.playing === 'boolean' &&
            message.playing !== connection.playing && Date.now() - (connection.lastPresence ?? 0) >= 1000) {
          connection.playing = message.playing;
          connection.lastPresence = Date.now();
          broadcastFriends();
        }
      },
      onClose() {
        connections.delete(connection);
        if (!connections.size) peers.delete(session.id);
        broadcastFriends();
        void settleTrades();
        rooms.disconnected(session.id);
      },
    });
    if (!connection) return;
    connection.session = session.hash;
    connection.playing = false;
    connections.add(connection);
    peers.set(session.id, connections);
    broadcastFriends();
    connection.send(store.read((data) => tradeView(data, data.content ?? createDefaultData(), session.id)));
    rooms.connection(session.id);
  });
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const host = process.env.ETD_HOST ?? '127.0.0.1';
  const port = Number(process.env.ETD_PORT ?? 5173);
  const publicOrigin = process.env.ETD_ORIGIN;
  if (!['127.0.0.1', 'localhost'].includes(host) && (!publicOrigin || new URL(publicOrigin).protocol !== 'https:')) {
    throw new Error('Defina ETD_ORIGIN como a origem HTTPS antes de expor o servidor.');
  }
  const store = await openStore(process.env.ETD_DATA_FILE ?? 'var/esquimo.json');
  prepareData(store.read((data) => data.content) ?? createDefaultData());
  const server = createGameServer({ store, publicOrigin });
  server.listen(port, host, () => console.log(`Esquimó TD em ${publicOrigin ?? `http://${host}:${port}`}`));
  const backup = () => store.backup().catch((error) => console.error('Falha no backup do servidor.', error.code ?? error.name));
  await backup();
  setInterval(backup, 12 * 60 * 60 * 1000).unref();
}
