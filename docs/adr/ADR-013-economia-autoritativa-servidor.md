# ADR-013 — Loot, garantia, fusão e chaves decididos no servidor

**Status:** implementado no servidor local · **Data:** 2026-11-17

## Contexto
Com trade, um item falsificado vira prejuízo para todos. No cliente, qualquer valor (drop, chance de fusão, contador de garantia) pode ser editado.

## Decisão
A partir da F2, o cliente **pede** e o servidor **decide**:
- Resultado de partida é enviado ao servidor; o servidor confere plausibilidade (duração, rodadas, fase existente) e **ele mesmo sorteia** o loot de chefe, aplica a garantia e concede chaves.
- Drops clicados durante a partida: o cliente envia quais coletou; o servidor limita pela quantidade esperada para aquela fase/duração.
- Fusão: sorteio no servidor.
- Todos os sorteios usam `crypto.randomInt`.

## Consequências
- (+) Item Mítico/Lendário só existe se o servidor sorteou.
- (−) Partida em si ainda pode ser trapaceada (vencer sem jogar), limitada pelas checagens. Anti-trapaça real = replay com seed validado no servidor (MELHORIAS).
- (−) Sem servidor não há trade: itens da fase F1 (localStorage) entram como não negociáveis (SPEC-014 R9).
