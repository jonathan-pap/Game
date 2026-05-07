// DOM-based unit stats panes. Two slots: hero (left) and enemy (right).
// The Phaser scene calls renderHero / renderEnemy with the unit to display
// (or null to show the empty state).

import { UnitInstance } from "../battle/state";
import { portraitSvgFor } from "./portraits";

const heroEl = () => document.getElementById("hero-pane");
const enemyEl = () => document.getElementById("enemy-pane");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function statRow(label: string, value: string | number): string {
  return `<div class="row"><span class="lbl">${label}</span><span class="val">${value}</span></div>`;
}

function bar(current: number, max: number, kind: "hp" | "mp"): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return `<div class="bar ${kind}"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}

function renderUnit(unit: UnitInstance, side: "hero" | "enemy", active: boolean): string {
  const t = unit.template;
  const weaponName = unit.weapon ? unit.weapon.name : "(unarmed)";
  const wRange = unit.weapon?.range ? `${unit.weapon.range.min}-${unit.weapon.range.max}` : "1";
  const wAtk = unit.weapon?.stats?.atk ?? 0;
  const totalAtk = t.stats.atk + wAtk;
  const portraitSvg = portraitSvgFor(unit);
  return `
    <div class="head">
      <div class="portrait ${side} svg-portrait">${portraitSvg}</div>
      <div class="meta">
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="cls">${escapeHtml(t.class)} &middot; Lv ${t.level}${active ? " &middot; ACTIVE" : ""}</div>
      </div>
    </div>
    <div class="row"><span class="lbl">HP</span><span class="val">${unit.hp} / ${t.stats.hp}</span></div>
    ${bar(unit.hp, t.stats.hp, "hp")}
    <div class="row"><span class="lbl">MP</span><span class="val">${unit.mp} / ${t.stats.mp}</span></div>
    ${bar(unit.mp, t.stats.mp, "mp")}
    ${statRow("ATK", `${totalAtk} (${t.stats.atk}${wAtk ? "+" + wAtk : ""})`)}
    ${statRow("DEF", t.stats.def)}
    ${statRow("AGI", t.stats.agi)}
    ${statRow("MOV", t.stats.mov)}
    <div class="row" style="margin-top:8px"><span class="lbl">Weapon</span><span class="val">${escapeHtml(weaponName)}</span></div>
    ${unit.weapon ? statRow("Range", wRange) : ""}
  `;
}

export function renderHero(unit: UnitInstance | null, active = false) {
  const el = heroEl();
  if (!el) return;
  el.classList.toggle("active", !!unit && active);
  el.classList.toggle("dead", !!unit && !unit.alive);
  if (!unit) {
    el.innerHTML = `<div class="empty">Click a hero to view stats</div>`;
    return;
  }
  el.innerHTML = renderUnit(unit, "hero", active);
}

export function renderEnemy(unit: UnitInstance | null, active = false) {
  const el = enemyEl();
  if (!el) return;
  el.classList.toggle("active", !!unit && active);
  el.classList.toggle("dead", !!unit && !unit.alive);
  if (!unit) {
    el.innerHTML = `<div class="empty">Click an enemy to view stats</div>`;
    return;
  }
  el.innerHTML = renderUnit(unit, "enemy", active);
}

export function clearPanes() {
  renderHero(null);
  renderEnemy(null);
}
