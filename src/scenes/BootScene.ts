import Phaser from "phaser";
import { loadAllGameData } from "../data/loader";
import { GameData } from "../data/schema";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  async create() {
    const center = { x: this.scale.width / 2, y: this.scale.height / 2 };
    const status = this.add
      .text(center.x, center.y, "Loading data...", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ddd",
      })
      .setOrigin(0.5);

    try {
      const data: GameData = await loadAllGameData();
      this.registry.set("gameData", data);
      status.setText("Data loaded. Starting battle...");
      this.time.delayedCall(300, () => this.scene.start("Battle"));
    } catch (err) {
      console.error(err);
      status.setText("Failed to load data. See console.");
      status.setColor("#f66");
    }
  }
}
