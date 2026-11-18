import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const fresh = () => ({ version: 1, accounts: {}, sessions: {}, content: null, history: [] });
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);

export function validateStore(data) {
  if (data?.version !== 1 || !record(data.accounts) || !record(data.sessions) ||
      !Array.isArray(data.history) || (data.content !== null && !record(data.content))) {
    throw new Error('O arquivo do servidor tem um esquema inválido.');
  }
  for (const [id, account] of Object.entries(data.accounts)) {
    if (!/^u:[a-z0-9_.-]{3,20}$/.test(id) || typeof account.username !== 'string' ||
        id !== `u:${account.username.toLowerCase()}` || !['admin', 'player'].includes(account.role) ||
        typeof account.salt !== 'string' || Buffer.from(account.salt, 'base64').length !== 16 ||
        typeof account.hash !== 'string' || Buffer.from(account.hash, 'base64').length !== 32 ||
        !record(account.progress) || ['friends', 'inbound', 'blocked'].some((key) => !Array.isArray(account[key]))) {
      throw new Error('O arquivo do servidor tem uma conta inválida.');
    }
  }
  for (const [hash, session] of Object.entries(data.sessions)) {
    if (!/^[a-f0-9]{64}$/.test(hash) || !Object.hasOwn(data.accounts, session?.account) ||
        !Number.isFinite(session.expires)) throw new Error('O arquivo do servidor tem uma sessão inválida.');
  }
  return data;
}

async function writeAtomic(filename, data) {
  const directory = dirname(filename);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${basename(filename)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(data), { encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true });
    await rename(temporary, filename);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function openStore(path) {
  const filename = resolve(path);
  let state;
  try {
    state = validateStore(JSON.parse(await readFile(filename, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = fresh();
    await writeAtomic(filename, state);
  }
  let queue = Promise.resolve();
  function serialize(work) {
    const updated = queue.then(work);
    queue = updated.catch(() => {});
    return updated;
  }
  return {
    read: (view = (data) => data) => structuredClone(view(state)),
    update(mutation) {
      return serialize(async () => {
        const next = structuredClone(state);
        const result = mutation(next);
        if (result?.then) throw new Error('As transações do repositório precisam ser síncronas.');
        validateStore(next);
        await writeAtomic(filename, next);
        state = next;
        return structuredClone(result);
      });
    },
    backup(at = new Date()) {
      return serialize(async () => {
        const folder = join(dirname(filename), 'backups');
        const name = `data-${at.toISOString().slice(0, 10)}.json`;
        const backupPath = join(folder, name);
        await writeAtomic(backupPath, state);
        const backups = (await readdir(folder)).filter((entry) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(entry)).sort();
        for (const old of backups.slice(0, -7)) await rm(join(folder, old), { force: true });
        return backupPath;
      });
    },
  };
}

export async function restoreBackup(source, destination) {
  const next = validateStore(JSON.parse(await readFile(source, 'utf8')));
  const filename = resolve(destination);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, JSON.stringify(next), { encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true });
}
