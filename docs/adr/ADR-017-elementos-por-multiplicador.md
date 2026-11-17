# ADR-017 — Elementos por multiplicador simples e biomas como dados

**Status:** aceito (implementação pendente) · **Data:** 2026-11-17

## Contexto
Igor pediu mais biomas e inimigos com afinidade a elementos: fortes contra uns, fracos contra outros. O risco desse tipo de sistema é ficar opaco (o jogador não entende por que perdeu) ou virar "parede" (fase impossível sem a torre certa).

## Decisão
1. **Um tipo de dano por torre e um elemento por camada.** Nada de dano misto nem resistência somada de várias fontes.
2. **Multiplicador de uma matriz pequena** (6 tipos de dano × 7 elementos), editável no admin, com regras de sanidade (todo elemento tem fraqueza; todo dano é eficaz contra algo).
3. **Imunidade rara** (só Fogo × Fogo no padrão) e validação que avisa quando uma fase fica sem resposta para o esquadrão inicial.
4. **Trocar o tipo de dano é recompensa:** armas, nós de árvore e variantes elementais de esquimó. Isso dá valor ao loot sem criar classes novas em código.
5. **Bioma é dado** (paleta, decoração, pesos de elemento, modificadores de uma lista fechada). Novo bioma não exige código; novo tipo de modificador exige.
6. Comunicação obrigatória: selo de elemento, "EFICAZ/RESISTE/IMUNE" no dano, bestiário.

## Consequências
- (+) Composição de esquadrão vira decisão estratégica real; loot elemental ganha propósito.
- (+) Tudo ajustável por números, sem recompilar.
- (−) Mais uma dimensão para balancear: depende da simulação de economia/combate (T0.0) para não virar palpite.
- (−) Fases de biomas avançados podem frustrar quem não tem o tipo de dano certo. Mitigação: aviso prévio, bestiário, e garantir que a variante elemental do bioma anterior resolve o próximo.
- (−) HP fracionado muda o cálculo de RBE: passa a ser "acertos de dano 1 neutro".
