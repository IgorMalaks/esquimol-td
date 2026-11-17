// Autenticação local (ADR-003 / ADR-004).
// ATENÇÃO: tudo roda no cliente. PBKDF2 evita senha em texto puro no localStorage,
// mas NÃO é controle de acesso real — quem tem o navegador tem os dados.
import { storage } from './storage.js';

const ITERATIONS = 120000;
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ADMIN_SESSION = 'etd.adminSession';

export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

function requireCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Abra o jogo via http://localhost (crypto indisponível fora de contexto seguro).');
  }
}

async function hash(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}

const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
const accounts = () => storage.get('accounts', {});

export function getAccount(username) {
  return accounts()[String(username).toLowerCase()] || null;
}

export function saveAccount(acc) {
  const all = accounts();
  all[acc.username.toLowerCase()] = acc;
  storage.set('accounts', all);
}

export async function register(username, password) {
  requireCrypto();
  username = username.trim();
  if (!USERNAME_RE.test(username)) throw new Error('Usuário: 3 a 20 caracteres (letras, números, _ . -).');
  if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  if (getAccount(username)) throw new Error('Esse usuário já existe.');
  const salt = newSalt();
  const acc = { username, salt, hash: await hash(password, salt), createdAt: new Date().toISOString(), progress: null };
  saveAccount(acc);
  storage.set('session', { username: acc.username });
  return acc;
}

export async function login(username, password) {
  requireCrypto();
  const acc = getAccount(username.trim());
  const fail = new Error('Usuário ou senha inválidos.');
  if (!acc) throw fail;
  if ((await hash(password, acc.salt)) !== acc.hash) throw fail;
  storage.set('session', { username: acc.username });
  return acc;
}

export function currentAccount() {
  const s = storage.get('session');
  return s ? getAccount(s.username) : null;
}

export function logout() {
  storage.remove('session');
}

// ---------- Admin ----------
export const adminConfigured = () => !!storage.get('admin');
export const isAdminSession = () => sessionStorage.getItem(ADMIN_SESSION) === '1';
export const adminLogout = () => sessionStorage.removeItem(ADMIN_SESSION);

export async function adminSetup(password) {
  requireCrypto();
  if (adminConfigured()) throw new Error('Admin já configurado.');
  if (password.length < 8) throw new Error('A senha de admin precisa ter pelo menos 8 caracteres.');
  const salt = newSalt();
  storage.set('admin', { salt, hash: await hash(password, salt) });
  sessionStorage.setItem(ADMIN_SESSION, '1');
}

export async function adminLogin(password) {
  requireCrypto();
  const cfg = storage.get('admin');
  if (!cfg) throw new Error('Admin ainda não configurado.');
  if ((await hash(password, cfg.salt)) !== cfg.hash) throw new Error('Senha incorreta.');
  sessionStorage.setItem(ADMIN_SESSION, '1');
}

export async function adminChangePassword(current, next) {
  await adminLogin(current);
  if (next.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
  const salt = newSalt();
  storage.set('admin', { salt, hash: await hash(next, salt) });
}
