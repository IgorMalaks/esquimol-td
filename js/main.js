import { registerScreen, go } from './core/router.js';
import { currentAccount } from './core/auth.js';
import { getData } from './data/gameData.js';
import { applyPreferences } from './core/preferences.js';
import { loginScreen, adminLoginScreen } from './screens/loginScreen.js';
import { menuScreen } from './screens/menuScreen.js';
import { gameScreen } from './screens/gameScreen.js';
import { adminScreen } from './screens/adminScreen.js';

registerScreen('login', loginScreen);
registerScreen('adminLogin', adminLoginScreen);
registerScreen('admin', adminScreen);
registerScreen('menu', menuScreen);
registerScreen('game', gameScreen);

getData();
applyPreferences();
go(currentAccount() ? 'menu' : 'login');
