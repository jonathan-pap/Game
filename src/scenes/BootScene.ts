import Phaser from "phaser";
import { loadAllGameData } from "../data/loader";
import { GameData } from "../data/schema";
import { portraitSvgFor, portraitTextureKey, preloadPortraitTexture } from "../ui/portraits";

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

      status.setText(`Generating portraits... (0 / ${data.characters.length})`);
      let done = 0;
      // Preload all portrait textures so battle tiles can use image sprites
      // synchronously. Done in parallel; SVGs are small so this is quick.
      await Promise.all(
        data.characters.map(async (c) => {
          const svg = portraitSvgFor(c);
          await preloadPortraitTexture(this, portraitTextureKey(c.id), svg);
          done += 1;
          if (done % 8 === 0 || done === data.characters.length) {
            status.setText(`Generating portraits... (${done} / ${data.characters.length})`);
          }
        })
      );

      this.scene.start("Battle");
    } catch (err) {
      console.error(err);
      status.setText(`Failed to load data: ${(err as Error).message}`);
      status.setColor("#f66");
    }
  }
}
