# SPEC-013 — Modo Infinito e ranking entre amigos

**Status:** implementado com recorde local (T1.9); ranking e coop planejados

## Geração de waves
Cada partida tem uma `seed` (RNG semeado). Para a wave `n` (começando em 1):

| Item | Fórmula padrão (editável no admin, aba Economia) |
|---|---|
| Orçamento de RBE | `20 × n^1,35` |
| Camadas disponíveis | começa nas 3 primeiras; +1 camada a cada 10 waves |
| Aéreos | a partir da wave 12, até 25% do orçamento |
| Vida por camada | `× 1,06^max(0, n − 20)` (arredonda pra cima) |
| Velocidade | `× min(1,6; 1 + 0,01 × n)` |
| Chefe | a cada 25 waves; vida escala igual |
| Bônus de fim de wave | `100 + n` até a wave 40, depois cai 2% por wave (mínimo 50) — evita farm infinito de ouro |

O gerador preenche o orçamento sorteando grupos do pool disponível, agrupando em "rajadas" como no Bloons.

## Recompensas
- XP para os esquimós usados (mesma fórmula das fases, por wave).
- Drops da tabela normal com o redutor global.
- Chaves de raide (SPEC-012).
- Chefe a cada 25 waves conta para a garantia de Lendário (SPEC-010).

## Fim
Não há vitória: termina quando as vidas acabam ou o jogador sai. O resultado registra `{ melhorWave, data, duracaoSeg, esquadrao, seed, modo: solo|coop }`.

## Ranking
- **F1 (sem servidor):** recorde local por conta, no Menu.
- **F2 (servidor):** ranking entre **amigos**, com abas **Solo** e **Coop** (no coop entra a dupla/trio/quarteto).
- **R1** O servidor guarda só o melhor resultado de cada jogador por modo.
- **R2** Checagem de plausibilidade no servidor: duração mínima por wave, wave máxima compatível com o tempo. **Não é anti-trapaça real** (o jogo roda no cliente); para isso, ver replay com seed em MELHORIAS.

## Critérios de aceite
- Mesma `seed` gera as mesmas waves (teste automatizado).
- Wave 30 tem ~2,5× o RBE da wave 15.
