# ADR-011 — Servidor Node sem dependências

**Status:** implementado e testado localmente · **Data:** 2026-11-17

## Contexto
Multiplayer, amigos e trade exigem uma fonte da verdade fora do navegador. O projeto até aqui tem zero dependências (ADR-001) e a política interna exige versões fixas e cuidado com supply chain.

## Decisão
Servidor em Node LTS 22, usando só módulos nativos: `http`, `crypto`, `fs`. WebSocket implementado num módulo próprio (`server/ws.js`) com o mínimo do RFC 6455 (frames de texto, máscara, ping/pong, close, limite de 64 KB). Dados num arquivo JSON por trás de `store.js`, com fila de escrita única e escrita atômica (arquivo temporário + rename).

## Consequências
- (+) Nada de terceiros para auditar; sobe com `node server/index.js`.
- (+) `store.js` e `ws.js` são trocáveis: banco (SQLite/Postgres) e biblioteca `ws` com versão fixa entram sem mexer nas rotas.
- (−) WebSocket feito à mão tem mais risco de bug de protocolo que uma biblioteca madura. Mitigação: escopo mínimo, testes de frame e limite de tamanho. **Se aparecerem problemas, trocar por `ws` com versão fixa** (decisão simples, isolada em um arquivo).
- (−) Arquivo JSON não escala para muitos jogadores nem para várias instâncias. Suficiente para amigos.
- Hospedagem fora da máquina da empresa (ver SPEC-014).
