import Phaser from "phaser";
import { GameData } from "../data/schema";
import { TILE_SIZE, Coord } from "../battle/grid";
import {
  BattleState,
  KnownSpell,
  UnitInstance,
  buildBattleState,
  makeMoveCostFn,
  spellLevelData,
  unitAt,
  weaponRange,
} from "../battle/state";
import { reachable } from "../battle/pathfinding";
import { TurnManager } from "../battle/TurnManager";
import { resolveAttack, AttackResult } from "../battle/combat";
import { planEnemyTurn } from "../battle/ai";
import { canCast, resolveSpell, spellTargetTiles, SpellResult } from "../battle/magic";
import { playCutin } from "../battle/Cutin";
import { renderHero, renderEnemy, clearPanes } from "../ui/StatsPanel";
import { hideAllMenus, showActionMenu, showSpellMenu } from "../ui/Menus";

const SIDE_COLOR: Record<"player" | "enemy", number> = {
  player: 0x4a90e2,
  enemy: 0xd05050,
};
const REACH_FILL = 0x4a90e2;
const ATTACK_FILL = 0xff5555;
const SPELL_DAMAGE_FILL = 0xc060ff;
const SPELL_HEAL_FILL = 0x70d070;
const SPELL_TILE_FILL = 0xffe14a;
const REACH_ALPHA = 0.25;

type Phase =
  | "idle"
  | "select_move"
  | "menu"
  | "select_attack_target"
  | "select_spell_target"
  | "animating"
  | "ended";

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
  private attackTargets = new Set<string>(); // "x,y" of attackable enemies post-move
  private spellTargets = new Set<string>(); // tiles legal for the active spell
  private inspectedHero: UnitInstance | null = null;
  private inspectedEnemy: UnitInstance | null = null;
  private preMovePos: Coord | null = null; // for Cancel
  private activeSpell: KnownSpell | null = null;

  constructor() {
    super("Battle");
  }

  create() {
    this.gameData = this.registry.get("gameData") as GameData;
    this.state = buildBattleState("skirmish", this.gameData);
    this.scale.resize(this.state.cols * TILE_SIZE, this.state.rows * TILE_SIZE);
    clearPanes();
    hideAllMenus();

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
    this.input.keyboard?.on("keydown-ESC", () => this.cancelToMenu());

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
      hideAllMenus();
      this.updateHud(
        e.outcome === "victory" ? "VICTORY! All enemies defeated." : "DEFEAT. All heroes fallen."
      );
    }
  }

  private beginUnitTurn(u: UnitInstance) {
    hideAllMenus();
    this.dimDoneUnits();
    this.drawActiveRing(u);
    this.preMovePos = null;
    this.activeSpell = null;
    if (u.template.side === "player") {
      this.phase = "select_move";
      this.computeMoveAndAttack(u);
      this.updateHud(
        `${u.template.name}'s turn - blue=move, red=enemy attack, click ${u.template.name} to skip move.`
      );
      this.inspectedHero = u;
      renderHero(u, true);
      this.refreshPanes();
    } else {
      this.phase = "animating";
      this.updateHud(`Enemy turn: ${u.template.name}`);
      this.inspectedEnemy = u;
      renderEnemy(u, true);
      this.refreshPanes();
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
      await this.playAttackCutin(result);
      this.showAttackPopup(result);
      this.refreshPanes();
      if (!plan.target.alive) this.removeUnitView(plan.target);
    }
    await this.delay(150);
    this.turn.endTurn();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  // --- player input router ---

  private handleClick(pointer: Phaser.Input.Pointer) {
    const tile: Coord = {
      x: Math.floor(pointer.worldX / TILE_SIZE),
      y: Math.floor(pointer.worldY / TILE_SIZE),
    };
    if (!this.inBounds(tile)) return;

    // Inspection: any click on a unit updates the corresponding pane.
    const inspectee = unitAt(this.state, tile);
    if (inspectee) {
      const isActive = this.turn.current() === inspectee;
      if (inspectee.template.side === "player") {
        this.inspectedHero = inspectee;
        renderHero(inspectee, isActive);
      } else {
        this.inspectedEnemy = inspectee;
        renderEnemy(inspectee, isActive);
      }
    }

    const cur = this.turn.current();
    if (!cur) return;

    if (this.phase === "select_move") this.onMoveClick(tile, cur);
    else if (this.phase === "select_attack_target") this.onAttackTargetClick(tile, cur);
    else if (this.phase === "select_spell_target") this.onSpellTargetClick(tile, cur);
  }

  // --- phase: select_move ---

  private onMoveClick(tile: Coord, cur: UnitInstance) {
    const key = `${tile.x},${tile.y}`;
    // Click own tile: stay in place, open menu.
    if (tile.x === cur.pos.x && tile.y === cur.pos.y) {
      this.preMovePos = { ...cur.pos };
      this.openActionMenu(cur);
      return;
    }
    // Click reachable empty tile: walk there, then open menu.
    if (this.reachableTiles.has(key) && !unitAt(this.state, tile)) {
      this.preMovePos = { ...cur.pos };
      cur.pos = { ...tile };
      this.redrawUnits();
      this.drawActiveRing(cur);
      this.openActionMenu(cur);
      return;
    }
    // Click an enemy in attack-after-move range: shortcut to walk + Attack.
    if (this.attackTargets.has(key)) {
      const enemy = unitAt(this.state, tile);
      if (enemy) {
        const stand = this.bestAttackStandTile(cur, enemy);
        this.preMovePos = { ...cur.pos };
        if (stand) {
          cur.pos = stand;
          this.redrawUnits();
          this.drawActiveRing(cur);
        }
        this.executeAttack(cur, enemy);
        return;
      }
    }
  }

  // --- action menu ---

  private openActionMenu(u: UnitInstance) {
    this.phase = "menu";
    this.clearHighlights();
    const canAttack = this.enemiesInRangeFromHere(u).length > 0;
    const canMagic = u.knownSpells.some((k) => canCast(u, k));
    showActionMenu(this.unitScreenAnchor(u), { canAttack, canMagic, canCancel: !!this.preMovePos }, (choice) => {
      if (choice === "attack") this.enterAttackTarget(u);
      else if (choice === "magic") this.openSpellMenu(u);
      else if (choice === "stay") this.endActiveTurn();
      else if (choice === "cancel") this.cancelMove(u);
    });
    this.updateHud(`${u.template.name}: choose action.`);
  }

  private cancelMove(u: UnitInstance) {
    if (!this.preMovePos) {
      this.endActiveTurn();
      return;
    }
    u.pos = { ...this.preMovePos };
    this.preMovePos = null;
    this.redrawUnits();
    this.drawActiveRing(u);
    this.phase = "select_move";
    this.computeMoveAndAttack(u);
    this.updateHud(`${u.template.name}'s turn - blue=move, red=enemy attack.`);
  }

  private enterAttackTarget(u: UnitInstance) {
    this.phase = "select_attack_target";
    const enemies = this.enemiesInRangeFromHere(u);
    this.attackTargets = new Set(enemies.map((e) => `${e.pos.x},${e.pos.y}`));
    this.reachableTiles.clear();
    this.spellTargets.clear();
    this.drawHighlights();
    this.updateHud(`${u.template.name}: click an enemy to attack (Esc to cancel).`);
  }

  private onAttackTargetClick(tile: Coord, cur: UnitInstance) {
    const key = `${tile.x},${tile.y}`;
    if (!this.attackTargets.has(key)) return;
    const enemy = unitAt(this.state, tile);
    if (!enemy) return;
    this.executeAttack(cur, enemy);
  }

  private async executeAttack(attacker: UnitInstance, defender: UnitInstance) {
    this.phase = "animating";
    this.clearHighlights();
    hideAllMenus();
    const result = resolveAttack(this.state, attacker, defender);
    await this.playAttackCutin(result);
    this.showAttackPopup(result);
    this.refreshPanes();
    if (!defender.alive) this.removeUnitView(defender);
    await this.delay(120);
    this.endActiveTurn();
  }

  private async playAttackCutin(result: AttackResult) {
    const text = result.hit ? `-${result.damage}` : "MISS";
    const color = result.hit ? "#ffeb6b" : "#bbbbbb";
    await playCutin(this, {
      attacker: result.attacker,
      defender: result.defender,
      effectText: text,
      effectColor: color,
      hit: result.hit,
    });
  }

  // --- spell menu / targeting ---

  private openSpellMenu(u: UnitInstance) {
    showSpellMenu(this.unitScreenAnchor(u), u, (chosen) => {
      if (!chosen) {
        // Back to action menu.
        this.openActionMenu(u);
        return;
      }
      this.activeSpell = chosen;
      this.enterSpellTarget(u);
    });
    this.updateHud(`${u.template.name}: pick a spell.`);
  }

  private enterSpellTarget(u: UnitInstance) {
    if (!this.activeSpell) return;
    this.phase = "select_spell_target";
    const tiles = spellTargetTiles(this.state, u, this.activeSpell);
    this.spellTargets = new Set(tiles.map((t) => `${t.x},${t.y}`));
    this.reachableTiles.clear();
    this.attackTargets.clear();
    this.drawHighlights();
    this.updateHud(
      `${u.template.name} casts ${this.activeSpell.spell.name} - click a target (Esc to cancel).`
    );
  }

  private onSpellTargetClick(tile: Coord, cur: UnitInstance) {
    if (!this.activeSpell) return;
    const key = `${tile.x},${tile.y}`;
    if (!this.spellTargets.has(key)) return;
    this.executeSpell(cur, this.activeSpell, tile);
  }

  private async executeSpell(caster: UnitInstance, spell: KnownSpell, target: Coord) {
    this.phase = "animating";
    this.clearHighlights();
    hideAllMenus();
    const result = resolveSpell(this.state, caster, spell, target);
    await this.playSpellCutin(result);
    this.showSpellPopups(result);
    this.refreshPanes();
    for (const h of result.hits) {
      if (h.unit && !h.unit.alive) this.removeUnitView(h.unit);
    }
    await this.delay(120);
    this.endActiveTurn();
  }

  private async playSpellCutin(result: SpellResult) {
    // Pick a focus target: first unit hit, or just the caster if none.
    const focus = result.hits[0]?.unit ?? result.caster;
    let text = result.spell.spell.name;
    let color = "#cfcfcf";
    if (result.hits.length === 0) {
      text = `${result.spell.spell.name}!`;
    } else {
      const h = result.hits[0];
      if (h.damage !== undefined) {
        text = `${result.spell.spell.name} -${h.damage}`;
        color = "#c060ff";
      } else if (h.heal !== undefined) {
        text = `${result.spell.spell.name} +${h.heal}`;
        color = "#70d070";
      } else if (h.cured) {
        text = `${result.spell.spell.name}: ${h.cured} cured`;
        color = "#70d0ff";
      }
    }
    await playCutin(this, {
      attacker: result.caster,
      defender: focus,
      effectText: text,
      effectColor: color,
      hit: true,
    });
  }

  private showSpellPopups(result: SpellResult) {
    for (const h of result.hits) {
      let text: string;
      let color: string;
      if (h.damage !== undefined) {
        text = `-${h.damage}`;
        color = "#c060ff";
      } else if (h.heal !== undefined) {
        text = `+${h.heal}`;
        color = "#70ff70";
      } else if (h.cured) {
        text = `${h.cured}-`;
        color = "#70d0ff";
      } else {
        continue;
      }
      this.spawnPopup(h.unit.pos, text, color);
      this.refreshUnitViewById(h.unit);
    }
  }

  // --- escape key cancel ---

  private cancelToMenu() {
    const cur = this.turn.current();
    if (!cur || cur.template.side !== "player") return;
    if (this.phase === "select_attack_target" || this.phase === "select_spell_target") {
      this.openActionMenu(cur);
    } else if (this.phase === "menu") {
      // Esc on menu = cancel move (revert to select_move) if possible.
      this.cancelMove(cur);
    }
  }

  // --- misc helpers ---

  private endActiveTurn() {
    this.phase = "animating";
    this.clearHighlights();
    hideAllMenus();
    this.drawActiveRing(null);
    this.time.delayedCall(80, () => this.turn.endTurn());
  }

  private inBounds(c: Coord) {
    return c.x >= 0 && c.y >= 0 && c.x < this.state.cols && c.y < this.state.rows;
  }

  private enemiesInRangeFromHere(u: UnitInstance): UnitInstance[] {
    const { min, max } = weaponRange(u);
    return this.state.units.filter((e) => {
      if (!e.alive || e.template.side === u.template.side) return false;
      const d = Math.abs(e.pos.x - u.pos.x) + Math.abs(e.pos.y - u.pos.y);
      return d >= min && d <= max;
    });
  }

  private unitScreenAnchor(u: UnitInstance): { x: number; y: number } {
    const canvas = this.game.canvas;
    const r = canvas.getBoundingClientRect();
    return {
      x: r.left + u.pos.x * TILE_SIZE + TILE_SIZE / 2,
      y: r.top + u.pos.y * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  private computeMoveAndAttack(u: UnitInstance) {
    const cost = makeMoveCostFn(this.state, u);
    this.reachableTiles = reachable(u.pos, u.template.stats.mov, this.state.cols, this.state.rows, cost);
    for (const other of this.state.units) {
      if (!other.alive || other === u) continue;
      this.reachableTiles.delete(`${other.pos.x},${other.pos.y}`);
    }
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

  private bestAttackStandTile(u: UnitInstance, enemy: UnitInstance): Coord | null {
    const { min, max } = weaponRange(u);
    const dHere = Math.abs(u.pos.x - enemy.pos.x) + Math.abs(u.pos.y - enemy.pos.y);
    if (dHere >= min && dHere <= max) return null;
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
    const barBg = this.add.rectangle(pad, TILE_SIZE - pad - 3, TILE_SIZE - pad * 2, 3, 0x000000, 0.8);
    barBg.setOrigin(0, 0);
    const bar = this.add.rectangle(pad, TILE_SIZE - pad - 3, TILE_SIZE - pad * 2, 3, 0x55ff55);
    bar.setOrigin(0, 0);
    container.add([body, label, barBg, bar]);
    container.setData("unit", u);
    container.setData("hpBar", bar);
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
    // Spell targets: color depends on spell payload. Targets often sit under
    // unit sprites, so we draw a thick outline as well as a fill.
    if (this.spellTargets.size && this.activeSpell) {
      const lvl = spellLevelData(this.activeSpell);
      let color = SPELL_TILE_FILL;
      if (lvl.damage) color = SPELL_DAMAGE_FILL;
      else if (lvl.heal) color = SPELL_HEAL_FILL;
      g.fillStyle(color, 0.35);
      for (const k of this.spellTargets) {
        const [xs, ys] = k.split(",");
        g.fillRect(Number(xs) * TILE_SIZE, Number(ys) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
      g.lineStyle(3, color, 1);
      for (const k of this.spellTargets) {
        const [xs, ys] = k.split(",");
        g.strokeRect(
          Number(xs) * TILE_SIZE + 1,
          Number(ys) * TILE_SIZE + 1,
          TILE_SIZE - 2,
          TILE_SIZE - 2
        );
      }
    }
    // Attack target outlines too (they sit under unit sprites).
    if (this.attackTargets.size && this.phase === "select_attack_target") {
      g.lineStyle(3, ATTACK_FILL, 1);
      for (const k of this.attackTargets) {
        const [xs, ys] = k.split(",");
        g.strokeRect(
          Number(xs) * TILE_SIZE + 1,
          Number(ys) * TILE_SIZE + 1,
          TILE_SIZE - 2,
          TILE_SIZE - 2
        );
      }
    }
  }

  private clearHighlights() {
    this.reachableTiles.clear();
    this.attackTargets.clear();
    this.spellTargets.clear();
    this.highlightLayer.clear();
  }

  // --- damage popups ---

  private spawnPopup(pos: Coord, text: string, color: string) {
    const x = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const y = pos.y * TILE_SIZE + 4;
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
  }

  private showAttackPopup(result: AttackResult) {
    const text = result.hit ? `-${result.damage}` : "miss";
    const color = result.hit ? "#ffeb6b" : "#bbbbbb";
    this.spawnPopup(result.defender.pos, text, color);
    if (result.hit) this.refreshUnitViewById(result.defender);
  }

  // --- panes ---

  private refreshPanes() {
    const cur = this.turn.current();
    if (this.inspectedHero) renderHero(this.inspectedHero, this.inspectedHero === cur);
    if (this.inspectedEnemy) renderEnemy(this.inspectedEnemy, this.inspectedEnemy === cur);
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
