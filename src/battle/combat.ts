// Damage formula stub. Final formula will incorporate weapon, terrain defense,
// crits, and class matchups. For now: max(1, atk - def) with small randomness.

export interface CombatStats {
  atk: number;
  def: number;
  agi: number;
}

export function computeAttackDamage(attacker: CombatStats, defender: CombatStats): number {
  const base = Math.max(1, attacker.atk - defender.def);
  const variance = 1 + (Math.random() * 0.2 - 0.1); // +/- 10%
  return Math.max(1, Math.round(base * variance));
}

// Hit chance based on AGI delta. 70% baseline, +/- 2% per AGI point.
export function computeHitChance(attacker: CombatStats, defender: CombatStats, evadeBonus = 0): number {
  const base = 70 + (attacker.agi - defender.agi) * 2 - evadeBonus;
  return Math.min(99, Math.max(20, base));
}
