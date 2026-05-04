import Phaser from "phaser";
import { GameData } from "../data/schema";

const TILE = 32;

export class BattleScene extends Phaser.Scene {
  private gameData!: GameData;

  constructor() {
    super("Battle");
  }

  create() {
    this.gameData = this.registry.get("gameData") as GameData;

    this.drawPlaceholderGrid();
    this.drawDataSummary();
  }

  private drawPlaceholderGrid() {
    const cols = Math.floor(this.scale.width / TILE);
    const rows = Math.floor(this.scale.height / TILE);
    const g = this.add.graphics();
    g.lineStyle(1, 0x333333, 1);
    for (let x = 0; x <= cols; x++) {
      g.moveTo(x * TILE, 0);
      g.lineTo(x * TILE, rows * TILE);
    }
    for (let y = 0; y <= rows; y++) {
      g.moveTo(0, y * TILE);
      g.lineTo(cols * TILE, y * TILE);
    }
    g.strokePath();
  }

  private drawDataSummary() {
    const lines = [
      "Shining Clone - scaffold",
      `characters: ${this.gameData.characters.length}`,
      `classes:    ${this.gameData.classes.length}`,
      `items:      ${this.gameData.items.length}`,
      `equipment:  ${this.gameData.equipment.length}`,
      `terrain:    ${this.gameData.terrain.length}`,
      `spells:     ${this.gameData.spells.length}`,
    ];
    this.add.text(8, 8, lines, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#cfcfcf",
      backgroundColor: "#000a",
      padding: { x: 6, y: 4 },
    });
  }
}
