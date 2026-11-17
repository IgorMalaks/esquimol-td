# SPEC-000 — Visão geral

**Status:** implementado (esqueleto v0.1)

## Objetivo
Tower Defense de navegador, mecânica fiel ao Bloons TD, tema neve/gelo, com camada de RPG (XP, árvore de habilidades, equipamentos) e conteúdo 100% editável por um admin.

## Glossário
| Termo | Significado |
|---|---|
| Esquimó | Torre. Instância criada pelo admin, com aparência, classe, atributos, árvore e condição de desbloqueio. |
| Classe | Comportamento de ataque definido em código: Arqueiro, Lançador de Bolas de Neve, Arpoador, Mago do Gelo. |
| Carinha / Inimigo | Rosto que anda pelo caminho. Tem camadas: ao morrer vira N inimigos da camada anterior. |
| RBE | "Red Bloon Equivalent": total de acertos de 1 de dano para destruir o inimigo e todas as camadas. Também é a quantidade de vidas perdidas se ele escapar. |
| Fase | Mapa + ouro inicial + vidas + lista de rodadas. |
| Rodada | Lista de grupos `{inimigo, qtd, intervalo, atraso}`. |
| Drop | Item ou baú que aparece no mapa ao abater um inimigo. |

## Telas
1. Login/Registro (+ link "Painel Admin") — SPEC-001
2. Painel Admin — SPEC-002 / SPEC-003
3. Menu pré-partida: Fases, Quartel, Inventário — SPEC-004
4. Arena — SPEC-005 / SPEC-006 / SPEC-007

## Próximas versões (planejadas)
Ver `docs/ROADMAP.md`:
| Spec | Tema |
|---|---|
| SPEC-008 | Classes Invocador e Suporte |
| SPEC-009 | Traits de inimigos e aéreos |
| SPEC-010 | Raridades, garantia de Lendário, fusão, economia de drops |
| SPEC-011 | Habilidades ativas como drop |
| SPEC-012 | Modo Raide e chaves |
| SPEC-013 | Modo Infinito e ranking entre amigos |
| SPEC-014 | Servidor, contas e amigos |
| SPEC-015 | Trade |
| SPEC-016 | Coop em tempo real |
| SPEC-017 | Biomas, elementos e arquétipos de inimigos |
| SPEC-018 | Desbloqueio de esquimós: marcos e fragmentos de bioma |

## Fora de escopo
Sons, editor de mapas, conquistas, monetização. Ver `docs/MELHORIAS.md`.
