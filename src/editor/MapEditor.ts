// MapEditor: canvas-based level editor. Loads a BattleMap, paints terrain
// via a tool palette derived from terrain.yaml, places units from
// characters.yaml + enemies.yaml, supports undo/redo, and POSTs the
// resulting YAML to /api/save-map (dev-only middleware in vite.config.ts).

import yaml from "js-yaml";
import {
  BattleMap,
  BattleMapSchema,
  Character,
  GameData,
  Terrain,
} from "../data/schema";
import { mapToYaml } from "./serialize";

type Tool =
  | { kind: "paint"; terrainGlyph: string }
  | { kind: "place_unit" }
  | { kind: "erase_unit" }
  | { kind: "select" };

const TILE_SIZE = 32;
const HISTORY_LIMIT = 50;

export class MapEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: GameData;
  private terrainByGlyph: Map<string, Terrain>;
  private maps: Record<string, BattleMap>;

  private currentId: string | null = null;
  private state: BattleMap | null = null;
  private dirty = false;
  private history: BattleMap[] = [];
  private redoStack: BattleMap[] = [];

  private tool: Tool = { kind: "paint", terrainGlyph: "." };
  private placingTemplateId = "";
  private selectedUnitIndex: number | null = null;
  private isMouseDown = false;

  constructor(canvas: HTMLCanvasElement, data: GameData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.data = data;
    this.maps = { ...data.maps };
    this.terrainByGlyph = new Map(data.terrain.map((t) => [t.glyph, t]));

    this.renderMapList();
    this.renderToolPalette();
    this.populateUnitDropdown();
    this.bindUiEvents();
    this.bindCanvasEvents();
    this.bindKeyboardEvents();
    this.setStatus("Pick a map from the left, or create a new one.");
  }

  // --- map list / selection -----------------------------------------

  private renderMapList() {
    const ul = document.getElementById("map-list") as HTMLUListElement;
    const filterEl = document.getElementById("map-filter") as HTMLInputElement;
    const filter = filterEl.value.toLowerCase();
    ul.innerHTML = "";
    const ids = Object.keys(this.maps).sort();
    for (const id of ids) {
      const m = this.maps[id];
      if (filter && !id.includes(filter) && !m.name.toLowerCase().includes(filter)) continue;
      const li = document.createElement("li");
      li.dataset["id"] = id;
      if (id === this.currentId) li.classList.add("active");
      li.innerHTML = `<strong>${escapeHtml(m.name)}</strong><small>${id} · ${m.size.cols}×${m.size.rows}</small>`;
      li.addEventListener("click", () => this.openMap(id));
      ul.appendChild(li);
    }
  }

  private openMap(id: string) {
    if (this.dirty) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    const m = this.maps[id];
    if (!m) return;
    this.currentId = id;
    this.state = deepClone(m);
    this.history = [];
    this.redoStack = [];
    this.dirty = false;
    this.selectedUnitIndex = null;
    this.refreshAll();
    this.setStatus(`Loaded ${id}.`);
  }

  // --- tool palette --------------------------------------------------

  private renderToolPalette() {
    const root = document.getElementById("tool-palette") as HTMLDivElement;
    root.innerHTML = "";
    // Terrain paint buttons.
    this.data.terrain.forEach((t, i) => {
      const btn = document.createElement("button");
      btn.className = "tool";
      btn.dataset["kind"] = "paint";
      btn.dataset["glyph"] = t.glyph;
      btn.title = `${t.name} (cost ${t.move_cost}${t.blocks ? ", blocked" : ""}) — press ${i + 1}`;
      btn.innerHTML = `<span class="swatch" style="background:${t.color}"></span><span>${escapeHtml(t.name)}<br/><span style="color:var(--ink-faint)">${i + 1} · ${t.glyph}</span></span>`;
      btn.addEventListener("click", () => this.setTool({ kind: "paint", terrainGlyph: t.glyph }));
      root.appendChild(btn);
    });
    // Unit tools.
    const u = document.createElement("button");
    u.className = "tool";
    u.dataset["kind"] = "place_unit";
    u.title = "Place selected unit (U)";
    u.innerHTML = `<span class="swatch" style="background:#4a90e2"></span><span>Unit<br/><span style="color:var(--ink-faint)">U · place</span></span>`;
    u.addEventListener("click", () => this.setTool({ kind: "place_unit" }));
    root.appendChild(u);

    const e = document.createElement("button");
    e.className = "tool";
    e.dataset["kind"] = "erase_unit";
    e.title = "Erase unit (E)";
    e.innerHTML = `<span class="swatch" style="background:#3a342c;border:1px dashed #c0432e"></span><span>Erase<br/><span style="color:var(--ink-faint)">E · unit</span></span>`;
    e.addEventListener("click", () => this.setTool({ kind: "erase_unit" }));
    root.appendChild(e);

    const s = document.createElement("button");
    s.className = "tool";
    s.dataset["kind"] = "select";
    s.title = "Select (S)";
    s.innerHTML = `<span class="swatch" style="background:#59c8ff"></span><span>Select<br/><span style="color:var(--ink-faint)">S</span></span>`;
    s.addEventListener("click", () => this.setTool({ kind: "select" }));
    root.appendChild(s);

    this.refreshToolHighlight();
  }

  private setTool(t: Tool) {
    this.tool = t;
    this.refreshToolHighlight();
    this.canvas.style.cursor = t.kind === "select" ? "pointer" : "crosshair";
  }

  private refreshToolHighlight() {
    const buttons = document.querySelectorAll<HTMLButtonElement>("#tool-palette button.tool");
    buttons.forEach((b) => {
      const kind = b.dataset["kind"];
      const glyph = b.dataset["glyph"];
      const active =
        (this.tool.kind === "paint" && kind === "paint" && glyph === this.tool.terrainGlyph) ||
        (this.tool.kind !== "paint" && kind === this.tool.kind);
      b.classList.toggle("active", active);
    });
  }

  // --- unit dropdown -------------------------------------------------

  private populateUnitDropdown() {
    const sel = document.getElementById("place-unit-select") as HTMLSelectElement;
    sel.innerHTML = "";
    const players = this.data.characters.filter((c) => c.side === "player");
    const enemies = this.data.characters.filter((c) => c.side === "enemy");
    const optgroup = (label: string, list: Character[]) => {
      const og = document.createElement("optgroup");
      og.label = label;
      list.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.class})`;
        og.appendChild(opt);
      });
      return og;
    };
    sel.appendChild(optgroup("Players", players));
    sel.appendChild(optgroup("Enemies", enemies));
    sel.addEventListener("change", () => {
      this.placingTemplateId = sel.value;
    });
    this.placingTemplateId = players[0]?.id ?? "";
    sel.value = this.placingTemplateId;
  }

  // --- general UI events --------------------------------------------

  private bindUiEvents() {
    (document.getElementById("map-filter") as HTMLInputElement).addEventListener("input", () => this.renderMapList());
    (document.getElementById("btn-save") as HTMLButtonElement).addEventListener("click", () => this.save());
    (document.getElementById("btn-reload") as HTMLButtonElement).addEventListener("click", () => this.reload());
    (document.getElementById("btn-undo") as HTMLButtonElement).addEventListener("click", () => this.undo());
    (document.getElementById("btn-redo") as HTMLButtonElement).addEventListener("click", () => this.redo());
    (document.getElementById("btn-new") as HTMLButtonElement).addEventListener("click", () => this.createNew());

    (document.getElementById("map-id") as HTMLInputElement).addEventListener("change", (e) => {
      if (!this.state) return;
      const v = (e.target as HTMLInputElement).value.trim();
      if (!/^[a-z0-9_-]+$/.test(v)) {
        this.toast("Map id must be lowercase letters/digits/_/-", true);
        (e.target as HTMLInputElement).value = this.state.id;
        return;
      }
      this.snapshotForUndo();
      this.state.id = v;
      this.markDirty();
      this.refreshHeader();
    });
    (document.getElementById("map-name") as HTMLInputElement).addEventListener("change", (e) => {
      if (!this.state) return;
      this.snapshotForUndo();
      this.state.name = (e.target as HTMLInputElement).value;
      this.markDirty();
      this.refreshHeader();
    });
    (document.getElementById("map-cols") as HTMLInputElement).addEventListener("change", (e) => {
      if (!this.state) return;
      const n = Math.max(4, Math.min(64, parseInt((e.target as HTMLInputElement).value, 10) || this.state.size.cols));
      if (n === this.state.size.cols) return;
      this.snapshotForUndo();
      this.resizeMap(n, this.state.size.rows);
      this.markDirty();
      this.refreshAll();
    });
    (document.getElementById("map-rows") as HTMLInputElement).addEventListener("change", (e) => {
      if (!this.state) return;
      const n = Math.max(4, Math.min(48, parseInt((e.target as HTMLInputElement).value, 10) || this.state.size.rows));
      if (n === this.state.size.rows) return;
      this.snapshotForUndo();
      this.resizeMap(this.state.size.cols, n);
      this.markDirty();
      this.refreshAll();
    });
    (document.getElementById("map-victory") as HTMLSelectElement).addEventListener("change", (e) => {
      if (!this.state) return;
      this.snapshotForUndo();
      this.state.victory = (e.target as HTMLSelectElement).value as BattleMap["victory"];
      this.markDirty();
    });
  }

  // --- canvas events -------------------------------------------------

  private bindCanvasEvents() {
    this.canvas.addEventListener("mousedown", (e) => {
      if (!this.state) return;
      const tile = this.tileFromMouse(e);
      if (!tile) return;
      this.isMouseDown = true;
      this.applyToolAt(tile.x, tile.y, true);
    });
    this.canvas.addEventListener("mousemove", (e) => {
      if (!this.state) return;
      const tile = this.tileFromMouse(e);
      if (!tile) return;
      this.setStatus(`Tile (${tile.x}, ${tile.y})`);
      if (this.isMouseDown) this.applyToolAt(tile.x, tile.y, false);
    });
    const finish = () => {
      this.isMouseDown = false;
    };
    this.canvas.addEventListener("mouseup", finish);
    this.canvas.addEventListener("mouseleave", finish);
    window.addEventListener("blur", finish);
  }

  private tileFromMouse(e: MouseEvent): { x: number; y: number } | null {
    if (!this.state) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - r.top) / TILE_SIZE);
    if (x < 0 || y < 0 || x >= this.state.size.cols || y >= this.state.size.rows) return null;
    return { x, y };
  }

  // Returns true if the action created a meaningful change (so we know
  // whether to snapshot).
  private applyToolAt(x: number, y: number, isInitialClick: boolean): void {
    if (!this.state) return;
    if (this.tool.kind === "paint") {
      const row = this.state.tiles[y];
      if (row.charAt(x) === this.tool.terrainGlyph) return;
      if (isInitialClick) this.snapshotForUndo();
      this.state.tiles[y] = row.substring(0, x) + this.tool.terrainGlyph + row.substring(x + 1);
      this.markDirty();
      this.draw();
    } else if (this.tool.kind === "place_unit" && isInitialClick) {
      if (!this.placingTemplateId) {
        this.toast("Pick a unit from the dropdown first", true);
        return;
      }
      // No duplicate placement on the same tile.
      const existing = this.state.units.findIndex((u) => u.at[0] === x && u.at[1] === y);
      this.snapshotForUndo();
      if (existing >= 0) this.state.units.splice(existing, 1);
      this.state.units.push({ template: this.placingTemplateId, at: [x, y] });
      this.selectedUnitIndex = this.state.units.length - 1;
      this.markDirty();
      this.refreshUnits();
      this.draw();
    } else if (this.tool.kind === "erase_unit" && isInitialClick) {
      const i = this.state.units.findIndex((u) => u.at[0] === x && u.at[1] === y);
      if (i < 0) return;
      this.snapshotForUndo();
      this.state.units.splice(i, 1);
      this.selectedUnitIndex = null;
      this.markDirty();
      this.refreshUnits();
      this.draw();
    } else if (this.tool.kind === "select" && isInitialClick) {
      const i = this.state.units.findIndex((u) => u.at[0] === x && u.at[1] === y);
      this.selectedUnitIndex = i >= 0 ? i : null;
      this.refreshUnits();
      this.draw();
    }
  }

  // --- keyboard events -----------------------------------------------

  private bindKeyboardEvents() {
    window.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement;
      // Don't hijack typing inside inputs.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); this.save(); return; }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); this.redo(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); this.undo(); return; }
      if (!this.state) return;
      if (e.key >= "1" && e.key <= "9") {
        const i = parseInt(e.key, 10) - 1;
        const t = this.data.terrain[i];
        if (t) this.setTool({ kind: "paint", terrainGlyph: t.glyph });
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "u") this.setTool({ kind: "place_unit" });
      else if (k === "s") this.setTool({ kind: "select" });
      else if (k === "e") this.setTool({ kind: "erase_unit" });
      else if (k === "delete" || k === "backspace") {
        if (this.selectedUnitIndex !== null) {
          this.snapshotForUndo();
          this.state.units.splice(this.selectedUnitIndex, 1);
          this.selectedUnitIndex = null;
          this.markDirty();
          this.refreshUnits();
          this.draw();
        }
      }
    });
  }

  // --- new / reload / save -------------------------------------------

  private createNew() {
    if (this.dirty && !confirm("Discard unsaved changes?")) return;
    const id = prompt("New map id (lowercase letters/digits/_/-):", "new_map");
    if (!id || !/^[a-z0-9_-]+$/.test(id)) {
      if (id) this.toast("Invalid id; cancelled", true);
      return;
    }
    const fresh: BattleMap = {
      id,
      name: id.replace(/_/g, " "),
      size: { cols: 16, rows: 12 },
      tiles: Array(12).fill(".".repeat(16)),
      units: [],
      victory: "rout_enemy",
    };
    this.maps[id] = fresh;
    this.currentId = id;
    this.state = deepClone(fresh);
    this.history = [];
    this.redoStack = [];
    this.dirty = true;
    this.selectedUnitIndex = null;
    this.renderMapList();
    this.refreshAll();
    this.setStatus("Created new map. Edit and Save to persist.");
  }

  private reload() {
    if (!this.currentId) return;
    if (this.dirty && !confirm("Discard unsaved changes?")) return;
    // Reload via fetch of the YAML through the dev server (Vite serves
    // /data/maps/<id>.yaml).
    fetch(`/data/maps/${this.currentId}.yaml`)
      .then((r) => r.text())
      .then((text) => {
        const raw = yaml.load(text);
        const parsed = BattleMapSchema.safeParse(raw);
        if (!parsed.success) throw new Error("Schema error on reload — see console");
        this.maps[parsed.data.id] = parsed.data;
        this.state = deepClone(parsed.data);
        this.history = [];
        this.redoStack = [];
        this.dirty = false;
        this.refreshAll();
        this.setStatus("Reloaded from disk.");
      })
      .catch((err) => {
        console.error(err);
        this.toast(`Reload failed: ${err.message}`, true);
      });
  }

  private async save() {
    if (!this.state) return;
    const yamlText = mapToYaml(this.state);
    try {
      const res = await fetch("/api/save-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.state.id, yaml: yamlText }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "save failed");
      this.maps[this.state.id] = deepClone(this.state);
      this.dirty = false;
      this.refreshButtons();
      this.refreshHeader();
      this.renderMapList();
      this.toast(`Saved data/maps/${this.state.id}.yaml`);
    } catch (e) {
      console.error(e);
      this.toast(`Save failed: ${(e as Error).message}`, true);
    }
  }

  // --- undo / redo ---------------------------------------------------

  private snapshotForUndo() {
    if (!this.state) return;
    this.history.push(deepClone(this.state));
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.redoStack = [];
    this.refreshButtons();
  }

  private undo() {
    if (!this.state || this.history.length === 0) return;
    const prev = this.history.pop()!;
    this.redoStack.push(deepClone(this.state));
    this.state = prev;
    this.dirty = true;
    this.selectedUnitIndex = null;
    this.refreshAll();
    this.setStatus("Undo");
  }

  private redo() {
    if (!this.state || this.redoStack.length === 0) return;
    const next = this.redoStack.pop()!;
    this.history.push(deepClone(this.state));
    this.state = next;
    this.dirty = true;
    this.selectedUnitIndex = null;
    this.refreshAll();
    this.setStatus("Redo");
  }

  // --- resize --------------------------------------------------------

  private resizeMap(cols: number, rows: number) {
    if (!this.state) return;
    const oldRows = this.state.tiles;
    const newRows: string[] = [];
    for (let y = 0; y < rows; y++) {
      const old = oldRows[y] ?? "";
      let row = old.slice(0, cols);
      if (row.length < cols) row += ".".repeat(cols - row.length);
      newRows.push(row);
    }
    this.state.tiles = newRows;
    this.state.size = { cols, rows };
    this.state.units = this.state.units.filter((u) => u.at[0] < cols && u.at[1] < rows);
  }

  // --- rendering -----------------------------------------------------

  private refreshAll() {
    this.refreshHeader();
    this.refreshButtons();
    this.refreshInputs();
    this.refreshUnits();
    this.resizeCanvas();
    this.draw();
    this.renderMapList();
  }

  private refreshHeader() {
    const title = document.getElementById("map-title") as HTMLHeadingElement;
    const meta = document.getElementById("map-meta") as HTMLSpanElement;
    const dirty = document.getElementById("dirty-flag") as HTMLSpanElement;
    if (!this.state) {
      title.textContent = "Pick a map";
      meta.textContent = "";
      dirty.hidden = true;
      return;
    }
    title.textContent = this.state.name;
    meta.textContent = `${this.state.id} · ${this.state.size.cols}×${this.state.size.rows} · ${this.state.units.length} units`;
    dirty.hidden = !this.dirty;
  }

  private refreshButtons() {
    (document.getElementById("btn-save") as HTMLButtonElement).disabled = !this.dirty;
    (document.getElementById("btn-undo") as HTMLButtonElement).disabled = this.history.length === 0;
    (document.getElementById("btn-redo") as HTMLButtonElement).disabled = this.redoStack.length === 0;
  }

  private refreshInputs() {
    if (!this.state) return;
    (document.getElementById("map-id") as HTMLInputElement).value = this.state.id;
    (document.getElementById("map-name") as HTMLInputElement).value = this.state.name;
    (document.getElementById("map-cols") as HTMLInputElement).value = String(this.state.size.cols);
    (document.getElementById("map-rows") as HTMLInputElement).value = String(this.state.size.rows);
    (document.getElementById("map-victory") as HTMLSelectElement).value = this.state.victory;
  }

  private refreshUnits() {
    if (!this.state) return;
    const ul = document.getElementById("units-list") as HTMLDivElement;
    const count = document.getElementById("unit-count") as HTMLSpanElement;
    count.textContent = String(this.state.units.length);
    ul.innerHTML = "";
    this.state.units.forEach((u, i) => {
      const tmpl = this.data.characters.find((c) => c.id === u.template);
      const row = document.createElement("div");
      row.className = "unit-row" + (i === this.selectedUnitIndex ? " selected" : "");
      const sideColor = tmpl?.side === "enemy" ? "#d05050" : "#4a90e2";
      row.innerHTML = `<span><span style="color:${sideColor}">●</span> ${escapeHtml(tmpl?.name ?? u.template)}</span><span class="pos">[${u.at[0]},${u.at[1]}]</span>`;
      row.addEventListener("click", () => {
        this.selectedUnitIndex = i;
        this.refreshUnits();
        this.draw();
      });
      ul.appendChild(row);
    });
  }

  private resizeCanvas() {
    if (!this.state) return;
    this.canvas.width = this.state.size.cols * TILE_SIZE;
    this.canvas.height = this.state.size.rows * TILE_SIZE;
  }

  private draw() {
    if (!this.state) {
      this.ctx.fillStyle = "#0c0e14";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const c = this.ctx;
    // Terrain
    for (let y = 0; y < this.state.size.rows; y++) {
      const row = this.state.tiles[y];
      for (let x = 0; x < this.state.size.cols; x++) {
        const glyph = row.charAt(x);
        const t = this.terrainByGlyph.get(glyph);
        c.fillStyle = t?.color ?? "#222";
        c.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    // Grid lines
    c.strokeStyle = "rgba(0,0,0,0.4)";
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= this.state.size.cols; x++) {
      c.moveTo(x * TILE_SIZE + 0.5, 0);
      c.lineTo(x * TILE_SIZE + 0.5, this.canvas.height);
    }
    for (let y = 0; y <= this.state.size.rows; y++) {
      c.moveTo(0, y * TILE_SIZE + 0.5);
      c.lineTo(this.canvas.width, y * TILE_SIZE + 0.5);
    }
    c.stroke();
    // Units
    this.state.units.forEach((u, i) => {
      const tmpl = this.data.characters.find((c) => c.id === u.template);
      const sideColor = tmpl?.side === "enemy" ? "#d05050" : "#4a90e2";
      const px = u.at[0] * TILE_SIZE;
      const py = u.at[1] * TILE_SIZE;
      const pad = 4;
      c.fillStyle = sideColor;
      c.fillRect(px + pad, py + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);
      c.fillStyle = "#fff";
      c.font = "bold 14px monospace";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText((tmpl?.name ?? "?").charAt(0), px + TILE_SIZE / 2, py + TILE_SIZE / 2);
      // Selection ring
      if (i === this.selectedUnitIndex) {
        c.strokeStyle = "#ffe14a";
        c.lineWidth = 2;
        c.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    });
  }

  // --- helpers -------------------------------------------------------

  private markDirty() {
    this.dirty = true;
    this.refreshButtons();
    this.refreshHeader();
  }

  private setStatus(s: string) {
    const el = document.getElementById("status");
    if (el) el.textContent = s;
  }

  private toast(msg: string, isError = false) {
    const el = document.getElementById("toast") as HTMLDivElement;
    el.textContent = msg;
    el.classList.toggle("error", isError);
    el.classList.add("show");
    window.setTimeout(() => el.classList.remove("show"), 2200);
  }
}

// --- utilities --------------------------------------------------------

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
