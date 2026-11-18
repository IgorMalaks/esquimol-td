# Roadmap — Esquimó TD

Plano de execução das próximas versões. Cada tarefa aponta para a spec (o quê) e o ADR (por quê).
Para pedir execução, basta citar o ID: **"executa T1.3"** ou **"executa a fase F1 inteira"**.

**Legenda:** `[ ]` pendente · `[~]` em andamento · `[x]` concluída · ⚠ precisa de decisão/confirmação do Igor

## Definição de pronto (vale para toda tarefa)
1. Código segue as regras do projeto (sem dependências não aprovadas, DOM sem `innerHTML`, versões fixas).
2. Regras puras cobertas por testes `node:test` (`npm test`).
3. Validado no navegador: desktop 1280×760, celular em pé 390×844 e deitado 844×390, sem erros no console.
4. Spec correspondente com status atualizado e este arquivo marcado.

---

## F0 — Base (pré-requisito de tudo)

O commit de importação preserva a licença e o histórico do repositório. O esquema 2 e o simulador de economia estão descritos em [Modelo de dados](DATA-MODEL.md) e no README.

| ID | Tarefa | Spec / ADR | Depende de |
|---|---|---|---|
| [x] T0.0 | **Base do projeto:** (a) `git init` + primeiro commit; (b) `docs/DATA-MODEL.md` com o formato completo e versionado de esquimó, inimigo, item, habilidade, fase, raide, bioma e conta (inclui `traits`, `powerTier`, `origin`, `damageType`, `element`, `fragments`, `raidKeys`, `legendaryPity`); (c) `tools/sim-economia.mjs`: simula N partidas e mostra curvas (partidas até o 1º Lendário, fragmentos por bioma, RBE × dano das waves do Infinito). | — | — |
| [x] T0.1 | **Migração de schema** do conteúdo (`migrations[v]` em `gameData.js`) e do progresso da conta. Sem isso, qualquer mudança de formato apaga o que o admin criou. | SPEC-002 R7 | T0.0 |
| [x] T0.2 | **2.5D na arena** (vista 3/4, inclinação 0,95): render, preview de posicionamento, conversão de toque, preview do esquimó no admin. Lógica do jogo inalterada. | ADR-016 | — |
| [x] T0.3 | Testes de lógica pura em `tests/logic.test.js` e `tests/foundation.test.js`, incluindo `ensureProgress` e `applyMatchResult`. | — | — |
| [ ] T0.4 ⚠ | Limpeza: `~/Documents/eskimo-td`, `~/Documents/frost-pop-td`, `~/fpt-login.png` para a lixeira; parar servidores nas portas 8765 e 5301. **Só após T0.3 e com OK do Igor.** | — | T0.3 |
| [x] T0.5 | Gancho `?debug` só ativo com flag de desenvolvimento (`localStorage etd.dev=1` ou build). | ADR-004 | — |

## F1 — Conteúdo novo (roda sem servidor)

Ordem recomendada pelas dependências:

| ID | Tarefa | Spec / ADR | Depende de |
|---|---|---|---|
| [x] T1.1 | **Traits de inimigo** + **inimigos aéreos** (altitude, sombra, só atingidos por quem tem `hitsAir`). | SPEC-009 | T0.1, T0.2 |
| [x] T1.2 | **Classe Suporte** (aura de buffs que não empilham por tipo; buff "antiaéreo"). | SPEC-008 | T1.1 |
| [x] T1.3 | **Classe Invocador** (aliados saem da base e andam contra o fluxo). | SPEC-008 | T0.2 |
| [x] T1.4 | **6 raridades** (+Incomum, +Mítico), sorteio em 2 etapas, **força dentro da raridade** (`powerTier`). | SPEC-010, ADR-014 | T0.1 |
| [x] T1.5 | **Redutor global de drop** (padrão ×0,6) e baú 25% → 15%. | SPEC-010 | T1.4 |
| [x] T1.6 | **Garantia de Lendário** em chefes, com viés para os Lendários mais fracos. | SPEC-010, ADR-014 | T1.4 |
| [x] T1.7 | **Fusão** 3 iguais → 20% de subir uma raridade. | SPEC-010, ADR-014 | T1.4 |
| [x] T1.8 | **Habilidades ativas como item** (drop com raridade; raridade define recarga, poder e área). | SPEC-011, ADR-015 | T1.4 |
| [~] T1.19 | **Desempenho:** spatial hash para colisão e alvo; meta de 60 fps com 400 inimigos num celular médio (medir antes/depois). | ADR-008 | T0.2 |
| [x] T1.9 | **Modo Infinito** + recorde local. | SPEC-013 | T1.1, T1.19 |
| [x] T1.10 | **Chaves de raide** (caem no Infinito) + **Modo Raide** (farm → chefe → loot próprio). | SPEC-012 | T1.6, T1.9 |
| [~] T1.11 | Admin: abas **Raides**, **Habilidades** e **Economia** (pesos, garantia, fusão, redutor). Campos novos nas abas existentes (traits, papel da classe, `powerTier`). | SPEC-002, 008–012 | conforme acima |
| [~] T1.13 | **Elementos**: tipo de dano por torre, elemento por camada, matriz editável, retorno EFICAZ/RESISTE, alvo "Eficaz". | SPEC-017, ADR-017 | T0.1 |
| [~] T1.14 | **Arquétipos de inimigos** (rápido, blindado, enxame, curandeiro, escudo, divisor, camuflado, ladrão, regenera) + **bestiário**. | SPEC-017, SPEC-009 | T1.1 |
| [~] T1.15 | **Biomas** (6) com paleta, decoração e modificador ambiental; aba Biomas e Elementos no admin. | SPEC-017 | T0.2, T1.13 |
| [~] T1.16 | Conteúdo por bioma: 2–3 fases + 1 raide, 4–6 inimigos, 1 variante elemental de esquimó, armas elementais. | SPEC-017 | T1.10, T1.13–T1.15 |
| [~] T1.17 | **Desbloqueio por fragmentos de bioma** (moeda por bioma, botão Recrutar, variantes elementais) + marcos para Domador e Xamã. Admin com forma de desbloqueio (protótipo em `preview/admin-esquimo.html`). | SPEC-018 | T1.15 |
| [~] T1.18 | **Aplicar o design system** (`tokens.css` + `ds.css`, visual original + filtro quente desligável) nas telas do jogo. | — | T0.2 |
| [~] T1.20 | **Telas dos fluxos novos** (wireframe → prévia no design system): Fusão, Recrutar variante, HUD com 2 habilidades + barra de chefe, janela de Trade, lobby do coop. Validar primeiro no celular em pé. | ADR-018 | T1.18 |
| [~] T1.21 | **Primeira experiência:** fase 1 guiada (posicionar, iniciar rodada, upgrade, coletar drop) + dicas contextuais na primeira vez de cada sistema (árvore, equipamento, elementos, fusão, chaves). Pulável. | — | T1.18 |
| [x] T1.12 | Atualizar conteúdo padrão: 1 invocador, 1 suporte, 2 aéreos, 1 raide, 6 habilidades ativas, itens nas 6 raridades. | — | T1.1–T1.10 |

### Estado do lançamento solo

A arena, o modo Infinito e as raides estão disponíveis com progresso local. Tundra, Floresta e Caverna têm fases e raides. As outras três definições de bioma aguardam mapas, inimigos e fases. O painel inclui os formulários de Raides, Habilidades, Economia, Elementos, Biomas e recrutamento. Para fechar as tarefas marcadas como em andamento, faltam a validação completa dos arquétipos e modificadores, a medição de 60 fps em celular físico, a migração visual dos componentes restantes, as dicas dos demais fluxos e os protótipos online.

## F2 — Servidor (contas, amigos, trade, ranking)

| ID | Tarefa | Spec / ADR | Depende de |
|---|---|---|---|
| [x] T2.1 | Servidor Node sem dependências (HTTP + WebSocket), armazenamento JSON com escrita atômica, sessões. | SPEC-014, ADR-011 | F1 |
| [~] T2.2 | Contas e progresso no servidor; importação única da conta local (itens importados ficam **não negociáveis**). Admin vira papel da conta. | SPEC-014 | T2.1 |
| [x] T2.3 | **Loot, garantia, fusão e chaves autoritativos no servidor.** | ADR-013 | T2.2 |
| [x] T2.4 | Amigos (pedido, aceite, remover, presença online). | SPEC-014 | T2.2 |
| [~] T2.5 | **Trade** entre amigos (janela ao vivo, confirmação dupla, execução atômica, auditoria). | SPEC-015 | T2.3, T2.4 |
| [~] T2.7 | **Privacidade:** apagar conta (e o que acontece com trades no histórico), exportar meus dados, filtro de nomes ofensivos, termos simples. Revisar LGPD antes de qualquer uso público. | SPEC-014 | T2.2 |
| [x] T2.8 | **Backup e restauração** do arquivo de dados do servidor: cópia diária com rotação (7), script de restaurar testado, checagem de integridade ao subir. | ADR-011 | T2.1 |
| [~] T2.6 | **Ranking do Infinito entre amigos** (solo e coop separados). | SPEC-013 | T2.4 |

O modo online está publicado na Vercel com Redis persistente e WebSocket. Em produção, foram validados cadastro, sessão, amizades, lobby e gravação do resultado para duas contas. Os testes locais cobrem persistência, restauração, regras de troca e exclusão de conta. A importação e a janela de troca ainda precisam de validação completa no navegador. A revisão de privacidade continua pendente.

## F3 — Coop em tempo real

| ID | Tarefa | Spec / ADR | Depende de |
|---|---|---|---|
| [x] T3.1 | Salas (até 4), convite de amigos, lobby com "pronto" e checagem de versão do conteúdo. | SPEC-016 | T2.4 |
| [x] T3.2 | Simulação no navegador do dono + relay pelo servidor; snapshots 15 Hz com interpolação; comandos dos convidados. | SPEC-016, ADR-012 | T3.1 |
| [~] T3.3 | Regras coop: ouro dividido igualmente, vidas compartilhadas, drops individuais, ping no mapa, habilidades por jogador. | SPEC-016 | T3.2 |
| [~] T3.4 | Coop em Fases, Raide (vida do chefe escala por jogador) e Infinito. | SPEC-012, 013, 016 | T3.3 |
| [~] T3.5 | Reconexão (60 s) e fim limpo quando o dono sai. | SPEC-016 | T3.2 |
| [~] T3.6 | **Teste automatizado do coop:** script com 2 navegadores (dono + convidado) que joga a fase 1 e compara vidas, ouro e torres; roda a cada mudança no motor. | SPEC-016 | T3.2 |

A fase 1 foi concluída em duas sessões locais de navegador e a reconexão preservou a torre e o ouro do convidado. Em produção, duas sessões WebSocket validaram o convite, o comando de posicionamento, a sincronização da torre e a persistência do resultado. O teste automatizado compara snapshots e a vitória de duas instâncias do motor. Faltam automatizar as duas sessões reais de navegador e validar partidas completas nos demais modos.

---

## Decisões em aberto ⚠
Todas já têm um padrão escolhido (aplicado se ninguém disser nada). Mudar = editar a spec antes de executar.

| Tema | Padrão adotado | Onde |
|---|---|---|
| Garantia: quantos chefes sem Lendário | 8 | SPEC-010 |
| Fusão que falha | Perde 2, devolve 1 | SPEC-010 |
| Lendário funde em Mítico? | Não. Mítico só cai de chefe de raide | SPEC-010 |
| Mítico pode ser trocado? | Não | SPEC-015 |
| Slots de habilidade ativa | 2 por jogador (não por esquimó) | SPEC-011 |
| Ouro no coop | Dividido igualmente entre os jogadores | SPEC-016 |
| Abandonar partida mantém itens? | Sim (avaliar abuso com telemetria) | SPEC-005 |
| Imunidade total (×0) | Existe, só Fogo × Fogo | SPEC-017 |
| Biomas no primeiro lançamento | Tundra + Floresta + Caverna; os outros 3 depois | SPEC-017 |
| Custo de uma variante | 50 fragmentos do bioma | SPEC-018 |
| Tema visual | Original (v0.1) + filtro quente leve ligado por padrão | design-system.html |
| Rostos mais sóbrios no criador (menos olho de estrela/língua) | Em aberto: manter os atuais | SPEC-003 |
| Hospedagem do servidor | **Fora da máquina da empresa.** Local só para testes | ADR-011 |
