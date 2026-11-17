# ADR-009 — Rostos procedurais em Canvas + cache de sprites

**Status:** aceito · **Data:** 2026-11-17

## Contexto
O admin cria aparências por um criador visual; não há artista nem assets. Desenhar dezenas de rostos com caminhos vetoriais a cada frame custa CPU no celular.

## Decisão
Rosto é um JSON de partes (`shape`, `eyes`, `mouth`, `headwear`, `accessory` + cores) desenhado por `drawFace`. Na arena, `drawFaceCached` rasteriza cada combinação (rosto + tamanho em px reais) uma vez num canvas offscreen e depois só faz `drawImage`. Cache LRU simples (300 entradas).

## Consequências
- (+) Conteúdo leve (dados, não imagens), exportável em JSON, sem direitos autorais de arte.
- (+) Custo por inimigo na arena = 1 `drawImage`.
- (−) Estilo limitado às partes existentes. Extensão = novo `case` no renderer (ver SPEC-003).
- (−) Rostos não rotacionam (decisão de legibilidade, igual a "carinhas" de desenho).
