import Phaser from "phaser";
import { GameData } from "../data/schema";
import { TILE_SIZE, Coord } from "../battle/grid";
import {
  BattleState,
  UnitInstance,
  buildBattleState,
  makeMoveCostFn,
  unitAt,
} from "../battle/state";
import { findPath, reachable } from "../battle/pathfinding";

const SIDE_COLOR: Record<"player" | "enemy", number> = {
  player: 0x4a90e2,
  enemy: 0xd05050,
};

const REACH_FILL = 0x4a90e2;
const REACH_ALPHA = 0.25;

export class BattleScene extends Phaser.Scene {
  private gameData!: GameData;
  private state!: BattleState;

  private terrainLayer!: Phaser.GameObjects.Graphics;
  private highlightLayer!: Phaser.GameObjects.Graphics;
  private unitLayer!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;

  private selectedUnit: UnitInstance | null = null;
  private reachableTiles: Map<string, number> = new Map();

  constructor() {
    super("Battle");
  }

  create() {
    this.gameData = this.registry.get("gameData") as GameData;
    this.state = buildBattleState("skirmish", this.gameData);

    // Resize the canvas to match the map.
    this.scale.resize(this.state.cols * TILE_SIZE, this.state.rows * TILE_SIZE);

    this.terrainLayer = this.add.graphics();
    this.highlightLayer = this.add.graphics();
    this.unitLayer = this.add.container(0, 0);

    this.drawTerrain();
    this.drawUnits();

    this.hud = this.add.text(4, 4, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#eaeaea",
      backgroundColor: "#000a",
      padding: { x: 6, y: 4 },
    });
    this.updateHud("Click a unit to select. Click a highlighted tile to move.");

    this.input.on("pointerdown", this.handleClick, this);
  }

  // -- rendering --

  private drawTerrain() {
    const g = this.terrainLayer;
    g.clear();
    for (let y = 0; y < this.state.rows; y++) {
      for (let x = 0; x < this.state.cols; x++) {
        const t = this.state.tiles[y][x];
        const color = Phaser.Display.Color.HexStringToColor(t.color).color;
        g.fillStyle(color, 1);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    // Grid lines on top.
    g.lineStyle(1, 0x000000, 0.25);
    for (let x = 0; x <= this.state.cols; x++) {
      g.moveTo(x * TILE_SIZE, 0);
      g.lineTo(x * TILE_SIZE, this.state.rows * TILE_SIZE);
    }
    for (let y = 0; y <= this.state.rows; y++) {
      g.moveTo(0, y * TILE_SIZE);
      g.lineTo(this.state.cols * TILE_SIZE, y * TILE_SIZE);
    }
    g.strokePath();
  }

  private drawUnits() {
    this.unitLayer.removeAll(true);
    for (const u of this.state.units) {
      this.unitLayer.add(this.makeUnitView(u));
    }
  }

  private makeUnitView(u: UnitInstance): Phaser.GameObjects.Container {
    const container = this.add.container(u.pos.x * TILE_SIZE, u.pos.y * TILE_SIZE);
    const pad = 3;
    const body = this.add.rectangle(
      pad,
      pad,
      TILE_SIZE - pad * 2,
      TILE_SIZE - pad * 2,
      SIDE_COLOR[u.template.side]
    );
    body.setOrigin(0, 0);
    body.setStrokeStyle(1, 0xffffff, 0.6);
    const label = this.add.text(TILE_SIZE / 2, TILE_SIZE / 2, u.template.name[0], {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#ffffff",
    });
    label.setOrigin(0.5, 0.5);
    container.add([body, label]);
    container.setData("unit", u);
    return container;
  }

  private redrawUnits() {
    for (const child of this.unitLayer.list as Phaser.GameObjects.Container[]) {
      const u = child.getData("unit") as UnitInstance;
      child.setPosition(u.pos.x * TILE_SIZE, u.pos.y * TILE_SIZE);
    }
  }

  private drawReachableHighlight() {
    const g = this.highlightLayer;
    g.clear();
    if (!this.selectedUnit) return;
    g.fillStyle(REACH_FILL, REACH_ALPHA);
    for (const key of this.reachableTiles.keys()) {
      const [xs, ys] = key.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (x === this.selectedUnit.pos.x && y === this.selectedUnit.pos.y) continue;
      g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // -- input --

  private handleClick(pointer: Phaser.Input.Pointer) {
    const tile: Coord = {
      x: Math.floor(pointer.worldX / TILE_SIZE),
      y: Math.floor(pointer.worldY / TILE_SIZE),
    };
    if (tile.x < 0 || tile.y < 0 || tile.x >= this.state.cols || tile.y >= this.state.rows) {
      return;
    }
    const clicked = unitAt(this.state, tile);

    if (this.selectedUnit) {
      // Try to move selected unit to a reachable empty tile.
      const key = `${tile.x},${tile.y}`;
      if (this.reachableTiles.has(key) && !clicked) {
        this.moveSelectedTo(tile);
        return;
      }
      // Click anywhere else deselects (or selects a different unit).
      this.deselect();
    }

    if (clicked) this.select(clicked);
  }

  private select(u: UnitInstance) {
    if (u.template.side !== "player") {
      this.updateHud(`${u.template.name} (enemy ${u.template.class}) - HP ${u.hp}`);
      return;
    }
    this.selectedUnit = u;
    const cost = makeMoveCostFn(this.state, u);
    this.reachableTiles = reachable(u.pos, u.template.stats.mov, this.state.cols, this.state.rows, cost);
    // Tiles occupied by other units cannot be stopped on.
    for (const other of this.state.units) {
      if (other === u) continue;
      this.reachableTiles.delete(`${other.pos.x},${other.pos.y}`);
    }
    this.drawReachableHighlight();
    this.updateHud(
      `${u.template.name} (${u.template.class}) - HP ${u.hp}/${u.template.stats.hp}, MOV ${u.template.stats.mov}. Click a blue tile to move.`
    );
  }

  private deselect() {
    this.selectedUnit = null;
    this.reachableTiles.clear();
    this.drawReachableHighlight();
    this.updateHud("Click a unit to select.");
  }

  private moveSelectedTo(dest: Coord) {
    const u = this.selectedUnit!;
    const cost = makeMoveCostFn(this.state, u);
    const path = findPath(u.pos, dest, this.state.cols, this.state.rows, cost);
    if (!path) {
      this.deselect();
      return;
    }
    u.pos = dest;
    u.hasMoved = true;
    this.redrawUnits();
    this.deselect();
  }

  private updateHud(text: string) {
    this.hud.setText(text);
  }
}
