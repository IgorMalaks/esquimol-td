import { el, toast } from '../core/utils.js';
import { go } from '../core/router.js';
import { login, register, adminConfigured, adminSetup, adminLogin } from '../core/auth.js';
import { getData } from '../data/gameData.js';
import { eskimoCanvas, faceCanvas } from '../render/faceRenderer.js';
import { preferencesButton } from '../core/preferences.js';

function hero() {
  const data = getData();
  return el('div', { class: 'hero' },
    el('div', { class: 'hero-row' },
      data.eskimos.slice(0, 2).map((e) => eskimoCanvas(e, 72)),
      el('h1', { class: 'logo ds-logo' }, 'Esquimó', el('span', { text: 'TD' })),
      data.enemies.slice(0, 2).map((e) => faceCanvas(e.face, 64))),
    el('p', { class: 'tagline', text: 'Defenda a vila do gelo contra as carinhas invasoras!' }));
}

async function withBusy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; }
}

export function loginScreen(root) {
  let mode = 'login';
  const user = el('input', { name: 'username', autocomplete: 'username', required: true, maxlength: 20, placeholder: 'seu_nome' });
  const pass = el('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••' });
  const pass2 = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'repita a senha' });
  const confirmField = el('label', { class: 'field hidden' }, el('span', { text: 'Confirmar senha' }), pass2);
  const submit = el('button', { type: 'submit', class: 'btn btn-primary btn-big ds-btn ds-btn--primary ds-btn--lg ds-btn--block', text: 'Entrar' });
  const tabs = ['login', 'register'].map((m) => el('button', {
    type: 'button', class: `tab ${m === mode ? 'active' : ''}`, text: m === 'login' ? 'Entrar' : 'Registrar',
    onclick: () => setMode(m),
  }));

  function setMode(m) {
    mode = m;
    tabs.forEach((t, i) => t.classList.toggle('active', (i === 0) === (m === 'login')));
    confirmField.classList.toggle('hidden', m === 'login');
    pass.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    submit.textContent = m === 'login' ? 'Entrar' : 'Criar conta';
  }

  const form = el('form', {
    class: 'card auth-card ds-card',
    onsubmit: (e) => {
      e.preventDefault();
      withBusy(submit, async () => {
        if (mode === 'register') {
          if (pass.value !== pass2.value) throw new Error('As senhas não conferem.');
          await register(user.value, pass.value);
          toast('Conta criada! Bem-vindo à vila.', 'success');
        } else {
          await login(user.value, pass.value);
        }
        go('menu');
      });
    },
  },
  el('div', { class: 'tabs' }, tabs),
  el('label', { class: 'field' }, el('span', { text: 'Usuário' }), user),
  el('label', { class: 'field' }, el('span', { text: 'Senha' }), pass),
  confirmField,
  submit);

  root.append(el('main', { class: 'screen screen-auth' },
    hero(), form, preferencesButton(),
    el('a', { href: '#', class: 'admin-link', text: 'Painel Admin', onclick: (e) => { e.preventDefault(); go('adminLogin'); } })));
  user.focus();
}

export function adminLoginScreen(root) {
  const setup = !adminConfigured();
  const pass = el('input', { type: 'password', autocomplete: setup ? 'new-password' : 'current-password', required: true });
  const pass2 = el('input', { type: 'password', autocomplete: 'new-password', required: setup });
  const submit = el('button', { type: 'submit', class: 'btn btn-primary btn-big', text: setup ? 'Criar senha de admin' : 'Entrar' });

  root.append(el('main', { class: 'screen screen-auth' },
    el('form', {
      class: 'card auth-card',
      onsubmit: (e) => {
        e.preventDefault();
        withBusy(submit, async () => {
          if (setup) {
            if (pass.value !== pass2.value) throw new Error('As senhas não conferem.');
            await adminSetup(pass.value);
          } else {
            await adminLogin(pass.value);
          }
          go('admin');
        });
      },
    },
    el('h2', { text: 'Painel Admin' }),
    setup && el('p', { class: 'hint', text: 'Primeiro acesso: defina a senha de administrador deste navegador (mín. 8 caracteres).' }),
    el('label', { class: 'field' }, el('span', { text: 'Senha' }), pass),
    setup && el('label', { class: 'field' }, el('span', { text: 'Confirmar senha' }), pass2),
    submit,
    el('button', { type: 'button', class: 'btn btn-ghost', text: 'Voltar', onclick: () => go('login') }))));
  pass.focus();
}
