# ADR-001 — Vanilla JS com ES Modules, sem build

**Status:** aceito · **Data:** 2026-11-17

## Contexto
O pedido é um esqueleto rodando direto no navegador, fácil de abrir e evoluir. Política interna exige versões fixas e evita dependências recentes; cada dependência é superfície de supply chain.

## Decisão
HTML + CSS + JavaScript puro com `<script type="module">`. Zero dependências, zero build. Módulos por responsabilidade (`core`, `data`, `game`, `render`, `ui`, `screens`).

## Consequências
- (+) Abre com qualquer servidor estático; nada para auditar além do próprio código.
- (+) Fácil migrar depois para Vite/TypeScript: os módulos já são ESM.
- (−) Sem tipagem estática. Mitigação: regras puras isoladas em `stats.js`/`progression.js` (fáceis de testar) e JSDoc nos pontos críticos.
- (−) Exige servidor HTTP (ESM não carrega via `file://`).

## Alternativas
Phaser/PixiJS (pesado para o escopo, mais uma dependência), TypeScript + Vite (melhor a médio prazo — ver MELHORIAS).
