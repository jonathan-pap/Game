# Shining Clone

A Shining Force 1-inspired tactical RPG. Browser game built with Phaser 3 + TypeScript + Vite.
Game balance data lives in YAML under `data/` — easy to hand-edit during development.

## Status

Early scaffold. Battle prototype is stubbed (renders a grid + data summary).
No combat, AI, or town yet.

## Run

```bash
npm install
npm run dev          # dev server on http://127.0.0.1:5173
npm run typecheck    # TS type-check only
npm run build        # production build to dist/
```

## Project layout

```
data/                YAML game data (hand-edited)
  characters.yaml    playable + enemy unit templates
  classes.yaml       class definitions, promotion paths, learned spells
  equipment.yaml     weapons / armor
  items.yaml         consumables / key items
  spells.yaml        spell catalog (multi-level: Heal 1/2/3/4)
  terrain.yaml       tile types: move cost, defense, evade

src/
  main.ts            Phaser game bootstrap
  scenes/            Phaser scenes (Boot, Battle)
  data/              schema (Zod) + YAML loader
  battle/            grid, pathfinding (A*), turn order, combat, AI stubs
```

## Design notes

- YAML files are imported as raw strings via Vite's `?raw` and validated with Zod
  at startup. Schema errors print to the browser console with a readable diff.
- `data/` is intentionally outside `src/` so non-coders can edit it without touching code.
- Permanent design goal: keep gameplay rules **data-driven**. New units, classes,
  spells, and items should never require code changes.

## Roadmap (rough)

1. Battle prototype: 1 map, 3 vs 3, grid move + attack, simple AI, win/lose.
2. Damage formula tuning, crits, terrain effects.
3. Spells (single target, then AoE), MP, status effects.
4. Town hub: shops, church (revive), HQ (party select), inn.
5. Save/load via localStorage.
6. Multi-battle campaign with story scenes.
7. Promotion system, character recruitment.
8. Real art (sprite sheets, animations) — placeholder until then.
