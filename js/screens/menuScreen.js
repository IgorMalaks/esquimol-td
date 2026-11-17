// Menu pré-partida: Fases, Quartel (árvore + equipamentos) e Inventário.
import { el, toast, confirmDialog } from '../core/utils.js';
import { go } from '../core/router.js';
import { currentAccount, logout, saveAccount } from '../core/auth.js';
import { getData, byId } from '../data/gameData.js';
import { CLASSES, ITEM_TYPES, RARITIES } from '../data/defaults.js';
import {
  ensureProgress, phaseUnlocked, unlockText, equippedItems, instanceItem, whoEquips,
  canEquip, equip, unequip, fuseItems, SLOTS,
} from '../core/progression.js';
import {
  computeStats, skillPoints, pointsFree, canLearn, canUnlearn, effectText, itemStatsText,
  STAT_LABELS, XP_PER_POINT, MAX_POINTS,
} from '../game/stats.js';
import { eskimoCanvas, itemCanvas } from '../render/faceRenderer.js';
import { economy, fusionPool } from '../game/economy.js';

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

export function menuScreen(root, params = {}) {
  const acc = currentAccount();
  if (!acc) { go('login'); return; }
  ensureProgress(acc);
  saveAccount(acc);
  const data = getData();
  let tab = params.tab || 'fases';
  let selectedEskimo = params.eskimo || acc.progress.unlocked[0];
  const content = el('div', { class: 'menu-content' });

  const tabBtns = [['fases', 'Fases'], ['quartel', 'Quartel'], ['inventario', 'Inventário']].map(([id, label]) =>
    el('button', { class: 'tab', text: label, 'data-tab': id, onclick: () => { tab = id; render(); } }));

  function render() {
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    content.replaceChildren(tab === 'fases' ? phasesView() : tab === 'quartel' ? barracksView() : inventoryView());
  }

  // ---------- Fases ----------
  function phasesView() {
    return el('div', { class: 'phase-grid' }, data.phases.map((ph, i) => {
      const open = phaseUnlocked(acc, i);
      const prog = acc.progress.phases[ph.id];
      const map = byId(data.maps, ph.mapId);
      return el('div', { class: `card phase-card ${open ? '' : 'locked'}` },
        el('h3', { text: ph.name }),
        el('p', { class: 'muted', text: `${map?.name ?? ''} · ${ph.rounds.length} rodadas · ${ph.lives} vidas` }),
        el('p', { text: prog?.completed ? 'Concluída' : prog ? `Melhor: rodada ${prog.bestRound}` : 'Nova' }),
        el('button', {
          class: 'btn btn-primary', text: open ? 'Jogar' : 'Bloqueada', disabled: !open,
          onclick: () => go('game', { phaseId: ph.id }),
        }));
    }),
    el('div', { class: 'card phase-card' },
      el('h3', { text: 'Modo Infinito' }),
      el('p', { text: `Recorde: rodada ${acc.progress.endlessBest?.melhorWave ?? 0}` }),
      el('p', { class: 'muted', text: `Garantia de Lendário: ${acc.progress.legendaryPity}/${economy(data).legendaryThreshold}` }),
      el('button', { class: 'btn btn-primary', text: 'Jogar Infinito', onclick: () => go('game', { endless: true }) })));
  }

  // ---------- Quartel ----------
  function barracksView() {
    const list = el('div', { class: 'eskimo-list' }, data.eskimos.map((def) => {
      const unlocked = acc.progress.unlocked.includes(def.id);
      return el('button', {
        class: `eskimo-card ${def.id === selectedEskimo ? 'active' : ''} ${unlocked ? '' : 'locked'}`,
        onclick: () => { if (unlocked) { selectedEskimo = def.id; render(); } else toast(unlockText(def), 'info'); },
      },
      eskimoCanvas(def, 56),
      el('div', {}, el('strong', { text: def.name }), el('small', { text: unlocked ? CLASSES[def.classId]?.name : unlockText(def) })));
    }));
    const def = byId(data.eskimos, selectedEskimo);
    return el('div', { class: 'barracks' }, list, def ? eskimoDetail(def) : el('p', { text: 'Nenhum esquimó desbloqueado.' }));
  }

  function eskimoDetail(def) {
    const ep = acc.progress.eskimos[def.id];
    const items = equippedItems(acc, def.id);
    const base = computeStats(def);
    const withItems = computeStats(def, { items });
    const pts = skillPoints(ep);
    const nextXp = pts >= MAX_POINTS ? null : XP_PER_POINT - (ep.xp % XP_PER_POINT);

    const statsTable = el('table', { class: 'stats-table' },
      Object.entries(STAT_LABELS).map(([k, label]) => {
        const b = base[k];
        const w = withItems[k];
        return el('tr', {}, el('td', { text: label }), el('td', { text: fmt(b) }),
          el('td', { class: w !== b ? 'bonus' : 'muted', text: w !== b ? `→ ${fmt(w)}` : '' }));
      }));

    const branches = [1, 2, 3].map((b) => el('div', { class: 'branch' },
      el('h4', { text: def.branches?.[b - 1] || `Caminho ${b}` }),
      def.tree.filter((n) => n.branch === b).sort((x, y) => x.tier - y.tier).map((node) => {
        const learned = ep.skills.includes(node.id);
        const chk = learned ? canUnlearn(def, ep, node) : canLearn(def, ep, node);
        return el('button', {
          class: `skill-node ${learned ? 'learned' : chk.ok ? 'available' : 'blocked'}`,
          title: chk.ok ? '' : chk.reason,
          onclick: () => {
            if (!chk.ok) { toast(chk.reason, 'error'); return; }
            ep.skills = learned ? ep.skills.filter((s) => s !== node.id) : [...ep.skills, node.id];
            saveAccount(acc); render();
          },
        },
        el('span', { class: 'tier', text: `Nv ${node.tier}` }),
        el('strong', { text: node.name }),
        el('small', { text: node.desc || effectText(node.effect) }),
        el('small', { class: 'muted', text: `${node.cost} pt · ativa por ${node.gold} ouro na partida` }));
      })));

    const slots = el('div', { class: 'slots' }, SLOTS.map((slot) => {
      const it = ep.equip[slot] && instanceItem(acc, ep.equip[slot]);
      return el('div', { class: 'slot' },
        el('span', { class: 'muted', text: ITEM_TYPES[slot] }),
        it ? itemCanvas(it, 32) : el('div', { class: 'slot-empty' }),
        el('span', { text: it ? it.name : 'vazio' }),
        it && el('button', { class: 'btn btn-small', text: 'Remover', onclick: () => { unequip(acc, def.id, slot); render(); } }));
    }));

    const compatible = acc.progress.inventory
      .map((inst) => ({ inst, item: instanceItem(acc, inst.uid) }))
      .filter(({ item }) => item && canEquip(item, def));

    return el('div', { class: 'card eskimo-detail' },
      el('div', { class: 'detail-head' },
        eskimoCanvas(def, 110),
        el('div', {},
          el('h2', { text: def.name }),
          el('p', { text: `${CLASSES[def.classId]?.name} — ${CLASSES[def.classId]?.desc}` }),
          el('p', { class: 'muted', text: `XP ${ep.xp}${nextXp ? ` · faltam ${nextXp} para +1 ponto` : ' · pontos no máximo'}` }),
          el('p', {}, el('span', { class: 'pill', text: `Pontos livres: ${pointsFree(def, ep)} / ${pts}` }),
            ' ', el('button', { class: 'btn btn-small', text: 'Resetar pontos', onclick: () => { ep.skills = []; saveAccount(acc); render(); } })))),
      el('h3', { text: 'Árvore de habilidades' }),
      el('p', { class: 'hint', text: 'Pontos liberam habilidades; na partida você paga ouro para ativá-las em cada esquimó posicionado. Só um caminho pode chegar ao nível 3.' }),
      el('div', { class: 'skill-tree' }, branches),
      el('div', { class: 'grid-2 detail-bottom' },
        el('div', {}, el('h3', { text: 'Atributos (base → com itens)' }), statsTable),
        el('div', {}, el('h3', { text: 'Equipamentos' }), slots,
          el('h4', { text: 'Itens compatíveis' }),
          compatible.length ? el('ul', { class: 'item-list' }, compatible.map(({ inst, item }) => {
            const owner = whoEquips(acc, inst.uid);
            return el('li', { class: `rarity-${item.rarity}` },
              itemCanvas(item, 28),
              el('div', {}, el('strong', { text: item.name }), el('small', { text: itemStatsText(item) }),
                owner && el('small', { class: 'muted', text: ` (com ${byId(data.eskimos, owner)?.name})` })),
              owner === def.id ? el('span', { class: 'pill', text: 'Equipado' })
                : el('button', {
                  class: 'btn btn-small btn-primary', text: 'Equipar',
                  onclick: () => { try { equip(acc, def.id, inst.uid); render(); } catch (e) { toast(e.message, 'error'); } },
                }));
          })) : el('p', { class: 'muted', text: 'Nenhum item compatível. Colete drops nas partidas!' }))));
  }

  // ---------- Inventário ----------
  function inventoryView() {
    const inv = acc.progress.inventory;
    if (!inv.length) return el('div', { class: 'card' }, el('p', { text: 'Seu inventário está vazio. Toque nos drops durante as partidas para coletar itens.' }));
    const free = new Map();
    for (const instance of inv) {
      if (whoEquips(acc, instance.uid)) continue;
      if (!free.has(instance.itemId)) free.set(instance.itemId, []);
      free.get(instance.itemId).push(instance.uid);
    }
    const chance = Math.round(economy(data).fusionChance * 100);
    const fusion = [...free].filter(([id, copies]) => copies.length >= 3 && fusionPool(data, byId(data.items, id)).length)
      .map(([id, copies]) => {
        const item = byId(data.items, id);
        return el('button', { class: 'btn btn-small', text: `Fundir 3 × ${item.name}`, onclick: async () => {
          if (!(await confirmDialog(`A fusão tem ${chance}% de chance de gerar um item de raridade superior. Se falhar, você perde duas cópias.`,
            { okLabel: 'Fundir', danger: true }))) return;
          try {
            const result = fuseItems(acc, copies.slice(0, 3));
            toast(result ? `Você obteve ${result.name}!` : 'A fusão falhou. Uma cópia foi devolvida.', result ? 'success' : 'info');
            render();
          } catch (error) { toast(error.message, 'error'); }
        } });
      });
    return el('div', { class: 'card' }, el('h3', { text: 'Fusão' }),
      fusion.length ? el('div', { class: 'form-actions' }, fusion) :
        el('p', { class: 'muted', text: 'Junte três cópias desequipadas de um item para fundir.' }),
      el('ul', { class: 'item-list' }, inv.map((inst) => {
      const item = instanceItem(acc, inst.uid);
      const owner = whoEquips(acc, inst.uid);
      return el('li', { class: `rarity-${item.rarity}` },
        itemCanvas(item, 32),
        el('div', {},
          el('strong', { text: item.name }),
          el('small', { text: ` ${RARITIES[item.rarity]?.name} · ${ITEM_TYPES[item.type]}${item.classRestriction ? ` · só ${CLASSES[item.classRestriction]?.name}` : ''}` }),
          el('small', { text: itemStatsText(item) })),
        el('span', { class: 'muted', text: owner ? `Equipado em ${byId(data.eskimos, owner)?.name}` : 'Livre' }));
    })));
  }

  const s = acc.progress.stats;
  root.append(el('div', { class: 'screen screen-menu' },
    el('header', { class: 'topbar' },
      el('h1', { class: 'logo logo-small' }, 'Esquimó', el('span', { text: 'TD' })),
      el('div', { class: 'player' },
        el('strong', { text: acc.username }),
        el('small', { text: `${s.wins} vitórias · ${s.roundsTotal} rodadas` })),
      el('button', { class: 'btn btn-small', text: 'Sair', onclick: () => { logout(); go('login'); } })),
    el('nav', { class: 'tabs' }, tabBtns),
    content));
  render();
}
