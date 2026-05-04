import yaml from "js-yaml";
import { z } from "zod";
import {
  BattleMap,
  BattleMapSchema,
  CharacterSchema,
  ClassSchema,
  EquipmentSchema,
  GameData,
  ItemSchema,
  SpellSchema,
  TerrainSchema,
} from "./schema";

// Vite ?raw imports inline the file as a string at build time.
import charactersYaml from "../../data/characters.yaml?raw";
import classesYaml from "../../data/classes.yaml?raw";
import itemsYaml from "../../data/items.yaml?raw";
import equipmentYaml from "../../data/equipment.yaml?raw";
import terrainYaml from "../../data/terrain.yaml?raw";
import spellsYaml from "../../data/spells.yaml?raw";

// Eager-load every map under data/maps/ as raw text.
const mapModules = import.meta.glob("../../data/maps/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseList<S extends z.ZodTypeAny>(
  schema: S,
  text: string,
  source: string
): z.infer<S>[] {
  const raw = yaml.load(text);
  const arrSchema = z.array(schema);
  const result = arrSchema.safeParse(raw);
  if (!result.success) {
    console.error(`Schema errors in ${source}:`, result.error.format());
    throw new Error(`Invalid data in ${source} - see console`);
  }
  return result.data;
}

function parseObject<S extends z.ZodTypeAny>(
  schema: S,
  text: string,
  source: string
): z.infer<S> {
  const raw = yaml.load(text);
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.error(`Schema errors in ${source}:`, result.error.format());
    throw new Error(`Invalid data in ${source} - see console`);
  }
  return result.data;
}

function parseMaps(): Record<string, BattleMap> {
  const out: Record<string, BattleMap> = {};
  for (const [path, text] of Object.entries(mapModules)) {
    const map = parseObject(BattleMapSchema, text, path);
    if (map.tiles.length !== map.size.rows) {
      throw new Error(
        `${path}: tiles has ${map.tiles.length} rows but size.rows is ${map.size.rows}`
      );
    }
    for (let r = 0; r < map.tiles.length; r++) {
      if (map.tiles[r].length !== map.size.cols) {
        throw new Error(
          `${path} row ${r}: length ${map.tiles[r].length} != size.cols ${map.size.cols}`
        );
      }
    }
    if (out[map.id]) throw new Error(`Duplicate map id: ${map.id}`);
    out[map.id] = map;
  }
  return out;
}

export async function loadAllGameData(): Promise<GameData> {
  return {
    characters: parseList(CharacterSchema, charactersYaml, "characters.yaml"),
    classes: parseList(ClassSchema, classesYaml, "classes.yaml"),
    items: parseList(ItemSchema, itemsYaml, "items.yaml"),
    equipment: parseList(EquipmentSchema, equipmentYaml, "equipment.yaml"),
    terrain: parseList(TerrainSchema, terrainYaml, "terrain.yaml"),
    spells: parseList(SpellSchema, spellsYaml, "spells.yaml"),
    maps: parseMaps(),
  };
}
