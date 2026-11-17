# ADR-018 — Design system: visual cartoon original + filtro quente

**Status:** aceito (aplicação no jogo pendente, T1.18) · **Data:** 2026-11-17

## Contexto
O CSS do jogo (`main.css`) cresceu sem tokens. Foram feitas duas propostas: v0.1 (cartoon, gelo + tinta + dourado) e v0.2 "Maduro" (tons frios dessaturados, fonte reta). Igor achou a v0.1 um pouco infantil, testou a v0.2 e preferiu **manter a v0.1 com um filtro amarelo leve** para cansar menos a vista.

## Decisão
- Fonte única de valores em `css/tokens.css`; componentes em `css/ds.css` com prefixo `ds-` (convive com `main.css` durante a migração).
- Visual v0.1. Tema "Maduro" descartado.
- **Filtro quente:** camada fixa `rgba(255, 214, 140, .16)` com `mix-blend-mode: multiply` por cima de tudo (inclusive o canvas), via `data-tone="warm"`. Ligado por padrão; opção do jogador para desligar.
- Intensidade de efeitos (`data-fx`: completo, sutil, sem animação); respeita `prefers-reduced-motion`.
- Regras: contorno grosso só em peça do jogo ou clicável; vidro para leitura; cor nunca sozinha (raridade e elemento sempre com nome/ícone); alvo de toque mínimo de 44 px; brilho forte só para o que é raro.
- Fontes do sistema, sem download.

## Consequências
- (+) Um lugar para ajustar a identidade; prévia viva em `preview/design-system.html`.
- (−) O filtro reduz um pouco o contraste real; a tabela de contraste da prévia calcula sem o filtro. Revalidar contraste com o filtro ao aplicar no jogo.
- (−) Até a T1.18 terminar, existem dois estilos no projeto.
