# SPEC-008 — Classes Invocador e Suporte

**Status:** planejado (T1.2, T1.3) · **ADR:** 007

## Papel da classe
`CLASSES` ganha dois campos definidos em código:
- `role`: `atacante` | `invocador` | `suporte`
- `hitsAir`: se a classe atinge inimigos aéreos por padrão (SPEC-009)

| Classe | role | hitsAir |
|---|---|---|
| Arqueiro | atacante | não |
| Lançador de Bolas de Neve | atacante | não |
| Arpoador | atacante | **sim** |
| Mago do Gelo | atacante | **sim** |
| **Domador** (novo) | invocador | não (aliados são terrestres) |
| **Xamã** (novo) | suporte | — |

O formulário do admin mostra só os atributos do papel escolhido.

---

## Invocador

### Atributos (editáveis por esquimó)
| Campo | Significado | Padrão |
|---|---|---|
| `summonInterval` | segundos entre invocações | 4 |
| `summonCount` | aliados por invocação | 1 |
| `maxAllies` | limite de aliados vivos desta torre | 4 |
| `allyHp` | quantos acertos o aliado aguenta | 3 |
| `allyDamage` | dano por contato | 1 |
| `allySpeed` | px/s no caminho | 70 |
| `allyLifetime` | segundos até sumir | 12 |
| `allyKind` | visual: `pinguim`, `foca`, `urso`, `lobo` | pinguim |

### Comportamento
- **R1** Só invoca durante rodada ativa e com inimigos no mapa.
- **R2** O aliado nasce na **base** (fim do caminho, no iglu) e anda o caminho **ao contrário** (`dist` diminuindo).
- **R3** Ao encostar num inimigo **terrestre**, causa `allyDamage` (via `hitEnemy`, então respeita camadas e dano excedente) e perde 1 de `allyHp`. Recarga de contato de 0,25 s por inimigo.
- **R4** Some quando `allyHp = 0`, quando acaba `allyLifetime` ou quando chega ao início do caminho.
- **R5** Estouros dos aliados contam para a torre que invocou (ouro, XP, contador de abates).
- **R6** Aliados nunca atingem aéreos e não podem ser buffados por "antiaéreo".
- **R7** Upgrades de partida no invocador: Ataque → `allyDamage +1`; Velocidade → `summonInterval ×0,85`; Alcance → `allyHp +1`.

### Árvore padrão do Domador
| Caminho | Nv1 | Nv2 | Nv3 |
|---|---|---|---|
| Matilha | +1 aliado por invocação | +2 `maxAllies` | Invoca lobos (rápidos, `allySpeed ×1,6`) |
| Urso Polar | +2 `allyHp` | +1 `allyDamage` | Invoca ursos (`allyHp ×3`, lentos) |
| Foca Gelada | aliados aplicam lentidão 20% | +4 s de duração | Aliado explode ao morrer (área 40) |

Novos efeitos em `EFFECT_KEYS`: `summonCount`, `maxAllies`, `allyHp`, `allyDamage`, `allySpeedPct`, `allyLifetime`, `allyKind` (troca de visual/perfil), `allySlowPct`, `allyExplode`.

---

## Suporte

### Atributos
| Campo | Significado | Padrão |
|---|---|---|
| `range` | raio da aura | 120 |
| `buffs` | lista `{ key, value }` | `[{ key: 'damage', value: 1 }]` |

Buffs permitidos: `damage`, `speedPct`, `rangePct`, `pierce`, `antiAereo` (dá `hitsAir` a quem está na aura).

### Comportamento
- **R8** O suporte não ataca. Torres (atacantes e invocadores) cujo centro está dentro do raio recebem os buffs.
- **R9** **Buffs do mesmo tipo não somam:** vale só o maior valor entre os suportes que cobrem a torre. Tipos diferentes somam entre si.
- **R10** Suporte não buffa outro suporte (evita cadeias e loops).
- **R11** Atributos das torres são recalculados só quando algo muda (posicionar, vender, upgrade, ativar habilidade), por uma flag "sujo" — nunca a cada frame.
- **R12** Upgrades de partida no suporte: Ataque → +1 no buff de dano; Velocidade → +10 p.p. no buff de velocidade; Alcance → raio ×1,15.
- **R13** Visual: aura em elipse no chão (2.5D), pulsando; torres buffadas ganham um ícone pequeno.

### Árvore padrão do Xamã
| Caminho | Nv1 | Nv2 | Nv3 |
|---|---|---|---|
| Tambor de Guerra | buff dano +1 | buff velocidade +15% | buff dano +2 adicional |
| Luneta Polar | buff alcance +10% | **antiaéreo** | buff perfuração +2 |
| Totem | raio +20% | +30 ouro por rodada | aura reduz recarga das habilidades ativas em 15% (SPEC-011) |

## Critérios de aceite
- Dois Xamãs com buff de dano +1 e +2 cobrindo a mesma torre → ela recebe +2 (não +3).
- Torre sem `hitsAir` passa a atingir aéreos dentro da aura com antiaéreo, e perde ao vender o Xamã.
- Aliado nascido do iglu anda contra os inimigos, estoura camadas e some ao fim da vida.
