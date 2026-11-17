# ADR-010 — DOM montado sem innerHTML + CSP

**Status:** aceito · **Data:** 2026-11-17

## Contexto
Nomes de esquimós, itens, inimigos e usuários são texto livre e aparecem para todos os jogadores do navegador. Importação de JSON aceita conteúdo externo.

## Decisão
Helper `el(tag, props, ...children)` que só usa `textContent`/propriedades. Nenhum `innerHTML` com dados. CSP em `index.html`: `default-src 'self'`, `script-src 'self'` (sem inline/eval). Importação limitada a 2 MB e validada antes de aplicar.

## Consequências
- (+) Elimina a classe de XSS mais comum nesse tipo de projeto.
- (−) Código de UI um pouco mais verboso que template strings.
- Se migrar para framework (React/Vue/Svelte), manter: nada de `dangerouslySetInnerHTML`/`v-html` com conteúdo do admin.
