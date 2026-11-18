import { createHash, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { httpError } from './http.js';

const scrypt = promisify(derive);
const OPTIONS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const COOKIE = 'etd_session';
const WEEK = 7 * 24 * 60 * 60;
const USERNAME = /^[a-zA-Z0-9_.-]{3,20}$/;
const FALLBACK_SALT = randomBytes(16);
const FALLBACK_HASH = randomBytes(32);
const digest = (token) => createHash('sha256').update(token).digest('hex');
export const accountKey = (username) => `u:${username.toLowerCase()}`;

export function readCredentials(body) {
  const username = body.username?.trim?.();
  if (typeof username !== 'string' || !USERNAME.test(username) || typeof body.password !== 'string' ||
      body.password.length < 6 || body.password.length > 128) {
    throw httpError(400, 'Use um usuário de 3 a 20 caracteres e uma senha de 6 a 128 caracteres.');
  }
  return { username, password: body.password };
}

export async function passwordRecord(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, OPTIONS);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export async function validPassword(account, password) {
  const salt = account ? Buffer.from(account.salt, 'base64') : FALLBACK_SALT;
  const expected = account ? Buffer.from(account.hash, 'base64') : FALLBACK_HASH;
  const actual = await scrypt(password, salt, 32, OPTIONS);
  return expected.length === actual.length && timingSafeEqual(actual, expected) && Boolean(account);
}

export function sessionHash(request) {
  const value = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? digest(value) : null;
}

export function readSession(request, store) {
  const hash = sessionHash(request);
  if (!hash) return null;
  return store.read((data) => {
    const session = data.sessions[hash];
    if (!session || session.expires <= Date.now()) return null;
    const account = data.accounts[session.account];
    return account ? { hash, id: session.account, account } : null;
  });
}

export function createSession(data, accountId) {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  for (const [key, session] of Object.entries(data.sessions)) {
    if (session.expires <= now) delete data.sessions[key];
  }
  data.sessions[digest(token)] = { account: accountId, expires: now + WEEK * 1000 };
  return token;
}

export function cookie(token, secure) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? WEEK : 0}${secure ? '; Secure' : ''}`;
}

export function loginLimiter() {
  const attempts = new Map();
  return (address, username) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    const key = `${address}/${username.toLowerCase()}`;
    const window = attempts.get(key) ?? { count: 0, expires: now + 60_000 };
    if (window.count >= 5 || (!attempts.has(key) && attempts.size >= 5000)) {
      throw httpError(429, 'Aguarde um minuto antes de tentar novamente.');
    }
    window.count++;
    attempts.set(key, window);
  };
}
