# ADR-007 — Classes em código, esquimós em dados; árvore libera, ouro ativa

**Status:** aceito · **Data:** 2026-11-17

## Contexto
O admin cria esquimós e "define sua classe". Ao mesmo tempo, a árvore é distribuída antes da partida e o pedido fala em "ativar habilidades desbloqueadas na árvore" gastando ouro durante a partida.

## Decisão
1. **Classe = comportamento** (tipo de projétil e visual da arma), definido em código (`CLASSES`). **Esquimó = dados** (aparência, atributos, árvore). O admin cria quantos esquimós quiser de cada classe, mas não cria classe nova sem código.
2. **Árvore fixa 3×3** (3 caminhos × 3 níveis), cada nó com um efeito de uma lista fechada (`EFFECT_KEYS`). Só um caminho chega ao nível 3.
3. **Dois momentos:** pontos no Quartel *liberam* o nó; na partida, ouro *ativa* o nó em cada esquimó posicionado. Upgrades de Ataque/Velocidade/Alcance são independentes da árvore.

## Consequências
- (+) Formulário do admin simples e sem estados inválidos (árvore sempre coerente).
- (+) Decisão estratégica dupla: o que levar (pontos) e quando pagar (ouro).
- (−) Habilidades são só modificadores numéricos; não há habilidades ativas com cooldown (ex.: "Chuva de Flechas" como ataque especial). Ver MELHORIAS.
- (−) 3×3 é rígido. Se precisar, evoluir para grafo com `requires[]`.
