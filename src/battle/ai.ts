// Enemy AI stub. SF1 enemies generally:
//   - move toward the nearest player unit they can reach
//   - attack if adjacent to a target after moving
//   - prefer weak/low-HP targets when multiple are in range
// This stub will be filled in once unit + map representations are in place.

import { Coord } from "./grid";

export interface AIUnitView {
  id: string;
  pos: Coord;
  hp: number;
  side: "player" | "enemy";
}

export interface AIAction {
  kind: "move_attack" | "move" | "wait";
  destination?: Coord;
  targetId?: string;
}

export function decideAction(_self: AIUnitView, _all: AIUnitView[]): AIAction {
  return { kind: "wait" };
}
