import { accountKey } from './auth.js';
import { httpError } from './http.js';

const MAX_FRIENDS = 100;
const MAX_REQUESTS = 20;

export function friendsView(data, accountId, presence = () => 'offline') {
  const account = data.accounts[accountId];
  const describe = (id) => data.accounts[id]?.username;
  return {
    friends: account.friends.filter(describe).map((id) => ({ username: describe(id), presence: presence(id) })),
    inbound: account.inbound.map(describe).filter(Boolean),
    blocked: account.blocked.map(describe).filter(Boolean),
  };
}

export function changeFriend(data, accountId, { username, action }) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,20}$/.test(username)) {
    throw httpError(400, 'Usuário inválido.');
  }
  const otherId = accountKey(username);
  const current = data.accounts[accountId];
  const other = data.accounts[otherId];
  if (!other || current === other || (other.blocked.includes(accountId) && action !== 'block')) {
    throw httpError(404, 'Jogador indisponível.');
  }
  const remove = (items, id) => items.filter((entry) => entry !== id);
  switch (action) {
    case 'request':
      if (current.blocked.includes(otherId) || current.friends.includes(otherId)) throw httpError(409, 'Pedido indisponível.');
      if (other.inbound.includes(accountId)) return;
      if (other.inbound.length >= MAX_REQUESTS ||
          Object.values(data.accounts).filter((account) => account.inbound.includes(accountId)).length >= MAX_REQUESTS) {
        throw httpError(409, 'Limite de pedidos pendentes atingido.');
      }
      other.inbound.push(accountId);
      break;
    case 'accept':
      if (!current.inbound.includes(otherId)) throw httpError(409, 'Pedido indisponível.');
      if (current.friends.length >= MAX_FRIENDS || other.friends.length >= MAX_FRIENDS) {
        throw httpError(409, 'Limite de amigos atingido.');
      }
      current.inbound = remove(current.inbound, otherId);
      other.inbound = remove(other.inbound, accountId);
      current.friends.push(otherId);
      other.friends.push(accountId);
      break;
    case 'decline':
      current.inbound = remove(current.inbound, otherId);
      break;
    case 'remove':
    case 'block':
      current.friends = remove(current.friends, otherId);
      other.friends = remove(other.friends, accountId);
      current.inbound = remove(current.inbound, otherId);
      other.inbound = remove(other.inbound, accountId);
      if (action === 'block' && !current.blocked.includes(otherId)) current.blocked.push(otherId);
      break;
    case 'unblock':
      current.blocked = remove(current.blocked, otherId);
      break;
    default:
      throw httpError(400, 'Ação de amizade inválida.');
  }
}
