import { BattleState, UnitInstance } from "./state";

// SF-style turn order: each round, units act once, sorted by AGI + dice.
// Within a round, the queue is fixed once rolled.

export interface RoundEvent {
  kind: "round_start" | "turn_start" | "turn_end" | "battle_end";
  round?: number;
  unit?: UnitInstance;
  outcome?: "victory" | "defeat";
}

export type TurnListener = (e: RoundEvent) => void;

export class TurnManager {
  private state: BattleState;
  private queue: UnitInstance[] = [];
  private idx = 0;
  private listeners = new Set<TurnListener>();
  private _round = 0;
  private _ended = false;

  constructor(state: BattleState) {
    this.state = state;
  }

  on(listener: TurnListener) {
    this.listeners.add(listener);
  }

  private emit(e: RoundEvent) {
    for (const l of this.listeners) l(e);
  }

  get round() {
    return this._round;
  }
  get ended() {
    return this._ended;
  }

  current(): UnitInstance | null {
    if (this._ended) return null;
    return this.queue[this.idx] ?? null;
  }

  start() {
    this.startRound();
  }

  private startRound() {
    this._round += 1;
    const alive = this.state.units.filter((u) => u.alive);
    for (const u of alive) {
      u.hasMoved = false;
      u.hasActed = false;
      u.acted = false;
    }
    this.queue = alive
      .map((u) => ({ u, score: u.template.stats.agi + Math.random() * 4 }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.u);
    this.idx = 0;
    this.emit({ kind: "round_start", round: this._round });
    this.emitTurnStart();
  }

  private emitTurnStart() {
    const u = this.current();
    if (u) this.emit({ kind: "turn_start", unit: u });
  }

  // Skip dead units (could happen if a unit dies between turns).
  private skipDead() {
    while (this.idx < this.queue.length && !this.queue[this.idx].alive) {
      this.idx += 1;
    }
  }

  endTurn() {
    if (this._ended) return;
    const cur = this.current();
    if (cur) {
      cur.acted = true;
      this.emit({ kind: "turn_end", unit: cur });
    }
    this.idx += 1;
    this.skipDead();

    if (this.checkBattleEnd()) return;

    if (this.idx >= this.queue.length) {
      this.startRound();
      return;
    }
    this.emitTurnStart();
  }

  private checkBattleEnd(): boolean {
    const players = this.state.units.filter((u) => u.alive && u.template.side === "player");
    const enemies = this.state.units.filter((u) => u.alive && u.template.side === "enemy");
    if (enemies.length === 0) {
      this._ended = true;
      this.emit({ kind: "battle_end", outcome: "victory" });
      return true;
    }
    if (players.length === 0) {
      this._ended = true;
      this.emit({ kind: "battle_end", outcome: "defeat" });
      return true;
    }
    return false;
  }
}
