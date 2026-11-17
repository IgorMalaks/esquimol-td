// Painel Admin: CRUD de Esquimós (com árvore), Inimigos (camadas), Fases/Rodadas, Itens e Dados.
import { el, toast, clone, getPath, setPath, slugify, uid, confirmDialog } from '../core/utils.js';
import { go } from '../core/router.js';
import { isAdminSession, adminLogout, adminChangePassword } from '../core/auth.js';
import { storage } from '../core/storage.js';
import { getData, saveData, resetData, validateData, byId } from '../data/gameData.js';
import { CLASSES, ITEM_TYPES, RARITIES, DEFAULT_FACE } from '../data/defaults.js';
import { EFFECT_KEYS, BASE_STATS } from '../game/stats.js';
import { rbe, layerChain } from '../core/progression.js';
import { createFaceEditor } from '../ui/faceEditor.js';
import { drawEskimo, eskimoCanvas, faceCanvas, itemCanvas } from '../render/faceRenderer.js';

const state = { tab: 'eskimos', eskimos: null, enemies: null, phases: null, items: null, draft: null };

const UNLOCK_TYPES = [['default', 'Inicial'], ['wins', 'Nº de vitórias'], ['rounds', 'Nº de rodadas vencidas'], ['phase', 'Completar fase']];
const EFFECT_OPTIONS = Object.entries(EFFECT_KEYS).map(([k, v]) => [k, v.label]);

// ---------- Helpers de formulário ----------
function fieldsForm(obj, defs, cls = 'grid-3') {
  const inputs = {};
  const nodes = defs.map((d) => {
    const v = getPath(obj, d.key);
    const input = d.type === 'select'
      ? el('select', { value: v ?? '' }, d.options.map(([val, lab]) => el('option', { value: val, text: lab })))
      : el('input', { type: d.type || 'text', step: d.step, min: d.min, max: d.max, value: v ?? '', list: d.list, maxlength: d.type ? null : 40 });
    if (d.onInput) input.addEventListener('input', d.onInput);
    inputs[d.key] = input;
    return el('label', { class: 'field' }, el('span', { text: d.label }), input, d.hint && el('small', { class: 'hint', text: d.hint }));
  });
  return {
    node: el('div', { class: cls }, nodes),
    inputs,
    read(target) {
      for (const d of defs) {
        const raw = inputs[d.key].value;
        setPath(target, d.key, d.type === 'number' ? Number(raw) || 0 : raw.trim());
      }
    },
  };
}

function section(title, ...children) {
  return el('section', { class: 'admin-section' }, el('h3', { text: title }), children);
}

function entityTab(cfg) {
  const all = getData()[cfg.key];
  const isNew = state[cfg.key] === '__new__';
  const draft = isNew ? state.draft : clone(byId(all, state[cfg.key]) || all[0] || null);
  if (draft && !isNew) state[cfg.key] = draft.id;

  const listNode = el('div', { class: 'admin-list' },
    el('button', {
      class: 'btn btn-primary btn-block', text: `+ ${cfg.newLabel}`,
      onclick: () => { state[cfg.key] = '__new__'; state.draft = cfg.newEntity(); render(); },
    }),
    all.map((x) => el('button', {
      class: `admin-item ${!isNew && x.id === draft?.id ? 'active' : ''}`,
      onclick: () => { state[cfg.key] = x.id; render(); },
    }, cfg.thumb(x), el('div', {}, el('strong', { text: x.name }), el('small', { text: cfg.sub(x) })))));

  if (!draft) return el('div', { class: 'admin-layout' }, listNode, el('div', { class: 'card' }, el('p', { text: 'Nada cadastrado ainda.' })));

  const form = cfg.buildForm(draft);
  const save = () => {
    try {
      form.read(draft);
      if (!draft.name?.trim()) throw new Error('Informe um nome.');
      if (!draft.id) draft.id = slugify(draft.name, cfg.prefix);
      const next = clone(getData());
      const idx = next[cfg.key].findIndex((x) => x.id === draft.id);
      if (idx >= 0) next[cfg.key][idx] = clone(draft); else next[cfg.key].push(clone(draft));
      saveData(next);
      state[cfg.key] = draft.id;
      toast('Salvo!', 'success');
      render();
    } catch (e) {
      toast(e.message, 'error', 4000);
    }
  };
  const del = async () => {
    if (isNew) { state[cfg.key] = null; render(); return; }
    const reason = cfg.blockDelete?.(draft, getData());
    if (reason) { toast(reason, 'error', 4000); return; }
    if (!(await confirmDialog(`Excluir "${draft.name}"? Jogadores perdem referências a ele.`, { danger: true, okLabel: 'Excluir' }))) return;
    try {
      const next = clone(getData());
      next[cfg.key] = next[cfg.key].filter((x) => x.id !== draft.id);
      saveData(next);
      state[cfg.key] = null;
      render();
    } catch (e) { toast(e.message, 'error', 4000); }
  };

  return el('div', { class: 'admin-layout' }, listNode,
    el('div', { class: 'card admin-form' },
      el('h2', { text: isNew ? `Novo: ${cfg.newLabel}` : draft.name }),
      form.node,
      el('div', { class: 'form-actions' },
        el('button', { class: 'btn btn-danger', text: isNew ? 'Descartar' : 'Excluir', onclick: del }),
        el('button', { class: 'btn btn-primary', text: 'Salvar', onclick: save }))));
}

// ---------- Aba 1: Esquimós ----------
function newEskimo() {
  const tree = [];
  for (let b = 1; b <= 3; b++) {
    for (let t = 1; t <= 3; t++) {
      tree.push({ id: uid('sk'), branch: b, tier: t, name: `Habilidade ${b}.${t}`, desc: '', cost: t === 3 ? 2 : 1, gold: 150 * 2 ** (t - 1), effect: { key: 'damage', value: 1 } });
    }
  }
  return {
    id: '', name: '', classId: 'arqueiro', bodyColor: '#3a7bd5', cost: 250, face: { ...DEFAULT_FACE },
    stats: { damage: 1, range: 150, fireRate: 1, pierce: 1, projectileSpeed: 600, splash: 0, slowPct: 0, slowDuration: 1.5 },
    unlock: { type: 'default', value: '' }, branches: ['Caminho 1', 'Caminho 2', 'Caminho 3'], tree,
  };
}

function eskimoForm(draft) {
  const data = getData();
  let editor;
  const base = fieldsForm(draft, [
    { key: 'name', label: 'Nome' },
    { key: 'classId', label: 'Classe', type: 'select', options: Object.entries(CLASSES).map(([id, c]) => [id, c.name]), onInput: () => editor?.redraw() },
    { key: 'bodyColor', label: 'Cor da parka', type: 'color', onInput: () => editor?.redraw() },
    { key: 'cost', label: 'Custo na partida (ouro)', type: 'number', min: 0, step: 5 },
    { key: 'unlock.type', label: 'Condição de desbloqueio', type: 'select', options: UNLOCK_TYPES },
    { key: 'unlock.value', label: 'Valor do desbloqueio', list: 'phase-ids', hint: 'Número (vitórias/rodadas) ou id da fase' },
  ]);
  const stats = fieldsForm(draft, Object.keys(BASE_STATS).filter((k) => k !== 'multishot').map((k) => ({
    key: `stats.${k}`, label: { damage: 'Dano', range: 'Alcance (px)', fireRate: 'Ataques/s', pierce: 'Perfuração', projectileSpeed: 'Vel. projétil', splash: 'Área (px)', slowPct: 'Lentidão %', slowDuration: 'Duração lentidão (s)' }[k],
    type: 'number', step: ['fireRate', 'slowDuration'].includes(k) ? 0.1 : 1, min: 0,
  })), 'grid-4');

  editor = createFaceEditor(draft.face, {
    extraPreview: (ctx, face) => drawEskimo(ctx, { ...draft, classId: base.inputs.classId?.value || draft.classId, bodyColor: base.inputs.bodyColor?.value || draft.bodyColor, face }, 140, 165, 85, 0, 1),
  });

  const branchInputs = [0, 1, 2].map((i) => el('input', { value: draft.branches?.[i] || `Caminho ${i + 1}`, maxlength: 30 }));
  const nodeRows = [];
  const treeGrid = el('div', { class: 'tree-editor' }, [1, 2, 3].map((b) => el('div', { class: 'tree-col' },
    el('label', { class: 'field' }, el('span', { text: `Caminho ${b}` }), branchInputs[b - 1]),
    [1, 2, 3].map((t) => {
      let node = draft.tree.find((n) => n.branch === b && n.tier === t);
      if (!node) { node = { id: uid('sk'), branch: b, tier: t, name: '', desc: '', cost: 1, gold: 150, effect: { key: 'damage', value: 1 } }; draft.tree.push(node); }
      const f = fieldsForm(node, [
        { key: 'name', label: `Nível ${t} — nome` },
        { key: 'desc', label: 'Descrição (opcional)' },
        { key: 'effect.key', label: 'Efeito', type: 'select', options: EFFECT_OPTIONS },
        { key: 'effect.value', label: 'Valor', type: 'number', step: 1 },
        { key: 'cost', label: 'Pontos', type: 'number', min: 0, step: 1 },
        { key: 'gold', label: 'Ouro p/ ativar', type: 'number', min: 0, step: 10 },
      ], 'grid-2');
      nodeRows.push({ node, f });
      return el('div', { class: 'tree-node-edit' }, f.node);
    }))));

  return {
    node: el('div', {},
      el('datalist', { id: 'phase-ids' }, data.phases.map((p) => el('option', { value: p.id, text: p.name }))),
      section('Aparência (Criador Visual)', editor.node),
      section('Identidade e desbloqueio', base.node),
      section('Atributos base', stats.node),
      section('Árvore de habilidades (3 caminhos × 3 níveis)', treeGrid)),
    read(target) {
      base.read(target);
      stats.read(target);
      target.face = editor.getFace();
      if (['wins', 'rounds'].includes(target.unlock.type)) target.unlock.value = Number(target.unlock.value) || 0;
      if (target.unlock.type === 'phase' && !byId(getData().phases, target.unlock.value)) throw new Error('Fase de desbloqueio inexistente.');
      target.branches = branchInputs.map((i) => i.value.trim() || 'Caminho');
      for (const { node, f } of nodeRows) {
        f.read(node);
        if (!node.name) throw new Error('Toda habilidade precisa de nome.');
      }
      if (target.stats.fireRate <= 0) throw new Error('Ataques/s precisa ser maior que zero.');
    },
  };
}

// ---------- Aba 2: Inimigos ----------
function enemyForm(draft) {
  const data = getData();
  const others = data.enemies.filter((e) => e.id !== draft.id);
  const f = fieldsForm(draft, [
    { key: 'name', label: 'Nome' },
    { key: 'hp', label: 'Resistência (acertos na camada)', type: 'number', min: 1, step: 1 },
    { key: 'speed', label: 'Velocidade (px/s)', type: 'number', min: 5, step: 5 },
    { key: 'size', label: 'Tamanho (raio)', type: 'number', min: 8, max: 60, step: 1 },
    { key: 'reward', label: 'Ouro ao estourar', type: 'number', min: 0, step: 1 },
    { key: 'dropChance', label: 'Chance de drop (0 a 1)', type: 'number', min: 0, max: 1, step: 0.005 },
    { key: 'childId', label: 'Ao morrer vira (camada anterior)', type: 'select', options: [['', '— nada (última camada) —'], ...others.map((e) => [e.id, e.name])] },
    { key: 'childCount', label: 'Quantidade gerada', type: 'number', min: 0, step: 1 },
  ]);
  const editor = createFaceEditor(draft.face);
  const chain = draft.id && byId(data.enemies, draft.id)
    ? layerChain(draft.id, data).map((e, i) => (i ? ` → ${e.name}` : e.name)).join('') + ` · RBE ${rbe(draft.id, data)}`
    : 'Salve para ver a cadeia de camadas.';
  return {
    node: el('div', {},
      section('Rosto (Criador Visual)', editor.node),
      section('Atributos e camadas', f.node, el('p', { class: 'hint', text: `Cadeia: ${chain}. RBE = vidas perdidas se ele escapar.` }))),
    read(target) {
      f.read(target);
      target.face = editor.getFace();
      target.hp = Math.max(1, target.hp);
      target.dropChance = Math.min(1, Math.max(0, target.dropChance));
      if (!target.childId) target.childCount = 0;
      else target.childCount = Math.max(1, target.childCount);
    },
  };
}

function blockEnemyDelete(enemy, data) {
  const parent = data.enemies.find((e) => e.childId === enemy.id);
  if (parent) return `"${parent.name}" vira esse inimigo. Ajuste antes de excluir.`;
  const phase = data.phases.find((p) => p.rounds.some((r) => r.groups.some((g) => g.enemyId === enemy.id)));
  if (phase) return `A fase "${phase.name}" usa esse inimigo. Remova das rodadas antes.`;
  return null;
}

// ---------- Aba 3: Fases & Rodadas ----------
function mapPreview(map) {
  const c = el('canvas', { width: 250, height: 150, class: 'map-preview' });
  const g = c.getContext('2d');
  g.fillStyle = '#eaf6ff'; g.fillRect(0, 0, 250, 150);
  g.strokeStyle = '#6fa8d6'; g.lineWidth = 10; g.lineJoin = 'round';
  g.beginPath();
  map?.points.forEach(([x, y], i) => (i ? g.lineTo(x * 250, y * 150) : g.moveTo(x * 250, y * 150)));
  g.stroke();
  return c;
}

function phaseForm(draft) {
  const data = getData();
  const rounds = clone(draft.rounds || []);
  const preview = el('div', {}, mapPreview(byId(data.maps, draft.mapId)));
  const f = fieldsForm(draft, [
    { key: 'name', label: 'Nome da fase' },
    { key: 'mapId', label: 'Mapa', type: 'select', options: data.maps.map((m) => [m.id, m.name]), onInput: (e) => preview.replaceChildren(mapPreview(byId(data.maps, e.target.value))) },
    { key: 'startGold', label: 'Ouro inicial', type: 'number', min: 0, step: 50 },
    { key: 'lives', label: 'Vidas', type: 'number', min: 1, step: 1 },
  ]);
  const enemyOpts = data.enemies.map((e) => [e.id, e.name]);
  const roundsBox = el('div', { class: 'rounds' });
  const memo = {};

  function renderRounds() {
    roundsBox.replaceChildren(
      ...rounds.map((r, ri) => {
        const total = r.groups.reduce((a, g) => a + rbe(g.enemyId, data, memo) * g.count, 0);
        return el('div', { class: 'round-card' },
          el('div', { class: 'round-head' },
            el('strong', { text: `Rodada ${ri + 1}` }), el('small', { class: 'muted', text: `RBE ${total}` }),
            el('button', { class: 'btn btn-small', text: 'Duplicar', onclick: () => { rounds.splice(ri + 1, 0, clone(r)); renderRounds(); } }),
            el('button', { class: 'btn btn-small btn-danger', text: 'Remover', onclick: () => { rounds.splice(ri, 1); renderRounds(); } })),
          r.groups.map((g, gi) => {
            const num = (key, label, step) => el('label', { class: 'field field-inline' }, el('span', { text: label }),
              el('input', { type: 'number', min: 0, step, value: g[key], oninput: (e) => { g[key] = Number(e.target.value) || 0; } }));
            return el('div', { class: 'group-row' },
              el('select', { value: g.enemyId, onchange: (e) => { g.enemyId = e.target.value; renderRounds(); } },
                enemyOpts.map(([id, n]) => el('option', { value: id, text: n }))),
              num('count', 'Qtd', 1), num('interval', 'Intervalo s', 0.1), num('delay', 'Atraso s', 0.5),
              el('button', { class: 'btn btn-small btn-ghost', text: 'X', 'aria-label': 'Remover grupo', onclick: () => { r.groups.splice(gi, 1); renderRounds(); } }));
          }),
          el('button', {
            class: 'btn btn-small', text: '+ Grupo de inimigos',
            onclick: () => { r.groups.push({ enemyId: enemyOpts[0]?.[0], count: 10, interval: 0.8, delay: 0 }); renderRounds(); },
          }));
      }),
      el('button', {
        class: 'btn btn-primary', text: '+ Rodada',
        onclick: () => { rounds.push({ groups: [{ enemyId: enemyOpts[0]?.[0], count: 10, interval: 0.8, delay: 0 }] }); renderRounds(); },
      }));
  }
  renderRounds();

  return {
    node: el('div', {}, section('Configuração', el('div', { class: 'phase-config' }, f.node, preview)), section('Rodadas e inimigos por rodada', roundsBox)),
    read(target) {
      f.read(target);
      target.rounds = clone(rounds).map((r) => ({ groups: r.groups.filter((g) => g.count > 0) })).filter((r) => r.groups.length);
      if (!target.rounds.length) throw new Error('A fase precisa de pelo menos uma rodada.');
    },
  };
}

// ---------- Aba 4: Itens ----------
function itemForm(draft) {
  const f = fieldsForm(draft, [
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo (slot)', type: 'select', options: Object.entries(ITEM_TYPES) },
    { key: 'rarity', label: 'Raridade', type: 'select', options: Object.entries(RARITIES).map(([k, v]) => [k, v.name]) },
    { key: 'classRestriction', label: 'Restrito à classe', type: 'select', options: [['', 'Qualquer classe'], ...Object.entries(CLASSES).map(([k, v]) => [k, v.name])] },
    { key: 'dropWeight', label: 'Peso no sorteio de drop', type: 'number', min: 0, step: 1, hint: '0 = nunca dropa' },
  ]);
  const st = fieldsForm(draft, Object.entries(EFFECT_KEYS).map(([k, v]) => ({ key: `stats.${k}`, label: v.label, type: 'number', step: 1 })), 'grid-4');
  return {
    node: el('div', {}, section('Item', f.node), section('Bônus permanentes (0 = sem bônus)', st.node)),
    read(target) {
      f.read(target);
      st.read(target);
      for (const k of Object.keys(target.stats)) if (!target.stats[k]) delete target.stats[k];
    },
  };
}

// ---------- Aba 5: Dados ----------
function dataTab() {
  const fileInput = el('input', { type: 'file', accept: 'application/json', class: 'hidden' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Arquivo muito grande.');
      const parsed = JSON.parse(await file.text());
      validateData(parsed);
      if (!(await confirmDialog('Substituir TODO o conteúdo atual pelo arquivo importado?', { danger: true, okLabel: 'Importar' }))) return;
      saveData({ ...parsed, version: getData().version });
      toast('Conteúdo importado.', 'success');
      render();
    } catch (e) { toast(`Importação falhou: ${e.message}`, 'error', 4000); } finally { fileInput.value = ''; }
  });
  const cur = el('input', { type: 'password', autocomplete: 'current-password' });
  const nxt = el('input', { type: 'password', autocomplete: 'new-password' });

  return el('div', { class: 'card data-tab' },
    section('Backup do conteúdo',
      el('p', { class: 'hint', text: 'Exporta esquimós, inimigos, itens, fases e mapas (não inclui contas).' }),
      el('div', { class: 'form-actions' },
        el('button', {
          class: 'btn btn-primary', text: 'Exportar JSON',
          onclick: () => {
            const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
            const a = el('a', { href: URL.createObjectURL(blob), download: 'esquimo-td-conteudo.json' });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          },
        }),
        el('button', { class: 'btn', text: 'Importar JSON', onclick: () => fileInput.click() }), fileInput)),
    section('Zona de perigo',
      el('div', { class: 'form-actions' },
        el('button', {
          class: 'btn btn-danger', text: 'Restaurar conteúdo padrão',
          onclick: async () => { if (await confirmDialog('Apagar todas as edições do admin e voltar ao conteúdo padrão?', { danger: true })) { resetData(); toast('Restaurado.', 'success'); render(); } },
        }),
        el('button', {
          class: 'btn btn-danger', text: 'Apagar todas as contas de jogador',
          onclick: async () => { if (await confirmDialog('Apagar TODAS as contas e progresso deste navegador?', { danger: true })) { storage.remove('accounts'); storage.remove('session'); toast('Contas apagadas.', 'success'); } },
        }))),
    section('Trocar senha do admin',
      el('div', { class: 'grid-3' },
        el('label', { class: 'field' }, el('span', { text: 'Senha atual' }), cur),
        el('label', { class: 'field' }, el('span', { text: 'Nova senha' }), nxt),
        el('button', {
          class: 'btn', text: 'Trocar senha',
          onclick: async () => { try { await adminChangePassword(cur.value, nxt.value); cur.value = nxt.value = ''; toast('Senha alterada.', 'success'); } catch (e) { toast(e.message, 'error'); } },
        }))));
}

// ---------- Tela ----------
let rootEl = null;
const TABS = [['eskimos', 'Esquimós'], ['enemies', 'Inimigos'], ['phases', 'Fases & Rodadas'], ['items', 'Itens & Armas'], ['data', 'Dados']];

function render() {
  const content = {
    eskimos: () => entityTab({ key: 'eskimos', prefix: 'esq', newLabel: 'Esquimó', newEntity: newEskimo, thumb: (x) => eskimoCanvas(x, 40), sub: (x) => CLASSES[x.classId]?.name || x.classId, buildForm: eskimoForm }),
    enemies: () => entityTab({
      key: 'enemies', prefix: 'ini', newLabel: 'Inimigo', thumb: (x) => faceCanvas(x.face, 40), sub: (x) => `RBE ${rbe(x.id, getData())} · vel ${x.speed}`,
      newEntity: () => ({ id: '', name: '', hp: 1, speed: 90, size: 16, reward: 1, dropChance: 0.02, childId: '', childCount: 0, face: { ...DEFAULT_FACE, headwear: 'nenhum', eyes: 'bravos', skin: '#ff4757' } }),
      buildForm: enemyForm, blockDelete: blockEnemyDelete,
    }),
    phases: () => entityTab({
      key: 'phases', prefix: 'fase', newLabel: 'Fase', thumb: () => el('span', { class: 'phase-thumb' }), sub: (x) => `${x.rounds.length} rodadas`,
      newEntity: () => ({ id: '', name: '', mapId: getData().maps[0]?.id, startGold: 650, lives: 100, rounds: [{ groups: [{ enemyId: getData().enemies[0]?.id, count: 10, interval: 0.8, delay: 0 }] }] }),
      buildForm: phaseForm,
      blockDelete: (p, d) => (d.eskimos.some((e) => e.unlock?.type === 'phase' && e.unlock.value === p.id) ? 'Algum esquimó é desbloqueado por essa fase.' : null),
    }),
    items: () => entityTab({
      key: 'items', prefix: 'item', newLabel: 'Item', thumb: (x) => itemCanvas(x, 36), sub: (x) => `${RARITIES[x.rarity]?.name} · ${ITEM_TYPES[x.type]}`,
      newEntity: () => ({ id: '', name: '', type: 'arma', rarity: 'comum', classRestriction: '', dropWeight: 60, stats: { damage: 1 } }),
      buildForm: itemForm,
    }),
    data: dataTab,
  }[state.tab]();

  rootEl.replaceChildren(el('div', { class: 'screen screen-admin' },
    el('header', { class: 'topbar' },
      el('h1', { class: 'logo logo-small' }, 'Painel ', el('span', { text: 'Admin' })),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn-small', text: 'Ir para o jogo', onclick: () => go('login') }),
      el('button', { class: 'btn btn-small btn-danger', text: 'Sair do admin', onclick: () => { adminLogout(); go('login'); } })),
    el('nav', { class: 'tabs tabs-scroll' }, TABS.map(([id, label]) => el('button', {
      class: `tab ${state.tab === id ? 'active' : ''}`, text: label, onclick: () => { state.tab = id; render(); },
    }))),
    content));
}

export function adminScreen(root) {
  if (!isAdminSession()) { go('adminLogin'); return; }
  rootEl = root;
  render();
  return () => { rootEl = null; };
}
