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

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  side: z.enum(["player", "enemy"]),
  class: z.string(),
  level: z.number().int().positive(),
  stats: StatsSchema,
  growth: GrowthSchema,
  starting_equipment: z.array(z.string()).default([]),
});
export type Character = z.infer<typeof CharacterSchema>;

const LearnEntrySchema = z.object({
  spell: z.string(),
  level: z.number().int().positive(),
});

export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  promotes_to: z.string().nullable(),
  movement: z.number().int().positive(),
  weapon_types: z.array(z.string()),
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
    kind: z.literal("cure_status"),
    status: z.string(),
    target: z.enum(["self", "ally"]),
  }),
  z.object({
    kind: z.literal("warp_to_town"),
    target: z.literal("self"),
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
    atk: z.number().int().optional(),
    def: z.number().int().optional(),
    agi: z.number().int().optional(),
  })
  .partial();

export const EquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.enum(["weapon", "armor", "accessory"]),
  weapon_type: z.string().optional(),
  price: z.number().int().nonnegative(),
  range: RangeSchema.optional(),
  stats: EquipmentStatsSchema.default({}),
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

export interface GameData {
  characters: Character[];
  classes: CharacterClass[];
  items: Item[];
  equipment: Equipment[];
  terrain: Terrain[];
  spells: Spell[];
  maps: Record<string, BattleMap>;
}
