# SPEC-014 — Servidor, contas e amigos

**Status:** disponível no servidor local e na Vercel. Cadastro, sessão e amizades validados em produção · **ADRs:** 011, 013

## Estrutura
```
server/
├── index.js        # HTTP: arquivos estáticos + API JSON + upgrade WebSocket
├── ws.js           # WebSocket mínimo (RFC 6455): texto, ping/pong, close, máx. 64 KB por mensagem
├── store.js        # repositório: arquivo JSON, fila de escrita única, escrita atômica (tmp + rename)
├── auth.js         # scrypt, sessões, rate limit
├── routes/         # accounts, friends, inventory, loot, trade, ranking, admin
└── admin-cli.js    # node server/admin-cli.js promote <usuario>
```
Node LTS 22 (versão fixa no `package.json` em `engines`). Zero dependências.

## Segurança
- **R1** Senha com `crypto.scrypt` (N=2^15, salt 16 bytes); comparação com `timingSafeEqual`.
- **R2** Sessão em cookie `HttpOnly; SameSite=Strict` (+ `Secure` quando em HTTPS), token aleatório de 32 bytes guardado como hash no servidor, expira em 7 dias.
- **R3** Rate limit de login: 5 tentativas/min por IP+usuário.
- **R4** Checagem de `Origin` em todo POST e no upgrade do WebSocket.
- **R5** Validação de entrada em toda rota (tipos, tamanhos, IDs existentes). Corpo máximo 64 KB (importação de conteúdo do admin: 2 MB).
- **R6** Bind padrão em `127.0.0.1`. Expor exige `HOST` explícito e HTTPS na frente.
- **R7** Logs sem senha, token ou cookie.

## Contas
- **R8** Mesmas regras de usuário/senha da SPEC-001.
- **R9** Importação única da conta local: progresso, XP e itens entram; **itens importados ficam `origin: 'local'` e não negociáveis** (evita injetar no mercado item criado editando o `localStorage`).
- **R10** Admin deixa de ser senha separada: é o papel `admin` na conta. O primeiro admin é promovido pelo `admin-cli.js` no próprio servidor.
- **R11** Conteúdo do jogo (esquimós, inimigos, itens...) passa a vir do servidor (`GET /api/content`, com hash de versão).

## Amigos
- **R12** Pedido por nome de usuário → aceitar/recusar; remover; bloquear.
- **R13** Limite de 100 amigos e 20 pedidos pendentes.
- **R14** Presença (online/em partida) via WebSocket, visível só para amigos.

## Principais rotas
`POST /api/register` · `POST /api/login` · `POST /api/logout` · `GET /api/me` · `POST /api/import-local` · `GET /api/content` · `GET/POST /api/friends` · `GET /api/inventory` · `POST /api/match/result` · `POST /api/fusion` · `GET /api/ranking/infinite` · `PUT /api/admin/content` · WS `/ws` (presença, trade, coop).

## Hospedagem ⚠
Para testes, o servidor roda local (`127.0.0.1`) e o coop é validado com dois navegadores na mesma máquina. Para jogar com amigos de fora, hospedar em VPS/serviço próprio. **Não abrir porta nem túnel a partir da máquina da empresa.**
