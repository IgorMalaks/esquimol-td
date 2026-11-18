export const ENEMY_TRAITS = {
  aereo: 'Aéreo',
  chefe: 'Chefe',
  camuflado: 'Camuflado',
  imune_gelo: 'Imune a gelo',
  blindado: 'Blindado',
  regenera: 'Regenera',
  rapido: 'Corredor',
  enxame: 'Enxame',
  curandeiro: 'Curandeiro',
  escudo: 'Escudeiro',
  divisor: 'Divisor',
  ladrao: 'Ladrão',
};

export const hasTrait = (def, trait) => def.traits?.includes(trait) ?? false;
export const canHitEnemy = (def, hitsAir, detection = false) =>
  (!hasTrait(def, 'aereo') || Boolean(hitsAir)) && (!hasTrait(def, 'camuflado') || Boolean(detection));

export function roundsHaveAir(rounds, enemies) {
  const byId = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  return rounds.some((round) => round.groups.some(({ enemyId }) => {
    const seen = new Set();
    for (let enemy = byId.get(enemyId); enemy && !seen.has(enemy.id); enemy = byId.get(enemy.childId)) {
      if (hasTrait(enemy, 'aereo')) return true;
      seen.add(enemy.id);
    }
    return false;
  }));
}
