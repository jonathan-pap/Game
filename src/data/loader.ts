import yaml from "js-yaml";
import { z } from "zod";
import {
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

export async function loadAllGameData(): Promise<GameData> {
  return {
    characters: parseList(CharacterSchema, charactersYaml, "characters.yaml"),
    classes: parseList(ClassSchema, classesYaml, "classes.yaml"),
    items: parseList(ItemSchema, itemsYaml, "items.yaml"),
    equipment: parseList(EquipmentSchema, equipmentYaml, "equipment.yaml"),
    terrain: parseList(TerrainSchema, terrainYaml, "terrain.yaml"),
    spells: parseList(SpellSchema, spellsYaml, "spells.yaml"),
  };
}
