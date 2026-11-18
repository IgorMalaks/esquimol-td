// Menu pré-partida: Fases, Quartel (árvore + equipamentos) e Inventário.
import { el, toast, confirmDialog } from '../core/utils.js';
import { go } from '../core/router.js';
import { currentAccount, logout, saveAccount } from '../core/auth.js';
import { getData, byId } from '../data/gameData.js';
import { CLASSES, ITEM_TYPES, RARITIES } from '../data/defaults.js';
import {
  ensureProgress, phaseUnlocked, biomeUnlocked, recruitVariant, unlockText, equippedItems, instanceItem, whoEquips,
  canEquip, equip, unequip, fuseItems, setAbilitySlot, SLOTS,
} from '../core/progression.js';
import {
  computeStats, skillPoints, pointsFree, canLearn, canUnlearn, effectText, itemStatsText,
  STAT_LABELS, XP_PER_POINT, MAX_POINTS,
} from '../game/stats.js';
import { eskimoCanvas, itemCanvas, faceCanvas } from '../render/faceRenderer.js';
import { economy, fusionPool } from '../game/economy.js';
import { raidAvailable } from '../game/raids.js';
import { abilityStats } from '../game/abilities.js';
import { DAMAGE_LABELS, ELEMENT_LABELS, damageMultiplier } from '../game/elements.js';
import { ENEMY_TRAITS } from '../game/enemies.js';
import { preferencesButton } from '../core/preferences.js';

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

  const tabBtns = [['fases', 'Fases'], ['quartel', 'Quartel'], ['inventario', 'Inventário'], ['bestiario', 'Bestiário']].map(([id, label]) =>
    el('button', { class: 'tab', text: label, 'data-tab': id, onclick: () => { tab = id; render(); } }));

  function render() {
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const view = { fases: phasesView, quartel: barracksView, inventario: inventoryView, bestiario: bestiaryView };
    content.replaceChildren((view[tab] ?? phasesView)());
  }

  // ---------- Fases ----------
  function phasesView() {
    return el('div', { class: 'phase-grid' }, data.phases.map((ph, i) => {
      const open = phaseUnlocked(acc, i);
      const prog = acc.progress.phases[ph.id];
      const map = byId(data.maps, ph.mapId);
      const biome = byId(data.biomes, map?.biome);
      return el('div', { class: `card phase-card ${open ? '' : 'locked'}` },
        el('h3', { text: ph.name }),
        el('p', { class: 'muted', text: `${map?.name ?? ''} · ${ph.rounds.length} rodadas · ${ph.lives} vidas` }),
        biome?.hint && el('p', { class: 'muted', text: biome.hint }),
        el('p', { text: prog?.completed ? 'Concluída' : prog ? `Melhor: rodada ${prog.bestRound}` : 'Nova' }),
        el('button', {
          class: 'btn btn-primary', text: open ? 'Jogar' : 'Bloqueada', disabled: !open,
          onclick: () => go('game', { phaseId: ph.id }),
        }));
    }),
    (data.biomes.length ? data.biomes.filter((biome) => data.maps.some((map) => map.biome === biome.id)) : [{ id: 'tundra', name: 'Tundra' }])
      .map((biome) => {
        const open = biomeUnlocked(acc, data.maps, biome.id);
        const record = acc.progress.endlessByBiome?.[biome.id] ?? (biome.id === 'tundra' ? acc.progress.endlessBest : null);
        return el('div', { class: `card phase-card ${open ? '' : 'locked'}` },
          el('h3', { text: `Infinito · ${biome.name}` }),
          el('p', { text: `Recorde: rodada ${record?.melhorWave ?? 0}` }),
          biome.id !== 'tundra' && el('p', { text: `Fragmentos: ${acc.progress.fragments[biome.id] ?? 0}` }),
          el('p', { class: 'muted', text: `Garantia de Lendário: ${acc.progress.legendaryPity}/${economy(data).legendaryThreshold}` }),
          el('button', { class: 'btn btn-primary', text: 'Jogar Infinito', disabled: !open,
            onclick: () => go('game', { endless: true, biomeId: biome.id }) }));
      }),
    data.raids.map((raid) => {
      const open = biomeUnlocked(acc, data.maps, byId(data.maps, raid.mapId)?.biome);
      const available = open && raidAvailable(acc, raid);
      return el('div', { class: `card phase-card ${available ? '' : 'locked'}` },
        el('h3', { text: raid.name }),
        el('p', { text: `Chaves de raide: ${acc.progress.raidKeys} · Custo: ${raid.keyCost}` }),
        !available && el('p', { class: 'muted', text: open ? 'Ganhe uma chave a cada 15 rodadas concluídas no Infinito.' : 'Avance nas fases para liberar este bioma.' }),
        el('button', { class: 'btn btn-primary', text: 'Entrar na raide', disabled: !available,
          onclick: () => go('game', { raidId: raid.id }) }));
    }));
  }

  // ---------- Quartel ----------
  function barracksView() {
    const list = el('div', { class: 'eskimo-list' }, data.eskimos.map((def) => {
      const unlocked = acc.progress.unlocked.includes(def.id);
      return el('button', {
        class: `eskimo-card ${def.id === selectedEskimo ? 'active' : ''} ${unlocked ? '' : 'locked'}`,
        onclick: () => { if (unlocked || def.unlock?.type === 'fragments') { selectedEskimo = def.id; render(); } else toast(unlockText(def), 'info'); },
      },
      eskimoCanvas(def, 56),
      el('div', {}, el('strong', { text: def.name }), el('small', { text: unlocked ? CLASSES[def.classId]?.name : unlockText(def) })));
    }));
    const def = byId(data.eskimos, selectedEskimo);
    if (!def) return el('div', { class: 'barracks' }, list, el('p', { text: 'Nenhum esquimó desbloqueado.' }));
    const unlock = def.unlock;
    if (unlock?.type !== 'fragments' || acc.progress.unlocked.includes(def.id)) {
      return el('div', { class: 'barracks' }, list, eskimoDetail(def));
    }
    const balance = acc.progress.fragments[unlock.biome] ?? 0;
    const biome = byId(data.biomes, unlock.biome);
    return el('div', { class: 'barracks' }, list, el('div', { class: 'card' },
      el('h2', { text: def.name }), eskimoCanvas(def, 90),
      el('p', { text: `${balance}/${unlock.amount} fragmentos · ${biome?.name}` }),
      el('progress', { max: unlock.amount, value: Math.min(balance, unlock.amount), 'aria-label': 'Fragmentos' }),
      el('div', { class: 'form-actions' }, el('button', { class: 'btn btn-primary', text: 'Recrutar',
        disabled: balance < unlock.amount, onclick: () => {
          try { recruitVariant(acc, def.id); render(); }
          catch (error) { toast(error.message, 'error'); }
        } }))));
  }

  function bestiaryView() {
    const known = data.enemies.filter((enemy) => acc.progress.discoveredEnemies.includes(enemy.id));
    if (!known.length) return el('div', { class: 'card' }, el('p', { text: 'Jogue uma partida para descobrir inimigos.' }));
    return el('div', { class: 'phase-grid' }, known.map((enemy) => {
      const classified = Object.entries(DAMAGE_LABELS).map(([key, name]) => [name, damageMultiplier(data, enemy, key)]);
      const weak = classified.filter(([, value]) => value >= 1.5).map(([name]) => name);
      const resisted = classified.filter(([, value]) => value <= 0.5).map(([name]) => name);
      return el('article', { class: 'card' }, faceCanvas(enemy.face, 60), el('h3', { text: enemy.name }),
        el('p', { text: ELEMENT_LABELS[enemy.element ?? 'neutro'] }),
        enemy.traits?.length && el('p', { text: enemy.traits.map((trait) => ENEMY_TRAITS[trait]).filter(Boolean).join(' · ') }),
        weak.length && el('p', { text: `Fraquezas · ${weak.join(', ')}` }),
        resisted.length && el('p', { text: `Resistências · ${resisted.join(', ')}` }));
    }));
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
    const active = inv.filter((entry) => instanceItem(acc, entry.uid)?.type === 'habilidade');
    const slots = active.length ? el('section', {}, el('h3', { text: 'Habilidades ativas' }),
      el('div', { class: 'grid-2' }, [0, 1].map((slot) => el('label', { class: 'field' },
        el('span', { text: slot ? 'Slot E' : 'Slot Q' }),
        el('select', {
          value: acc.progress.activeAbilities[slot] ?? '',
          onchange: (event) => {
            try { setAbilitySlot(acc, slot, event.target.value || null); render(); }
            catch (error) { toast(error.message, 'error'); }
          },
        }, el('option', { value: '', text: 'Vazio' }), active.map((instance) => {
          const item = instanceItem(acc, instance.uid);
          const stats = abilityStats(data, item);
          return el('option', { value: instance.uid, text: `${item.name} · ${RARITIES[item.rarity].name} · ${stats?.cooldown ?? '—'}s` });
        })))))) : null;
    return el('div', { class: 'card' }, slots, el('h3', { text: 'Fusão' }),
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
        el('span', { class: 'muted', text: owner === 'perfil' ? 'Habilidade ativa equipada' :
          owner ? `Equipado em ${byId(data.eskimos, owner)?.name}` : 'Livre' }));
    })));
  }

  const s = acc.progress.stats;
  root.append(el('div', { class: 'screen screen-menu' },
    el('header', { class: 'topbar' },
      el('h1', { class: 'logo logo-small' }, 'Esquimó', el('span', { text: 'TD' })),
      el('div', { class: 'player' },
        el('strong', { text: acc.username }),
        el('small', { text: `${s.wins} vitórias · ${s.roundsTotal} rodadas` })),
      preferencesButton(),
      el('button', { class: 'btn btn-small', text: 'Sair', onclick: () => { logout(); go('login'); } })),
    el('nav', { class: 'tabs tabs-scroll' }, tabBtns),
    content));
  render();
}
