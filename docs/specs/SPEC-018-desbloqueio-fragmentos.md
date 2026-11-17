# SPEC-018 — Desbloqueio de esquimós: marcos e fragmentos de bioma

**Status:** planejado (T1.17) · **Relacionadas:** SPEC-004, SPEC-008, SPEC-010, SPEC-017 · **ADR:** 013 (após servidor)

## Decisão do Igor (2026-11-17)
Esquimós novos vêm de **fragmentos do bioma correspondente**. Classes base continuam por **marcos** (todo jogador precisa montar um esquadrão sem depender de sorte); as **variantes elementais** de cada bioma saem por fragmentos.

## Classes base (marcos)
| Esquimó | Classe | Condição padrão |
|---|---|---|
| Nanuk | Arqueiro | inicial |
| Aput | Bolas de Neve | inicial |
| Siku | Arpoador | 15 rodadas completadas |
| Ila | Mago do Gelo | concluir a fase 1 |
| Tuktu | Domador | 3 vitórias |
| Aaju | Xamã | 40 rodadas completadas |

## Fragmentos
- **R1** Fragmento é uma **moeda por bioma** (`fragments: { floresta: 12, caverna: 30, ... }` na conta), não um item.
- **R2** Cada variante custa **N fragmentos do seu bioma** (padrão 50). O jogador escolhe qual variante recrutar com o botão **Recrutar** no Quartel — não é automático, para dar escolha quando o bioma tem mais de uma variante.
- **R3** Fontes (padrões editáveis na aba Economia):

| Fonte | Quantidade |
|---|---|
| Estouro de camada em fase do bioma | 0,4% de chance de +1 |
| Vencer fase do bioma | +2 (primeira vitória: +5) |
| Chefe da raide do bioma | +3 a +5, garantido |
| Infinito no bioma | +1 a cada 10 waves |

- **R4** Fragmentos são **coletados automaticamente** (sem clicar no mapa) e aparecem no resumo da partida. O redutor global de drop (SPEC-010) **não** se aplica: é progressão, não loot.
- **R5** Tundra (bioma inicial) não tem variantes nem fragmentos.
- **R6** Com todas as variantes do bioma recrutadas, fragmentos novos viram XP: 1 fragmento = 20 XP para uma variante daquele bioma escolhida pelo jogador.
- **R7** Não negociáveis. Após o servidor (F2), concedidos e gastos só pelo servidor (ADR-013).
- **R8** Coop: cada jogador recebe seus próprios fragmentos.

## Variante
Esquimó com `variantOf: <id da base>` e `unlock: { type: 'fragments', biome, amount }`. É um esquimó completo (aparência, atributos, árvore, tipo de dano próprio); `variantOf` serve para agrupar no Quartel e no bestiário. Exemplo: **Nanuk da Chama** — Arqueiro de Fogo, 50 fragmentos das Fontes Termais.

## Interface
- **Quartel:** variante bloqueada aparece em cinza com barra "32/50 fragmentos · Fontes Termais" e o botão Recrutar quando completa.
- **Tela do bioma:** saldo de fragmentos e as variantes que eles liberam.
- **Admin, aba Esquimós:** forma de desbloqueio "Marco" ou "Fragmentos de bioma" (bioma, quantidade, "variante de"), com prévia de como o jogador vê. Protótipo em `preview/admin-esquimo.html`.

## Validação
- Bioma precisa existir e não ser Tundra.
- Quantidade ≥ 1.
- Aviso (não bloqueia) se a quantidade exigir, pela estimativa da simulação de economia (T0.0), mais de 20 partidas.

## Critérios de aceite
- Vencer fase da Caverna pela primeira vez soma +5 fragmentos de Caverna e nada nos outros biomas.
- Recrutar com saldo insuficiente é bloqueado; com saldo, desconta exatamente N e libera a variante.
- Recarregar a página durante o resumo da partida não duplica fragmentos.
