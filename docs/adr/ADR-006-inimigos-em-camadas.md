# ADR-006 — Inimigos em camadas orientados a dados (modelo Bloons)

**Status:** aceito · **Data:** 2026-11-17

## Contexto
O pedido: "ao derrotar um rosto mais forte, ele vira o rosto da camada anterior", e o admin define os inimigos.

## Decisão
Cada inimigo é um registro com `hp`, `childId` e `childCount`. A "camada" é um grafo (lista ligada com multiplicidade): Chefão → 4× Pedra → 2× Rosa → Amarela → Verde → Azul → Vermelha. O motor não conhece tipos; só segue o grafo. Dano excedente passa ao primeiro filho; filhos não são atingidos pelo projétil que matou o pai. Vidas perdidas ao escapar = RBE recursivo (memoizado).

## Consequências
- (+) Admin cria qualquer hierarquia sem código; validação impede ciclos e referências quebradas.
- (+) RBE vira métrica de balanceamento visível no admin (por inimigo e por rodada).
- (−) Ainda não há propriedades especiais (imune a gelo, camuflado, regenera, chumbo). Ver MELHORIAS: modelar como `traits: []`.
