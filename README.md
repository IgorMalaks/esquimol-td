# Esquimó TD

Esqueleto funcional de um Tower Defense de navegador inspirado em Bloons TD: esquimós no lugar de macacos, "carinhas" em camadas no lugar de balões, com progressão (árvore de habilidades, XP, desbloqueios), drops clicáveis e Painel Admin com criador visual de rostos.

Roda 100% no navegador, sem build e sem dependências. PC (mouse) e celular (toque/arraste).

## Como rodar

ES Modules e `crypto.subtle` exigem servidor HTTP (não abre via `file://`):

```bash
cd esquimo-td
python3 -m http.server 5173 --bind 127.0.0.1
# abra http://127.0.0.1:5173
```

Para testar no celular na mesma rede, sirva com `--bind 0.0.0.0` e acesse pelo IP da máquina. **Atenção:** fora de `localhost`/`127.0.0.1` o navegador exige HTTPS para `crypto.subtle` (login). Use um túnel HTTPS ou um certificado local.

Primeiro acesso ao admin: link **Painel Admin** no rodapé do login → define a senha (mín. 8 caracteres).

Modo QA: abra com `?debug` para expor a partida em `window.__etdGame` (ex.: `__etdGame.speed = 10`).

## Testes

```bash
npm test   # Node 22+, sem dependências
```

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
