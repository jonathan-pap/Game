// Combat resolution. Damage formula uses effective stats (weapon + terrain).
// Hit chance baseline 70% adjusted by AGI delta and target's evade tile bonus.

import { BattleState, UnitInstance, effectiveStats, weaponRange } from "./state";
import { Coord, manhattan } from "./grid";

export interface AttackResult {
  attacker: UnitInstance;
  defender: UnitInstance;
  hit: boolean;
  damage: number;
  defenderAlive: boolean;
}

export function inAttackRange(_state: BattleState, attacker: UnitInstance, target: Coord): boolean {
  const { min, max } = weaponRange(attacker);
  const d = manhattan(attacker.pos, target);
  return d >= min && d <= max;
}

export function resolveAttack(
  state: BattleState,
  attacker: UnitInstance,
  defender: UnitInstance
): AttackResult {
  const a = effectiveStats(state, attacker);
  const d = effectiveStats(state, defender);
  const hitChance = Math.min(99, Math.max(20, 70 + (a.agi - d.agi) * 2 - d.evade));
  const hit = Math.random() * 100 < hitChance;
  let damage = 0;
  if (hit) {
    const base = Math.max(1, a.atk - d.def);
    const variance = 1 + (Math.random() * 0.2 - 0.1); // +/- 10%
    damage = Math.max(1, Math.round(base * variance));
    defender.hp = Math.max(0, defender.hp - damage);
    if (defender.hp <= 0) defender.alive = false;
  }
  return {
    attacker,
    defender,
    hit,
    damage,
    defenderAlive: defender.alive,
  };
}
