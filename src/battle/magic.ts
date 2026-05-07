// Spell targeting + resolution. Mirrors combat.ts but for magic.

import { BattleState, KnownSpell, UnitInstance, spellLevelData, unitAt } from "./state";
import { Coord, manhattan } from "./grid";

// Possible legal target tiles for a spell, given the caster's position.
export function spellTargetTiles(
  state: BattleState,
  caster: UnitInstance,
  known: KnownSpell
): Coord[] {
  const lvl = spellLevelData(known);
  const out: Coord[] = [];
  const target = known.spell.target;
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const c = { x, y };
      const d = manhattan(caster.pos, c);
      if (d > lvl.range) continue;
      if (target === "self" && d !== 0) continue;
      if (target === "enemy") {
        const u = unitAt(state, c);
        if (!u || u.template.side === caster.template.side) continue;
      } else if (target === "ally") {
        const u = unitAt(state, c);
        if (!u || u.template.side !== caster.template.side) continue;
      }
      // tile: any tile within range is fair
      out.push(c);
    }
  }
  return out;
}

// Tiles affected by an AoE shape centered on `target`.
function areaTiles(target: Coord, area: string): Coord[] {
  switch (area) {
    case "single":
      return [target];
    case "cross_1":
      return [
        { x: target.x, y: target.y },
        { x: target.x + 1, y: target.y },
        { x: target.x - 1, y: target.y },
        { x: target.x, y: target.y + 1 },
        { x: target.x, y: target.y - 1 },
      ];
    case "cross_2": {
      const out: Coord[] = [];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          out.push({ x: target.x + dx, y: target.y + dy });
        }
      }
      return out;
    }
    case "line_3":
      // Crude: target tile + 1 along each cardinal so the spell still hits.
      // True line-from-caster aiming will need direction info; defer.
      return [
        target,
        { x: target.x + 1, y: target.y },
        { x: target.x + 2, y: target.y },
      ];
    default:
      return [target];
  }
}

export interface SpellHit {
  unit: UnitInstance;
  damage?: number;
  heal?: number;
  cured?: string;
  fizzled?: boolean;
}

export interface SpellResult {
  caster: UnitInstance;
  spell: KnownSpell;
  target: Coord;
  hits: SpellHit[];
}

export function resolveSpell(
  state: BattleState,
  caster: UnitInstance,
  known: KnownSpell,
  target: Coord
): SpellResult {
  const lvl = spellLevelData(known);
  caster.mp = Math.max(0, caster.mp - lvl.mp);

  const tiles = areaTiles(target, lvl.area);
  const hits: SpellHit[] = [];
  for (const t of tiles) {
    if (t.x < 0 || t.y < 0 || t.x >= state.cols || t.y >= state.rows) continue;
    const u = unitAt(state, t);
    if (!u) continue;
    // Filter by spell target affinity.
    if (known.spell.target === "enemy" && u.template.side === caster.template.side) continue;
    if (known.spell.target === "ally" && u.template.side !== caster.template.side) continue;
    if (lvl.damage) {
      const dmg = Math.max(1, Math.round(lvl.damage * (1 + (Math.random() * 0.2 - 0.1))));
      u.hp = Math.max(0, u.hp - dmg);
      if (u.hp <= 0) u.alive = false;
      hits.push({ unit: u, damage: dmg });
    } else if (lvl.heal) {
      const healAmt = lvl.heal >= 9999 ? u.template.stats.hp : lvl.heal;
      const before = u.hp;
      u.hp = Math.min(u.template.stats.hp, u.hp + healAmt);
      hits.push({ unit: u, heal: u.hp - before });
    } else if (lvl.cure) {
      // Status not yet implemented; record intent.
      hits.push({ unit: u, cured: lvl.cure });
    } else {
      hits.push({ unit: u, fizzled: true });
    }
  }
  return { caster, spell: known, target, hits };
}

export function canCast(caster: UnitInstance, known: KnownSpell): boolean {
  const lvl = spellLevelData(known);
  return caster.mp >= lvl.mp;
}
