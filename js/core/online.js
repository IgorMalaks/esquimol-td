import { toast } from './utils.js';

let account = null;
let profileQueue = Promise.resolve();
let socket = null;
let playing = false;
let contentHash = null;
const listeners = new Set();
export const isOnline = () => globalThis.document?.documentElement.dataset.backend === 'node';
export const onlineAccount = () => structuredClone(account);
export const currentContentHash = () => contentHash;
export function setContentHash(hash) { contentHash = hash; }

export async function requestAPI(path, { method = 'GET', body, anonymous = false } = {}) {
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (anonymous && response.status === 401) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível falar com o servidor.');
  return result;
}

export function cacheAccount(next) {
  if (isOnline() && account?.username !== next?.username) {
    socket?.close();
    socket = null;
    playing = false;
    if (next) connect();
  }
  account = structuredClone(next);
  return onlineAccount();
}

function connect() {
  const url = new URL('/ws', location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const peer = new WebSocket(url);
  socket = peer;
  peer.addEventListener('open', () => setPresence(playing));
  peer.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    for (const listener of [...listeners]) if (listeners.has(listener)) listener(message);
  });
  peer.addEventListener('close', () => {
    if (socket !== peer) return;
    socket = null;
    setTimeout(() => { if (account && !socket) connect(); }, 3000);
  });
}

export function setPresence(value) {
  playing = value;
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'presence', playing }));
}

export function subscribeOnline(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function sendOnline(message) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

export function queueProfile(updated) {
  const snapshot = structuredClone(updated);
  cacheAccount(snapshot);
  profileQueue = profileQueue.then(() => requestAPI('/profile', {
    method: 'PUT',
    body: {
      eskimos: snapshot.progress.eskimos,
      activeAbilities: snapshot.progress.activeAbilities,
      fragmentTargets: snapshot.progress.fragmentTargets,
      tutorialDone: snapshot.progress.tutorialDone,
    },
  })).catch((error) => {
    toast(error.message, 'error');
  });
}

export async function accountAction(path, body) {
  await profileQueue;
  const data = await requestAPI(path, { method: 'POST', body });
  if (data.account) cacheAccount(data.account);
  return data;
}
