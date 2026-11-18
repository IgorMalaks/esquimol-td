import { randomUUID } from 'node:crypto';
import { byId } from '../js/data/gameData.js';
import { whoEquips } from '../js/core/progression.js';
import { accountKey } from './auth.js';
import { httpError } from './http.js';

const TIMEOUT = 5 * 60 * 1000;
const ACTIVE = new Set(['invite', 'open', 'countdown']);
const trading = (data) => Object.values(data.trades ?? {});
const name = (data, id) => data.accounts[id]?.username ?? 'Conta removida';

export function reservedItem(data, uid, except) {
  return trading(data).some((trade) => trade.id !== except && ACTIVE.has(trade.status) &&
    Object.values(trade.offers).some((items) => items.includes(uid)));
}

function itemFrom(data, content, owner, uid, tradeId) {
  const account = data.accounts[owner];
  const instance = account?.progress.inventory.find((item) => item.uid === uid);
  const item = instance && byId(content.items, instance.itemId);
  const tradable = item && (content.economy?.tradable?.[item.rarity] ?? item.rarity !== 'mitico');
  if (!tradable || instance.origin !== 'server' || whoEquips(account, uid) || reservedItem(data, uid, tradeId)) {
    throw httpError(409, 'Item indisponível para troca.');
  }
  return instance;
}

export function tradeView(data, content, player) {
  return {
    type: 'trade',
    trades: trading(data).filter((trade) => ACTIVE.has(trade.status) && trade.players.includes(player)).map((trade) => {
      const partner = trade.players.find((id) => id !== player);
      const offered = (id) => trade.offers[id].flatMap((uid) => {
        const instance = data.accounts[id]?.progress.inventory.find((item) => item.uid === uid);
        const item = instance && byId(content.items, instance.itemId);
        return item ? [{ uid, name: item.name, rarity: item.rarity }] : [];
      });
      return {
        id: trade.id, status: trade.status, partner: name(data, partner), incoming: trade.players[1] === player,
        mine: offered(player), theirs: offered(partner), confirmed: Boolean(trade.confirmed[player]),
        partnerConfirmed: Boolean(trade.confirmed[partner]), executeAt: trade.executeAt,
        available: data.accounts[player].progress.inventory.flatMap((instance) => {
          try {
            itemFrom(data, content, player, instance.uid, trade.id);
            const item = byId(content.items, instance.itemId);
            return [{ uid: instance.uid, name: item.name, rarity: item.rarity }];
          } catch { return []; }
        }),
      };
    }),
    history: data.history.filter((entry) => entry.players?.includes(player)).slice(-20).reverse().map((entry) => ({
      id: entry.id, when: entry.when, partner: name(data, entry.players.find((id) => id !== player)),
      sent: entry.items[player], received: entry.items[entry.players.find((id) => id !== player)],
    })),
  };
}

export function cancelTradesFor(data, player) {
  let changed = false;
  for (const trade of trading(data)) {
    if (!ACTIVE.has(trade.status) || !trade.players.includes(player)) continue;
    trade.status = 'cancelled';
    changed = true;
  }
  return changed;
}

export function changeTrade(data, content, player, command, present, now = Date.now()) {
  data.trades ??= {};
  const { action, id } = command;
  const account = data.accounts[player];
  if (action === 'invite') {
    const partner = typeof command.username === 'string' && /^[a-zA-Z0-9_.-]{3,20}$/.test(command.username) ?
      accountKey(command.username) : null;
    if (!partner || !account.friends.includes(partner) || !present(partner) || !present(player)) {
      throw httpError(403, 'A troca exige um amigo online.');
    }
    if (trading(data).some((entry) => ACTIVE.has(entry.status) &&
        entry.players.some((id) => id === player || id === partner))) throw httpError(409, 'Já existe uma troca em andamento.');
    const trade = { id: randomUUID(), players: [player, partner], offers: { [player]: [], [partner]: [] },
      status: 'invite', confirmed: {}, executeAt: null, updatedAt: now };
    data.trades[trade.id] = trade;
    return trade;
  }
  const trade = typeof id === 'string' && Object.hasOwn(data.trades, id) ? data.trades[id] : null;
  if (!trade || !trade.players.includes(player)) throw httpError(404, 'Troca indisponível.');
  if (!ACTIVE.has(trade.status) || trade.updatedAt + TIMEOUT < now || trade.players.some((id) => !present(id))) {
    throw httpError(409, 'A troca já encerrou.');
  }
  if (action === 'cancel') trade.status = 'cancelled';
  else if (action === 'accept' && trade.status === 'invite' && trade.players[1] === player) trade.status = 'open';
  else if (action === 'offer' && trade.status !== 'invite') {
    const { uids } = command;
    if (!Array.isArray(uids) || uids.length > 6 || new Set(uids).size !== uids.length ||
        uids.some((uid) => typeof uid !== 'string')) throw httpError(400, 'Escolha até seis itens diferentes.');
    for (const uid of uids) itemFrom(data, content, player, uid, trade.id);
    trade.offers[player] = uids;
    trade.confirmed = {};
    trade.executeAt = null;
    trade.status = 'open';
  } else if (action === 'confirm' && trade.status === 'open') {
    if (!Object.values(trade.offers).some((items) => items.length)) throw httpError(400, 'Inclua pelo menos um item.');
    trade.confirmed[player] = true;
    if (trade.players.every((id) => trade.confirmed[id])) {
      trade.status = 'countdown';
      trade.executeAt = now + 3000;
    }
  } else throw httpError(409, 'Ação indisponível nesta etapa da troca.');
  trade.updatedAt = now;
  return trade;
}

export function affectedTrades(data, now, present) {
  return trading(data).some((trade) => ACTIVE.has(trade.status) &&
    (trade.updatedAt + TIMEOUT <= now || (trade.executeAt !== null && trade.executeAt <= now) ||
      trade.players.some((id) => !present(id))));
}

export function advanceTrades(data, content, present, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  for (const trade of trading(data)) {
    if (!ACTIVE.has(trade.status)) continue;
    if (trade.updatedAt + TIMEOUT <= now) { trade.status = 'expired'; continue; }
    if (trade.players.some((id) => !present(id))) { trade.status = 'cancelled'; continue; }
    if (trade.status !== 'countdown' || trade.executeAt > now) continue;
    const [left, right] = trade.players;
    if (!data.accounts[left]?.friends.includes(right) || trade.players.some((id) =>
      data.history.filter((entry) => entry.players?.includes(id) && entry.when?.startsWith(today)).length >= 20)) {
      trade.status = 'cancelled';
      continue;
    }
    let offered;
    try {
      offered = trade.players.map((id) => trade.offers[id].map((uid) => itemFrom(data, content, id, uid, trade.id)));
    } catch { trade.status = 'cancelled'; continue; }
    trade.players.forEach((id, index) => {
      const leaving = new Set(trade.offers[id]);
      const progress = data.accounts[id].progress;
      progress.inventory = progress.inventory.filter((it) => !leaving.has(it.uid)).concat(offered[1 - index]);
    });
    trade.status = 'done';
    data.history.push({ id: trade.id, when: new Date(now).toISOString(), players: trade.players,
      items: Object.fromEntries(trade.players.map((id, index) => [id,
        offered[index].map((instance) => byId(content.items, instance.itemId).name)])),
    });
  }
}
