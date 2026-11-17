# ADR-016 — 2.5D em vista 3/4 com inclinação 0,95

**Status:** aceito (implementação pendente) · **Data:** 2026-11-17

## Contexto
Igor pediu visual 2.5D. Prévia aprovada em `preview/25d.html`, escolhendo inclinação 0,95.

## Decisão
Projeção só no render: `tela.y = TOPO + mundo.y × 0,95 − altura`. Personagens em pé, sombras, ordenação por profundidade (maior `y` desenhado por cima), projéteis com arco, aéreos com altitude. Simulação, colisão e dados continuam no mundo 1000×600 (ADR-002). Toque convertido pela inversa da projeção.

## Consequências
- (+) Nenhuma regra de jogo muda; testes de lógica continuam válidos.
- (+) Com 0,95 o mapa quase não perde altura — bom para celular em pé.
- (+) Altura vira recurso visual para aéreos (SPEC-009).
- (−) Alcance desenhado em elipse; posições muito no fundo podem ser cobertas por objetos da frente (mitigar com transparência de objetos sobre o ponteiro).
