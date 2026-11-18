// Arena: HUD, barra de esquimós (toque ou arraste), painel de upgrades e fim de partida.
import { el, toast, modal, confirmDialog, uid } from '../core/utils.js';
import { go } from '../core/router.js';
import { currentAccount } from '../core/auth.js';
import { getData, byId } from '../data/gameData.js';
import { ensureProgress, equippedItems, applyMatchResult, spendRaidKeys, instanceItem } from '../core/progression.js';
import { Game, TARGET_LABEL } from '../game/game.js';
import { UPGRADE_TRACKS, upgradeCost, effectText, STAT_LABELS, computeStats } from '../game/stats.js';
import { eskimoCanvas, itemCanvas } from '../render/faceRenderer.js';
import { CLASSES } from '../data/defaults.js';
import { roundsHaveAir } from '../game/enemies.js';
import { economy } from '../game/economy.js';
import { raidAvailable, raidPhase } from '../game/raids.js';
import { abilityStats } from '../game/abilities.js';

const DRAG_THRESHOLD = 10;

export function gameScreen(root, { phaseId, endless = false, raidId }) {
  const acc = currentAccount();
  if (!acc) { go('login'); return; }
  ensureProgress(acc);
  const data = getData();
  const raid = raidId && byId(data.raids, raidId);
  if (raidId && (!raid || !raidAvailable(acc, raid))) {
    toast('Você precisa de chaves para iniciar esta raide.', 'error');
    go('menu');
    return;
  }
  const phase = raid ? raidPhase(raid) : endless
    ? { id: 'infinito', name: 'Modo Infinito', mapId: data.maps[0]?.id, startGold: 650, lives: 100, rounds: [], endless: uid('seed') }
    : byId(data.phases, phaseId);
  const map = phase && byId(data.maps, phase.mapId);
  if (!phase || !map) { toast('Fase inválida.', 'error'); go('menu'); return; }

  const roster = acc.progress.unlocked.map((id) => {
    const def = byId(data.eskimos, id);
    const ep = acc.progress.eskimos[id];
    return { def, nodes: def.tree.filter((n) => ep.skills.includes(n.id)), items: equippedItems(acc, id) };
  });
  const abilities = acc.progress.activeAbilities.map((id) => {
    const item = id && instanceItem(acc, id);
    return item ? abilityStats(data, item) : null;
  });

  const hud = {
    lives: el('span', { class: 'hud-val' }),
    gold: el('span', { class: 'hud-val' }),
    round: el('span', { class: 'hud-val' }),
  };
  const bossLife = el('progress', { 'aria-label': 'Vida do chefe' });
  const bossName = el('span');
  const bossStatus = el('div', { class: 'hud-boss', hidden: true }, bossName, bossLife);
  const abilityButtons = abilities.map((ability, slot) => {
    if (!ability) return null;
    const timer = el('span', { class: 'ability-timer', 'aria-hidden': 'true' });
    const button = el('button', { class: 'btn btn-small ability-button', title: slot ? 'Atalho E' : 'Atalho Q',
      onclick: () => game.selectAbility(slot) }, ability.name, timer);
    return { button, timer };
  });
  const startBtn = el('button', { class: 'btn btn-go', text: 'Iniciar rodada', onclick: () => game.startRound() });
  const speedBtn = el('button', { class: 'btn btn-small', text: '1x', onclick: () => { game.speed = game.speed === 1 ? 2 : 1; } });
  const autoBtn = el('button', { class: 'btn btn-small', text: 'Auto: não', onclick: () => {
    game.autoStart = !game.autoStart;
    if (game.autoStart && game.round > 0) game.startRound();
  } });
  const exitBtn = el('button', {
    class: 'btn btn-small btn-danger', text: 'Sair',
    onclick: async () => {
      if (game.over) { go('menu'); return; }
      if (raid && !game.raidStarted) { go('menu'); return; }
      const message = endless ? 'Encerrar a partida e registrar as rodadas concluídas?' :
        'Abandonar a partida conta como derrota. Itens já coletados são mantidos.';
      if (await confirmDialog(message, { okLabel: 'Encerrar', danger: true })) game.end(false);
    },
  });

  const canvas = el('canvas', { class: 'arena', 'aria-label': 'Arena do jogo' });
  const panel = el('div', { class: 'tower-panel hidden' });
  const cards = roster.map(({ def, items }) => {
    const card = el('button', { class: 'tower-card', 'data-id': def.id, title: CLASSES[def.classId]?.name },
      eskimoCanvas(def, 52), el('strong', { text: def.name }), el('span', { class: 'cost', text: String(def.cost) }),
      items.length ? el('span', { class: 'gear-dot', title: 'Equipado' }) : null);
    attachDrag(card, def.id);
    return card;
  });
  const bar = el('aside', { class: 'tower-bar' }, cards);

  root.append(el('div', { class: 'screen screen-game' },
    el('header', { class: 'hud' },
      el('div', { class: 'hud-stats' },
        el('span', { class: 'hud-item lives', title: 'Vidas' }, el('i', { class: 'ico-heart' }), hud.lives),
        el('span', { class: 'hud-item gold', title: 'Ouro' }, el('i', { class: 'ico-coin' }), hud.gold),
        el('span', { class: 'hud-item', title: 'Rodada' }, 'Rodada ', hud.round)),
      el('div', { class: 'hud-actions' }, autoBtn, speedBtn, startBtn, exitBtn),
      abilityButtons.some(Boolean) && el('div', { class: 'hud-abilities' }, abilityButtons.map((entry) => entry?.button)), bossStatus),
    el('div', { class: 'game-body' }, el('div', { class: 'canvas-wrap' }, canvas, panel), bar)));

  const game = new Game(canvas, {
    data, phase, map, roster, abilities,
    callbacks: {
      onHud: (s) => {
        hud.lives.textContent = s.lives;
        hud.gold.textContent = s.gold;
        hud.round.textContent = endless ? String(s.round + 1) : `${Math.min(s.round + 1, s.totalRounds)}/${s.totalRounds}`;
        startBtn.disabled = s.roundActive || s.over || s.preparation !== null;
        const upcoming = !s.roundActive && game.nextRound();
        const air = upcoming && roundsHaveAir([upcoming], data.enemies);
        startBtn.textContent = s.preparation !== null ? `Chefe em ${s.preparation}s` :
          s.roundActive ? 'Em andamento...' : air ? 'Iniciar rodada · Aéreos' : 'Iniciar rodada';
        bossStatus.hidden = !s.boss && s.preparation === null;
        bossLife.hidden = !s.boss;
        if (s.boss) {
          bossName.textContent = s.boss.name;
          bossLife.max = s.boss.maxHp;
          bossLife.value = s.boss.hp;
        } else if (s.preparation !== null) {
          const boss = byId(data.enemies, raid.bossId);
          bossName.textContent = `${boss.name} · atordoa torres próximas por ${raid.bossAbility.duration}s`;
        }
        speedBtn.textContent = `${s.speed}x`;
        autoBtn.textContent = `Auto: ${s.autoStart ? 'sim' : 'não'}`;
        abilityButtons.forEach((entry, slot) => {
          if (!entry) return;
          const seconds = s.abilities[slot];
          entry.button.disabled = s.over || seconds > 0;
          entry.button.setAttribute('aria-pressed', String(s.abilityTarget === slot));
          entry.timer.textContent = seconds || (slot ? 'E' : 'Q');
          entry.timer.style.setProperty('--ready', `${100 - (100 * seconds) / abilities[slot].cooldown}%`);
        });
        cards.forEach((c) => c.classList.toggle('poor', s.gold < Number(byId(data.eskimos, c.dataset.id).cost)));
        cards.forEach((c) => c.classList.toggle('active', game?.placing === c.dataset.id));
        refreshPanel();
      },
      onSelect: (t) => renderPanel(t),
      onToast: (m, type) => toast(m, type, 2000),
      onEnd: (r) => showResult(r),
      onRaidStart: () => {
        try {
          spendRaidKeys(acc, raid);
          return true;
        } catch (error) { toast(error.message, 'error'); return false; }
      },
    },
  });
  if (roundsHaveAir(phase.rounds, data.enemies) &&
      !roster.some((entry) => computeStats(entry.def, entry).hitsAir)) {
    toast('Esta fase tem inimigos voadores.', 'info');
  }

  // Arraste de card -> mapa (Pointer Events: mouse e touch unificados).
  function attachDrag(card, id) {
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || game.over) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;
      const wasPlacing = game.placing === id;
      game.beginPlacing(id, true);
      const onMove = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > DRAG_THRESHOLD) moved = true;
        if (moved) game.updateGhost(ev.clientX, ev.clientY);
      };
      const onUp = (ev) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        if (!moved && wasPlacing) { game.cancelPlacing(); return; }
        game.finishDrag(ev.clientX, ev.clientY, moved);
        if (!moved) toast('Toque no mapa para posicionar.', 'info', 1400);
      };
      // pointercancel = navegador assumiu o gesto (rolagem da barra). Cancela o arraste.
      const onCancel = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        game.cancelPlacing();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    });
  }

  // Botões compráveis do painel: só o "disabled" muda com o ouro (recriar o DOM engoliria cliques).
  let affordable = [];
  function refreshPanel() {
    for (const [btn, cost] of affordable) btn.disabled = !game || game.gold < cost;
  }

  function renderPanel(t) {
    affordable = [];
    if (!t || game.over) { panel.classList.add('hidden'); panel.replaceChildren(); return; }
    panel.classList.remove('hidden');
    const s = t.stats;
    const tracks = Object.entries(UPGRADE_TRACKS).map(([key, tr]) => {
      const lvl = t.upgrades[key];
      const maxed = lvl >= tr.max;
      const cost = maxed ? 0 : upgradeCost(t.def, key, lvl);
      const btn = el('button', {
        class: 'upg', disabled: maxed || game.gold < cost,
        onclick: () => { game.upgrade(t, key); renderPanel(t); },
      },
      el('strong', { text: tr.label }),
      el('span', { class: 'pips' }, Array.from({ length: tr.max }, (_, i) => el('i', { class: i < lvl ? 'on' : '' }))),
      el('small', { text: maxed ? 'Máximo' : `${cost} ouro` }));
      if (!maxed) affordable.push([btn, cost]);
      return btn;
    });
    const skills = t.entry.nodes.length
      ? t.entry.nodes.map((n) => {
        const on = t.active.has(n.id);
        const btn = el('button', {
          class: `skill-act ${on ? 'on' : ''}`, disabled: on || game.gold < n.gold,
          onclick: () => { game.activateNode(t, n.id); renderPanel(t); },
        }, el('strong', { text: n.name }), el('small', { text: on ? 'Ativa' : `${effectText(n.effect)} · ${n.gold} ouro` }));
        if (!on) affordable.push([btn, Number(n.gold) || 0]);
        return btn;
      })
      : [el('p', { class: 'muted', text: 'Sem habilidades aprendidas. Distribua pontos no Quartel.' })];

    const values = t.summon
      ? [['Dano aliado', t.summon.allyDamage], ['Vida aliado', t.summon.allyHp], ['Invocação', t.summon.summonInterval]]
      : s.buffs ? [['Raio da aura', s.range], ['Bônus de dano', s.buffs.damage ?? 0], ['Antiaéreo', s.buffs.antiAereo ? 'Sim' : 'Não']]
      : ['damage', 'range', 'fireRate', 'pierce'].map((key) => [STAT_LABELS[key], s[key]]);
    panel.replaceChildren(
      el('div', { class: 'panel-head' },
        eskimoCanvas(t.def, 44),
        el('div', {}, el('strong', { text: t.def.name }), el('small', { text: `${CLASSES[t.def.classId]?.name} · ${t.pops} abates` })),
        el('button', { class: 'btn btn-small btn-ghost close', text: 'X', 'aria-label': 'Fechar', onclick: () => game.select(null) })),
      el('div', { class: 'panel-stats' }, values.map(([label, value]) =>
        el('span', {}, el('small', { text: label }), el('b', { text: typeof value === 'number' ? Number(value.toFixed(1)) : value })))),
      el('div', { class: 'upg-row' }, tracks),
      el('h4', { text: 'Habilidades da árvore' }),
      el('div', { class: 'skill-row' }, skills),
      el('div', { class: 'panel-foot' },
        !t.summon && !s.buffs && el('button', { class: 'btn btn-small', text: `Alvo: ${TARGET_LABEL[t.targetMode]}`, onclick: () => { game.cycleTarget(t); renderPanel(t); } }),
        el('button', { class: 'btn btn-small btn-danger', text: `Vender (${game.sellValue(t)})`, onclick: () => game.sell(t) })));
  }

  function showResult(r) {
    renderPanel(null);
    const res = applyMatchResult(acc, r);
    const itemDefs = res.gained.map((instance) => byId(data.items, instance.itemId)).filter(Boolean);
    modal({
      title: endless ? 'Fim do Infinito' : r.victory ? 'Vitória!' : 'Derrota',
      dismissable: false,
      body: el('div', { class: 'result' },
        el('p', { text: `Rodadas completadas: ${r.roundsCompleted}${endless ? '' : `/${phase.rounds.length}`}` }),
        (endless || raid) && el('p', { text: `Garantia de Lendário: ${acc.progress.legendaryPity}/${economy(data).legendaryThreshold}` }),
        el('p', { text: `XP para cada esquimó usado: +${res.xp}` }),
        res.levelUps.length && el('p', { class: 'bonus', text: `Novo ponto de habilidade: ${res.levelUps.map((id) => byId(data.eskimos, id)?.name).join(', ')}` }),
        res.newUnlocks.length && el('div', { class: 'unlocks' }, el('p', { class: 'bonus', text: 'Novo esquimó desbloqueado!' }),
          res.newUnlocks.map((d) => el('div', { class: 'unlock' }, eskimoCanvas(d, 64), el('strong', { text: d.name })))),
        el('h4', { text: itemDefs.length ? 'Itens coletados' : 'Nenhum item coletado' }),
        el('ul', { class: 'item-list' }, itemDefs.map((it) => el('li', { class: `rarity-${it.rarity}` }, itemCanvas(it, 28), el('strong', { text: it.name }))))),
      actions: [
        { label: 'Quartel', onClick: () => go('menu', { tab: 'quartel' }) },
        ...(!raid || raidAvailable(acc, raid) ? [{ label: 'Jogar de novo', onClick: () => go('game', { phaseId, endless, raidId }) }] : []),
        { label: 'Menu', class: 'btn-primary', onClick: () => go('menu') },
      ],
    });
  }

  // Gancho de teste/QA: abrir com ?debug expõe a instância no console.
  if (localStorage.getItem('etd.dev') === '1' && new URLSearchParams(location.search).has('debug')) {
    window.__etdGame = game;
  }

  return () => {
    if (window.__etdGame === game) delete window.__etdGame;
    game.destroy();
    document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
  };
}
