# Esquimó TD

Tower defense de navegador com personagens originais, inimigos em camadas, progressão, equipamentos e um Painel Admin com criador visual de rostos.

O modo solo funciona no navegador sem build ou dependências. O modo online usa um servidor Node com contas, amizades, trocas e partidas cooperativas.

## Como rodar

ES Modules e `crypto.subtle` exigem servidor HTTP (não abre via `file://`):

```bash
cd esquimo-td
python3 -m http.server 5173 --bind 127.0.0.1
# abra http://127.0.0.1:5173
```

Para testar no celular na mesma rede, sirva com `--bind 0.0.0.0` e acesse pelo IP da máquina. **Atenção:** fora de `localhost`/`127.0.0.1` o navegador exige HTTPS para `crypto.subtle` (login). Use um túnel HTTPS ou um certificado local.

Primeiro acesso ao admin: link **Painel Admin** no rodapé do login → define a senha (mín. 8 caracteres).

Modo QA: execute `localStorage.setItem('etd.dev', '1')` no navegador de teste e abra com `?debug` para expor a partida em `window.__etdGame`. Remova a flag com `localStorage.removeItem('etd.dev')`.

## Testes

```bash
npm test   # Node 22+, sem dependências
npm run test:server   # Usa uma porta de teste em 127.0.0.1
node tools/sim-economia.mjs 1000 esquimo-td
```

## Publicação

Importe o repositório na Vercel. O `vercel.json` configura o modo solo como site estático sem build. As contas, o conteúdo editado e o progresso solo ficam no navegador, por domínio. Use **Exportar progresso** para gerar um arquivo que a conta online com o mesmo nome possa importar uma vez.

## Servidor online

```bash
npm run start:server
# http://127.0.0.1:5173
```

O Node serve a interface, a API e o WebSocket na mesma origem. Cadastre uma conta e abra a aba **Online**. Para testar duas contas na mesma máquina, use `http://127.0.0.1:5173` e `http://localhost:5173` ou perfis diferentes do navegador.

- O banco JSON padrão fica em `var/esquimo.json`. Use `ETD_DATA_FILE` para apontar a um volume persistente. Execute uma instância do Node por arquivo.
- O servidor cria uma cópia diária e mantém até sete em `backups/`, ao lado do arquivo. Para testar uma restauração, execute `node server/admin-cli.js restore <cópia> <novo-arquivo>`.
- Para promover o primeiro administrador, pare a instância e execute `node server/admin-cli.js promote <usuário>` com o mesmo `ETD_DATA_FILE`.
- Para produção online, hospede o Node num serviço com volume persistente e WebSocket. Configure `ETD_ORIGIN` com a URL pública HTTPS e encaminhe o WebSocket `/ws` pelo proxy. `ETD_PORT` e `ETD_HOST` configuram a escuta. O bind padrão é local. As Vercel Functions não hospedam o servidor WebSocket.

O formato está em [Modelo de dados](docs/DATA-MODEL.md). O [roadmap](docs/ROADMAP.md) registra a validação restante.

## Estrutura

```
esquimo-td/
├── index.html                 # shell + CSP
├── css/main.css               # estilo atual do jogo (será substituído pelo design system, T1.18)
├── css/tokens.css             # design system: cores, tipo, espaço, movimento, elementos
├── css/ds.css                 # design system: componentes (prefixo ds-)
├── js/
│   ├── main.js                # registra telas e decide a inicial
│   ├── core/
│   │   ├── storage.js         # única camada de persistência (localStorage, prefixo etd.v1.)
│   │   ├── auth.js            # contas (PBKDF2), sessão, admin
│   │   ├── progression.js     # desbloqueios, inventário, equipar, XP, resultado de partida, RBE
│   │   ├── router.js          # troca de telas com cleanup
│   │   └── utils.js           # el() seguro (sem innerHTML), modal, toast, helpers
│   ├── data/
│   │   ├── defaults.js        # conteúdo padrão + classes/opções do criador
│   │   └── gameData.js        # repositório do conteúdo do admin + validação
│   ├── game/
│   │   ├── game.js            # motor: loop fixo, inimigos em camadas, torres, projéteis, drops, input, render
│   │   ├── pathing.js         # caminho por waypoints (posição por distância, distância ponto-caminho)
│   │   └── stats.js           # regras puras: atributos, upgrades, árvore de habilidades
│   ├── render/faceRenderer.js # rostos/esquimós/itens procedurais + cache de sprites
│   ├── ui/faceEditor.js       # Criador Visual (compartilhado entre esquimós e inimigos)
│   └── screens/               # login, admin, menu (fases/quartel/inventário), arena
├── preview/
│   ├── 25d.html               # prévia aprovada do visual 2.5D (inclinação 0,95)
│   ├── design-system.html     # design system aprovado (v0.1 + filtro quente)
│   └── admin-esquimo.html     # protótipo do admin: criação de esquimós
├── tests/logic.test.js        # testes de lógica pura (npm test)
└── docs/
    ├── ROADMAP.md             # plano de execução F0..F3 (tarefas T0.1..T3.5)
    ├── specs/                 # SPEC-000..007 implementadas · SPEC-008..016 planejadas
    ├── adr/                   # ADR-001..010 implementados · ADR-011..016 aceitos, pendentes
    └── MELHORIAS.md           # riscos e ideias fora do roadmap
```

## Fluxo

Login/Registro → Menu (Fases · Quartel · Inventário) → Arena → Resultado (XP, itens, desbloqueios) → Quartel.

Leia `docs/specs/SPEC-000-visao-geral.md` primeiro. Para evoluir, siga `docs/ROADMAP.md` — peça a execução pelo ID da tarefa (ex.: "executa T1.3").
