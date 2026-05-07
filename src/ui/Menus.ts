// DOM-based floating menus (action menu, spell submenu). Positioned near
// the active unit's screen coordinates.

import { KnownSpell, UnitInstance, spellLevelData } from "../battle/state";
import { canCast } from "../battle/magic";

export type ActionChoice = "attack" | "magic" | "stay" | "cancel";

export interface ActionMenuOptions {
  canAttack: boolean;
  canMagic: boolean;
  canCancel: boolean;
}

const actionMenuEl = () => document.getElementById("action-menu") as HTMLDivElement | null;
const spellMenuEl = () => document.getElementById("spell-menu") as HTMLDivElement | null;

function positionAt(el: HTMLDivElement, anchor: { x: number; y: number }) {
  // Position to the right of anchor by default; flip left if it would
  // overflow the viewport.
  const margin = 12;
  const w = el.offsetWidth || 160;
  const h = el.offsetHeight || 120;
  let left = anchor.x + margin;
  let top = anchor.y - h / 2;
  if (left + w > window.innerWidth - 8) left = anchor.x - w - margin;
  if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
  if (top < 8) top = 8;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

export function showActionMenu(
  anchor: { x: number; y: number },
  opts: ActionMenuOptions,
  onChoice: (c: ActionChoice) => void
) {
  const el = actionMenuEl();
  if (!el) return;
  el.innerHTML = `
    <div class="title">Action</div>
    <button data-action="attack" ${opts.canAttack ? "" : "disabled"}>Attack</button>
    <button data-action="magic" ${opts.canMagic ? "" : "disabled"}>Magic</button>
    <button data-action="stay">Stay</button>
    ${opts.canCancel ? '<button data-action="cancel">Cancel Move</button>' : ""}
  `;
  el.classList.remove("hidden");
  positionAt(el, anchor);
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = (btn.getAttribute("data-action") as ActionChoice) || "stay";
      hideActionMenu();
      onChoice(a);
    });
  });
}

export function hideActionMenu() {
  const el = actionMenuEl();
  if (el) el.classList.add("hidden");
}

export function showSpellMenu(
  anchor: { x: number; y: number },
  caster: UnitInstance,
  onChoice: (s: KnownSpell | null) => void
) {
  const el = spellMenuEl();
  if (!el) return;
  const rows = caster.knownSpells
    .map((k, i) => {
      const lvl = spellLevelData(k);
      const ok = canCast(caster, k);
      return `<button data-i="${i}" ${ok ? "" : "disabled"}>${k.spell.name} <span class="meta">${lvl.mp} MP</span></button>`;
    })
    .join("");
  el.innerHTML = `
    <div class="title">Magic - ${caster.mp} MP</div>
    ${rows || '<div style="color:#777;font-size:12px">No spells known</div>'}
    <button data-i="-1">Cancel</button>
  `;
  el.classList.remove("hidden");
  positionAt(el, anchor);
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      hideSpellMenu();
      onChoice(i >= 0 ? caster.knownSpells[i] : null);
    });
  });
}

export function hideSpellMenu() {
  const el = spellMenuEl();
  if (el) el.classList.add("hidden");
}

export function hideAllMenus() {
  hideActionMenu();
  hideSpellMenu();
}
