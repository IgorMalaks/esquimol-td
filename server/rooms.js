import { randomUUID } from 'node:crypto';
import { httpError } from './http.js';
import { accountKey } from './auth.js';
import { byId } from '../js/data/gameData.js';
import { beginMatch, finishMatch } from './matches.js';
import { ensureProgress } from '../js/core/progression.js';

export function roomHub({ store, contentSnapshot, send, present, saved }) {
  const rooms = new Map((saved?.rooms ?? []).map(([id, room]) => [id, { ...room, members: new Map(room.members) }]));
  const membership = new Map(saved?.membership);
  const invitations = new Map((saved?.invitations ?? []).map(([id, rooms]) => [id, new Set(rooms)]));
  const presenceTimers = new Map();

  const snapshot = () => ({
    rooms: [...rooms].map(([id, room]) => [id, { ...room, members: [...room.members] }]),
    membership: [...membership],
    invitations: [...invitations].filter(([, rooms]) => rooms.size > 0).map(([id, rooms]) => [id, [...rooms]]),
  });

  function describe(state, room, player) {
    const account = state.accounts[player];
    return { id: room.id, owner: room.owner, me: player, phaseId: room.phaseId, status: room.status,
      mode: room.mode, target: room.target, seed: room.seed, title: room.title,
      members: [...room.members].map(([id, value]) => ({ id, name: state.accounts[id]?.username, ready: value.ready, online: present(id) })),
      invitations: [...(invitations.get(player) ?? [])].map((id) => ({
        id, owner: state.accounts[rooms.get(id)?.owner]?.username, title: rooms.get(id)?.title,
      })).filter((entry) => entry.owner),
      contentHash: room.contentHash, username: account?.username,
    };
  }

  function view(player) {
    const room = rooms.get(membership.get(player));
    const state = store.read();
    if (room) return describe(state, room, player);
    return { id: null, me: player, invitations: [...(invitations.get(player) ?? [])].flatMap((id) => {
      const invited = rooms.get(id);
      if (!invited) return [];
      return [{ id, owner: state.accounts[invited.owner]?.username, title: invited.title }];
    }) };
  }

  function broadcast(room) {
    for (const id of room.members.keys()) send(id, { type: 'room', room: view(id) });
  }
  const rosterPayload = (room) => Object.fromEntries(Object.entries(room.matches).map(([id, { username, roster, abilities }]) =>
    [id, { username, roster, abilities }]));

  function interrupt(room, players) {
    if (!room.matches) return;
    void store.update((data) => {
      const snapshot = contentSnapshot(data);
      for (const id of players) {
        const account = data.accounts[id];
        const token = room.matches[id];
        if (!token || account?.match?.matchId !== token.matchId) continue;
        if (room.started && room.report) {
          try {
            finishMatch(account, snapshot, { matchId: token.matchId, victory: false, interrupted: true,
              roundsCompleted: room.report.round, collected: room.report.collected?.[id] ?? 0 });
          } catch { account.match = null; }
        } else account.match = null;
      }
    }).catch(() => {});
  }

  function exit(player, reason = 'Um jogador saiu da sala.') {
    const room = rooms.get(membership.get(player));
    if (!room) return;
    membership.delete(player);
    if (player === room.owner) {
      rooms.delete(room.id);
      for (const invite of invitations.values()) invite.delete(room.id);
      interrupt(room, [...room.members.keys()]);
      for (const id of room.members.keys()) {
        membership.delete(id);
        send(id, { type: 'room/closed', message: reason });
      }
    } else {
      room.members.delete(player);
      interrupt(room, [player]);
      send(player, { type: 'room/closed', message: reason });
      broadcast(room);
    }
  }

  async function command(player, body) {
    const room = rooms.get(membership.get(player));
    if (body.action === 'create') {
      if (room) throw httpError(409, 'Saia da sala atual primeiro.');
      const snapshot = store.read(contentSnapshot);
      const mode = body.mode ?? 'phase';
      const target = body.target ?? body.phaseId;
      const selected = mode === 'phase' ? byId(snapshot.content.phases, target) :
        mode === 'raid' ? byId(snapshot.content.raids, target) :
        mode === 'endless' && snapshot.content.maps.some((map) => map.biome === target) && byId(snapshot.content.biomes, target);
      if (!selected) throw httpError(400, 'Modo ou fase inválida.');
      const id = randomUUID();
      const created = { id, owner: player, mode, target, phaseId: mode === 'phase' ? target : null,
        title: mode === 'endless' ? `Infinito · ${selected.name}` : selected.name,
        seed: randomUUID(), status: 'lobby', contentHash: snapshot.hash, started: false,
        members: new Map([[player, { ready: false }]]), matches: null, sequence: 0, lastSnapshot: 0 };
      rooms.set(id, created);
      membership.set(player, id);
      broadcast(created);
    } else if (body.action === 'join') {
      const invited = invitations.get(player);
      const destination = invited?.has(body.id) && rooms.get(body.id);
      if (room || !destination || destination.status !== 'lobby' || destination.members.size >= 4) {
        throw httpError(409, 'Convite ou sala indisponível.');
      }
      invited.delete(body.id);
      destination.members.set(player, { ready: false });
      membership.set(player, destination.id);
      broadcast(destination);
    } else {
      if (!room) throw httpError(404, 'Você está fora de uma sala.');
      switch (body.action) {
        case 'leave': exit(player); break;
        case 'invite': {
          if (room.owner !== player || room.status !== 'lobby' || room.members.size >= 4 ||
              typeof body.username !== 'string') throw httpError(409, 'A sala não pode receber convidados.');
          const id = accountKey(body.username);
          const canInvite = store.read((state) => state.accounts[player].friends.includes(id));
          if (!canInvite || !present(id) || membership.has(id)) throw httpError(403, 'O convite exige um amigo online e disponível.');
          if (!invitations.has(id)) invitations.set(id, new Set());
          invitations.get(id).add(room.id);
          send(id, { type: 'room', room: view(id) });
          break;
        }
        case 'ready': {
          if (room.status !== 'lobby' || body.contentHash !== room.contentHash || typeof body.ready !== 'boolean') {
            throw httpError(409, 'Recarregue o conteúdo para entrar na partida.');
          }
          room.members.get(player).ready = body.ready;
          broadcast(room);
          break;
        }
        case 'start': {
          if (room.owner !== player || room.status !== 'lobby' || room.members.size < 2 ||
              [...room.members].some(([id, entry]) => !present(id) || !entry.ready)) {
            throw httpError(409, 'São necessários dois ou mais jogadores prontos.');
          }
          room.status = 'starting';
          try {
            const enrolled = [...room.members.keys()];
            room.matches = await store.update((state) => {
              const snapshot = contentSnapshot(state);
              if (snapshot.hash !== room.contentHash) throw httpError(409, 'O conteúdo mudou. Recrie a sala.');
              return Object.fromEntries(enrolled.map((id) => {
                const account = state.accounts[id];
                if (account.match?.startedAt > Date.now() - 30 * 60_000) throw httpError(409, 'Um jogador já está em partida.');
                const match = beginMatch(account, snapshot, { mode: room.mode, id: room.target }, Date.now(), true);
                match.seed = room.seed;
                match.coop = enrolled.map((id) => state.accounts[id].username);
                ensureProgress(account, snapshot.content);
                const inventory = new Map(account.progress.inventory.map((instance) => [instance.uid, instance.itemId]));
                const roster = account.progress.unlocked.map((defId) => ({
                  defId,
                  skills: account.progress.eskimos[defId].skills,
                  items: Object.values(account.progress.eskimos[defId].equip).map((uid) => inventory.get(uid)).filter(Boolean),
                }));
                const abilities = account.progress.activeAbilities.map((uid) => inventory.get(uid) ?? null);
                return [id, { matchId: match.matchId, username: account.username, roster, abilities }];
              }));
            });
            room.status = 'playing';
            for (const id of enrolled) send(id, { type: 'room/start', room: view(id), teams: rosterPayload(room) });
          } catch (error) { room.status = 'lobby'; throw error; }
          break;
        }
        case 'round-one': {
          if (room.owner !== player || room.status !== 'playing') throw httpError(403, 'Apenas o dono inicia a rodada.');
          if (room.started) break;
          await store.update((state) => {
            for (const id of room.members.keys()) {
              const account = state.accounts[id];
              const token = room.matches[id];
              if (account?.match?.matchId !== token.matchId) throw httpError(409, 'A partida de um jogador foi encerrada.');
              if (account.match.roundStarted) continue;
              if (room.mode === 'raid') {
                const raid = byId(contentSnapshot(state).content.raids, room.target);
                if (account.progress.raidKeys < raid.keyCost) throw httpError(409, 'Um jogador ficou sem chaves.');
                account.progress.raidKeys -= raid.keyCost;
              }
              account.match.startedAt = Date.now();
              account.match.roundStarted = true;
            }
          });
          room.started = true;
          break;
        }
        case 'finish': {
          if (room.owner !== player || room.status !== 'playing' || !room.started) throw httpError(403, 'Apenas o dono conclui esta partida.');
          room.status = 'finishing';
          try {
            const results = await store.update((state) => {
              const snapshot = contentSnapshot(state);
              return Object.fromEntries(Object.entries(room.matches).filter(([id]) => room.members.has(id)).map(([id, token]) => {
                const account = state.accounts[id];
                const result = finishMatch(account, snapshot, { matchId: token.matchId, victory: body.victory,
                  roundsCompleted: body.roundsCompleted, collected: body.players?.[id]?.collected ?? 0,
                  usedEskimos: body.players?.[id]?.usedEskimos ?? [] });
                return [id, { result, progress: account.progress }];
              }));
            });
            room.status = 'done';
            for (const id of room.members.keys()) {
              membership.delete(id);
              send(id, { type: 'room/result', ...results[id], victory: body.victory, roundsCompleted: body.roundsCompleted,
                lives: Number.isFinite(body.final?.lives) ? body.final.lives : null,
                gold: Number.isFinite(body.final?.wallet?.[id]) ? body.final.wallet[id] : null });
            }
            rooms.delete(room.id);
          } catch (error) { room.status = 'playing'; throw error; }
          break;
        }
        default: throw httpError(400, 'Ação de sala inválida.');
      }
    }
    return view(player);
  }

  function relay(player, message) {
    const room = rooms.get(membership.get(player));
    if (!room || room.status !== 'playing') return;
    const now = Date.now();
    if (message.type === 'room/snapshot' && room.owner === player) {
      if (now - room.lastSnapshot < 1000 / 20 || !message.state || typeof message.state !== 'object' ||
          !Array.isArray(message.state.enemies) || !Array.isArray(message.state.towers) || !Array.isArray(message.state.drops)) return;
      room.lastSnapshot = now;
      room.report = { round: message.state.round, collected: message.state.collected };
      const seq = ++room.sequence;
      for (const member of room.members.keys()) if (member !== player) {
        const { collected, ...shared } = message.state;
        const state = { ...shared, drops: shared.drops.filter((drop) => drop.owner === member) };
        send(member, { type: message.type, state, seq });
      }
    }
    if (message.type === 'room/command' && room.owner !== player) {
      const entry = room.members.get(player);
      if (now - (entry.lastCommand ?? 0) < 90 || !message.action || typeof message.action !== 'object') return;
      entry.lastCommand = now;
      send(room.owner, { type: message.type, from: player, action: message.action });
    }
    if (message.type === 'room/reject' && room.owner === player && room.members.has(message.target)) {
      send(message.target, { type: 'room/reject', message: String(message.message ?? 'Comando recusado.').slice(0, 120) });
    }
  }

  function connection(player) {
    clearTimeout(presenceTimers.get(player));
    presenceTimers.delete(player);
    const room = rooms.get(membership.get(player));
    if (room?.status === 'playing') send(player, { type: 'room/start', room: view(player), teams: rosterPayload(room) });
    else send(player, { type: 'room', room: view(player) });
  }

  function disconnected(player) {
    if (present(player)) return;
    const room = rooms.get(membership.get(player));
    if (!room) return;
    if (room.owner === player || room.status !== 'playing') exit(player, 'A sala foi interrompida.');
    else {
      broadcast(room);
      const timer = setTimeout(() => {
        if (!present(player)) exit(player, 'Tempo de reconexão encerrado.');
        presenceTimers.delete(player);
      }, 60_000);
      timer.unref();
      presenceTimers.set(player, timer);
    }
  }

  function rememberReport(player, report) {
    const room = rooms.get(membership.get(player));
    if (room?.owner === player && room.status === 'playing' && Number.isInteger(report?.round)) room.report = report;
  }

  return { command, view, relay, connection, disconnected, snapshot, exit, rememberReport };
}
