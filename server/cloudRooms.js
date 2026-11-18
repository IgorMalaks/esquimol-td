import { setTimeout as delay } from 'node:timers/promises';
import { roomHub } from './rooms.js';

const LEASE = 45_000;
const RECONNECT = 60_000;
const HOST_RECONNECT = 10_000;

function presenceOf(state, player, now = Date.now()) {
  const active = Object.values(state.playerPresence?.[player] ?? {}).filter((peer) => peer.until > now);
  return active.some((peer) => peer.playing) ? 'em partida' : active.length ? 'online' : 'offline';
}

export function cloudRooms({ store, redis, namespace, contentSnapshot, deliver, onTrade, revoke }) {
  const channel = `${namespace}:events`;
  const routes = new Map();
  const connections = new Map();
  const lastFrame = new Map();
  const lastReport = new Map();
  let subscription;
  let heartbeat;
  let busy = false;
  let tradeTimer;

  function publish(event) {
    return redis.command('PUBLISH', channel, JSON.stringify(event));
  }

  function sendMany(messages) {
    return messages.length ? publish({ messages }) : Promise.resolve();
  }

  function receive(event) {
    if (event.revoked) { revoke(event.revoked); return; }
    if (event.messages) {
      for (const [player, message] of event.messages) {
        if (!connections.has(player)) continue;
        if (message.type === 'room/start' || message.type === 'room') {
          if (message.room?.id && message.room.status === 'playing') routes.set(player, message.room);
          else routes.delete(player);
        } else if (message.type === 'room/closed' || message.type === 'room/result') routes.delete(player);
        if (message.type === 'trade') {
          for (const trade of message.trades) {
            if (trade.status !== 'countdown' || !trade.executeAt) continue;
            clearTimeout(tradeTimer);
            tradeTimer = setTimeout(() => store.run(onTrade).catch(() => {}), Math.max(10, trade.executeAt - Date.now()));
            tradeTimer.unref();
          }
        }
        deliver(player, message);
      }
      return;
    }
    const eventRoom = event.room;
    const from = event.from;
    if (event.frame?.type === 'room/snapshot') {
      for (const [player, room] of routes) {
        if (room.id !== eventRoom || room.owner !== from || player === from) continue;
        const { collected, ...shared } = event.frame.state;
        const state = { ...shared, drops: shared.drops.filter((drop) => drop.owner === player) };
        deliver(player, { type: event.frame.type, seq: event.seq, state });
      }
    } else if (event.frame?.type === 'room/command') {
      const room = routes.get(event.target);
      if (room?.id === eventRoom && room.owner === event.target && room.members.some((member) => member.id === from)) {
        deliver(event.target, { ...event.frame, from });
      }
    } else if (event.frame?.type === 'room/reject') {
      const room = routes.get(event.target);
      if (room?.id === eventRoom && room.owner === from) deliver(event.target, event.frame);
    }
  }

  function startSubscription() {
    if (subscription) return subscription;
    const controller = new AbortController();
    let open;
    const ready = new Promise((resolve) => { open = resolve; });
    const run = async () => {
      while (!controller.signal.aborted) {
        try { await redis.subscribe(channel, { signal: controller.signal, onOpen: open, receive }); }
        catch { /* as conexões ativas permitem retomar a assinatura */ }
        if (!controller.signal.aborted) await delay(700);
      }
    };
    subscription = { controller, ready };
    void run();
    heartbeat = setInterval(() => {
      if (busy) return;
      busy = true;
      void transact((state, hub) => {
        for (const [player, peers] of connections) {
          hub.rememberReport(player, lastReport.get(player));
          for (const [id, peer] of peers) {
            const session = state.sessions[peer.session];
            if (session?.account !== player || session.expires <= Date.now()) {
              revoke(peer.session);
              continue;
            }
            setPresence(state, player, id, peer.playing);
          }
        }
      }).catch(() => {}).finally(() => { busy = false; });
    }, 20_000);
    heartbeat.unref();
    return subscription;
  }

  function createHub(state, messages) {
    const nestedStore = {
      read: (project = (copy) => copy) => project(state),
      update: async (mutate) => mutate(state),
    };
    return roomHub({
      store: nestedStore, saved: state.roomState, contentSnapshot, present: (id) => presenceOf(state, id) !== 'offline',
      send: (player, message) => messages.push([player, message]),
    });
  }

  function prune(state, hub) {
    const now = Date.now();
    const consulted = new Set();
    for (const [id] of state.roomState?.membership ?? []) {
      if (presenceOf(state, id, now) !== 'offline') continue;
      const room = hub.view(id);
      if (!room.id || consulted.has(id)) continue;
      const last = state.playerLastSeen?.[id] ?? 0;
      const timeout = room.owner === id || room.status !== 'playing' ? LEASE : RECONNECT + LEASE;
      if (now - last >= timeout) {
        hub.exit(id, 'A sala perdeu a conexão com um jogador.');
        consulted.add(id);
      }
    }
    for (const [id, peers] of Object.entries(state.playerPresence ?? {})) {
      for (const [key, peer] of Object.entries(peers)) if (peer.until <= now) delete peers[key];
      if (!Object.keys(peers).length) delete state.playerPresence[id];
    }
  }

  function setPresence(state, player, id, playing) {
    if (!Object.hasOwn(state.accounts, player)) return;
    state.playerPresence ??= {};
    state.playerPresence[player] ??= {};
    state.playerPresence[player][id] = { until: Date.now() + LEASE, playing };
    state.playerLastSeen ??= {};
    state.playerLastSeen[player] = Date.now();
  }

  async function transact(action) {
    const { value, messages } = await store.update(async (state) => {
      const messages = [];
      const hub = createHub(state, messages);
      const value = await action(state, hub);
      prune(state, hub);
      state.roomState = hub.snapshot();
      return { value, messages };
    });
    await sendMany(messages);
    return value;
  }

  return {
    sendMany,
    revoke: (hash) => publish({ revoked: hash }),
    presence: (id) => store.read((state) => presenceOf(state, id)),
    players: () => store.read((state) => Object.keys(state.playerPresence ?? {}).filter((id) => presenceOf(state, id) !== 'offline')),
    view: (player) => store.read((state) => createHub(state, []).view(player)),
    command(player, body, token) {
      return transact((state, hub) => {
        const session = state.sessions[token];
        if (session?.account !== player || session.expires <= Date.now()) {
          throw Object.assign(new Error('A sessão expirou.'), { status: 401 });
        }
        if (presenceOf(state, player) === 'offline') throw Object.assign(new Error('Conecte-se à sala para continuar.'), { status: 409 });
        return hub.command(player, body);
      });
    },
    async connect(player, peerId, token) {
      if (!connections.has(player)) connections.set(player, new Map());
      connections.get(player).set(peerId, { session: token, playing: false });
      const { ready } = startSubscription();
      const opened = await Promise.race([ready.then(() => true), delay(4500, false)]);
      if (!opened) throw new Error('Conexão com o multiplayer indisponível.');
      await transact((state, hub) => {
        setPresence(state, player, peerId, false);
        hub.connection(player);
      });
    },
    async playing(player, peerId, value) {
      const peer = connections.get(player)?.get(peerId);
      if (!peer) return;
      peer.playing = value;
      await transact((state) => setPresence(state, player, peerId, value));
    },
    async close(player, peerId) {
      const peers = connections.get(player);
      peers?.delete(peerId);
      if (!peers?.size) {
        connections.delete(player);
        routes.delete(player);
        lastFrame.delete(player);
      }
      if (!connections.size && subscription) {
        subscription.controller.abort();
        subscription = null;
        clearInterval(heartbeat);
      }
      const report = lastReport.get(player);
      if (!peers?.size) lastReport.delete(player);
      await transact((state, hub) => {
        const saved = state.playerPresence?.[player];
        if (saved) delete saved[peerId];
        const room = hub.view(player);
        if (room.id && presenceOf(state, player) === 'offline') {
          if (room.status === 'playing') {
            hub.rememberReport(player, report);
            const grace = room.owner === player ? HOST_RECONNECT : RECONNECT;
            const rawTimeout = room.owner === player ? LEASE : RECONNECT + LEASE;
            state.playerLastSeen[player] = Date.now() - rawTimeout + grace;
          } else hub.exit(player, 'A sala foi interrompida.');
        }
      });
    },
    relay(player, frame) {
      const room = routes.get(player);
      if (!room) return;
      const time = Date.now();
      if (frame.type === 'room/snapshot' && room.owner === player && Array.isArray(frame.state?.enemies) &&
          Array.isArray(frame.state?.towers) && Array.isArray(frame.state?.drops) && time - (lastFrame.get(player) ?? 0) >= 60) {
        lastFrame.set(player, time);
        lastReport.set(player, { round: frame.state.round, collected: frame.state.collected });
        void publish({ room: room.id, from: player, seq: time, frame }).catch(() => {});
      } else if (frame.type === 'room/command' && room.owner !== player && typeof frame.action?.kind === 'string' &&
          time - (lastFrame.get(player) ?? 0) >= 90) {
        lastFrame.set(player, time);
        void publish({ room: room.id, from: player, target: room.owner, frame: { type: frame.type, action: frame.action } }).catch(() => {});
      } else if (frame.type === 'room/reject' && room.owner === player && room.members.some((member) => member.id === frame.target)) {
        void publish({ room: room.id, from: player, target: frame.target, frame: { type: frame.type,
          message: String(frame.message ?? 'Comando recusado.').slice(0, 120) } }).catch(() => {});
      }
    },
  };
}
