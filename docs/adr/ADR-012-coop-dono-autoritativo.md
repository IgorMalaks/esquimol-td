# ADR-012 — Coop com simulação no navegador do dono e servidor como relay

**Status:** aceito (implementação pendente) · **Data:** 2026-11-17

## Contexto
Coop precisa de um estado único do jogo. Rodar a simulação no servidor seria o mais seguro, mas exige portar o motor para Node, servidor com CPU por partida e lidar com render separado.

## Decisão
O navegador do dono roda o mesmo `Game` do modo solo e é a autoridade da partida. O servidor só repassa mensagens. Convidados mandam comandos e recebem snapshots a 15 Hz.

## Consequências
- (+) Reaproveita 100% do motor; o servidor fica barato.
- (+) Base para evoluir: como o loop é de passo fixo (ADR-008), dá para mover a simulação ao servidor depois.
- (−) O dono pode trapacear dentro da partida. Entre amigos, aceitável. **O que não pode é virar item no mercado:** por isso recompensas são decididas no servidor (ADR-013).
- (−) Se o dono cai, a partida acaba (v1).
