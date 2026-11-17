# SPEC-007 — Responsividade e input

**Status:** implementado · **Código:** `css/main.css`, `game.js` (`resize`, `clientToWorld`), `gameScreen.js` (`attachDrag`) · **ADRs:** 002, 005

## Layouts da arena
| Condição | Layout |
|---|---|
| Paisagem larga (aspect > 4:3) | Barra de esquimós à direita (rolagem vertical), painel de upgrade flutuando no canto. |
| Retrato ou aspect ≤ 4:3 | Barra embaixo (rolagem horizontal), painel de upgrade como "bottom sheet". |
| Altura ≤ 500 px (celular deitado) | HUD e cards compactos. |

## Input
- Pointer Events (mouse, toque e caneta pelo mesmo código).
- `touch-action: none` no canvas (sem zoom/rolagem acidental).
- Barra com `touch-action: pan-x` (retrato) / `pan-y` (paisagem): deslizar **ao longo** da barra rola; arrastar **para fora** (em direção ao mapa) posiciona. Se o navegador assumir o gesto (`pointercancel`), o arraste é cancelado.
- Limiar de 10 px separa toque de arraste.

## Canvas
- Mundo lógico fixo 1000×600; escala uniforme para caber no espaço disponível (letterbox).
- Backing store em `devicePixelRatio` (máx. 2) para nitidez sem custo excessivo.
- Contorno via `box-shadow` para não deslocar o mapeamento de toque.

## Validado
Desktop 1280×760, celular retrato 390×844, celular paisagem 844×390: sem overflow, mapeamento de clique exato. **Ainda não testado em aparelho físico** (ver MELHORIAS).
