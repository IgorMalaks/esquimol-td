# SPEC-004 — Progressão, Quartel e Inventário

**Status:** implementado · **Código:** `js/screens/menuScreen.js`, `js/core/progression.js`, `js/game/stats.js` · **ADR:** 007

## Desbloqueio de esquimós
| Tipo | Condição |
|---|---|
| `default` | Desde o início |
| `wins` | `stats.wins >= valor` |
| `rounds` | `stats.roundsTotal >= valor` |
| `phase` | Fase `valor` concluída |

Checado ao entrar no menu e ao fim de cada partida. Fases abrem em sequência (fase N exige N-1 concluída).

## XP e pontos
- XP por partida, para cada esquimó **posicionado**: `10 × rodadas completadas + 50 se vitória`.
- Pontos = `min(8, 2 + floor(xp / 100))`.

## Árvore de habilidades
- 3 caminhos × 3 níveis. Custo padrão: nível 1 = 1 pt, nível 2 = 1 pt, nível 3 = 2 pt.
- Para aprender nível N, precisa do N-1 do mesmo caminho.
- **Só um caminho pode chegar ao nível 3** (escolha estratégica, como os "crosspaths" do Bloons).
- Para remover nível N, o N+1 do mesmo caminho não pode estar aprendido. Reset de pontos é grátis.
- Aprender **libera** a habilidade; na partida, o jogador paga ouro para **ativá-la** em cada esquimó posicionado (SPEC-005).

## Equipamentos
- 3 slots por esquimó: arma, armadura, amuleto (o tipo do item define o slot).
- Item pode ter restrição de classe. Uma instância só fica equipada em um esquimó por vez (equipar em outro move).
- Bônus de item são permanentes e já valem ao posicionar.

## Efeitos (usados por itens e habilidades)
`damage` (+), `pierce` (+), `rangePct` (×), `speedPct` (×), `splash` (+px), `slowPct` (+, teto 80%), `multishot` (+projéteis).
