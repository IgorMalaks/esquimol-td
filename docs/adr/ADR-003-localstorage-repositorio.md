# ADR-003 — localStorage atrás de uma camada de repositório

**Status:** aceito · **Data:** 2026-11-17

## Contexto
O pedido especifica localStorage para contas, inventário e progresso. Ao mesmo tempo, um jogo real vai precisar de servidor.

## Decisão
Todo acesso a persistência passa por `core/storage.js` (chaves com prefixo `etd.v1.`). Conteúdo do admin vive em `data/gameData.js` (com cache e validação); contas em `core/auth.js`; regras de progresso em `core/progression.js`. Telas nunca tocam `localStorage` direto.

## Consequências
- (+) Trocar por API REST é mexer em 3 arquivos, não nas telas.
- (+) Prefixo versionado permite migrações.
- (−) Dados presos ao navegador/dispositivo; limpar o navegador apaga tudo; não sincroniza PC↔celular.
- (−) Limite de ~5 MB. Hoje o conteúdo padrão ocupa poucos KB.
- (−) Sem migração de schema ainda: versão diferente volta ao padrão (registrado em MELHORIAS como prioridade).
