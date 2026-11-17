# Modelo de dados — Esquimó TD

Conteúdo e progresso têm versões independentes. Ambos estão no esquema 2 e usam JSON. IDs de definições são persistentes e fazem a ligação entre tabelas. Timestamps usam ISO 8601 em UTC. Valores percentuais de atributos vão de 0 a 100. Probabilidades vão de 0 a 1.

## Conteúdo

O objeto exportado pelo painel tem `version`, `eskimos`, `enemies`, `items`, `maps`, `phases`, `abilities`, `raids` e `biomes`. As últimas três coleções começam vazias até suas funcionalidades entrarem no jogo.

| Registro | Campos |
|---|---|
| Rosto | `shape`, `skin`, `eyes`, `eyeColor`, `mouth`, `headwear`, `headwearColor`, `accessory`, `accessoryColor`, `outline`. As opções estão em `FACE_OPTIONS`. |
| Esquimó | `id`, `name`, `classId`, `bodyColor`, `cost`, `face`, `stats`, `unlock`, `branches`, `tree`, `damageType`, `hitsAir`, `variantOf`. `variantOf` referencia o esquimó base ou é nulo. |
| Atributos | `damage`, `range`, `fireRate` (ataques/s), `pierce`, `projectileSpeed`, `splash`, `slowPct`, `slowDuration` (s). |
| Nó de árvore | `id`, `branch`, `tier`, `name`, `desc`, `cost` em pontos, `gold` para ativação e `effect: { key, value }`. |
| Desbloqueio | `{ type: 'default' | 'wins' | 'rounds' | 'phase', value }`. O formato previsto para recrutar variantes é `{ type: 'fragments', biome, amount }`. |
| Inimigo | `id`, `name`, `hp`, `speed`, `size`, `reward`, `dropChance`, `childId`, `childCount`, `face`, `traits` e `element`. Cada camada tem seus próprios traits e elemento. `childId` vazio encerra a cadeia. |
| Item | `id`, `name`, `type`, `rarity`, `stats` com bônus, `classRestriction`, `dropWeight`, `powerTier` de 1 a 3 e `damageType` opcional. Uma instância guarda `uid`, `itemId`, `foundAt` e `origin` (`local` ou `server`). |
| Mapa | `id`, `name`, `points` com pares `[x, y]` normalizados, `biome` (ID ou nulo) e `flightPath` opcional, com o mesmo formato de `points`. |
| Fase | `id`, `name`, `mapId`, `startGold`, `lives` e `rounds`. Cada rodada contém `groups` com `enemyId`, `count`, `interval` e `delay` em segundos. |
| Habilidade (SPEC-011) | `id`, `name`, `type`, `cooldown`, `power`, `area` e parâmetros do efeito. Item de habilidade referencia `abilityId`; sua raridade ajusta os atributos. |
| Raide (SPEC-012) | `id`, `name`, `mapId`, `startGold`, `lives`, `keyCost`, `farmRounds`, `farmGoldMultiplier`, `prepTime`, `bossId`, `bossAbility: { type, interval, radius, duration }`, `bossPhases` com limiares de HP, multiplicadores e escolta, e `bossLoot` com fonte e número de sorteios. |
| Bioma (SPEC-017) | `id`, `name`, paleta de chão e caminho, decoração, pesos de elementos para o Infinito e modificador ambiental. Mapas referenciam o bioma. |

## Conta local

`accounts` é indexado pelo nome de usuário em minúsculas. Cada conta contém `username`, `salt`, `hash`, `createdAt` e `progress`. Os dois campos de credencial usam Base64. A sessão de jogador guarda o nome de usuário. O painel local usa credenciais e sessão próprias.

| Campo de progresso | Formato |
|---|---|
| `version` | Número inteiro independente da versão do conteúdo. |
| `unlocked` | Lista de IDs de esquimós desbloqueados. |
| `eskimos` | ID → `{ xp, skills, equip }`. `skills` contém IDs de nós e `equip` associa `arma`, `armadura` e `amuleto` ao UID da instância ou a nulo. |
| `inventory` | Lista de instâncias de item. |
| `phases` | ID da fase → `{ completed, bestRound }`. |
| `stats` | `{ wins, losses, roundsTotal }`. |
| `fragments` | ID do bioma → saldo inteiro. |
| `raidKeys` | Saldo inteiro de chaves compartilhado entre raides. |
| `legendaryPity` | Chefes elegíveis consecutivos sem Lendário ou Mítico. |

O repositório aplica migrações sequenciais antes de salvar uma atualização. Backups antigos sem `version` são tratados como versão 1. Conteúdo de versão futura fica preservado no armazenamento e pode ser substituído pelo painel após confirmação explícita de importação ou restauração.
