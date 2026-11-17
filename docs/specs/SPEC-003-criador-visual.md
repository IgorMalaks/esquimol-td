# SPEC-003 — Criador Visual de Rostos

**Status:** implementado · **Código:** `js/ui/faceEditor.js`, `js/render/faceRenderer.js` · **ADR:** 009

## Requisitos
- **R1** O mesmo componente deve ser usado para esquimós e inimigos.
- **R2** O rosto é um objeto de dados (não imagem):

```json
{ "shape": "redondo|oval|quadrado|coracao|gota", "skin": "#hex",
  "eyes": "pontos|bravos|felizes|sonolentos|ciclope|estrelas", "eyeColor": "#hex",
  "mouth": "sorriso|triste|aberta|dentes|reta|lingua",
  "headwear": "nenhum|capuz|gorro|chifres|coroa|cabelo|orelhas", "headwearColor": "#hex",
  "accessory": "nenhum|cachecol|oculos|bigode|cicatriz|bochechas", "accessoryColor": "#hex",
  "outline": "#hex" }
```
- **R3** Toda alteração atualiza o preview em tempo real. Para esquimós, o preview mostra corpo (parka) + arma da classe.
- **R4** Botão "Aleatório" e paleta rápida de pele.
- **R5** Ordem de desenho: cabeça-trás (capuz/orelhas) → rosto → bochechas → olhos → boca → acessório → cabeça-frente.

## Como estender
Nova opção = adicionar o valor em `FACE_OPTIONS` (`defaults.js`) e um `case` na função correspondente em `faceRenderer.js`. Nenhuma outra mudança é necessária.
