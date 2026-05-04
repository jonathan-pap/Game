// Runtime battle state. Built from a BattleMap + GameData at battle start.
// Holds the current grid (terrain refs) and live unit instances.

import { BattleMap, Character, GameData, Terrain } from "../data/schema";
import { Coord } from "./grid";

export interface UnitInstance {
  instanceId: string;
  template: Character;
  pos: Coord;
  hp: number;
  mp: number;
  hasMoved: boolean;
  hasActed: boolean;
}

export interface BattleState {
  map: BattleMap;
  cols: number;
  rows: number;
  // Indexed [y][x] for clean row-major iteration.
  tiles: Terrain[][];
  units: UnitInstance[];
}

export function buildBattleState(mapId: string, data: GameData): BattleState {
  const map = data.maps[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);

  const terrainByGlyph = new Map<string, Terrain>();
  for (const t of data.terrain) terrainByGlyph.set(t.glyph, t);

  const tiles: Terrain[][] = [];
  for (let y = 0; y < map.size.rows; y++) {
    const row: Terrain[] = [];
    const rowText = map.tiles[y];
    for (let x = 0; x < map.size.cols; x++) {
      const glyph = rowText[x];
      const terrain = terrainByGlyph.get(glyph);
      if (!terrain) throw new Error(`Unknown terrain glyph '${glyph}' at (${x},${y})`);
      row.push(terrain);
    }
    tiles.push(row);
  }

  const charByTemplate = new Map<string, Character>();
  for (const c of data.characters) charByTemplate.set(c.id, c);

  const counts = new Map<string, number>();
  const units: UnitInstance[] = map.units.map((p) => {
    const tmpl = charByTemplate.get(p.template);
    if (!tmpl) throw new Error(`Unknown character template '${p.template}' in map ${map.id}`);
    const n = (counts.get(p.template) ?? 0) + 1;
    counts.set(p.template, n);
    return {
      instanceId: `${p.template}_${n}`,
      template: tmpl,
      pos: { x: p.at[0], y: p.at[1] },
      hp: tmpl.stats.hp,
      mp: tmpl.stats.mp,
      hasMoved: false,
      hasActed: false,
    };
  });

  return { map, cols: map.size.cols, rows: map.size.rows, tiles, units };
}

export function unitAt(state: BattleState, c: Coord): UnitInstance | undefined {
  return state.units.find((u) => u.pos.x === c.x && u.pos.y === c.y);
}

// Cost function for pathfinding/reachable. Treats other units as blockers
// (player units block enemy movement and vice-versa).
export function makeMoveCostFn(state: BattleState, mover: UnitInstance) {
  return (c: Coord): number => {
    const t = state.tiles[c.y]?.[c.x];
    if (!t || t.blocks) return Infinity;
    const occupant = unitAt(state, c);
    if (occupant && occupant !== mover && occupant.template.side !== mover.template.side) {
      return Infinity;
    }
    if (occupant && occupant !== mover && occupant.template.side === mover.template.side) {
      // Allies are passable but cannot stop on their tile (handled by caller).
      return t.move_cost;
    }
    return t.move_cost;
  };
}
