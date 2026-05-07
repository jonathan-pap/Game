import { z } from "zod";

const StatsSchema = z.object({
  hp: z.number().int().nonnegative(),
  mp: z.number().int().nonnegative(),
  atk: z.number().int().nonnegative(),
  def: z.number().int().nonnegative(),
  agi: z.number().int().nonnegative(),
  mov: z.number().int().nonnegative(),
});

const GrowthSchema = z.object({
  hp: z.number().min(0).max(100),
  mp: z.number().min(0).max(100),
  atk: z.number().min(0).max(100),
  def: z.number().min(0).max(100),
  agi: z.number().min(0).max(100),
});

const LearnEntrySchema = z.object({
  spell: z.string(),
  level: z.number().int().positive(),
  // Which tier (entry in spell.levels) the unit knows this spell at.
  // 1-indexed; defaults to 1 (the first/weakest tier).
  tier: z.number().int().positive().default(1),
});

// SF1's spell-learning is per-character (Lowe and Khris are both Healers but
// learn different spell rotations). Each character can have its own learn[].
// A class.learn[] is still supported as a default/fallback for genericness.
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  side: z.enum(["player", "enemy"]),
  class: z.string(),
  level: z.number().int().positive(),
  stats: StatsSchema,
  growth: GrowthSchema,
  starting_equipment: z.array(z.string()).default([]),
  learn: z.array(LearnEntrySchema).default([]),
});
export type Character = z.infer<typeof CharacterSchema>;

export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  promotes_to: z.string().nullable(),
  movement: z.number().int().positive(),
  weapon_types: z.array(z.string()),
  // Default character level required to promote (SF1 = 10).
  promotion_level: z.number().int().positive().default(10),
  // Class-default spell-learn list. Per-character entries override these.
  learn: z.array(LearnEntrySchema).default([]),
});
export type CharacterClass = z.infer<typeof ClassSchema>;

const ItemEffectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heal_hp"),
    amount: z.number().int().positive(),
    target: z.enum(["self", "ally"]),
  }),
  z.object({
    kind: z.literal("heal_party_hp"),
    amount: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("cure_status"),
    status: z.string(),
    target: z.enum(["self", "ally"]),
  }),
  z.object({
    kind: z.literal("warp_to_town"),
    target: z.literal("self"),
  }),
  // Permanent stat-up consumable (Bread of Life, Power Potion, etc.)
  z.object({
    kind: z.literal("permanent_stat_up"),
    stat: z.enum(["hp", "mp", "atk", "def", "agi", "mov"]),
    amount: z.number().int().positive(),
    target: z.enum(["self", "ally"]),
  }),
  // Plot-significant key items consumed in events.
  z.object({
    kind: z.literal("plot_event"),
    description: z.string(),
  }),
]);

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["consumable", "key"]),
  price: z.number().int().nonnegative(),
  effect: ItemEffectSchema,
});
export type Item = z.infer<typeof ItemSchema>;

const RangeSchema = z.object({
  min: z.number().int().positive(),
  max: z.number().int().positive(),
});

const EquipmentStatsSchema = z
  .object({
    hp: z.number().int().optional(),
    mp: z.number().int().optional(),
    atk: z.number().int().optional(),
    def: z.number().int().optional(),
    agi: z.number().int().optional(),
    mov: z.number().int().optional(),
  })
  .partial();

export const EquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.enum(["weapon", "armor", "accessory"]),
  weapon_type: z.string().optional(),
  price: z.number().int().nonnegative().default(0),
  range: RangeSchema.optional(),
  stats: EquipmentStatsSchema.default({}),
  // Class ids that may equip this. Empty = unrestricted.
  classes_allowed: z.array(z.string()).default([]),
  // Cursed gear cannot be unequipped without a Cancel/de-curse NPC.
  cursed: z.boolean().default(false),
  // Some items grant a built-in spell cast (Power Ring -> Boost, etc.).
  cast_spell: z.string().optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

export const TerrainSchema = z.object({
  id: z.string(),
  name: z.string(),
  glyph: z.string().min(1).max(2),
  color: z.string(),
  move_cost: z.number().int().positive(),
  defense_bonus: z.number().int().nonnegative(),
  evade_bonus: z.number().int().nonnegative(),
  blocks: z.boolean(),
});
export type Terrain = z.infer<typeof TerrainSchema>;

const SpellLevelSchema = z.object({
  mp: z.number().int().nonnegative(),
  range: z.number().int().nonnegative(),
  area: z.string(), // single | cross_1 | cross_2 | line_3 | ... validated at runtime
  damage: z.number().int().nonnegative().optional(),
  heal: z.number().int().nonnegative().optional(),
  cure: z.string().optional(),
});

export const SpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  school: z.string(),
  target: z.enum(["enemy", "ally", "self", "tile"]),
  levels: z.array(SpellLevelSchema).min(1),
});
export type Spell = z.infer<typeof SpellSchema>;

const CoordTupleSchema = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);

const MapUnitPlacementSchema = z.object({
  template: z.string(),
  at: CoordTupleSchema,
});

export const BattleMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.object({
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
  }),
  tiles: z.array(z.string()),
  units: z.array(MapUnitPlacementSchema),
  victory: z.enum(["rout_enemy", "defeat_boss", "survive_n_turns", "reach_tile"]),
});
export type BattleMap = z.infer<typeof BattleMapSchema>;

// Enemies live in a separate YAML file but use the same shape as Character.
// They're merged into the unified `characters` lookup at load time so map
// unit-placement templates can reference players or enemies by id uniformly.
export const EnemySchema = CharacterSchema.extend({
  side: z.literal("enemy").default("enemy"),
  // Which SF1 chapter this enemy first appears in (for documentation /
  // future encounter generation).
  chapter: z.number().int().positive().optional(),
});
export type Enemy = z.infer<typeof EnemySchema>;

export interface GameData {
  characters: Character[]; // includes enemies after loader merges
  classes: CharacterClass[];
  items: Item[];
  equipment: Equipment[];
  terrain: Terrain[];
  spells: Spell[];
  maps: Record<string, BattleMap>;
}
