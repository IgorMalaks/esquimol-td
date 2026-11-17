# ADR-014 — Raridades em 2 etapas, garantia com viés, fusão 20% e redutor de drop

**Status:** aceito (implementação pendente) · **Data:** 2026-11-17

## Contexto
Pedido: Lendário raro mas alcançável, Mítico raríssimo, garantia contra azar, destino para repetidos.

## Decisão
1. Sorteio em 2 etapas (raridade → item), com tabelas por fonte (normal, farm de raide, chefe de raide).
2. `powerTier` (1–3) dentro da raridade. Na **garantia**, o peso favorece os tiers baixos (`{1: 4, 2: 1,5, 3: 0,5}`): ela evita frustração, mas não entrega os melhores Lendários de graça.
3. Garantia só em chefes, em 8 chefes sem Lendário. Mítico sem garantia.
4. Fusão 3 → 1 com 20% de sucesso; falha devolve 1. Não funde para Mítico.
5. Redutor global de drop ×0,6 e baú 15%.
6. Todos os números na aba Economia do admin.

## Consequências
- (+) Curva de raridade controlada por poucos números, ajustáveis sem código.
- (+) Probabilidades exibidas ao jogador (transparência). **Se um dia houver dinheiro real envolvido, vários países exigem divulgar essas chances por lei — revisar antes.**
- (−) Números iniciais são palpite. Calibrar com a telemetria local (SPEC-010 R15).
