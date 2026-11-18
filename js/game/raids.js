export function raidPhase(raid) {
  return {
    ...raid,
    rounds: [...raid.farmRounds, {
      groups: [{ enemyId: raid.bossId, count: 1, interval: 1, delay: 0 }],
    }],
    raid,
  };
}

export function raidAvailable(account, raid) {
  return (account.progress.raidKeys ?? 0) >= raid.keyCost;
}
