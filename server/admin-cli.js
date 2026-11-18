import { accountKey } from './auth.js';
import { openStore, restoreBackup } from './store.js';

const [operation, argument, destination] = process.argv.slice(2);
const filename = process.env.ETD_DATA_FILE ?? 'var/esquimo.json';

if (operation === 'restore' && argument && destination) {
  await restoreBackup(argument, destination);
  console.log('Backup validado e restaurado em um novo arquivo.');
} else if (operation === 'promote' && /^[A-Za-z0-9_.-]{3,20}$/.test(argument ?? '')) {
  const store = await openStore(filename);
  await store.update((data) => {
    const account = data.accounts[accountKey(argument)];
    if (!account) throw new Error('Conta não encontrada.');
    account.role = 'admin';
  });
  console.log('Conta promovida.');
} else {
  console.error('Uso: node server/admin-cli.js promote <usuário> | restore <backup> <novo-arquivo>');
  process.exitCode = 1;
}
