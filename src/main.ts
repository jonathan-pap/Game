import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { BattleScene } from "./scenes/BattleScene";

const TILE = 32;
const COLS = 16;
const ROWS = 12;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1a1a1a",
  width: TILE * COLS,
  height: TILE * ROWS,
  pixelArt: true,
  scene: [BootScene, BattleScene],
});
