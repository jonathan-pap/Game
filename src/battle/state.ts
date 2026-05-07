// Runtime battle state. Built from a BattleMap + GameData at battle start.
// Holds the current grid (terrain refs) and live unit instances.

import { BattleMap, Character, Equipment, GameData, Spell, Terrain } from "../data/schema";
import { Coord } from "./grid";

// One spell a unit knows + which tier. The tier indexes into spell.levels.
export interface KnownSpell {
  spell: Spell;
  tier: number; // 1-indexed
}

export interface UnitInstance {
  instanceId: string;
  template: Character;
  pos: Coord;
  hp: number;
  mp: number;
  weapon: Equipment | null;
  knownSpells: KnownSpell[];
  alive: boolean;
  // Per-round flags: reset by TurnManager.startRound().
  hasMoved: boolean;
  hasActed: boolean;
  acted: boolean; // turn finished (cannot act again this round)
}

// Look up the level data (mp, range, damage/heal, etc.) for a known spell.
// Clamps to the highest available tier if the unit has somehow learned a tier
// beyond what's defined in spells.yaml.
export function spellLevelData(known: KnownSpell) {
  const idx = Math.min(Math.max(0, known.tier - 1), known.spell.levels.length - 1);
  return known.spell.levels[idx];
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

  const equipById = new Map<string, Equipment>();
  for (const e of data.equipment) equipById.set(e.id, e);

  const classById = new Map(data.classes.map((c) => [c.id, c]));
  const spellById = new Map(data.spells.map((s) => [s.id, s]));

  const counts = new Map<string, number>();
  const units: UnitInstance[] = map.units.map((p) => {
    const tmpl = charByTemplate.get(p.template);
    if (!tmpl) throw new Error(`Unknown character template '${p.template}' in map ${map.id}`);
    const n = (counts.get(p.template) ?? 0) + 1;
    counts.set(p.template, n);
    let weapon: Equipment | null = null;
    for (const eqId of tmpl.starting_equipment) {
      const eq = equipById.get(eqId);
      if (eq && eq.slot === "weapon") {
        weapon = eq;
        break;
      }
    }
    // Resolve known spells. SF1's spell-learning is per-character (Lowe and
    // Khris are both Healers but learn different rotations), so character.learn
    // takes precedence. If the character has no learn entries, fall back to
    // class.learn as a default. For any given spell id, the highest qualifying
    // tier wins.
    const klass = classById.get(tmpl.class);
    const learnEntries = tmpl.learn.length > 0 ? tmpl.learn : klass?.learn ?? [];
    const learnedById = new Map<string, KnownSpell>();
    for (const learn of learnEntries) {
      if (tmpl.level < learn.level) continue;
      const spell = spellById.get(learn.spell);
      if (!spell) continue;
      const prev = learnedById.get(spell.id);
      if (!prev || learn.tier > prev.tier) {
        learnedById.set(spell.id, { spell, tier: learn.tier });
      }
    }
    const knownSpells = Array.from(learnedById.values());
    return {
      instanceId: `${p.template}_${n}`,
      template: tmpl,
      pos: { x: p.at[0], y: p.at[1] },
      hp: tmpl.stats.hp,
      mp: tmpl.stats.mp,
      weapon,
      knownSpells,
      alive: true,
      hasMoved: false,
      hasActed: false,
      acted: false,
    };
  });

  return { map, cols: map.size.cols, rows: map.size.rows, tiles, units };
}

export function unitAt(state: BattleState, c: Coord): UnitInstance | undefined {
  return state.units.find((u) => u.alive && u.pos.x === c.x && u.pos.y === c.y);
}

export function weaponRange(u: UnitInstance): { min: number; max: number } {
  if (u.weapon?.range) return u.weapon.range;
  return { min: 1, max: 1 };
}

// Effective combat stats including weapon bonuses + terrain defense.
export function effectiveStats(state: BattleState, u: UnitInstance) {
  const base = u.template.stats;
  const wAtk = u.weapon?.stats?.atk ?? 0;
  const wDef = u.weapon?.stats?.def ?? 0;
  const tile = state.tiles[u.pos.y]?.[u.pos.x];
  const tDef = tile?.defense_bonus ?? 0;
  const tEvade = tile?.evade_bonus ?? 0;
  return {
    atk: base.atk + wAtk,
    def: base.def + wDef + tDef,
    agi: base.agi,
    evade: tEvade,
  };
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
