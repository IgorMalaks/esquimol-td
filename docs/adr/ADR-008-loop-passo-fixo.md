# ADR-008 — Game loop com passo fixo de 1/60 s

**Status:** aceito · **Data:** 2026-11-17

## Contexto
Velocidade 1x/2x e telas de 60/120 Hz não podem mudar o resultado do combate. Celulares travam frames.

## Decisão
`requestAnimationFrame` acumula `dt × velocidade` e executa `update(1/60)` quantas vezes couber (máx. 12 por frame; o excedente é descartado). `dt` é limitado a 0,25 s (aba em segundo plano não "teletransporta" inimigos). Render 1× por frame.

## Consequências
- (+) Simulação determinística por passo; 2x = dois passos por frame.
- (+) Base para replay/validação no servidor se a aleatoriedade for semeada.
- (−) Aleatoriedade usa `Math.random` (drops, baús). Para replay, trocar por RNG semeado por partida.
