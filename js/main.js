import { registerScreen, go } from './core/router.js';
import { currentAccount } from './core/auth.js';
import { getData, useServerContent } from './data/gameData.js';
import { applyPreferences } from './core/preferences.js';
import { cacheAccount, isOnline, requestAPI, setContentHash, subscribeOnline } from './core/online.js';
import { el, toast } from './core/utils.js';
import { loginScreen, adminLoginScreen } from './screens/loginScreen.js';
import { menuScreen } from './screens/menuScreen.js';
import { gameScreen } from './screens/gameScreen.js';
import { adminScreen } from './screens/adminScreen.js';
import { multiplayerScreen } from './screens/multiplayerScreen.js';

registerScreen('login', loginScreen);
registerScreen('adminLogin', adminLoginScreen);
registerScreen('admin', adminScreen);
registerScreen('menu', menuScreen);
registerScreen('game', gameScreen);
registerScreen('multiplayer', multiplayerScreen);

applyPreferences();
try {
  const wantsCoop = new URLSearchParams(location.search).get('modo') === 'coop';
  if (wantsCoop && !isOnline()) {
    try {
      const response = await fetch('/api/health', { signal: AbortSignal.timeout(7000) });
      const health = response.ok && await response.json();
      if (health?.service === 'esquimo-td' && health.status === 'ok') document.documentElement.dataset.backend = 'cloud';
    } catch { /* mantém o modo solo se o multiplayer estiver indisponível */ }
  }
  if (isOnline()) {
    const [data, account] = await Promise.all([requestAPI('/content'), requestAPI('/me', { anonymous: true })]);
    useServerContent(data.content);
    setContentHash(data.hash);
    cacheAccount(account);
    subscribeOnline((message) => {
      const app = document.getElementById('app');
      if (message.type === 'room/start' && app.dataset.room !== message.room.id) {
        go('game', {
          phaseId: message.room.phaseId, coop: message,
          endless: message.room.mode === 'endless',
          biomeId: message.room.mode === 'endless' ? message.room.target : undefined,
          raidId: message.room.mode === 'raid' ? message.room.target : undefined,
        });
      }
      if (message.type === 'room/closed' && app.dataset.room) {
        go('menu', { tab: 'online' });
        toast(message.message, 'info');
      }
    });
  } else getData();
  if (wantsCoop && !isOnline()) go('multiplayer');
  else go(currentAccount() ? 'menu' : 'login', wantsCoop ? { tab: 'online' } : {});
} catch (error) {
  document.getElementById('app').append(el('main', { class: 'card' },
    el('h1', { text: 'Não foi possível abrir o jogo' }), el('p', { text: error.message }),
    el('button', { class: 'btn', text: 'Tentar de novo', onclick: () => location.reload() })));
}
