// Action bar below the canvas. Replaces the old floating menus so the map
// is never covered. Same public surface (showActionMenu / showSpellMenu /
// hideAllMenus) so BattleScene doesn't need to change much.

import { KnownSpell, UnitInstance, spellLevelData } from "../battle/state";
import { canCast } from "../battle/magic";

export type ActionChoice = "attack" | "magic" | "stay" | "cancel";

export interface ActionMenuOptions {
  canAttack: boolean;
  canMagic: boolean;
  canCancel: boolean;
}

const barEl = () => document.getElementById("action-bar") as HTMLDivElement | null;

// Single source of truth for what the bar is currently showing. The keyboard
// handler in BattleScene reads this to dispatch hotkeys.
type BarMode =
  | { kind: "idle"; message: string }
  | { kind: "action"; opts: ActionMenuOptions; onChoice: (c: ActionChoice) => void; unitName: string }
  | { kind: "spell"; caster: UnitInstance; onChoice: (s: KnownSpell | null) => void };

let mode: BarMode = { kind: "idle", message: "It's no one's turn yet." };

function render() {
  const el = barEl();
  if (!el) return;
  el.classList.toggle("menu-on", mode.kind !== "idle");

  if (mode.kind === "idle") {
    el.innerHTML = `<span class="empty-label">${escapeHtml(mode.message)}</span>`;
    return;
  }

  if (mode.kind === "action") {
    const { opts, unitName } = mode;
    el.innerHTML = `
      <span class="label">${escapeHtml(unitName)}</span>
      <button data-action="attack" ${opts.canAttack ? "" : "disabled"}><span class="key">A</span>ttack</button>
      <button data-action="magic" ${opts.canMagic ? "" : "disabled"}><span class="key">M</span>agic</button>
      <button data-action="stay"><span class="key">S</span>tay</button>
      ${opts.canCancel ? '<button data-action="cancel"><span class="key">C</span>ancel Move</button>' : ""}
    `;
    el.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = (btn.getAttribute("data-action") as ActionChoice) || "stay";
        const cb = mode.kind === "action" ? mode.onChoice : null;
        setIdle("");
        cb?.(a);
      });
    });
    return;
  }

  if (mode.kind === "spell") {
    const { caster } = mode;
    const rows = caster.knownSpells
      .map((k, i) => {
        const lvl = spellLevelData(k);
        const ok = canCast(caster, k);
        const num = i + 1;
        return `<button data-i="${i}" ${ok ? "" : "disabled"}><span class="key">${num}</span> ${escapeHtml(k.spell.name)}<span class="meta">${lvl.mp} MP</span></button>`;
      })
      .join("");
    el.innerHTML = `
      <span class="label">${escapeHtml(caster.template.name)} - magic (${caster.mp} MP)</span>
      ${rows || '<span class="empty-label">No spells known</span>'}
      <button data-i="-1"><span class="key">C</span>ancel</button>
    `;
    el.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-i"));
        const cb = mode.kind === "spell" ? mode.onChoice : null;
        const caster_ = mode.kind === "spell" ? mode.caster : null;
        setIdle("");
        cb?.(i >= 0 && caster_ ? caster_.knownSpells[i] : null);
      });
    });
  }
}

function setIdle(message: string) {
  mode = { kind: "idle", message };
  render();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// --- public API used by BattleScene ---

export function showActionMenu(
  _anchor: { x: number; y: number } | null,
  opts: ActionMenuOptions,
  onChoice: (c: ActionChoice) => void,
  unitName = ""
) {
  mode = { kind: "action", opts, onChoice, unitName };
  render();
}

export function hideActionMenu() {
  if (mode.kind === "action") setIdle("");
}

export function showSpellMenu(
  _anchor: { x: number; y: number } | null,
  caster: UnitInstance,
  onChoice: (s: KnownSpell | null) => void
) {
  mode = { kind: "spell", caster, onChoice };
  render();
}

export function hideSpellMenu() {
  if (mode.kind === "spell") setIdle("");
}

export function hideAllMenus() {
  setIdle("");
}

// Set a message in the bar without showing buttons (e.g., during enemy
// turns or target-selection phases).
export function setBarStatus(message: string) {
  setIdle(message);
}

// Keyboard dispatch: invoked by BattleScene's keydown handler.
// Returns true if the keystroke matched a current bar button.
export function handleKey(key: string): boolean {
  const k = key.toLowerCase();
  if (mode.kind === "action") {
    const map: Record<string, ActionChoice> = { a: "attack", m: "magic", s: "stay", c: "cancel" };
    const choice = map[k];
    if (!choice) return false;
    if (choice === "attack" && !mode.opts.canAttack) return false;
    if (choice === "magic" && !mode.opts.canMagic) return false;
    if (choice === "cancel" && !mode.opts.canCancel) return false;
    const cb = mode.onChoice;
    setIdle("");
    cb(choice);
    return true;
  }
  if (mode.kind === "spell") {
    if (k === "c" || k === "escape") {
      const cb = mode.onChoice;
      setIdle("");
      cb(null);
      return true;
    }
    const i = Number(k) - 1;
    if (Number.isFinite(i) && i >= 0 && i < mode.caster.knownSpells.length) {
      if (!canCast(mode.caster, mode.caster.knownSpells[i])) return false;
      const cb = mode.onChoice;
      const caster = mode.caster;
      setIdle("");
      cb(caster.knownSpells[i]);
      return true;
    }
  }
  return false;
}
