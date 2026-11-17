# ADR-004 — Admin e contas no cliente são proteção de conveniência, não segurança

**Status:** aceito · **Data:** 2026-11-17

## Contexto
Sem backend, qualquer pessoa com acesso ao navegador consegue ler e alterar o `localStorage`, abrir o DevTools e mudar ouro, itens ou pular a senha do admin.

## Decisão
- Senhas (jogador e admin) com PBKDF2-SHA256, 120k iterações, salt aleatório por conta. Nunca em texto.
- Admin: sem senha padrão. O primeiro acesso define a senha (evita o clássico `admin/admin`).
- Sessão de admin em `sessionStorage` (some ao fechar a aba).
- DOM montado só com `textContent` (helper `el()`), sem `innerHTML` com dados, e CSP restritiva em `index.html` — nomes criados pelo admin não viram XSS.
- Documentar explicitamente que isso **não** é controle de acesso.

## Consequências
- (+) Nada vergonhoso em texto puro; sem XSS via conteúdo do admin.
- (−) Trapaça é trivial (inclusive `?debug`). Aceitável para protótipo; **inaceitável** para ranking, economia real ou dados pessoais.
- Quem levar adiante: autenticação no servidor, admin com papel no backend, validação de resultado de partida no servidor.
