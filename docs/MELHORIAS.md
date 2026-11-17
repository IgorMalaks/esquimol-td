# Melhorias sugeridas e riscos conhecidos

O que já foi aprovado e planejado está em **`docs/ROADMAP.md`** (tarefas T0.x a T3.x). Este arquivo guarda os riscos e as ideias que **ainda não** entraram no roadmap.

## Já planejado (ver ROADMAP)
- Migração de schema → T0.1
- 2.5D → T0.2
- Testes automatizados → T0.3
- Remover `?debug` em produção → T0.5
- Traits de inimigos (aéreo; camuflado/imune etc. reservados) → T1.1
- Classes Invocador e Suporte → T1.2, T1.3
- Raridades, garantia, fusão, redutor de drop → T1.4–T1.7
- Habilidades ativas → T1.8
- Infinito, chaves e raide → T1.9, T1.10
- Servidor, contas, amigos, trade, ranking → F2
- Coop em tempo real → F3

## Riscos que continuam valendo
1. **Até a F2, tudo é client-side.** Qualquer jogador edita o `localStorage`. Por isso itens dessa fase entram no servidor como não negociáveis (SPEC-014 R9).
2. **Partida trapaceável mesmo com servidor.** O servidor decide o loot (ADR-013), mas não reproduz a partida. Anti-trapaça real = item 4 abaixo.
3. **Celular físico** (iOS Safari, Android Chrome) ainda não testado; validar a cada fase.
4. **HTTPS** obrigatório fora de `localhost`/`127.0.0.1`.
5. **Hospedagem** do servidor fora da máquina da empresa.

## Ideias ainda não planejadas
1. Traits reservados com efeito: camuflado, imune a gelo, blindado, regenera.
2. Editor de mapas no admin (clicar para criar waypoints e `flightPath` de aéreos).
3. Áudio (estouro, drop, chefe) com volume.
4. **Replay com seed** validado no servidor (anti-trapaça real e base para ranking confiável).
5. Dificuldade por fase (Fácil/Médio/Difícil) com drop melhor no difícil.
6. Migração de dono no coop (outro jogador assume se o dono cair).
7. PWA (instalar no celular, jogar offline o modo solo).
8. Acessibilidade: modo daltônico (forma/ícone por camada), fonte maior, reduzir animações.
9. TypeScript + Vite quando passar de ~5k linhas.
10. Spatial hash para colisão quando houver mais de 300 inimigos (provável no Infinito avançado).
11. Mercado/leilão entre amigos (só depois de o trade direto estar estável).
