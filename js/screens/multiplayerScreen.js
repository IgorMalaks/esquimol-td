import { el } from '../core/utils.js';

export function multiplayerNotice() {
  const requested = new URLSearchParams(location.search).get('modo') === 'coop';
  return el('section', { class: 'card multiplayer-card' },
    el('header', { class: 'multiplayer-banner' },
      el('h2', { text: 'Coop' }),
      el('p', { text: 'Salas de 2 a 4 jogadores' })),
    !requested ? el('div', { class: 'multiplayer-card-body' },
      el('p', { text: 'Crie uma sala ou aceite o convite de um amigo para jogar em equipe.' }),
      el('a', { class: 'btn btn-primary', href: '?modo=coop', text: 'Abrir coop online' })
    ) : el('div', { class: 'multiplayer-card-body' },
      el('p', { text: 'O servidor multiplayer público ainda está indisponível.' }),
      el('p', { class: 'muted', text: 'Com o servidor rodando neste computador, entre no jogo, adicione um amigo e crie uma sala na aba Multiplayer.' }),
      el('a', { class: 'btn btn-primary', href: 'http://127.0.0.1:5173/', text: 'Abrir servidor neste PC' })));
}

export function multiplayerScreen(root) {
  root.append(el('main', { class: 'screen screen-auth' }, multiplayerNotice(),
    el('a', { href: './', class: 'btn', text: 'Voltar para o jogo' })));
}
