// Arena: HUD, barra de esquimós (toque ou arraste), painel de upgrades e fim de partida.
import { el, toast, modal, confirmDialog } from '../core/utils.js';
import { go } from '../core/router.js';
import { currentAccount } from '../core/auth.js';
import { getData, byId } from '../data/gameData.js';
import { ensureProgress, equippedItems, applyMatchResult } from '../core/progression.js';
import { Game, TARGET_LABEL } from '../game/game.js';
import { UPGRADE_TRACKS, upgradeCost, effectText, STAT_LABELS } from '../game/stats.js';
import { eskimoCanvas, itemCanvas } from '../render/faceRenderer.js';
import { CLASSES } from '../data/defaults.js';

const DRAG_THRESHOLD = 10;

export function gameScreen(root, { phaseId }) {
  const acc = currentAccount();
  if (!acc) { go('login'); return; }
  ensureProgress(acc);
  const data = getData();
  const phase = byId(data.phases, phaseId);
  const map = phase && byId(data.maps, phase.mapId);
  if (!phase || !map) { toast('Fase inválida.', 'error'); go('menu'); return; }

  const roster = acc.progress.unlocked.map((id) => {
    const def = byId(data.eskimos, id);
    const ep = acc.progress.eskimos[id];
    return { def, nodes: def.tree.filter((n) => ep.skills.includes(n.id)), items: equippedItems(acc, id) };
  });

  const hud = {
    lives: el('span', { class: 'hud-val' }),
    gold: el('span', { class: 'hud-val' }),
    round: el('span', { class: 'hud-val' }),
  };
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
      if (await confirmDialog('Abandonar a partida conta como derrota. Itens já coletados são mantidos.', { okLabel: 'Abandonar', danger: true })) game.end(false);
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
      el('div', { class: 'hud-actions' }, autoBtn, speedBtn, startBtn, exitBtn)),
    el('div', { class: 'game-body' }, el('div', { class: 'canvas-wrap' }, canvas, panel), bar)));

  const game = new Game(canvas, {
    data, phase, map, roster,
    callbacks: {
      onHud: (s) => {
        hud.lives.textContent = s.lives;
        hud.gold.textContent = s.gold;
        hud.round.textContent = `${Math.min(s.round + 1, s.totalRounds)}/${s.totalRounds}`;
        startBtn.disabled = s.roundActive || s.over;
        startBtn.textContent = s.roundActive ? 'Em andamento...' : 'Iniciar rodada';
        speedBtn.textContent = `${s.speed}x`;
        autoBtn.textContent = `Auto: ${s.autoStart ? 'sim' : 'não'}`;
        cards.forEach((c) => c.classList.toggle('poor', s.gold < Number(byId(data.eskimos, c.dataset.id).cost)));
        cards.forEach((c) => c.classList.toggle('active', game?.placing === c.dataset.id));
        refreshPanel();
      },
      onSelect: (t) => renderPanel(t),
      onToast: (m, type) => toast(m, type, 2000),
      onEnd: (r) => showResult(r),
    },
  });

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

    panel.replaceChildren(
      el('div', { class: 'panel-head' },
        eskimoCanvas(t.def, 44),
        el('div', {}, el('strong', { text: t.def.name }), el('small', { text: `${CLASSES[t.def.classId]?.name} · ${t.pops} abates` })),
        el('button', { class: 'btn btn-small btn-ghost close', text: 'X', 'aria-label': 'Fechar', onclick: () => game.select(null) })),
      el('div', { class: 'panel-stats' }, ['damage', 'range', 'fireRate', 'pierce'].map((k) =>
        el('span', {}, el('small', { text: STAT_LABELS[k] }), el('b', { text: Number.isInteger(s[k]) ? s[k] : s[k].toFixed(1) })))),
      el('div', { class: 'upg-row' }, tracks),
      el('h4', { text: 'Habilidades da árvore' }),
      el('div', { class: 'skill-row' }, skills),
      el('div', { class: 'panel-foot' },
        el('button', { class: 'btn btn-small', text: `Alvo: ${TARGET_LABEL[t.targetMode]}`, onclick: () => { game.cycleTarget(t); renderPanel(t); } }),
        el('button', { class: 'btn btn-small btn-danger', text: `Vender (${game.sellValue(t)})`, onclick: () => game.sell(t) })));
  }

  function showResult(r) {
    renderPanel(null);
    const res = applyMatchResult(acc, r);
    const itemDefs = r.items.map((id) => byId(data.items, id)).filter(Boolean);
    modal({
      title: r.victory ? 'Vitória!' : 'Derrota',
      dismissable: false,
      body: el('div', { class: 'result' },
        el('p', { text: `Rodadas completadas: ${r.roundsCompleted}/${phase.rounds.length}` }),
        el('p', { text: `XP para cada esquimó usado: +${res.xp}` }),
        res.levelUps.length && el('p', { class: 'bonus', text: `Novo ponto de habilidade: ${res.levelUps.map((id) => byId(data.eskimos, id)?.name).join(', ')}` }),
        res.newUnlocks.length && el('div', { class: 'unlocks' }, el('p', { class: 'bonus', text: 'Novo esquimó desbloqueado!' }),
          res.newUnlocks.map((d) => el('div', { class: 'unlock' }, eskimoCanvas(d, 64), el('strong', { text: d.name })))),
        el('h4', { text: itemDefs.length ? 'Itens coletados' : 'Nenhum item coletado' }),
        el('ul', { class: 'item-list' }, itemDefs.map((it) => el('li', { class: `rarity-${it.rarity}` }, itemCanvas(it, 28), el('strong', { text: it.name }))))),
      actions: [
        { label: 'Quartel', onClick: () => go('menu', { tab: 'quartel' }) },
        { label: 'Jogar de novo', onClick: () => go('game', { phaseId }) },
        { label: 'Menu', class: 'btn-primary', onClick: () => go('menu') },
      ],
    });
  }

  // Gancho de teste/QA: abrir com ?debug expõe a instância no console.
  if (new URLSearchParams(location.search).has('debug')) window.__etdGame = game;

  return () => {
    if (window.__etdGame === game) delete window.__etdGame;
    game.destroy();
    document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
  };
}
