import { Coord, inBounds, manhattan } from "./grid";

// Cost function: cells with cost === Infinity are impassable.
export type CostFn = (c: Coord) => number;

interface Node {
  coord: Coord;
  g: number;
  f: number;
  parent: Node | null;
}

const NEIGHBORS: Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function key(c: Coord): string {
  return `${c.x},${c.y}`;
}

// A* on a 4-connected grid. Returns the path including start and goal,
// or null if no path exists. costAt(goal) is paid to enter the goal.
export function findPath(
  start: Coord,
  goal: Coord,
  cols: number,
  rows: number,
  costAt: CostFn
): Coord[] | null {
  if (!inBounds(start, cols, rows) || !inBounds(goal, cols, rows)) return null;

  const open = new Map<string, Node>();
  const closed = new Set<string>();
  const startNode: Node = { coord: start, g: 0, f: manhattan(start, goal), parent: null };
  open.set(key(start), startNode);

  while (open.size > 0) {
    let current: Node | null = null;
    for (const n of open.values()) {
      if (!current || n.f < current.f) current = n;
    }
    if (!current) return null;

    if (current.coord.x === goal.x && current.coord.y === goal.y) {
      const path: Coord[] = [];
      let n: Node | null = current;
      while (n) {
        path.unshift(n.coord);
        n = n.parent;
      }
      return path;
    }

    open.delete(key(current.coord));
    closed.add(key(current.coord));

    for (const d of NEIGHBORS) {
      const next: Coord = { x: current.coord.x + d.x, y: current.coord.y + d.y };
      if (!inBounds(next, cols, rows)) continue;
      const k = key(next);
      if (closed.has(k)) continue;
      const stepCost = costAt(next);
      if (!Number.isFinite(stepCost)) continue;
      const g = current.g + stepCost;
      const existing = open.get(k);
      if (!existing || g < existing.g) {
        open.set(k, { coord: next, g, f: g + manhattan(next, goal), parent: current });
      }
    }
  }
  return null;
}

// Tiles reachable from origin within budget. Returns map of "x,y" -> total cost.
export function reachable(
  origin: Coord,
  budget: number,
  cols: number,
  rows: number,
  costAt: CostFn
): Map<string, number> {
  const result = new Map<string, number>();
  result.set(key(origin), 0);
  const frontier: Array<{ c: Coord; cost: number }> = [{ c: origin, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    for (const d of NEIGHBORS) {
      const next: Coord = { x: cur.c.x + d.x, y: cur.c.y + d.y };
      if (!inBounds(next, cols, rows)) continue;
      const stepCost = costAt(next);
      if (!Number.isFinite(stepCost)) continue;
      const total = cur.cost + stepCost;
      if (total > budget) continue;
      const k = key(next);
      const prev = result.get(k);
      if (prev === undefined || total < prev) {
        result.set(k, total);
        frontier.push({ c: next, cost: total });
      }
    }
  }
  return result;
}
