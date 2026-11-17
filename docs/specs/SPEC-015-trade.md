# SPEC-015 — Trade de itens entre amigos

**Status:** planejado (T2.5) · **ADR:** 013

## Fluxo (janela ao vivo, os dois online)
1. A convida B (só amigos). B aceita → abre a janela de trade para os dois.
2. Cada um adiciona até **6 itens** à sua oferta.
3. Cada um clica **Confirmar**. **Qualquer mudança de oferta derruba as duas confirmações.**
4. Com as duas confirmações, contagem de 3 s (dá tempo de cancelar).
5. O servidor executa.

Estados: `convite → aberta → confirmada → executada` | `cancelada` | `expirada` (5 min sem ação ou desconexão).

## Regras
- **R1** Só itens: não equipados, fora de outra trade aberta, raridade negociável (Mítico não, por padrão), `origin` diferente de `local`.
- **R2** Item numa trade aberta fica **travado**: não pode ser equipado, fundido nem oferecido em outra trade.
- **R3** Execução **atômica** no servidor: revalida dono e regras de todos os itens, troca tudo e grava numa única escrita. Se algo falhar, nada muda.
- **R4** Idempotente: cada `tradeId` só executa uma vez (reenvio não duplica).
- **R5** Auditoria: registro `{ tradeId, de, para, itensA, itensB, data }` guardado e visível no histórico de cada jogador.
- **R6** Limite de **20 trades por dia** por conta.
- **R7** Chaves de raide e ouro não são negociáveis.
- **R8** Trade de mão única (presente) é permitido: uma oferta pode ser vazia, mas os dois confirmam.

## Critérios de aceite
- Teste com dois navegadores: troca de 2×1 itens, inventários corretos nos dois lados após recarregar.
- Mudar a oferta depois de confirmar exige nova confirmação dos dois.
- Fechar uma aba durante a contagem cancela sem perder item.
- Tentar trocar item equipado ou Mítico é recusado pelo servidor (não só pela interface).
