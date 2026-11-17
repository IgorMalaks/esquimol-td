# SPEC-011 — Habilidades ativas (drop com raridade)

**Status:** planejado (T1.8) · **ADR:** 015

## Conceito
Habilidade ativa é um **item** do tipo `habilidade` que cai como qualquer drop e pode ter qualquer raridade. O jogador equipa até **2** no próprio perfil (não em esquimó) e usa na partida por botões na HUD, com tempo de recarga.

## Tipos (comportamento em código)
| `skillType` | Alvo | Efeito base (raridade Épico = 100%) |
|---|---|---|
| `chuva_flechas` | ponto no mapa | 3 ondas de dano 2 em raio 90 |
| `nevasca` | global | lentidão 40% por 5 s em todos os inimigos |
| `avalanche` | trecho do caminho | dano 3 em todos num trecho de 200 px do caminho |
| `bloco_gelo` | ponto no mapa | congela inimigos em raio 70 por 2,5 s |
| `chamado_matilha` | base | invoca 6 lobos aliados (SPEC-008) |
| `fogueira` | global | +50% ouro por estouro por 10 s |

O admin cria itens de habilidade escolhendo o `skillType`, nome, raridade e `powerTier`; pode sobrescrever os valores base de cada tipo na aba **Habilidades**.

## Escala por raridade
| Raridade | Recarga | Poder | Área | Duração |
|---|---|---|---|---|
| Comum | 120 s | ×0,50 | ×0,60 | ×0,60 |
| Incomum | 105 s | ×0,65 | ×0,70 | ×0,70 |
| Raro | 90 s | ×0,80 | ×0,80 | ×0,80 |
| Épico | 75 s | ×1,00 | ×1,00 | ×1,00 |
| Lendário | 60 s | ×1,30 | ×1,20 | ×1,20 |
| Mítico | 45 s | ×1,70 | ×1,50 (ponto → global quando faz sentido) | ×1,50 |

`powerTier` aplica ±10% no poder (tier 1 = −10%, tier 3 = +10%). Tabela editável na aba **Economia**.

## Regras na partida
- **R1** 2 botões na HUD com contador circular de recarga. Atalhos de teclado Q/E.
- **R2** A recarga começa em **50%** no início da partida (evita uso imediato no primeiro segundo) e corre no tempo do jogo (respeita 2x e pausa).
- **R3** Habilidade de alvo: toque no botão → toque no mapa (mesmo fluxo do posicionamento; Esc cancela; prévia da área em elipse).
- **R4** Controle (lentidão/congelar) em inimigos `chefe` tem 50% do efeito.
- **R5** Totem do Xamã (SPEC-008) reduz recarga em 15% enquanto existir.
- **R6** Coop: cada jogador tem seus 2 slots e sua própria recarga; efeitos globais afetam o mapa inteiro.

## Inventário e loot
- Entram nas tabelas de drop normais com `dropWeight` próprio (padrão: metade do peso de um equipamento da mesma raridade).
- Fundem pelas regras da SPEC-010. Negociáveis pelas regras da SPEC-015.

## Critérios de aceite
- "Nevasca" Comum: recarga 120 s, lentidão 20% por 3 s. "Nevasca" Lendária: 60 s, 52% (teto de 80% respeitado) por 6 s.
- Usar habilidade de alvo fora do mapa cancela sem consumir recarga.
