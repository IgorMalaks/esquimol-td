# SPEC-012 — Modo Raide e chaves

**Status:** implementado no solo (T1.10); coop planejado (T3.4) · **ADR:** 014, 013

## Chaves de raide
- **R1** Moeda `raidKeys` por conta, limite de **5** (editável).
- **R2** Fonte: **Modo Infinito** — 1 chave ao completar a wave 15 e +1 a cada 15 waves seguintes na mesma partida.
- **R3** Chaves não são negociáveis.
- **R4** Entrar numa raide custa `keyCost` (padrão 1), consumido quando a **rodada 1 começa** (sair no lobby não gasta).

## Definição de raide (admin, aba "Raides")
| Campo | Exemplo |
|---|---|
| nome, mapa, ouro inicial, vidas | "Covil do Rei Iceberg", 900, 100 |
| `keyCost` | 1 |
| `farmRounds` | rodadas como nas fases |
| `farmGoldMultiplier` | 1,5 (ouro por estouro durante o farm) |
| `prepTime` | 30 s de preparação antes do chefe |
| `bossId` | inimigo com trait `chefe` |
| `bossAbility` | `{ type: 'atordoar', interval: 12, radius: 140, duration: 3 }` |
| `bossPhases` | em 66% e 33% de vida: +25% velocidade e invoca escolta |
| `bossLoot` | 2 sorteios na tabela "chefe de raide" (SPEC-010), mínimo Raro |

## Fluxo
1. **Farm:** N rodadas com ouro multiplicado e drops da tabela "farm de raide".
2. **Preparação:** 30 s com HUD mostrando o chefe e sua habilidade.
3. **Chefe:** entra sozinho; barra de vida no topo da tela.
   - **Atordoar:** a cada `interval`, torres dentro do `radius` ao redor do chefe param de atacar por `duration` (efeito visual de gelo nelas).
   - Fases de vida conforme `bossPhases`.
4. **Vitória:** chefe derrotado → abre o loot do chefe (aplica garantia de Lendário da SPEC-010).
5. **Derrota:** vidas = 0. A chave já foi gasta; itens coletados no farm são mantidos.

## Coop
- **R5** Cada jogador gasta 1 chave.
- **R6** Vida do chefe × `(1 + 0,75 × (jogadores − 1))`.
- **R7** Cada jogador recebe **seu próprio** sorteio de loot do chefe e sua própria garantia.

## Critérios de aceite
- Sem chave, botão "Entrar" desabilitado com explicação de como conseguir.
- Atordoamento visível e torres afetadas realmente param por 3 s.
- Loot do chefe nunca abaixo de Raro.
