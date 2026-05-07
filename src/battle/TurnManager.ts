import { BattleState, UnitInstance } from "./state";

// Phase-based turn order:
//   1. Player Phase: player freely picks any unacted player unit, acts it,
//      repeats until all player units have acted or player ends the phase.
//   2. Enemy Phase: each alive enemy acts once, ordered by AGI (with small
//      RNG so ties don't always favor the same unit).
//   3. New round.
// AGI no longer determines who acts when within a side -- it now affects
// hit/evade math only. This gives the player full tactical control over
// the order of their own moves.

type Side = "player" | "enemy";

export interface RoundEvent {
  kind:
    | "round_start"
    | "phase_start"
    | "turn_start"
    | "turn_end"
    | "battle_end"
    | "player_idle"; // emitted when player phase has no active unit (waiting for pick)
  round?: number;
  side?: Side;
  unit?: UnitInstance;
  outcome?: "victory" | "defeat";
}

export type TurnListener = (e: RoundEvent) => void;

export class TurnManager {
  private state: BattleState;
  private listeners = new Set<TurnListener>();
  private _round = 0;
  private _phase: Side = "player";
  private _activeUnit: UnitInstance | null = null;
  private _enemyQueue: UnitInstance[] = [];
  private _enemyIdx = 0;
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
  get phase(): Side {
    return this._phase;
  }
  get ended() {
    return this._ended;
  }

  current(): UnitInstance | null {
    if (this._ended) return null;
    return this._activeUnit;
  }

  // Living player units that haven't acted yet this round.
  unactedPlayerUnits(): UnitInstance[] {
    return this.state.units.filter(
      (u) => u.alive && u.template.side === "player" && !u.acted
    );
  }

  start() {
    this.startRound();
  }

  private startRound() {
    this._round += 1;
    for (const u of this.state.units) {
      if (!u.alive) continue;
      u.hasMoved = false;
      u.hasActed = false;
      u.acted = false;
    }
    this._phase = "player";
    this._activeUnit = null;
    this.emit({ kind: "round_start", round: this._round });
    this.emit({ kind: "phase_start", side: "player" });
    this.emit({ kind: "player_idle" });
  }

  // Player chooses which of their unacted units to make active. Returns true
  // if the unit was selected.
  selectPlayerUnit(u: UnitInstance): boolean {
    if (this._ended) return false;
    if (this._phase !== "player") return false;
    if (!u.alive || u.template.side !== "player" || u.acted) return false;
    if (this._activeUnit && !this._activeUnit.acted) {
      // Disallow swapping while another player unit is mid-turn.
      return false;
    }
    this._activeUnit = u;
    this.emit({ kind: "turn_start", unit: u });
    return true;
  }

  endTurn() {
    if (this._ended) return;
    const cur = this._activeUnit;
    if (cur) {
      cur.acted = true;
      this.emit({ kind: "turn_end", unit: cur });
    }
    this._activeUnit = null;

    if (this.checkBattleEnd()) return;

    if (this._phase === "player") {
      if (this.unactedPlayerUnits().length > 0) {
        // Stay in player phase; wait for the player to pick another unit.
        this.emit({ kind: "player_idle" });
        return;
      }
      this.startEnemyPhase();
    } else {
      this._enemyIdx += 1;
      this.advanceEnemyQueue();
    }
  }

  // Player ends their phase early (skipping any remaining unit moves).
  endPlayerPhase() {
    if (this._ended) return;
    if (this._phase !== "player") return;
    this._activeUnit = null;
    this.startEnemyPhase();
  }

  private startEnemyPhase() {
    if (this._ended) return;
    this._phase = "enemy";
    const enemies = this.state.units.filter(
      (u) => u.alive && u.template.side === "enemy" && !u.acted
    );
    this._enemyQueue = enemies
      .map((u) => ({ u, score: u.template.stats.agi + Math.random() * 4 }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.u);
    this._enemyIdx = 0;
    this.emit({ kind: "phase_start", side: "enemy" });
    this.advanceEnemyQueue();
  }

  private advanceEnemyQueue() {
    if (this._ended) return;
    if (this.checkBattleEnd()) return;
    while (this._enemyIdx < this._enemyQueue.length) {
      const next = this._enemyQueue[this._enemyIdx];
      if (next.alive) {
        this._activeUnit = next;
        this.emit({ kind: "turn_start", unit: next });
        return;
      }
      this._enemyIdx += 1;
    }
    // Enemy phase done, start a new round.
    this.startRound();
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
