# SPEC-005 — Arena e combate

**Status:** implementado · **Código:** `js/game/game.js`, `js/screens/gameScreen.js` · **ADRs:** 002, 006, 008

## HUD
Vidas, ouro, rodada atual/total, Auto (inicia rodadas sozinho), 1x/2x, "Iniciar rodada" (ou Espaço), Sair (= derrota, mantém itens coletados).

## Posicionamento
- Barra lateral (paisagem) ou inferior (retrato) com os esquimós desbloqueados e custo.
- Duas formas: **arrastar** o card até o mapa, ou **tocar** no card e depois no mapa. Esc/botão direito cancelam.
- Inválido: em cima do caminho, sobreposto a outro esquimó, fora do mapa, ou sem ouro. Preview mostra alcance em vermelho quando inválido.

## Combate
- Inimigos andam por distância no caminho; posição = `path.pointAt(dist)`.
- Torre ataca quando `cooldown <= 0` e existe alvo no alcance. Modos de alvo: Primeiro, Último, Mais forte (maior RBE), Mais perto.
- Projétil por classe: flecha (rápida), bola (área), arpão (perfuração alta), gelo (lentidão).
- `pierce`: quantos inimigos o projétil atravessa. `splash > 0`: explode no primeiro contato e acerta todos no raio.
- `multishot`: projéteis extras em leque.
- Lentidão: maior valor ativo prevalece; duração renovada; filhos herdam.

## Camadas (ADR-006)
- Ao zerar o HP, o inimigo dá `reward` de ouro, rola drop e gera `childCount` filhos de `childId` na mesma posição (levemente atrás).
- Dano excedente passa para o primeiro filho.
- O projétil que matou o pai não acerta os filhos recém-criados (igual ao Bloons).
- Se escapar, tira `RBE` vidas.

## Economia
- Ouro inicial e vidas definidos na fase.
- Fim de rodada: `+100 + número da rodada`.
- Upgrades temporários por torre (3 trilhas × 4 níveis): Ataque (+1 dano/nível), Velocidade (+20%/nível), Alcance (+12%/nível). Custo = `custo do esquimó × mult × (nível+1)`, arredondado a 5.
- Ativar habilidade da árvore: custa o `gold` definido pelo admin no nó.
- Vender devolve 70% de tudo investido na torre.

## Fim
- Vitória: completar todas as rodadas com vidas > 0. Baús restantes no mapa são abertos automaticamente.
- Derrota: vidas ≤ 0 ou abandonar. Itens já clicados são mantidos; baús não clicados são perdidos.
