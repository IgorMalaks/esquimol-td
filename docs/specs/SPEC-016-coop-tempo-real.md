# SPEC-016 — Coop em tempo real

**Status:** fase 1 validada em duas sessões locais, validação dos demais modos em andamento · **ADRs:** 012, 013

## Salas
- **R1** Dono cria a sala, escolhe modo (Fase, Raide, Infinito) e convida amigos online. Até **4** jogadores.
- **R2** Lobby: cada jogador marca "pronto"; o dono inicia. Todos precisam do mesmo hash de conteúdo (se não, recarregar).
- **R3** Cada jogador leva seu esquadrão, árvore, equipamentos e 2 habilidades ativas.

## Arquitetura
- **R4** A simulação roda **no navegador do dono** (o mesmo `Game` do solo). O servidor só repassa mensagens (relay) via WebSocket.
- **R5** Dono envia snapshot **15 vezes por segundo**: torres, inimigos (`id, def, dist, hp, slow`), drops, vidas, ouro de cada um, rodada. Projéteis não vão no snapshot: o dono envia eventos de "disparo" e cada navegador desenha localmente.
- **R6** Convidados interpolam entre snapshots (100 ms de atraso visual).
- **R7** Convidados enviam **comandos**: posicionar, melhorar, vender, ativar nó, mudar alvo, usar habilidade, coletar drop, ping. O dono valida (ouro, dono da torre, posição) e aplica.
- **R8** Prévia de posicionamento é local (sem esperar o servidor).

## Regras de jogo
- **R9** **Ouro dividido igualmente:** todo ouro de estouro e de fim de rodada é dividido entre os jogadores. Cada um gasta o seu.
- **R10** **Vidas compartilhadas.**
- **R11** Cada um só melhora/vende os próprios esquimós. Limite de torres por jogador = `limiteDaFase ÷ jogadores` (se houver limite).
- **R12** **Drops individuais:** cada drop é atribuído a um jogador (rodízio) e só aparece para ele.
- **R13** Ping no mapa (toque longo / botão do meio) com ícone e cor do jogador.
- **R14** Velocidade 1x/2x e pausa: só o dono.
- **R15** Recompensas (XP, itens, chaves, garantia) são calculadas **no servidor** com base no resultado (ADR-013), por jogador.

## Conexão
- **R16** Convidado que cai tem 60 s para voltar; as torres dele continuam atacando; o ouro dele acumula.
- **R17** Se o dono sai, a partida termina para todos como "interrompida" (sem derrota registrada; itens coletados são mantidos). Migração de dono fica para depois.

## Critérios de aceite
- Dois navegadores na mesma máquina jogam a fase 1 inteira juntos sem dessincronizar vidas/ouro.
- Comando de posicionar do convidado sem ouro é recusado pelo dono e o convidado vê o motivo.
- Derrubar a conexão do convidado por 30 s e voltar: estado correto.
