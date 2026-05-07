import Phaser from "phaser";
import { GameData } from "../data/schema";
import { TILE_SIZE, Coord } from "../battle/grid";
import {
  BattleState,
  UnitInstance,
  buildBattleState,
  makeMoveCostFn,
  unitAt,
  weaponRange,
} from "../battle/state";
import { reachable } from "../battle/pathfinding";
import { TurnManager } from "../battle/TurnManager";
import { resolveAttack, AttackResult } from "../battle/combat";
import { planEnemyTurn } from "../battle/ai";

const SIDE_COLOR: Record<"player" | "enemy", number> = {
  player: 0x4a90e2,
  enemy: 0xd05050,
};
const REACH_FILL = 0x4a90e2;
const ATTACK_FILL = 0xff5555;
const REACH_ALPHA = 0.25;

type Phase = "idle" | "select_move" | "select_attack" | "animating" | "ended";

export class BattleScene extends Phaser.Scene {
  private gameData!: GameData;
  private state!: BattleState;
  private turn!: TurnManager;

  private terrainLayer!: Phaser.GameObjects.Graphics;
  private highlightLayer!: Phaser.GameObjects.Graphics;
  private activeRing!: Phaser.GameObjects.Graphics;
  private unitLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;

  private phase: Phase = "idle";
  private reachableTiles = new Map<string, number>();
  private attackTargets = new Set<string>(); // "x,y" of attackable enemies

  constructor() {
    super("Battle");
  }

  create() {
    this.gameData = this.registry.get("gameData") as GameData;
    this.state = buildBattleState("skirmish", this.gameData);
    this.scale.resize(this.state.cols * TILE_SIZE, this.state.rows * TILE_SIZE);

    this.terrainLayer = this.add.graphics();
    this.highlightLayer = this.add.graphics();
    this.activeRing = this.add.graphics();
    this.unitLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);

    this.drawTerrain();
    this.drawUnits();

    this.hud = this.add.text(4, 4, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#eaeaea",
      backgroundColor: "#000a",
      padding: { x: 6, y: 4 },
    });

    this.input.on("pointerdown", this.handleClick, this);

    this.turn = new TurnManager(this.state);
    this.turn.on((e) => this.onTurnEvent(e.kind, e));
    this.turn.start();
  }

  // --- turn loop ---

  private onTurnEvent(kind: string, e: { unit?: UnitInstance; outcome?: "victory" | "defeat" }) {
    if (kind === "turn_start" && e.unit) {
      this.beginUnitTurn(e.unit);
    } else if (kind === "battle_end") {
      this.phase = "ended";
      this.clearHighlights();
      this.drawActiveRing(null);
      this.dimDoneUnits();
      this.updateHud(
        e.outcome === "victory" ? "VICTORY! All enemies defeated." : "DEFEAT. All heroes fallen."
      );
    }
  }

  private beginUnitTurn(u: UnitInstance) {
    this.dimDoneUnits();
    this.drawActiveRing(u);
    if (u.template.side === "player") {
      this.phase = "select_move";
      this.computeMoveAndAttack(u);
      this.updateHud(
        `${u.template.name} (${u.template.class}) HP ${u.hp}/${u.template.stats.hp} - blue=move, red=attack, click ${u.template.name} again to wait.`
      );
    } else {
      this.phase = "animating";
      this.updateHud(`Enemy turn: ${u.template.name}`);
      this.runEnemyTurn(u);
    }
  }

  private async runEnemyTurn(u: UnitInstance) {
    await this.delay(250);
    const plan = planEnemyTurn(this.state, u);
    if (plan.destination.x !== u.pos.x || plan.destination.y !== u.pos.y) {
      u.pos = { ...plan.destination };
      this.redrawUnits();
      this.drawActiveRing(u);
      await this.delay(200);
    }
    if (plan.target) {
      const result = resolveAttack(this.state, u, plan.target);
      this.showAttackFx(result);
      await this.delay(400);
      if (!plan.target.alive) this.removeUnitView(plan.target);
    }
    await this.delay(150);
    this.turn.endTurn();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  // --- player input ---

  private handleClick(pointer: Phaser.Input.Pointer) {
    if (this.phase !== "select_move") return;
    const tile: Coord = {
      x: Math.floor(pointer.worldX / TILE_SIZE),
      y: Math.floor(pointer.worldY / TILE_SIZE),
    };
    if (!this.inBounds(tile)) return;
    const cur = this.turn.current();
    if (!cur) return;
    const key = `${tile.x},${tile.y}`;

    // Click own tile -> wait/end turn.
    if (tile.x === cur.pos.x && tile.y === cur.pos.y) {
      this.endActiveTurn();
      return;
    }

    // Click an attackable enemy: move to best adjacent tile, then attack.
    if (this.attackTargets.has(key)) {
      const enemy = unitAt(this.state, tile);
      if (enemy) {
        const stand = this.bestAttackStandTile(cur, enemy);
        if (stand) {
          cur.pos = stand;
          this.redrawUnits();
        }
        this.phase = "animating";
        this.clearHighlights();
        const result = resolveAttack(this.state, cur, enemy);
        this.showAttackFx(result);
        this.time.delayedCall(450, () => {
          if (!enemy.alive) this.removeUnitView(enemy);
          this.endActiveTurn();
        });
        return;
      }
    }

    // Click reachable empty tile: move only, then end turn.
    if (this.reachableTiles.has(key) && !unitAt(this.state, tile)) {
      cur.pos = { ...tile };
      this.redrawUnits();
      this.endActiveTurn();
      return;
    }
    // Otherwise ignore (clicking other units, off-grid, etc.).
  }

  private endActiveTurn() {
    this.phase = "animating";
    this.clearHighlights();
    this.drawActiveRing(null);
    this.time.delayedCall(80, () => this.turn.endTurn());
  }

  private inBounds(c: Coord) {
    return c.x >= 0 && c.y >= 0 && c.x < this.state.cols && c.y < this.state.rows;
  }

  // --- attack range computation for the active player ---

  private computeMoveAndAttack(u: UnitInstance) {
    const cost = makeMoveCostFn(this.state, u);
    this.reachableTiles = reachable(u.pos, u.template.stats.mov, this.state.cols, this.state.rows, cost);
    // Other units cannot be stopped on.
    for (const other of this.state.units) {
      if (!other.alive || other === u) continue;
      this.reachableTiles.delete(`${other.pos.x},${other.pos.y}`);
    }
    // Compute attack targets: enemies that can be attacked from any reachable
    // standing tile (or current position).
    this.attackTargets.clear();
    const standTiles: Coord[] = [{ ...u.pos }];
    for (const k of this.reachableTiles.keys()) {
      const [xs, ys] = k.split(",");
      standTiles.push({ x: Number(xs), y: Number(ys) });
    }
    const { min, max } = weaponRange(u);
    for (const enemy of this.state.units) {
      if (!enemy.alive || enemy.template.side === u.template.side) continue;
      for (const s of standTiles) {
        const d = Math.abs(s.x - enemy.pos.x) + Math.abs(s.y - enemy.pos.y);
        if (d >= min && d <= max) {
          this.attackTargets.add(`${enemy.pos.x},${enemy.pos.y}`);
          break;
        }
      }
    }
    this.drawHighlights();
  }

  // For an enemy we want to attack: find the move-tile from which we can
  // attack that has the lowest movement cost (or stay on current pos if
  // already in range).
  private bestAttackStandTile(u: UnitInstance, enemy: UnitInstance): Coord | null {
    const { min, max } = weaponRange(u);
    const dHere = Math.abs(u.pos.x - enemy.pos.x) + Math.abs(u.pos.y - enemy.pos.y);
    if (dHere >= min && dHere <= max) return null; // no move needed
    let best: Coord | null = null;
    let bestCost = Infinity;
    for (const [k, c] of this.reachableTiles) {
      const [xs, ys] = k.split(",");
      const tile: Coord = { x: Number(xs), y: Number(ys) };
      if (unitAt(this.state, tile)) continue;
      const d = Math.abs(tile.x - enemy.pos.x) + Math.abs(tile.y - enemy.pos.y);
      if (d < min || d > max) continue;
      if (c < bestCost) {
        bestCost = c;
        best = tile;
      }
    }
    return best;
  }

  // --- rendering ---

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
      if (!u.alive) continue;
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
    const label = this.add.text(TILE_SIZE / 2, TILE_SIZE / 2 - 4, u.template.name[0], {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
    });
    label.setOrigin(0.5, 0.5);
    // tiny HP bar at bottom of tile
    const barBg = this.add.rectangle(pad, TILE_SIZE - pad - 3, TILE_SIZE - pad * 2, 3, 0x000000, 0.8);
    barBg.setOrigin(0, 0);
    const bar = this.add.rectangle(pad, TILE_SIZE - pad - 3, TILE_SIZE - pad * 2, 3, 0x55ff55);
    bar.setOrigin(0, 0);
    bar.setData("hpBar", true);
    container.add([body, label, barBg, bar]);
    container.setData("unit", u);
    container.setData("body", body);
    container.setData("hpBar", bar);
    container.setData("baseAlpha", 1);
    this.refreshUnitView(u, container);
    return container;
  }

  private redrawUnits() {
    for (const child of this.unitLayer.list as Phaser.GameObjects.Container[]) {
      const u = child.getData("unit") as UnitInstance;
      child.setPosition(u.pos.x * TILE_SIZE, u.pos.y * TILE_SIZE);
      this.refreshUnitView(u, child);
    }
  }

  private refreshUnitView(u: UnitInstance, container: Phaser.GameObjects.Container) {
    const bar = container.getData("hpBar") as Phaser.GameObjects.Rectangle;
    const ratio = Math.max(0, u.hp / u.template.stats.hp);
    const pad = 3;
    bar.width = (TILE_SIZE - pad * 2) * ratio;
    bar.fillColor = ratio > 0.5 ? 0x55ff55 : ratio > 0.25 ? 0xffaa33 : 0xff3333;
  }

  private removeUnitView(u: UnitInstance) {
    const child = (this.unitLayer.list as Phaser.GameObjects.Container[]).find(
      (c) => c.getData("unit") === u
    );
    if (child) child.destroy();
  }

  private dimDoneUnits() {
    for (const child of this.unitLayer.list as Phaser.GameObjects.Container[]) {
      const u = child.getData("unit") as UnitInstance;
      child.setAlpha(u.acted ? 0.45 : 1);
    }
  }

  private drawActiveRing(u: UnitInstance | null) {
    const g = this.activeRing;
    g.clear();
    if (!u) return;
    g.lineStyle(2, 0xffe14a, 1);
    g.strokeRect(u.pos.x * TILE_SIZE + 1, u.pos.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }

  private drawHighlights() {
    const g = this.highlightLayer;
    g.clear();
    g.fillStyle(REACH_FILL, REACH_ALPHA);
    const cur = this.turn.current();
    for (const k of this.reachableTiles.keys()) {
      const [xs, ys] = k.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (cur && x === cur.pos.x && y === cur.pos.y) continue;
      g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    g.fillStyle(ATTACK_FILL, 0.45);
    for (const k of this.attackTargets) {
      const [xs, ys] = k.split(",");
      g.fillRect(Number(xs) * TILE_SIZE, Number(ys) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  private clearHighlights() {
    this.reachableTiles.clear();
    this.attackTargets.clear();
    this.highlightLayer.clear();
  }

  // --- combat fx ---

  private showAttackFx(result: AttackResult) {
    const x = result.defender.pos.x * TILE_SIZE + TILE_SIZE / 2;
    const y = result.defender.pos.y * TILE_SIZE + 4;
    const text = result.hit ? `-${result.damage}` : "miss";
    const color = result.hit ? "#ffeb6b" : "#bbbbbb";
    const popup = this.add.text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "14px",
      color,
      stroke: "#000000",
      strokeThickness: 3,
    });
    popup.setOrigin(0.5, 0.5);
    this.fxLayer.add(popup);
    this.tweens.add({
      targets: popup,
      y: y - 18,
      alpha: 0,
      duration: 600,
      onComplete: () => popup.destroy(),
    });
    if (result.hit) this.refreshUnitViewById(result.defender);
  }

  private refreshUnitViewById(u: UnitInstance) {
    const child = (this.unitLayer.list as Phaser.GameObjects.Container[]).find(
      (c) => c.getData("unit") === u
    );
    if (child) this.refreshUnitView(u, child);
  }

  private updateHud(text: string) {
    this.hud.setText(text);
  }
}
