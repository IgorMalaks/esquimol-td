# SPEC-010 — Raridades, garantia de Lendário, fusão e economia de drops

**Status:** implementado no solo (T1.4–T1.7) · **ADR:** 014, 013 (após servidor)

## Raridades
| Raridade | Cor | Peso padrão (tabela normal) | Funde para cima? | Negociável? |
|---|---|---|---|---|
| Comum | cinza | 55 | sim | sim |
| Incomum | verde | 25 | sim | sim |
| Raro | azul | 13 | sim | sim |
| Épico | roxo | 6 | sim (→ Lendário) | sim |
| Lendário | laranja | **0,9** | **não** | sim |
| Mítico | vermelho/arco-íris | **0** (só chefe de raide) | não | **não** |

Todos os pesos, "funde" e "negociável" ficam editáveis na aba **Economia** do admin.

## Sorteio em 2 etapas
1. Sorteia a **raridade** pela tabela de pesos da fonte do drop.
2. Sorteia o **item** dentro da raridade pelo `dropWeight` de cada item.

Tabelas por fonte:
| Fonte | Comum | Incomum | Raro | Épico | Lendário | Mítico |
|---|---|---|---|---|---|---|
| Normal (fases, infinito) | 55 | 25 | 13 | 6 | 0,9 | 0 |
| Farm de raide | 35 | 30 | 20 | 12 | 2,8 | 0,2 |
| Chefe de raide (2 sorteios, mínimo Raro) | — | — | 45 | 35 | 17 | 3 |

## Força dentro da raridade
- Item ganha `powerTier`: 1 (mais fraco), 2, 3 (mais forte). Campo "Força dentro da raridade" no admin.
- No sorteio **normal**, o tier não influencia (só `dropWeight`).
- No sorteio **da garantia**, o peso vira `dropWeight × fatorGarantia[powerTier]`, padrão `{1: 4, 2: 1,5, 3: 0,5}` → os Lendários mais fracos tendem a sair.

## Garantia de Lendário (pity)
- **R1** Contador `legendaryPity` por conta.
- **R2** Só conta em **chefes**: chefe de raide e chefe do Infinito (a cada 25 waves).
- **R3** Cada chefe derrotado que não deu Lendário nem Mítico soma +1.
- **R4** Quando o contador atinge **X (padrão 8)**, o próximo chefe garante 1 Lendário extra, sorteado com o `fatorGarantia`.
- **R5** Qualquer Lendário ou Mítico vindo de chefe zera o contador.
- **R6** Mítico **não** tem garantia.
- **R7** A interface mostra o progresso ("Garantia de Lendário: 5/8") — transparência evita sensação de injustiça.

## Fusão de duplicados
- **R8** Tela "Fusão" no Inventário: escolher 3 instâncias do **mesmo item**, não equipadas e fora de trade.
- **R9** Só raridades com "funde para cima" (Comum a Épico).
- **R10** Chance de sucesso **20%** (`fusionChance`, editável).
  - **Sucesso:** consome os 3 e entrega 1 item aleatório da raridade seguinte, **mesmo slot** (se não houver, qualquer slot), sorteado por `dropWeight`.
  - **Falha (padrão):** consome 2 e devolve 1. ⚠ alternativa: consumir os 3.
- **R11** O resultado é sorteado e **salvo antes** da animação (recarregar a página não permite tentar de novo). Após o servidor (T2.3), o sorteio acontece no servidor.
- **R12** Habilidades ativas (SPEC-011) também fundem, com as mesmas regras.

## Redução de drops
A fusão é um **ralo** de itens (3 entram, no máximo 1 sai), mas encurta o caminho até raridades altas. Para manter Raro+ escassos:
- **R13** `dropRateMultiplier` global, padrão **0,6** (−40%), aplicado ao `dropChance` de todo inimigo.
- **R14** Chance de baú cai de 25% para **15%** dos drops.
- **R15** Registrar localmente, por partida: drops por raridade, fusões tentadas/sucesso. Recalibrar com esses números.

## Critérios de aceite
- 10.000 sorteios da tabela normal em teste: frequências dentro de ±10% relativo dos pesos.
- Garantia em 8: o 8º chefe sem Lendário sempre entrega um; com fator padrão, tier 1 sai ~66% das vezes quando há um de cada tier.
- Fusão: 1.000 tentativas em teste → sucesso entre 17% e 23%.
