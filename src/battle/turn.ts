// Turn order in Shining Force is per-unit, ordered by AGI with some randomness.
// This is a simple stub; the real formula will need a dice roll per unit per round.

export interface TurnUnit {
  id: string;
  agi: number;
  alive: boolean;
}

export function rollTurnOrder(units: TurnUnit[]): string[] {
  return units
    .filter((u) => u.alive)
    .map((u) => ({ id: u.id, score: u.agi + Math.random() * 4 }))
    .sort((a, b) => b.score - a.score)
    .map((u) => u.id);
}
