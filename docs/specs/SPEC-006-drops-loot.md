# SPEC-006 — Drops e loot

**Status:** implementado · **Código:** `game.js` (`_maybeDrop`, `_collectDrop`, `_openChest`), `progression.js` (`rollItem`, `applyMatchResult`)

## Regras
- Ao abater um inimigo (qualquer camada): `Math.random() < dropChance` do inimigo → gera drop.
- 25% dos drops são **baús**, 75% são **itens**.
- Item sorteado por peso (`dropWeight` do item; padrão pela raridade: comum 60, raro 25, épico 12, lendário 3). Peso 0 = nunca dropa.
- **Item:** fica 8 s no mapa, pisca nos últimos 2 s, some se não for tocado.
- **Baú:** não expira. Tocar abre na hora (1 item, 30% de chance de 2). Na vitória, baús restantes são abertos automaticamente.
- Área de toque do drop: raio 30 px do mundo (generosa para dedo). O toque no drop tem prioridade sobre selecionar/posicionar.
- Itens coletados viram instâncias únicas no inventário (`uid`) no fim da partida.

## Critérios de aceite
- Drop não tocado some; tocado aparece no resultado e no inventário.
- Abandonar a partida mantém os itens já tocados.
