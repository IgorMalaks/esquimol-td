# ADR-005 — Pointer Events unificados para mouse e toque

**Status:** aceito · **Data:** 2026-11-17

## Contexto
Precisa funcionar com mouse (PC) e toque/arraste (celular). Tratar `mouse*` e `touch*` separado duplica código e gera cliques fantasmas.

## Decisão
Só Pointer Events. Duas formas de posicionar: arrastar o card até o mapa ou tocar no card e depois no mapa. `touch-action` controla o que é gesto do navegador: canvas `none`; barra `pan-x`/`pan-y` conforme orientação, assim deslizar ao longo da barra rola e arrastar para o mapa posiciona. `pointercancel` cancela o arraste. Limiar de 10 px separa toque de arraste.

## Consequências
- (+) Um caminho de código; funciona com caneta.
- (+) Toque-toque é acessível para quem tem dificuldade com arraste.
- (−) Não há long-press/pinça. Zoom do mapa fica para depois.
- (−) Validado em emulação de viewport; falta aparelho físico (iOS Safari em especial).
