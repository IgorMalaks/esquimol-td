// Painel Admin: CRUD de Esquimós (com árvore), Inimigos (camadas), Fases/Rodadas, Itens e Dados.
import { el, toast, clone, getPath, setPath, slugify, uid, confirmDialog } from '../core/utils.js';
import { go } from '../core/router.js';
import { isAdminSession, adminLogout, adminChangePassword, currentAccount } from '../core/auth.js';
import { storage } from '../core/storage.js';
import { getData, saveData, resetData, prepareData, byId } from '../data/gameData.js';
import { CLASSES, ITEM_TYPES, RARITIES, DEFAULT_FACE } from '../data/defaults.js';
import { EFFECT_KEYS, BASE_STATS, computeStats } from '../game/stats.js';
import { ENEMY_TRAITS, roundsHaveAir } from '../game/enemies.js';
import { ALLY_DEFAULTS, ALLY_OPTIONS, BUFF_KEYS } from '../game/roles.js';
import { ABILITY_SCALES, ABILITY_TYPES } from '../game/abilities.js';
import { economy, RARITY_ORDER } from '../game/economy.js';
import { DAMAGE_LABELS, DEFAULT_MATRIX, ELEMENT_LABELS } from '../game/elements.js';
import { BIOME_DEFAULTS, FRAGMENT_DEFAULTS } from '../data/biomes.js';
import { isOnline } from '../core/online.js';
import { rbe, layerChain } from '../core/progression.js';
import { createFaceEditor } from '../ui/faceEditor.js';
import { drawEskimo, eskimoCanvas, faceCanvas, itemCanvas } from '../render/faceRenderer.js';

const state = { tab: 'eskimos', eskimos: null, enemies: null, phases: null, items: null, draft: null };
const filters = new Map();

const UNLOCK_TYPES = [['default', 'Inicial'], ['wins', 'Nº de vitórias'], ['rounds', 'Nº de rodadas vencidas'],
  ['phase', 'Completar fase'], ['fragments', 'Fragmentos de bioma']];
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

  const newLabel = cfg.newAction ?? `Novo ${cfg.newLabel.toLowerCase()}`;
  const rows = all.map((x) => ({
    text: `${x.name} ${cfg.sub(x) ?? ''}`,
    button: el('button', {
      class: `admin-item ${!isNew && x.id === draft?.id ? 'active' : ''}`,
      'aria-pressed': String(!isNew && x.id === draft?.id),
      onclick: () => { state[cfg.key] = x.id; render(); },
    }, el('span', { class: 'admin-item-art', 'aria-hidden': 'true' }, cfg.thumb(x)),
    el('span', { class: 'admin-item-text' }, el('strong', { text: x.name }), el('small', { text: cfg.sub(x) }))),
  }));
  const filter = el('input', { class: 'admin-filter', type: 'search', 'aria-label': 'Buscar no catálogo',
    placeholder: 'Buscar no catálogo', value: filters.get(cfg.key) ?? '' });
  const empty = el('p', { class: 'admin-empty', role: 'status', hidden: true });
  const normalize = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  function updateList() {
    const query = normalize(filter.value.trim());
    let visible = 0;
    for (const { button, text } of rows) {
      button.hidden = !normalize(text).includes(query);
      if (!button.hidden) visible++;
    }
    empty.hidden = visible > 0;
    empty.textContent = all.length ? 'Nenhum resultado para esta busca.' : 'O catálogo está vazio.';
  }
  filter.addEventListener('input', () => { filters.set(cfg.key, filter.value); updateList(); });
  updateList();

  const listNode = el('aside', { class: 'admin-catalog', 'aria-label': 'Catálogo' },
    el('div', { class: 'admin-catalog-heading' },
      el('h2', { text: 'Catálogo' }), el('span', { class: 'admin-count', text: String(all.length) })),
    el('button', {
      class: 'btn btn-primary btn-block admin-create', text: `+ ${newLabel}`,
      onclick: () => { state[cfg.key] = '__new__'; state.draft = cfg.newEntity(); render(); },
    }),
    all.length > 0 && filter,
    el('div', { class: 'admin-list' }, rows.map(({ button }) => button), empty));

  if (!draft) return el('div', { class: 'admin-layout' }, listNode,
    el('div', { class: 'card admin-form' }, el('p', { text: 'Crie um registro para começar.' })));

  const form = cfg.buildForm(draft);
  const saveButton = el('button', { class: 'btn btn-primary', text: 'Salvar', onclick: () => save() });
  const save = async () => {
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando…';
    try {
      form.read(draft);
      if (!draft.name?.trim()) throw new Error('Informe um nome.');
      if (!draft.id) draft.id = slugify(draft.name, cfg.prefix);
      const next = clone(getData());
      const idx = next[cfg.key].findIndex((x) => x.id === draft.id);
      if (idx >= 0) next[cfg.key][idx] = clone(draft); else next[cfg.key].push(clone(draft));
      await saveData(next);
      state[cfg.key] = draft.id;
      toast('Salvo!', 'success');
      render();
    } catch (e) {
      toast(e.message, 'error', 4000);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Salvar';
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
      await saveData(next);
      state[cfg.key] = null;
      render();
    } catch (e) { toast(e.message, 'error', 4000); }
  };

  return el('div', { class: 'admin-layout' }, listNode,
    el('div', { class: 'card admin-form' },
      el('header', { class: 'admin-editor-heading' },
        el('h2', { text: isNew ? newLabel : draft.name }),
        el('div', { class: 'admin-editor-actions' },
          el('button', { class: 'btn admin-discard', text: isNew ? 'Descartar' : 'Excluir', onclick: del }),
          saveButton)),
      form.node));
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
  function refreshClass() {
    const role = CLASSES[base.inputs.classId.value]?.role ?? 'atacante';
    attackerSection.hidden = role !== 'atacante';
    summonSection.hidden = role !== 'invocador';
    supportSection.hidden = role !== 'suporte';
    editor?.redraw();
  }
  function refreshUnlock() {
    fragmentFields.node.hidden = base.inputs['unlock.type'].value !== 'fragments';
  }
  const base = fieldsForm(draft, [
    { key: 'name', label: 'Nome' },
    { key: 'classId', label: 'Classe', type: 'select', options: Object.entries(CLASSES).map(([id, c]) => [id, c.name]), onInput: refreshClass },
    { key: 'bodyColor', label: 'Cor da parka', type: 'color', onInput: () => editor?.redraw() },
    { key: 'cost', label: 'Custo na partida (ouro)', type: 'number', min: 0, step: 5 },
    { key: 'damageType', label: 'Tipo de dano', type: 'select', options: [['', 'Padrão da classe'], ...Object.entries(DAMAGE_LABELS)] },
    { key: 'unlock.type', label: 'Condição de desbloqueio', type: 'select', options: UNLOCK_TYPES, onInput: refreshUnlock },
    { key: 'unlock.value', label: 'Valor do desbloqueio', list: 'phase-ids', hint: 'Número (vitórias/rodadas) ou id da fase' },
  ]);
  const fragmentFields = fieldsForm(draft, [
    { key: 'variantOf', label: 'Variante de', type: 'select', options: [['', 'Selecione'], ...data.eskimos
      .filter((eskimo) => eskimo.id !== draft.id && !eskimo.variantOf).map((eskimo) => [eskimo.id, eskimo.name])] },
    { key: 'unlock.biome', label: 'Bioma dos fragmentos', type: 'select', options: [['', 'Selecione'], ...data.biomes
      .filter((biome) => biome.id !== 'tundra').map((biome) => [biome.id, biome.name])] },
    { key: 'unlock.amount', label: 'Custo em fragmentos (padrão 50)', type: 'number', min: 1, step: 1 },
  ]);
  refreshUnlock();
  const stats = fieldsForm(draft, Object.keys(BASE_STATS).filter((k) => k !== 'multishot').map((k) => ({
    key: `stats.${k}`, label: { damage: 'Dano', range: 'Alcance (px)', fireRate: 'Ataques/s', pierce: 'Perfuração', projectileSpeed: 'Vel. projétil', splash: 'Área (px)', slowPct: 'Lentidão %', slowDuration: 'Duração lentidão (s)' }[k],
    type: 'number', step: ['fireRate', 'slowDuration'].includes(k) ? 0.1 : 1, min: 0,
  })), 'grid-4');
  const summonFields = fieldsForm({ ...ALLY_DEFAULTS, ...draft.summon }, [
    { key: 'summonInterval', label: 'Intervalo (s)', type: 'number', min: 0.2, step: 0.1 },
    { key: 'summonCount', label: 'Aliados por invocação', type: 'number', min: 1, max: 20 },
    { key: 'maxAllies', label: 'Limite de aliados', type: 'number', min: 1, max: 40 },
    { key: 'allyHp', label: 'Vida do aliado', type: 'number', min: 1 },
    { key: 'allyDamage', label: 'Dano do aliado', type: 'number', min: 1 },
    { key: 'allySpeed', label: 'Velocidade do aliado', type: 'number', min: 1 },
    { key: 'allyLifetime', label: 'Duração do aliado (s)', type: 'number', min: 1 },
    { key: 'allyKind', label: 'Visual do aliado', type: 'select', options: ALLY_OPTIONS.map((value) => [value, value]) },
  ]);
  const supportFields = fieldsForm({
    range: draft.classId === 'xama' ? draft.stats.range : 120,
    ...Object.fromEntries((draft.buffs ?? [{ key: 'damage', value: 1 }]).map(({ key, value }) => [key, value])),
  }, [
    { key: 'range', label: 'Raio da aura', type: 'number', min: 1 },
    ...BUFF_KEYS.map((key) => ({ key, label: EFFECT_KEYS[key]?.label ?? 'Antiaéreo (0 ou 1)', type: 'number', min: 0 })),
  ]);
  const attackerSection = section('Atributos base', stats.node);
  const summonSection = section('Invocação', summonFields.node);
  const supportSection = section('Aura de suporte', supportFields.node);
  refreshClass();

  editor = createFaceEditor(draft.face, {
    extraPreview: (ctx, face) => drawEskimo(ctx, { ...draft, classId: base.inputs.classId?.value || draft.classId, bodyColor: base.inputs.bodyColor?.value || draft.bodyColor, face }, 130, 238, 76, 0, 1),
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
      section('Identidade e desbloqueio', base.node, fragmentFields.node),
      attackerSection, summonSection, supportSection,
      section('Árvore de habilidades (3 caminhos × 3 níveis)', treeGrid)),
    read(target) {
      base.read(target);
      if (!target.damageType) delete target.damageType;
      if (target.unlock.type === 'fragments') {
        fragmentFields.read(target);
        if (target.unlock.amount > 100) toast('O custo pode exigir mais de 20 partidas. Confira o simulador de economia.', 'info', 6000);
      }
      const role = CLASSES[target.classId]?.role ?? 'atacante';
      if (role === 'atacante') stats.read(target);
      if (role === 'invocador') {
        target.summon ??= {};
        summonFields.read(target.summon);
        if (target.summon.summonInterval < 0.2 || Object.keys(ALLY_DEFAULTS).some((key) =>
          key !== 'allyKind' && key !== 'allyExplode' && key !== 'allySlowPct' && target.summon[key] <= 0)) {
          throw new Error('Os atributos de invocação precisam ser positivos.');
        }
        if (!Number.isInteger(target.summon.summonCount) || target.summon.summonCount > 20 ||
          !Number.isInteger(target.summon.maxAllies) || target.summon.maxAllies > 40) {
          throw new Error('Use até 20 aliados por invocação e limite de até 40 aliados.');
        }
      }
      if (role === 'suporte') {
        const values = {};
        supportFields.read(values);
        target.stats = { range: Math.max(1, values.range) };
        target.buffs = BUFF_KEYS.filter((key) => values[key] > 0).map((key) => ({ key, value: values[key] }));
      }
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
    { key: 'hp', label: 'Resistência (vida da camada)', type: 'number', min: 0.1, step: 0.1 },
    { key: 'element', label: 'Elemento', type: 'select', options: Object.entries(ELEMENT_LABELS) },
    { key: 'speed', label: 'Velocidade (px/s)', type: 'number', min: 5, step: 5 },
    { key: 'size', label: 'Tamanho (raio)', type: 'number', min: 8, max: 60, step: 1 },
    { key: 'reward', label: 'Ouro ao estourar', type: 'number', min: 0, step: 1 },
    { key: 'dropChance', label: 'Chance de drop (0 a 1)', type: 'number', min: 0, max: 1, step: 0.005 },
    { key: 'childId', label: 'Ao morrer vira (camada anterior)', type: 'select', options: [['', '— nada (última camada) —'], ...others.map((e) => [e.id, e.name])] },
    { key: 'childCount', label: 'Quantidade gerada', type: 'number', min: 0, step: 1 },
  ]);
  const editor = createFaceEditor(draft.face);
  const traits = Object.entries(ENEMY_TRAITS).map(([id, name]) => {
    const input = el('input', { type: 'checkbox', checked: draft.traits?.includes(id) });
    return { id, input, label: el('label', {}, input, ` ${name}`) };
  });
  const chain = draft.id && byId(data.enemies, draft.id)
    ? layerChain(draft.id, data).map((e) =>
      [e.name, ...(e.traits ?? []).map((trait) => ENEMY_TRAITS[trait])].join(' · ')
    ).join(' → ') + ` · RBE ${rbe(draft.id, data)}`
    : 'Salve para ver a cadeia de camadas.';
  return {
    node: el('div', {},
      section('Rosto (Criador Visual)', editor.node),
      section('Traços', el('div', { class: 'grid-3' }, traits.map((trait) => trait.label))),
      section('Atributos e camadas', f.node, el('p', { class: 'hint', text: `Cadeia: ${chain}. RBE = vidas perdidas se ele escapar.` }))),
    read(target) {
      f.read(target);
      target.face = editor.getFace();
      target.traits = traits.filter((trait) => trait.input.checked).map((trait) => trait.id);
      if (target.traits.length > 2) throw new Error('Use até dois traços em cada camada.');
      target.hp = Math.max(0.1, target.hp);
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
      if (roundsHaveAir(target.rounds, data.enemies) && !data.eskimos.some((eskimo) =>
        (eskimo.unlock?.type ?? 'default') === 'default' && computeStats(eskimo).hitsAir)) {
        toast('A fase tem inimigos aéreos e nenhum esquimó inicial os atinge.', 'info', 5000);
      }
    },
  };
}

// ---------- Aba 4: Itens ----------
function itemForm(draft) {
  const definitions = getData().abilities;
  const f = fieldsForm(draft, [
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo (slot)', type: 'select', options: Object.entries(ITEM_TYPES),
      onInput: () => { ability.node.hidden = f.inputs.type.value !== 'habilidade'; } },
    { key: 'rarity', label: 'Raridade', type: 'select', options: Object.entries(RARITIES).map(([k, v]) => [k, v.name]) },
    { key: 'powerTier', label: 'Força dentro da raridade', type: 'select', options: [['1', '1'], ['2', '2'], ['3', '3']] },
    { key: 'damageType', label: 'Tipo de dano da arma', type: 'select', options: [['', 'Usar tipo da torre'], ...Object.entries(DAMAGE_LABELS)] },
    { key: 'classRestriction', label: 'Restrito à classe', type: 'select', options: [['', 'Qualquer classe'], ...Object.entries(CLASSES).map(([k, v]) => [k, v.name])] },
    { key: 'dropWeight', label: 'Peso no sorteio de drop', type: 'number', min: 0, step: 1, hint: '0 = nunca dropa' },
  ]);
  const ability = fieldsForm(draft, [
    { key: 'abilityId', label: 'Habilidade ativa', type: 'select', options: [['', 'Selecione'], ...definitions.map((definition) => [definition.id, definition.name])] },
  ]);
  ability.node.hidden = draft.type !== 'habilidade';
  const st = fieldsForm(draft, Object.entries(EFFECT_KEYS).filter(([key]) =>
    key !== 'damageType' && !/^(ally|aura|buff|summon|maxAllies)/.test(key)).map(([k, v]) =>
    ({ key: `stats.${k}`, label: v.label, type: 'number', step: 1 })), 'grid-4');
  return {
    node: el('div', {}, section('Item', f.node, ability.node), section('Bônus permanentes (0 = sem bônus)', st.node)),
    read(target) {
      f.read(target);
      st.read(target);
      if (target.type === 'habilidade') ability.read(target);
      else delete target.abilityId;
      target.powerTier = Number(target.powerTier) || 1;
      for (const k of Object.keys(target.stats)) if (!target.stats[k]) delete target.stats[k];
    },
  };
}

const numberField = (key, label, min = 0, step = 1) => ({ key, label, min, step, type: 'number' });

function abilityForm(draft) {
  const metadata = ABILITY_TYPES[draft.type] ?? Object.values(ABILITY_TYPES)[0];
  const form = fieldsForm({ ...metadata, ...draft }, [
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Comportamento', type: 'select', options: Object.entries(ABILITY_TYPES).map(([id, value]) => [id, value.name]) },
    numberField('power', 'Poder base', 0, 0.1),
    numberField('area', 'Área base (px)'),
    numberField('duration', 'Duração base (s)', 0, 0.1),
  ]);
  form.inputs.type.addEventListener('input', (event) => {
    const base = ABILITY_TYPES[event.target.value];
    for (const key of ['power', 'area', 'duration']) form.inputs[key].value = base[key];
  });
  return form;
}

function raidForm(draft) {
  const data = getData();
  const phase = phaseForm({ ...draft, rounds: draft.farmRounds });
  const enemies = (boss) => data.enemies.filter((enemy) => Boolean(enemy.traits?.includes('chefe')) === boss)
    .map((enemy) => [enemy.id, enemy.name]);
  const rules = fieldsForm(draft, [
    numberField('keyCost', 'Custo em chaves', 1),
    numberField('farmGoldMultiplier', 'Multiplicador de ouro no farm', 0.1, 0.1),
    numberField('prepTime', 'Preparação (s)'),
    { key: 'bossId', label: 'Chefe', type: 'select', options: enemies(true) },
    numberField('bossAbility.interval', 'Intervalo do atordoamento (s)', 1),
    numberField('bossAbility.radius', 'Raio do atordoamento', 1),
    numberField('bossAbility.duration', 'Duração do atordoamento (s)', 0.1, 0.1),
    numberField('bossLoot.rolls', 'Sorteios do chefe', 1),
  ]);
  const stages = draft.bossPhases.map((stage, index) => fieldsForm(stage, [
    numberField('hp', `Fase ${index + 1} · fração da vida`, 0.01, 0.01),
    numberField('speedMultiplier', 'Velocidade ×', 0.1, 0.05),
    { key: 'escortId', label: 'Escolta', type: 'select', options: enemies(false) },
    numberField('escortCount', 'Quantidade'),
  ], 'grid-4'));
  return {
    node: el('div', {}, phase.node, section('Raide e chefe', rules.node, stages.map((stage) => stage.node))),
    read(target) {
      phase.read(target);
      target.farmRounds = target.rounds;
      delete target.rounds;
      rules.read(target);
      stages.forEach((form, index) => form.read(target.bossPhases[index]));
    },
  };
}

function economyTab() {
  const draft = clone(economy(getData()));
  draft.abilityScales ??= clone(ABILITY_SCALES);
  draft.fragments = { ...FRAGMENT_DEFAULTS, ...draft.fragments };
  const groups = [
    ['Regras de economia', [
      numberField('dropRateMultiplier', 'Multiplicador de drops (0 a 1)', 0, 0.01),
      numberField('chestChance', 'Chance de baú (0 a 1)', 0, 0.01),
      numberField('fusionChance', 'Chance de fusão (0 a 1)', 0, 0.01),
      numberField('legendaryThreshold', 'Chefes até a garantia', 1),
      numberField('raidKeyCap', 'Limite de chaves', 1),
      ...[1, 2, 3].map((tier) => numberField(`legendaryFactors.${tier}`, `Peso na garantia · força ${tier}`, 0.01, 0.01)),
    ]],
    ['Fragmentos', [
      numberField('fragments.layerChance', 'Chance por camada (0 a 1)', 0, 0.001),
      numberField('fragments.firstWin', 'Bônus da primeira vitória'),
      numberField('fragments.win', 'Bônus de outra vitória'),
      numberField('fragments.raidMin', 'Mínimo do chefe de raide'),
      numberField('fragments.raidMax', 'Máximo do chefe de raide'),
      numberField('fragments.endlessInterval', 'Rodadas por fragmento no Infinito', 1),
      numberField('fragments.xp', 'XP por fragmento após recrutar', 1),
    ]],
    ...[['normal', 'Fases e Infinito'], ['raidFarm', 'Farm da raide'], ['raidBoss', 'Chefe da raide']].map(([source, label]) =>
      [label, (source === 'raidBoss' ? RARITY_ORDER.slice(2) : RARITY_ORDER.slice(0, -1))
        .map((rarity) => numberField(`weights.${source}.${rarity}`, RARITIES[rarity].name, 0, 0.01))]),
    ...RARITY_ORDER.map((rarity) => [`Habilidades · ${RARITIES[rarity].name}`,
      Object.entries({ cooldown: 'Recarga (s)', power: 'Poder ×', area: 'Área ×', duration: 'Duração ×' })
        .map(([key, label]) => numberField(`abilityScales.${rarity}.${key}`, label, 0.01, 0.01))]),
  ].map(([label, defs]) => ({ label, form: fieldsForm(draft, defs) }));
  const fusion = RARITY_ORDER.slice(0, 4).map((rarity) => {
    const input = el('input', { type: 'checkbox', checked: draft.fusionAllowed[rarity] });
    return { rarity, input, node: el('label', {}, input, ` ${RARITIES[rarity].name}`) };
  });
  return el('div', { class: 'card data-tab' },
    groups.map(({ label, form }) => section(label, form.node)),
    section('Raridades que podem subir por fusão', el('div', { class: 'grid-4' }, fusion.map((entry) => entry.node))),
    el('button', { class: 'btn btn-primary', text: 'Salvar economia', onclick: async () => {
      try {
        for (const { form } of groups) form.read(draft);
        for (const { rarity, input } of fusion) draft.fusionAllowed[rarity] = input.checked;
        const fragments = draft.fragments;
        if (fragments.layerChance < 0 || fragments.layerChance > 1 || fragments.raidMin > fragments.raidMax ||
            fragments.endlessInterval < 1 || fragments.xp < 1) throw new Error('Configuração de fragmentos inválida.');
        await saveData({ ...getData(), economy: draft });
        toast('Economia salva.', 'success');
      } catch (error) { toast(error.message, 'error'); }
    } }));
}

function elementsTab() {
  const data = getData();
  const draft = clone(data.elements ?? DEFAULT_MATRIX);
  const forms = Object.entries(ELEMENT_LABELS).map(([element, title]) => ({
    title, fields: fieldsForm(draft[element], Object.entries(DAMAGE_LABELS)
      .map(([damageType, name]) => numberField(damageType, name, 0, 0.05)), 'grid-3'),
    element,
  }));
  return el('div', { class: 'card data-tab' },
    forms.map(({ title, fields }) => section(title, fields.node)),
    el('button', { class: 'btn btn-primary', text: 'Salvar matriz', onclick: async () => {
      try {
        for (const { fields, element } of forms) fields.read(draft[element]);
        await saveData({ ...getData(), elements: draft });
        toast('Matriz salva.', 'success');
      } catch (error) { toast(error.message, 'error'); }
    } }));
}

function biomeForm(draft) {
  const colors = { ground: 'Chão', edge: 'Borda', path: 'Caminho', trees: 'Decoração' };
  return fieldsForm(draft, [
    { key: 'name', label: 'Nome' }, { key: 'hint', label: 'Descrição do modificador' },
    { key: 'effect', label: 'Modificador', type: 'select', options: BIOME_DEFAULTS.map(({ effect }) => [effect, effect]) },
    ...Object.entries(colors).map(([key, label]) => ({ key: `palette.${key}`, label, type: 'color' })),
    ...Object.entries(ELEMENT_LABELS).map(([id, name]) => numberField(`weights.${id}`, `Peso · ${name}`, 0, 0.1)),
  ]);
}

// ---------- Aba 5: Dados ----------
function dataTab() {
  const fileInput = el('input', { type: 'file', accept: 'application/json', class: 'hidden' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Arquivo muito grande.');
      const parsed = prepareData(JSON.parse(await file.text()));
      if (!(await confirmDialog('Substituir TODO o conteúdo atual pelo arquivo importado?', { danger: true, okLabel: 'Importar' }))) return;
      await saveData(parsed, { replace: true });
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
          onclick: async () => {
            if (!(await confirmDialog('Apagar todas as edições do admin e voltar ao conteúdo padrão?', { danger: true }))) return;
            try { await resetData(); toast('Restaurado.', 'success'); render(); }
            catch (error) { toast(error.message, 'error'); }
          },
        }),
        !isOnline() && el('button', {
          class: 'btn btn-danger', text: 'Apagar todas as contas de jogador',
          onclick: async () => { if (await confirmDialog('Apagar TODAS as contas e progresso deste navegador?', { danger: true })) { storage.remove('accounts'); storage.remove('session'); toast('Contas apagadas.', 'success'); } },
        }))),
    !isOnline() && section('Trocar senha do admin',
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
const GROUPS = [
  ['Conteúdo', [['eskimos', 'Esquimós'], ['enemies', 'Inimigos'], ['phases', 'Fases e rodadas'], ['raids', 'Raides'], ['biomes', 'Biomas']]],
  ['Balanceamento', [['items', 'Itens e armas'], ['abilities', 'Habilidades'], ['economy', 'Economia'], ['elements', 'Elementos']]],
  ['Configurações', [['data', 'Dados e backup']]],
];
const TITLES = Object.fromEntries(GROUPS.flatMap(([, links]) => links));

function changeTab(tab) {
  if (tab === state.tab) return;
  state.tab = tab;
  render();
  rootEl?.querySelector('.admin-section-title')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function render() {
  if (!rootEl) return;
  const content = {
    eskimos: () => entityTab({ key: 'eskimos', prefix: 'esq', newLabel: 'Esquimó', newEntity: newEskimo, thumb: (x) => eskimoCanvas(x, 40), sub: (x) => CLASSES[x.classId]?.name || x.classId, buildForm: eskimoForm }),
    enemies: () => entityTab({
      key: 'enemies', prefix: 'ini', newLabel: 'Inimigo', thumb: (x) => faceCanvas(x.face, 40), sub: (x) => `RBE ${rbe(x.id, getData())} · vel ${x.speed}`,
      newEntity: () => ({ id: '', name: '', hp: 1, speed: 90, size: 16, reward: 1, dropChance: 0.02, childId: '', childCount: 0, face: { ...DEFAULT_FACE, headwear: 'nenhum', eyes: 'bravos', skin: '#ff4757' } }),
      buildForm: enemyForm, blockDelete: blockEnemyDelete,
    }),
    phases: () => entityTab({
      key: 'phases', prefix: 'fase', newLabel: 'Fase', newAction: 'Nova fase', thumb: () => el('span', { class: 'phase-thumb' }), sub: (x) => `${x.rounds.length} rodadas`,
      newEntity: () => ({ id: '', name: '', mapId: getData().maps[0]?.id, startGold: 650, lives: 100, rounds: [{ groups: [{ enemyId: getData().enemies[0]?.id, count: 10, interval: 0.8, delay: 0 }] }] }),
      buildForm: phaseForm,
      blockDelete: (p, d) => (d.eskimos.some((e) => e.unlock?.type === 'phase' && e.unlock.value === p.id) ? 'Algum esquimó é desbloqueado por essa fase.' : null),
    }),
    items: () => entityTab({
      key: 'items', prefix: 'item', newLabel: 'Item', thumb: (x) => itemCanvas(x, 36), sub: (x) => `${RARITIES[x.rarity]?.name} · ${ITEM_TYPES[x.type]}`,
      newEntity: () => ({ id: '', name: '', type: 'arma', rarity: 'comum', classRestriction: '', dropWeight: 60, stats: { damage: 1 } }),
      buildForm: itemForm,
    }),
    raids: () => entityTab({
      key: 'raids', prefix: 'raide', newLabel: 'Raide', newAction: 'Nova raide', thumb: () => el('span', { class: 'phase-thumb' }),
      sub: (raid) => `${raid.farmRounds.length} rodadas de farm`, buildForm: raidForm,
      newEntity: () => {
        const data = getData();
        const escort = data.enemies.find((enemy) => !enemy.traits?.includes('chefe'))?.id;
        return { id: '', name: '', mapId: data.maps[0]?.id, startGold: 900, lives: 100,
          keyCost: 1, farmGoldMultiplier: 1.5, prepTime: 30,
          bossId: data.enemies.find((enemy) => enemy.traits?.includes('chefe'))?.id,
          farmRounds: [{ groups: [{ enemyId: escort, count: 10, interval: 0.8, delay: 0 }] }],
          bossAbility: { type: 'atordoar', interval: 12, radius: 140, duration: 3 },
          bossPhases: [0.66, 0.33].map((hp) => ({ hp, speedMultiplier: 1.25, escortId: escort, escortCount: 3 })),
          bossLoot: { source: 'raidBoss', rolls: 2 },
        };
      },
    }),
    abilities: () => entityTab({
      key: 'abilities', prefix: 'habilidade', newLabel: 'Habilidade', newAction: 'Nova habilidade', thumb: () => el('span', { class: 'phase-thumb' }),
      sub: (ability) => ABILITY_TYPES[ability.type]?.name, buildForm: abilityForm,
      newEntity: () => ({ id: '', name: '', type: 'chuva_flechas' }),
      blockDelete: (ability, data) => data.items.some((item) => item.abilityId === ability.id) ?
        'Existe um item que usa esta habilidade.' : null,
    }),
    economy: economyTab,
    biomes: () => entityTab({
      key: 'biomes', prefix: 'bioma', newLabel: 'Bioma',
      thumb: (biome) => el('span', { class: 'phase-thumb', style: { background: biome.palette.ground } }),
      sub: (biome) => biome.effect, buildForm: biomeForm,
      newEntity: () => ({ ...structuredClone(BIOME_DEFAULTS[0]), id: '', name: '' }),
    }),
    elements: elementsTab,
    data: dataTab,
  }[state.tab]();

  const mode = isOnline() ? 'Servidor online' : 'Neste navegador';
  rootEl.replaceChildren(el('div', { class: 'screen-admin admin-workshop' },
    el('header', { class: 'admin-top' },
      el('div', { class: 'admin-brand' },
        el('strong', {}, 'Esquimó ', el('span', { text: 'TD' })),
        el('span', { class: 'admin-brand-section', text: 'Painel Admin' })),
      el('div', { class: 'admin-top-actions' },
        el('button', { class: 'btn', text: 'Voltar ao jogo', onclick: () => go(currentAccount() ? 'menu' : 'login') }),
        el('button', { class: 'btn admin-discard', text: 'Sair do admin', onclick: async () => {
          try { await adminLogout(); go(currentAccount() ? 'menu' : 'login'); } catch (error) { toast(error.message, 'error'); }
        } }))),
    el('div', { class: 'admin-workspace' },
      el('nav', { class: 'admin-nav', 'aria-label': 'Seções do painel' },
        GROUPS.map(([name, links]) => el('div', { class: 'admin-nav-group' }, el('h2', { text: name }),
          links.map(([id, label]) => el('button', {
            class: 'admin-nav-button', text: label, 'aria-current': state.tab === id ? 'page' : null,
            onclick: () => changeTab(id),
          })) ))),
      el('main', { class: 'admin-main' },
        el('label', { class: 'field admin-mobile-nav' }, el('span', { text: 'Seção do painel' }),
          el('select', { value: state.tab, onchange: (event) => changeTab(event.target.value) },
            GROUPS.map(([name, links]) => el('optgroup', { label: name },
              links.map(([id, label]) => el('option', { value: id, text: label })))))),
        el('header', { class: 'admin-banner' },
          el('span', { class: 'admin-mode', text: mode }),
          el('h1', { class: 'admin-section-title', tabindex: '-1', text: TITLES[state.tab] })),
        content))));
}

export function adminScreen(root) {
  if (!isAdminSession()) { go('adminLogin'); return; }
  rootEl = root;
  render();
  return () => { rootEl = null; };
}
