# SPEC-009 — Traits de inimigos e inimigos aéreos

**Status:** implementado no solo (T1.1) · **ADR:** 006, 016

## Traits
Inimigo ganha `traits: string[]`, com valores de uma lista fechada em código:

| Trait | Efeito | Nesta fase? |
|---|---|---|
| `aereo` | voa; só é atingido por torres com `hitsAir` | **sim** |
| `chefe` | barra de vida no topo da HUD; efeitos de controle (congelar/lentidão) com 50% de efeito | **sim** (usado por raide/infinito) |
| `camuflado` | só visível para torres com detecção | reservado |
| `imune_gelo` | ignora lentidão | reservado |
| `blindado` | ignora flechas | reservado |
| `regenera` | recupera camadas com o tempo | reservado |

- **R1** Traits **não são herdados**: cada camada tem os seus. Ex.: "Dirigível" (aéreo) pode estourar em "Pedra" (terrestre).
- **R2** O admin marca traits com checkboxes e a cadeia de camadas mostra um ícone por trait.

## Aéreos
- **R3** Simulação igual: anda por distância no caminho do mapa (ou em `flightPath`, se o mapa definir um — opcional, para "atalhos" no ar). Colisão usa a posição no chão.
- **R4** Render (2.5D): desenhado a 60 px de altura, com sombra no chão e leve balanço lateral.
- **R5** Alvo: `_findTarget` ignora aéreos se a torre não tem `hitsAir`. Explosões em área só acertam aéreos se a torre tiver `hitsAir`.
- **R6** Fontes de `hitsAir`: classe (Arpoador, Mago), nó de árvore com efeito `hitsAir` (ex.: "Mira antiaérea" no Arqueiro), item com `hitsAir`, aura de Suporte com `antiAereo`.
- **R7** Aliados de invocador nunca atingem aéreos.
- **R8** Vidas perdidas ao vazar: RBE, igual aos terrestres.

## Avisos (não bloqueiam)
- **R9** Admin: ao salvar uma fase com aéreo, avisar se nenhum esquimó **inicial** atinge aéreo.
- **R10** Partida: ao iniciar, se nenhum esquimó do jogador atinge aéreo e a fase tem aéreo, toast "Esta fase tem inimigos voadores".
- **R11** Prévia da rodada (no botão "Iniciar rodada") mostra ícone de asa quando a rodada tem aéreo.

## Conteúdo padrão novo
- **Corvo de Gelo** (aéreo, rápido, 1 camada → nada).
- **Dirigível Glacial** (aéreo, `hp` 20, vira 3× Pedra terrestre).

## Critérios de aceite
- Arqueiro sem upgrade não atira em aéreo; Arpoador atira.
- Arqueiro dentro de aura antiaérea atira; ao vender o Xamã, para.
