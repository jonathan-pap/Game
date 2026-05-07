// Enemy AI. Behavior: find the nearest living player; if already in attack
// range, attack without moving; else walk along the shortest path toward
// that player as far as movement allows, and attack if newly in range.

import { BattleState, UnitInstance, makeMoveCostFn, weaponRange } from "./state";
import { findPath, reachable } from "./pathfinding";
import { Coord, manhattan } from "./grid";

export interface AIPlan {
  destination: Coord; // where the unit ends up (may equal current pos)
  target: UnitInstance | null; // attack target after moving, if any
}

function pickNearestPlayer(state: BattleState, self: UnitInstance): UnitInstance | null {
  let best: UnitInstance | null = null;
  let bestD = Infinity;
  for (const u of state.units) {
    if (!u.alive) continue;
    if (u.template.side !== "player") continue;
    const d = manhattan(self.pos, u.pos);
    if (d < bestD) {
      best = u;
      bestD = d;
    }
  }
  return best;
}

function attackableFrom(
  _state: BattleState,
  self: UnitInstance,
  from: Coord,
  enemy: UnitInstance
): boolean {
  const { min, max } = weaponRange(self);
  const d = Math.abs(from.x - enemy.pos.x) + Math.abs(from.y - enemy.pos.y);
  return d >= min && d <= max;
}

export function planEnemyTurn(state: BattleState, self: UnitInstance): AIPlan {
  const target = pickNearestPlayer(state, self);
  if (!target) return { destination: self.pos, target: null };

  // Already in range from current position.
  if (attackableFrom(state, self, self.pos, target)) {
    return { destination: self.pos, target };
  }

  const cost = makeMoveCostFn(state, self);
  const reach = reachable(self.pos, self.template.stats.mov, state.cols, state.rows, cost);

  // Find a reachable tile from which we can attack the target.
  let bestAttackTile: Coord | null = null;
  let bestAttackTileDist = Infinity;
  for (const key of reach.keys()) {
    const [xs, ys] = key.split(",");
    const c: Coord = { x: Number(xs), y: Number(ys) };
    // Cannot stop on a tile occupied by another live unit.
    const blocked = state.units.some(
      (u) => u.alive && u !== self && u.pos.x === c.x && u.pos.y === c.y
    );
    if (blocked) continue;
    if (!attackableFrom(state, self, c, target)) continue;
    const d = manhattan(c, self.pos);
    if (d < bestAttackTileDist) {
      bestAttackTileDist = d;
      bestAttackTile = c;
    }
  }
  if (bestAttackTile) {
    return { destination: bestAttackTile, target };
  }

  // Otherwise: walk as far along the path as movement allows.
  const path = findPath(self.pos, target.pos, state.cols, state.rows, cost);
  if (!path || path.length <= 1) return { destination: self.pos, target: null };

  // Walk from start, accumulating cost; stop before exceeding budget; stop
  // before stepping onto a tile occupied by another live unit (we cannot
  // end on it). Path's first node is our position with cost 0.
  let acc = 0;
  let dest = self.pos;
  for (let i = 1; i < path.length; i++) {
    const step = path[i];
    const stepCost = cost(step);
    if (!Number.isFinite(stepCost)) break;
    if (acc + stepCost > self.template.stats.mov) break;
    const occupied = state.units.some(
      (u) => u.alive && u !== self && u.pos.x === step.x && u.pos.y === step.y
    );
    if (occupied) break;
    acc += stepCost;
    dest = step;
  }
  return { destination: dest, target: null };
}
