# ADR-002 — Canvas 2D com mundo lógico fixo 1000×600

**Status:** aceito · **Data:** 2026-11-17

## Contexto
O jogo precisa ficar igual em telas de 360 px a 2560 px, e regras (alcance, velocidade) não podem depender da resolução.

## Decisão
Toda a simulação usa coordenadas de um mundo fixo de 1000×600. O canvas escala uniformemente (letterbox) e o backing store usa `devicePixelRatio` (limitado a 2). Mapas guardam waypoints normalizados (0–1). Fundo é pré-renderizado num canvas offscreen a cada resize.

## Consequências
- (+) Balanceamento independe do dispositivo; admin pensa em "px do mundo".
- (+) Mapeamento de toque é uma regra de três (`clientToWorld`).
- (−) Faixas vazias nas laterais em telas com proporção diferente de 5:3 (aceitável; é o que o Bloons faz).
- (−) Em retrato o mapa fica pequeno. Mitigação futura: mapas verticais ou zoom/pan (MELHORIAS).
