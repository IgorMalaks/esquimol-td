# ADR-015 — Habilidades ativas como itens com escala por raridade

**Status:** aceito (implementação pendente) · **Data:** 2026-11-17

## Contexto
Pedido: habilidades com recarga (Chuva de Flechas, Nevasca) que caem como drop, com raridade definindo recarga, dano e alcance.

## Decisão
- Comportamento (`skillType`) em código, lista fechada — mesmo princípio das classes (ADR-007).
- Item do tipo `habilidade` aponta para um `skillType`; os números saem de `valores base do tipo × tabela de escala da raridade × ajuste de powerTier`.
- Loadout de **2 habilidades por jogador**, não por esquimó: decisão rápida e legível na HUD, funciona igual no coop.

## Consequências
- (+) Admin cria variações sem código; balanceamento por uma tabela.
- (+) Reaproveita drop, fusão, trade e garantia sem regra nova.
- (−) Novo efeito (ex.: teleporte de inimigo) exige código.
