# SPEC-017 — Biomas, elementos e arquétipos de inimigos

**Status:** planejado (T1.13–T1.16) · **ADR:** 017 · **Relacionadas:** SPEC-009 (traits), SPEC-012 (raide), SPEC-013 (infinito)

## 1. Elementos

Cada **esquimó causa 1 tipo de dano**. Cada **camada de inimigo tem 1 elemento**. Dano final = dano × multiplicador da matriz.

### Tipos de dano
| Tipo | Fonte padrão |
|---|---|
| Perfurante | Arqueiro, Arpoador |
| Impacto | Lançador de Bolas de Neve, aliados do Domador |
| Gelo | Mago do Gelo |
| Fogo | variantes elementais, armas, habilidades |
| Raio | variantes elementais, armas, habilidades |
| Arcano | variantes elementais, armas, habilidades |

Uma torre pode trocar de tipo. Prioridade: **nó da árvore ativado na partida > arma equipada > classe**. Nunca mais de 1 tipo por torre (legibilidade).

### Elementos de inimigo e matriz padrão
Linhas = elemento do inimigo; colunas = tipo de dano.

| | Perfurante | Impacto | Gelo | Fogo | Raio | Arcano |
|---|---|---|---|---|---|---|
| Neutro | 1 | 1 | 1 | 1 | 1 | 1 |
| Gelo | 1 | 1,25 | **0,25** | **1,75** | 1 | 1 |
| Fogo | 1 | 1 | **1,75** | **0 (imune)** | 1 | 1 |
| Pedra | **0,5** | **1,5** | 0,75 | 1 | 1,25 | 1 |
| Natureza | 0,75 | 1 | 1,25 | **1,75** | 1 | 1 |
| Tempestade | 1,25 | 0,75 | 1 | 1 | **0,25** | 1,25 |
| Sombra | 0,75 | 0,75 | 0,75 | 1 | 1 | **1,75** |

### Regras
- **R1** HP passa a aceitar fração; a camada estoura com HP ≤ 0. Dano excedente continua passando para o filho, já com o multiplicador do elemento do filho.
- **R2** Elemento é **por camada**, não herdado (mesma regra dos traits, SPEC-009). Ex.: Golem de Gelo estoura em Pedras.
- **R3** Lentidão e congelamento em inimigos de **Fogo** e **Gelo** têm 50% do efeito.
- **R4** Imunidade (×0) é rara: no padrão, só Fogo contra Fogo.
- **R5** Validação no admin: avisa se uma fase tem camada imune a todos os tipos de dano dos esquimós **iniciais**. A partida mostra o mesmo aviso antes de começar.
- **R6** Sanidade da matriz (bloqueia o salvar): todo elemento tem pelo menos uma fraqueza ≥ 1,5, e todo tipo de dano é eficaz (≥ 1,5) contra pelo menos um elemento.
- **R7** Retorno visual: número de dano com "EFICAZ" (≥ 1,5), "RESISTE" (≤ 0,5) ou "IMUNE". Selo de elemento pequeno sobre o inimigo. O painel da torre mostra o tipo de dano. A prévia da rodada mostra os elementos que vêm.
- **R8** Novo modo de alvo: **"Eficaz"** — prioriza o inimigo com maior multiplicador contra o dano da torre; empate decide por "Primeiro".
- **R9** Matriz editável no admin (aba **Elementos**).
- **R10** Visual: selo = losango colorido + nome (tokens `--el-*`, design system v0.2). Cor nunca sozinha.

## 2. Biomas

Bioma é atributo do **mapa**: paleta, decoração, pesos de elemento dos inimigos e um **modificador ambiental**.

| Bioma | Visual | Inimigos predominantes | Modificador ambiental | Chefe de raide |
|---|---|---|---|---|
| **Tundra** (atual) | neve aberta | Neutro, Gelo | nenhum (bioma de aprendizado) | Rei Iceberg |
| **Floresta Boreal** | pinheiros densos, neblina | Natureza, Neutro | neblina: alcance −10%; árvores bloqueiam parte das posições | Ancião Musgoso |
| **Caverna de Cristal** | escura, cristais com brilho | Pedra, Sombra | escuridão: alcance −15% fora das zonas iluminadas pelos cristais | Golem Prismático |
| **Fontes Termais** | rocha escura, vapor, lava sob o gelo | Fogo, Pedra | calor: lentidão −30%; trechos de lava aceleram inimigos de Fogo em 20% | Salamandra do Degelo |
| **Costa da Tempestade** | mar escuro, relâmpagos | Tempestade (muitos aéreos), Neutro | vento: aéreos +20% velocidade; a cada 30 s um raio atordoa uma torre aleatória por 2 s | Serpe do Trovão |
| **Ruínas da Aurora** | gelo antigo, aurora no céu | Sombra, Neutro | aurora: habilidades ativas recarregam 15% mais rápido; inimigos de Sombra ficam camuflados fora da luz | Rainha do Eclipse |

### Regras
- **R11** Biomas abrem em sequência. Cada bioma tem 2–3 fases e 1 raide.
- **R12** Infinito pode ser jogado por bioma (usa os pesos de elemento do bioma). Ranking separado por bioma.
- **R13** O modificador aparece antes da partida e fica na HUD como ícone com explicação.
- **R14** Modelo: `{ id, nome, paleta: { chao, caminho, borda, ceu, nevoa }, decor: [...], pesosElemento: { gelo: 3, ... }, modificadores: [{ tipo, valor }], musica (reservado) }`. O mapa ganha `biomeId`.
- **R15** Render 2.5D: paleta e decoração por bioma; neblina e escuridão pré-renderizadas em camada própria (custo fixo no celular, não por frame).
- **R16** Admin: aba **Biomas** (paleta com preview, decoração, pesos, modificadores).

## 3. Arquétipos de inimigos
Estende a lista de traits da SPEC-009. Combináveis com qualquer elemento ("Corredor de Fogo").

| Arquétipo | Trait | Comportamento | Respostas esperadas |
|---|---|---|---|
| Corredor | `rapido` | velocidade ×1,8, HP baixo | lentidão, alvo "Primeiro" |
| Blindado | `blindado` | acertos com dano < 2 causam só 25% | Impacto, Arpoador, upgrades de dano |
| Enxame | `enxame` | nasce em grupos de 8–12, pequenos | dano em área |
| Curandeiro | `curandeiro` | a cada 4 s restaura 1 camada de aliados num raio 80 (não a si) | alvo "Mais forte", foco |
| Escudeiro | `escudo` | escudo frontal absorve 6 acertos de frente; por trás leva normal | torres depois das curvas, perfuração |
| Divisor | `divisor` | ao estourar, gera o dobro de filhos | área |
| Camuflado | `camuflado` | só visível para torres com detecção | Xamã (Luneta), itens |
| Voador | `aereo` | SPEC-009 | antiaéreo |
| Ladrão | `ladrao` | se vazar, também rouba 5% do ouro | não deixar vazar |
| Regenerador | `regenera` | recupera 1 camada após 3 s sem levar dano | dano contínuo |

- **R17** Máximo de 2 traits por camada (legibilidade).
- **R18** Cada trait tem ícone próprio no selo do inimigo.
- **R19** **Bestiário** no menu: inimigos já encontrados, com elemento, fraquezas, resistências e traits. Ensina o sistema sem tutorial longo.

## 4. Conteúdo padrão (por bioma)
4 a 6 inimigos por bioma, exemplos:
- Floresta: Broto Corredor (Natureza, rápido), Cogumelo Curandeiro (Natureza, curandeiro), Lobo Cinzento (Neutro, enxame).
- Caverna: Golem de Gelo (Gelo, blindado → 3× Pedra), Morcego de Cristal (Sombra, aéreo), Espreitador (Sombra, camuflado).
- Termais: Brasa (Fogo, rápido), Tartaruga de Magma (Fogo/Pedra, escudo).
- Costa: Gaivota do Trovão (Tempestade, aéreo, enxame), Caranguejo Ladrão (Neutro, ladrão).
- Ruínas: Eco (Sombra, regenerador), Sentinela Antiga (Pedra, escudo).

E por bioma, 1 **variante elemental** de esquimó (liberada por fragmentos do bioma, SPEC-018) e armas que mudam o tipo de dano (ex.: "Arco Incendiário": Perfurante → Fogo).

## Critérios de aceite
- Mago (Gelo) contra Golem de Gelo causa 25% do dano e mostra "RESISTE"; com arma de Fogo equipada, 175% e "EFICAZ".
- Salvar matriz com um elemento sem fraqueza é bloqueado com mensagem clara.
- Fase com Fogo e esquimós iniciais só de Fogo gera aviso no admin.
- Modificador "calor" reduz a lentidão aplicada em 30% (teste automatizado).
