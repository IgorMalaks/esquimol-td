# SPEC-002 — Painel Admin

Backups antigos passam pelas migrações do conteúdo. O painel também edita traços de inimigos e força dos itens dentro da raridade.

**Status:** implementado · **Código:** `js/screens/adminScreen.js`, `js/data/gameData.js` · **ADRs:** 004, 007

## Abas
| Aba | O que gerencia |
|---|---|
| Esquimós | Aparência (Criador Visual com preview do corpo + arma da classe), nome, classe, cor da parka, custo, atributos base, desbloqueio, nomes dos 3 caminhos e as 9 habilidades (3 caminhos × 3 níveis). |
| Inimigos | Rosto (Criador Visual), resistência, velocidade, tamanho, ouro, chance de drop, camada seguinte e quantidade. Mostra a cadeia de camadas e o RBE. |
| Fases & Rodadas | Nome, mapa (com preview), ouro inicial, vidas e rodadas (grupos de inimigos: qtd, intervalo, atraso). Duplicar/remover rodada. Mostra o RBE da rodada. |
| Itens & Armas | Nome, tipo/slot (arma, armadura, amuleto), raridade, restrição de classe, peso no sorteio e bônus permanentes. |
| Dados | Exportar/importar JSON, restaurar padrões, apagar contas, trocar senha do admin. |

## Requisitos (EARS)
- **R1** Ao salvar, o sistema deve validar o conjunto inteiro (`validateData`) e recusar: inimigo apontando para camada inexistente, ciclo de camadas, fase sem rodada, rodada vazia, mapa/inimigo inexistente e conteúdo sem nenhum esquimó inicial.
- **R2** Ao excluir um inimigo usado como camada de outro ou em alguma rodada, o sistema deve bloquear e dizer onde ele é usado.
- **R3** Ao excluir uma fase usada como condição de desbloqueio, o sistema deve bloquear.
- **R4** Quando o conteúdo mudar e um jogador entrar, o sistema deve limpar referências órfãs no progresso (esquimós, itens, habilidades e equipamentos inválidos) — `ensureProgress`.
- **R5** Se uma mudança de custo deixar pontos gastos acima do disponível, o sistema deve resetar a árvore daquele esquimó (não quebrar).
- **R6** Importação deve aceitar no máximo 2 MB e passar por `validateData` antes de pedir confirmação.
- **R7** **Migração de schema (T0.1).** Conteúdo e progresso de conta guardam `version`. Ao carregar uma versão antiga, o sistema deve aplicar em ordem as funções `migrations[v] = (data) => data` (v → v+1) até a versão atual, validar com `validateData` e só então salvar. Regras:
  - nunca descartar o conteúdo do admin por diferença de versão (comportamento atual de `getData`, que deve ser removido);
  - antes de migrar, guardar uma cópia em `etd.v1.backup.<versão>` (uma por versão, a mais recente);
  - se a migração ou a validação falhar, manter os dados antigos intactos, abrir o admin em modo somente leitura e mostrar o erro com a opção "Exportar JSON";
  - versão **maior** que a do código (dado de um build mais novo): não migrar nem sobrescrever; avisar;
  - cada migração tem teste com um JSON de exemplo da versão anterior.

## Regra de edição
Edição em rascunho (cópia); nada é persistido até "Salvar". IDs são gerados a partir do nome (`slugify`) e nunca mudam depois.
