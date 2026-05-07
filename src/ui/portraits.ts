// SVG portrait factory. Synthesizes a stylized 64x64 portrait from an
// archetype function + per-unit palette. Anime / 16-bit JRPG flavor with
// strong color blocks; original art -- nothing copied from SF sprites.
//
// Each archetype is a function that takes a Palette and produces an inner
// SVG string (drawn over the standard frame + background). The wrapper
// function stitches frame, gradient backdrop, content, and frame border.

import Phaser from "phaser";

export interface Palette {
  skin: string;
  hair: string;
  accent: string; // primary armor / robe color
  trim: string;   // secondary armor / robe color
  eye: string;    // eye color
}

// --- color constants --------------------------------------------------

const SKIN = {
  light: "#f4d6b0",
  tan: "#dba87a",
  pale: "#fbe6c8",
  green: "#7da256",
  bone: "#ece6d2",
  grey: "#bfb8a8",
} as const;

const HAIR = {
  blond: "#f3d56b",
  brown: "#6a4a2c",
  black: "#1d1812",
  red: "#bf3a2c",
  blue: "#3e6cc8",
  green: "#4f9148",
  pink: "#e489a8",
  silver: "#c8cdd6",
  white: "#f0ece0",
  purple: "#7a4ab0",
  orange: "#d88334",
} as const;

const ACCENT = {
  hero: "#3658b8",       // royal blue
  knight: "#9aa8c0",     // silver-blue
  paladin: "#d8c060",    // gold
  warrior: "#7a4830",    // leather brown
  gladiator: "#8a3030",  // crimson
  archer: "#3a8a48",     // forest green
  bowmaster: "#3a8a48",
  healer: "#e8e2d0",     // cream/white
  vicar: "#f0e0a0",
  mage: "#a83040",       // mage red
  wizard: "#5b34a8",     // wizard purple
  monk: "#c89048",       // saffron
  ninja: "#202028",      // black-grey
  samurai: "#9c2a30",    // samurai red
  birdman: "#d0d8e0",    // bird-grey
  sky_warrior: "#80a8d0",
  werewolf: "#4a3a30",   // dark fur
  wolf_baron: "#3a2a20",
  dragon: "#3aa860",     // dragon green
  great_dragon: "#3aa860",
  wing_knight: "#c89860", // yellow-orange (Kokichi sprite-ish)
  sky_lord: "#c89860",
  steam_knight: "#a07040",
  steam_baron: "#a07040",
  assault_knight: "#5a8848",
  strike_knight: "#5a8848",
  robot: "#a8a8b8",
  cyborg: "#8898a8",
  magic_creature: "#7060c8", // mystical purple
  yogurt: "#f0d8a8",
  // generic enemy fallbacks:
  enemy_basic: "#7a3030",
  goblin: "#4a6a30",
  dark_dwarf: "#604030",
  rune_knight: "#6a3a30",
  dark_elf: "#3a2848",
  skeleton: "#8a8270",
  zombie: "#4a5a3a",
  dark_mage: "#3c2860",
  hellhound: "#6a2828",
  dragon_enemy: "#3a4078",
  demon: "#5a1830",
} as const;

// --- helpers ----------------------------------------------------------

function frame(_palette: Palette, body: string, frameColor = "#3a3f48"): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#2a3450"/>`,
    `<stop offset="100%" stop-color="#10131c"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="64" height="64" fill="url(#bg)"/>`,
    body,
    `<rect x="1" y="1" width="62" height="62" fill="none" stroke="${frameColor}" stroke-width="2"/>`,
    `</svg>`,
  ].join("");
}

// Standard anime face: oval, big-eye placement, small mouth.
function face(p: Palette): string {
  return [
    // neck
    `<rect x="28" y="36" width="8" height="6" fill="${p.skin}"/>`,
    `<rect x="28" y="36" width="8" height="2" fill="rgba(0,0,0,0.18)"/>`,
    // face
    `<ellipse cx="32" cy="28" rx="11" ry="12.5" fill="${p.skin}"/>`,
    // chin shading
    `<path d="M 24 32 Q 32 38 40 32 Q 38 36 32 38 Q 26 36 24 32 Z" fill="rgba(0,0,0,0.08)"/>`,
    // eyes (big anime style)
    `<ellipse cx="27" cy="29" rx="1.5" ry="2.6" fill="${p.eye}"/>`,
    `<ellipse cx="37" cy="29" rx="1.5" ry="2.6" fill="${p.eye}"/>`,
    `<circle cx="27" cy="28.3" r="0.5" fill="#fff"/>`,
    `<circle cx="37" cy="28.3" r="0.5" fill="#fff"/>`,
    // mouth
    `<path d="M 30 33.5 Q 32 34.5 34 33.5" stroke="#5b3030" stroke-width="0.7" fill="none" stroke-linecap="round"/>`,
  ].join("");
}

// Body block (shoulders + chest) — used as armor/robe base under the face.
function shoulders(p: Palette, accentOverride?: string): string {
  const c = accentOverride ?? p.accent;
  return [
    `<path d="M 6 64 L 6 50 Q 6 42 13 39 L 22 37 L 32 40 L 42 37 L 51 39 Q 58 42 58 50 L 58 64 Z" fill="${c}"/>`,
    // trim line across the chest
    `<path d="M 12 48 Q 32 44 52 48" stroke="${p.trim}" stroke-width="1.5" fill="none"/>`,
  ].join("");
}

// --- archetypes -------------------------------------------------------

function heroPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      // gold pauldron rim
      `<path d="M 8 50 Q 12 40 22 38" stroke="${p.trim}" stroke-width="1.5" fill="none"/>`,
      `<path d="M 56 50 Q 52 40 42 38" stroke="${p.trim}" stroke-width="1.5" fill="none"/>`,
      face(p),
      // hair: side-swept, classic shounen
      `<path d="M 21 18 Q 22 11 30 9 Q 38 9 43 14 Q 45 20 43 24 L 41 22 L 38 24 L 35 22 L 32 24 L 29 22 L 25 24 L 22 22 L 21 26 Z" fill="${p.hair}"/>`,
      `<path d="M 21 26 L 22 30 L 24 27" fill="${p.hair}"/>`,
    ].join("")
  );
}

function knightPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      face(p),
      // helmet covering top of head
      `<path d="M 19 24 Q 19 14 32 12 Q 45 14 45 24 L 45 27 L 41 27 L 41 22 L 23 22 L 23 27 L 19 27 Z" fill="${p.accent}"/>`,
      // helmet trim
      `<rect x="19" y="26" width="26" height="2" fill="${p.trim}"/>`,
      // visor cut-out (T-slot)
      `<rect x="26" y="22" width="12" height="3" fill="rgba(0,0,0,0.55)"/>`,
      // plume
      `<path d="M 32 12 Q 36 8 38 4 Q 32 6 32 12" fill="${p.trim}"/>`,
    ].join("")
  );
}

function healerPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p, p.accent),
      // hood frame around face
      `<path d="M 17 28 Q 18 12 32 10 Q 46 12 47 28 L 44 30 Q 44 16 32 14 Q 20 16 20 30 Z" fill="${p.accent}"/>`,
      `<path d="M 17 28 Q 18 12 32 10 Q 46 12 47 28" stroke="${p.trim}" stroke-width="1.5" fill="none"/>`,
      face(p),
      // small fringe of hair peeking out
      `<path d="M 24 22 Q 28 19 32 21 Q 36 19 40 22 L 40 24 L 36 23 L 32 24 L 28 23 L 24 24 Z" fill="${p.hair}"/>`,
    ].join("")
  );
}

function magePortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      face(p),
      // pointed hat / hood
      `<path d="M 32 4 L 18 24 L 46 24 Z" fill="${p.accent}"/>`,
      `<path d="M 32 4 L 28 12 L 36 12 Z" fill="${p.trim}" opacity="0.6"/>`,
      `<rect x="18" y="22" width="28" height="3" fill="${p.trim}"/>`,
      // hair fringe
      `<path d="M 22 24 Q 26 21 30 23 Q 34 21 38 23 L 38 25 L 34 24 L 30 24 L 26 24 L 22 25 Z" fill="${p.hair}"/>`,
    ].join("")
  );
}

function archerPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      // bow string across the chest
      `<path d="M 14 56 Q 32 50 50 56" stroke="${p.trim}" stroke-width="1" fill="none" opacity="0.8"/>`,
      face(p),
      // hair: tied back, short forelock
      `<path d="M 21 18 Q 24 11 32 10 Q 41 11 43 19 L 43 26 L 39 24 L 35 23 L 31 25 L 27 23 L 23 25 L 21 24 Z" fill="${p.hair}"/>`,
      // headband
      `<rect x="20" y="21" width="24" height="2" fill="${p.accent}"/>`,
    ].join("")
  );
}

function monkPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      face(p),
      // bald + small topknot
      `<path d="M 22 22 Q 24 16 32 14 Q 40 16 42 22 L 42 24 L 22 24 Z" fill="${p.skin}"/>`,
      // eyebrow lines (older look)
      `<path d="M 24 26 L 28 25" stroke="#3a2418" stroke-width="0.7"/>`,
      `<path d="M 36 25 L 40 26" stroke="#3a2418" stroke-width="0.7"/>`,
      // beard
      `<path d="M 26 36 Q 32 42 38 36 Q 38 40 32 41 Q 26 40 26 36 Z" fill="${p.hair}"/>`,
    ].join("")
  );
}

function ninjaPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      // mask fully covers face except eyes
      `<rect x="20" y="20" width="24" height="20" fill="${p.accent}"/>`,
      // headcloth top
      `<path d="M 18 22 Q 32 8 46 22 L 44 24 L 32 14 L 20 24 Z" fill="${p.accent}"/>`,
      // cloth tail
      `<path d="M 44 22 L 56 18 L 50 28 Z" fill="${p.accent}"/>`,
      // eye slit
      `<rect x="22" y="28" width="20" height="3" fill="${p.skin}"/>`,
      // glowing eyes
      `<rect x="26" y="29" width="3" height="2" fill="${p.eye}"/>`,
      `<rect x="35" y="29" width="3" height="2" fill="${p.eye}"/>`,
      // forehead band
      `<rect x="20" y="22" width="24" height="2" fill="${p.trim}"/>`,
    ].join("")
  );
}

function samuraiPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      face(p),
      // distinctive samurai topknot + receding hair
      `<path d="M 23 24 Q 23 18 32 18 Q 41 18 41 24 L 38 22 L 32 22 L 26 22 Z" fill="${p.hair}"/>`,
      // chonmage knot
      `<rect x="29" y="10" width="6" height="10" fill="${p.hair}"/>`,
      `<ellipse cx="32" cy="9" rx="4" ry="2.5" fill="${p.hair}"/>`,
      // mustache
      `<path d="M 27 33 Q 32 32 37 33" stroke="${p.hair}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
    ].join("")
  );
}

function warriorPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      face(p),
      // wild hair
      `<path d="M 19 22 Q 18 8 26 6 L 30 10 L 32 6 L 34 10 L 38 6 Q 46 8 45 22 L 41 18 L 36 22 L 32 18 L 28 22 L 23 18 Z" fill="${p.hair}"/>`,
      // beard
      `<path d="M 25 35 Q 32 42 39 35 Q 38 40 32 41 Q 26 40 25 35 Z" fill="${p.hair}"/>`,
    ].join("")
  );
}

function birdmanPortrait(p: Palette): string {
  return frame(
    p,
    [
      // wing peek behind shoulders
      `<path d="M 4 64 Q 10 52 18 56 L 12 64 Z" fill="${p.trim}"/>`,
      `<path d="M 60 64 Q 54 52 46 56 L 52 64 Z" fill="${p.trim}"/>`,
      shoulders(p),
      face(p),
      // feathered headcrest
      `<path d="M 20 22 Q 14 14 22 8 L 28 14 L 32 8 L 36 14 L 42 8 Q 50 14 44 22 L 40 18 L 32 14 L 24 18 Z" fill="${p.hair}"/>`,
      // small beak nose
      `<path d="M 31 30 L 33 30 L 32 32 Z" fill="${p.trim}"/>`,
    ].join("")
  );
}

function werewolfPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p, p.accent),
      // fur halo around the face
      `<path d="M 16 26 Q 14 14 32 8 Q 50 14 48 26 L 44 22 L 40 14 L 32 12 L 24 14 L 20 22 Z" fill="${p.hair}"/>`,
      // muzzle
      `<ellipse cx="32" cy="32" rx="9" ry="9" fill="${p.skin}"/>`,
      `<ellipse cx="32" cy="36" rx="2.5" ry="1.5" fill="#1a0e08"/>`,
      // ears
      `<path d="M 18 18 L 22 12 L 22 22 Z" fill="${p.hair}"/>`,
      `<path d="M 46 18 L 42 12 L 42 22 Z" fill="${p.hair}"/>`,
      // eyes (yellow / wolfish)
      `<ellipse cx="27" cy="28" rx="1.6" ry="2.4" fill="${p.eye}"/>`,
      `<ellipse cx="37" cy="28" rx="1.6" ry="2.4" fill="${p.eye}"/>`,
      // fangs
      `<path d="M 29 36 L 30 39 L 31 36 Z" fill="#fff"/>`,
      `<path d="M 33 36 L 34 39 L 35 36 Z" fill="#fff"/>`,
    ].join("")
  );
}

function dragonPortrait(p: Palette): string {
  return frame(
    p,
    [
      // body scales filling lower half
      `<path d="M 6 64 L 6 44 Q 32 36 58 44 L 58 64 Z" fill="${p.accent}"/>`,
      `<path d="M 14 50 L 18 54 L 22 50 L 26 54 L 30 50 L 34 54 L 38 50 L 42 54 L 46 50 L 50 54" stroke="${p.trim}" stroke-width="1" fill="none"/>`,
      // dragon snout
      `<ellipse cx="32" cy="30" rx="14" ry="13" fill="${p.accent}"/>`,
      `<ellipse cx="32" cy="36" rx="10" ry="6" fill="${p.trim}"/>`,
      // nostrils
      `<circle cx="29" cy="36" r="0.8" fill="#000"/>`,
      `<circle cx="35" cy="36" r="0.8" fill="#000"/>`,
      // brow ridge
      `<path d="M 20 24 Q 32 20 44 24" stroke="${p.trim}" stroke-width="1.5" fill="none"/>`,
      // eyes glowing
      `<ellipse cx="26" cy="27" rx="1.8" ry="1.2" fill="${p.eye}"/>`,
      `<ellipse cx="38" cy="27" rx="1.8" ry="1.2" fill="${p.eye}"/>`,
      // horns
      `<path d="M 18 18 L 14 8 L 22 16 Z" fill="${p.trim}"/>`,
      `<path d="M 46 18 L 50 8 L 42 16 Z" fill="${p.trim}"/>`,
    ].join("")
  );
}

function robotPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      // antenna
      `<rect x="31" y="4" width="2" height="6" fill="${p.trim}"/>`,
      `<circle cx="32" cy="4" r="1.5" fill="${p.eye}"/>`,
      // head box
      `<rect x="20" y="12" width="24" height="22" fill="${p.accent}" stroke="${p.trim}" stroke-width="1"/>`,
      // visor
      `<rect x="22" y="20" width="20" height="6" fill="#0a0e14"/>`,
      `<rect x="24" y="22" width="4" height="2" fill="${p.eye}"/>`,
      `<rect x="36" y="22" width="4" height="2" fill="${p.eye}"/>`,
      // bolts
      `<circle cx="22" cy="14" r="1" fill="${p.trim}"/>`,
      `<circle cx="42" cy="14" r="1" fill="${p.trim}"/>`,
      `<circle cx="22" cy="32" r="1" fill="${p.trim}"/>`,
      `<circle cx="42" cy="32" r="1" fill="${p.trim}"/>`,
      // mouth grille
      `<rect x="26" y="29" width="12" height="2" fill="#0a0e14"/>`,
    ].join("")
  );
}

function magicCreaturePortrait(p: Palette): string {
  return frame(
    p,
    [
      // floating glow halo
      `<circle cx="32" cy="32" r="22" fill="${p.accent}" opacity="0.25"/>`,
      `<circle cx="32" cy="32" r="14" fill="${p.accent}" opacity="0.45"/>`,
      // central blob
      `<ellipse cx="32" cy="32" rx="11" ry="13" fill="${p.accent}"/>`,
      `<ellipse cx="32" cy="28" rx="6" ry="4" fill="${p.trim}" opacity="0.7"/>`,
      // big single eye
      `<circle cx="32" cy="32" r="4" fill="#fff"/>`,
      `<circle cx="32" cy="32" r="2.5" fill="${p.eye}"/>`,
      `<circle cx="32" cy="31" r="0.8" fill="#fff"/>`,
      // tendrils
      `<path d="M 22 44 Q 18 50 22 56" stroke="${p.accent}" stroke-width="2" fill="none"/>`,
      `<path d="M 42 44 Q 46 50 42 56" stroke="${p.accent}" stroke-width="2" fill="none"/>`,
    ].join("")
  );
}

function yogurtPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      // tiny round body
      `<ellipse cx="32" cy="34" rx="14" ry="12" fill="${p.accent}"/>`,
      // big round eyes
      `<circle cx="27" cy="32" r="3" fill="#fff"/>`,
      `<circle cx="37" cy="32" r="3" fill="#fff"/>`,
      `<circle cx="27" cy="32.5" r="1.8" fill="#1a1a1a"/>`,
      `<circle cx="37" cy="32.5" r="1.8" fill="#1a1a1a"/>`,
      // mouth
      `<path d="M 28 38 Q 32 41 36 38" stroke="#1a1a1a" stroke-width="1" fill="none"/>`,
      // sparkle
      `<text x="48" y="20" font-family="monospace" font-size="10" fill="#ffe14a">★</text>`,
    ].join("")
  );
}

// --- enemy archetypes -------------------------------------------------

function goblinPortrait(p: Palette): string {
  return frame(
    p,
    [
      // hide-vest shoulders
      `<path d="M 6 64 L 6 50 Q 12 44 22 42 L 32 44 L 42 42 Q 52 44 58 50 L 58 64 Z" fill="${p.accent}"/>`,
      // green-skinned face (uses skin color)
      `<ellipse cx="32" cy="28" rx="11" ry="12" fill="${p.skin}"/>`,
      // pointed ears
      `<path d="M 19 26 L 14 22 L 22 28 Z" fill="${p.skin}"/>`,
      `<path d="M 45 26 L 50 22 L 42 28 Z" fill="${p.skin}"/>`,
      // angry brow
      `<path d="M 24 24 L 30 25" stroke="#1a1a0e" stroke-width="1.2"/>`,
      `<path d="M 34 25 L 40 24" stroke="#1a1a0e" stroke-width="1.2"/>`,
      // beady eyes
      `<circle cx="27" cy="28" r="1.4" fill="${p.eye}"/>`,
      `<circle cx="37" cy="28" r="1.4" fill="${p.eye}"/>`,
      // wide grin + tusks
      `<path d="M 26 33 Q 32 38 38 33 L 36 36 L 32 37 L 28 36 Z" fill="#1a1a0e"/>`,
      `<path d="M 28 34 L 28 36 L 30 35 Z" fill="#fff"/>`,
      `<path d="M 36 34 L 36 36 L 34 35 Z" fill="#fff"/>`,
      // wild hair tufts
      `<path d="M 22 18 L 24 14 L 26 18 L 28 14 L 30 18 L 32 14 L 34 18 L 36 14 L 38 18 L 40 14 L 42 18" stroke="${p.hair}" stroke-width="1.5" fill="none"/>`,
    ].join("")
  );
}

function darkDwarfPortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      // thick beard taking lower half
      `<path d="M 16 38 Q 16 56 32 60 Q 48 56 48 38 L 44 36 L 32 38 L 20 36 Z" fill="${p.hair}"/>`,
      // braid lines
      `<path d="M 24 44 L 24 56" stroke="${p.trim}" stroke-width="0.8"/>`,
      `<path d="M 40 44 L 40 56" stroke="${p.trim}" stroke-width="0.8"/>`,
      // head with helmet
      `<ellipse cx="32" cy="26" rx="11" ry="12" fill="${p.skin}"/>`,
      `<path d="M 19 22 Q 19 12 32 10 Q 45 12 45 22 L 45 26 L 19 26 Z" fill="${p.accent}"/>`,
      `<rect x="19" y="24" width="26" height="2" fill="${p.trim}"/>`,
      // angry brows
      `<path d="M 24 27 L 30 28" stroke="#1a1208" stroke-width="1.4"/>`,
      `<path d="M 34 28 L 40 27" stroke="#1a1208" stroke-width="1.4"/>`,
      // eyes
      `<circle cx="27" cy="30" r="1.3" fill="${p.eye}"/>`,
      `<circle cx="37" cy="30" r="1.3" fill="${p.eye}"/>`,
      // helmet horns
      `<path d="M 18 18 L 12 12 L 22 16 Z" fill="${p.trim}"/>`,
      `<path d="M 46 18 L 52 12 L 42 16 Z" fill="${p.trim}"/>`,
    ].join("")
  );
}

function skeletonPortrait(p: Palette): string {
  return frame(
    p,
    [
      // skeletal shoulders -- bone-colored
      `<path d="M 6 64 L 6 50 Q 12 44 22 42 L 32 44 L 42 42 Q 52 44 58 50 L 58 64 Z" fill="${p.accent}"/>`,
      // ribcage hint
      `<path d="M 24 50 L 40 50 M 24 54 L 40 54 M 24 58 L 40 58" stroke="${p.trim}" stroke-width="0.6"/>`,
      // skull
      `<ellipse cx="32" cy="26" rx="12" ry="13" fill="${p.skin}"/>`,
      // jaw
      `<path d="M 24 32 Q 32 42 40 32 L 40 36 Q 32 40 24 36 Z" fill="${p.skin}"/>`,
      // jaw teeth
      `<path d="M 26 36 L 38 36" stroke="#1a1108" stroke-width="0.6"/>`,
      `<path d="M 28 35 L 28 37 M 30 35 L 30 37 M 32 35 L 32 37 M 34 35 L 34 37 M 36 35 L 36 37" stroke="#1a1108" stroke-width="0.5"/>`,
      // big black eye sockets
      `<ellipse cx="27" cy="27" rx="3" ry="3.5" fill="#0a0a08"/>`,
      `<ellipse cx="37" cy="27" rx="3" ry="3.5" fill="#0a0a08"/>`,
      `<ellipse cx="27" cy="27" rx="1.2" ry="1.2" fill="${p.eye}"/>`,
      `<ellipse cx="37" cy="27" rx="1.2" ry="1.2" fill="${p.eye}"/>`,
      // nasal cavity
      `<path d="M 31 30 L 33 30 L 32 33 Z" fill="#0a0a08"/>`,
    ].join("")
  );
}

function darkMagePortrait(p: Palette): string {
  return frame(
    p,
    [
      shoulders(p),
      // hooded shadow over face
      `<path d="M 17 28 Q 18 6 32 4 Q 46 6 47 28 L 44 32 Q 44 12 32 10 Q 20 12 20 32 Z" fill="${p.accent}"/>`,
      // shadowed face
      `<ellipse cx="32" cy="28" rx="10" ry="11" fill="rgba(20,12,18,0.75)"/>`,
      // glowing eyes
      `<ellipse cx="27" cy="29" rx="2" ry="1.2" fill="${p.eye}"/>`,
      `<ellipse cx="37" cy="29" rx="2" ry="1.2" fill="${p.eye}"/>`,
      // wicked grin
      `<path d="M 28 34 Q 32 36 36 34" stroke="#a02828" stroke-width="0.8" fill="none"/>`,
    ].join("")
  );
}

function generic(p: Palette, label: string): string {
  return frame(
    p,
    [
      shoulders(p),
      face(p),
      `<path d="M 22 22 Q 24 14 32 12 Q 40 14 42 22 L 38 22 L 32 22 L 26 22 Z" fill="${p.hair}"/>`,
      `<text x="32" y="56" font-family="monospace" font-size="10" fill="#fff" text-anchor="middle" opacity="0.6">${escapeHtml(label.slice(0, 6))}</text>`,
    ].join("")
  );
}

// --- per-id and per-class palette + archetype mapping -----------------

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Pick an archetype function from a class id (with sensible fallbacks).
type ArchetypeFn = (p: Palette) => string;
const CLASS_TO_ARCHETYPE: Record<string, ArchetypeFn> = {
  swordsman: heroPortrait,
  hero: heroPortrait,
  knight: knightPortrait,
  paladin: knightPortrait,
  warrior: warriorPortrait,
  gladiator: warriorPortrait,
  archer: archerPortrait,
  bowmaster: archerPortrait,
  healer: healerPortrait,
  vicar: healerPortrait,
  mage: magePortrait,
  wizard: magePortrait,
  monk: monkPortrait,
  master_monk: monkPortrait,
  ninja: ninjaPortrait,
  great_ninja: ninjaPortrait,
  samurai: samuraiPortrait,
  great_samurai: samuraiPortrait,
  birdman: birdmanPortrait,
  sky_warrior: birdmanPortrait,
  werewolf: werewolfPortrait,
  wolf_baron: werewolfPortrait,
  dragon: dragonPortrait,
  great_dragon: dragonPortrait,
  wing_knight: knightPortrait,
  sky_lord: knightPortrait,
  steam_knight: robotPortrait,
  steam_baron: robotPortrait,
  assault_knight: archerPortrait,
  strike_knight: archerPortrait,
  robot: robotPortrait,
  cyborg: robotPortrait,
  magic_creature: magicCreaturePortrait,
  yogurt: yogurtPortrait,
};

// Per-character / per-enemy palette overrides. Anything not listed falls
// back to a class default below.
const CHARACTER_PALETTES: Record<string, Palette> = {
  // === Players ===
  max: { skin: SKIN.light, hair: HAIR.blond, accent: ACCENT.hero, trim: "#d4b14a", eye: "#3a78c0" },
  lowe: { skin: SKIN.light, hair: HAIR.blue, accent: ACCENT.healer, trim: "#a89a78", eye: "#2c80c0" },
  ken: { skin: SKIN.light, hair: HAIR.brown, accent: ACCENT.knight, trim: "#7080a0", eye: "#4a3020" },
  luke: { skin: SKIN.tan, hair: HAIR.orange, accent: ACCENT.warrior, trim: "#3a2418", eye: "#7a4a20" },
  tao: { skin: SKIN.light, hair: HAIR.pink, accent: ACCENT.mage, trim: "#601820", eye: "#a83898" },
  hans: { skin: SKIN.light, hair: HAIR.blond, accent: ACCENT.archer, trim: "#a08038", eye: "#5a8030" },
  khris: { skin: SKIN.pale, hair: HAIR.blond, accent: ACCENT.healer, trim: "#c0a060", eye: "#3aa0c0" },
  gort: { skin: SKIN.tan, hair: HAIR.red, accent: ACCENT.warrior, trim: "#3a1818", eye: "#9c4828" },
  mae: { skin: SKIN.light, hair: HAIR.purple, accent: ACCENT.knight, trim: "#a878d0", eye: "#7048a0" },
  anri: { skin: SKIN.pale, hair: HAIR.blue, accent: ACCENT.mage, trim: "#702030", eye: "#3858b0" },
  gong: { skin: SKIN.tan, hair: HAIR.white, accent: ACCENT.monk, trim: "#a06030", eye: "#3a2018" },
  arthur: { skin: SKIN.light, hair: HAIR.silver, accent: ACCENT.knight, trim: "#80a0c0", eye: "#3a78a0" },
  balbaroy: { skin: SKIN.light, hair: HAIR.brown, accent: ACCENT.birdman, trim: "#80a0c0", eye: "#3878a0" },
  amon: { skin: SKIN.pale, hair: HAIR.blond, accent: ACCENT.birdman, trim: "#a8b8c8", eye: "#5a98c8" },
  diane: { skin: SKIN.light, hair: HAIR.green, accent: ACCENT.archer, trim: "#a08038", eye: "#5a9c40" },
  zylo: { skin: "#3a2820", hair: "#704830", accent: ACCENT.werewolf, trim: "#5a4030", eye: "#f0c038" },
  pelle: { skin: SKIN.light, hair: HAIR.silver, accent: ACCENT.knight, trim: "#90a0c0", eye: "#4878a0" },
  kokichi: { skin: SKIN.pale, hair: HAIR.brown, accent: ACCENT.wing_knight, trim: "#8a5828", eye: "#6a4828" },
  jogurt: { skin: SKIN.light, hair: HAIR.brown, accent: ACCENT.yogurt, trim: "#8a6838", eye: "#3a2018" },
  vankar: { skin: SKIN.tan, hair: HAIR.black, accent: ACCENT.knight, trim: "#7080a0", eye: "#3a2818" },
  earnest: { skin: SKIN.light, hair: HAIR.black, accent: ACCENT.knight, trim: "#7080a0", eye: "#3a2818" },
  guntz: { skin: SKIN.tan, hair: HAIR.black, accent: ACCENT.steam_knight, trim: "#7a5028", eye: "#3a2818" },
  domingo: { skin: "#a8d0f0", hair: HAIR.white, accent: ACCENT.magic_creature, trim: "#9888d8", eye: "#3098f0" },
  lyle: { skin: SKIN.tan, hair: HAIR.green, accent: ACCENT.assault_knight, trim: "#80a050", eye: "#5a9050" },
  bleu: { skin: "#5ab880", hair: "#4aa078", accent: ACCENT.dragon, trim: "#80d0a0", eye: "#f0c038" },
  musashi: { skin: SKIN.tan, hair: HAIR.black, accent: ACCENT.samurai, trim: "#d4a040", eye: "#3a2818" },
  adam: { skin: "#a8a8b8", hair: "#a8a8b8", accent: ACCENT.robot, trim: "#5070a0", eye: "#80f0ff" },
  hanzou: { skin: SKIN.light, hair: HAIR.black, accent: ACCENT.ninja, trim: "#a82828", eye: "#f04030" },
  torasu: { skin: SKIN.light, hair: HAIR.white, accent: ACCENT.vicar, trim: "#c0a060", eye: "#5060a0" },
  alef: { skin: SKIN.pale, hair: HAIR.purple, accent: ACCENT.wizard, trim: "#a878d0", eye: "#a040d0" },

  // === Enemies ===
  goblin: { skin: SKIN.green, hair: HAIR.black, accent: ACCENT.goblin, trim: "#3a4a20", eye: "#f0c038" },
  dark_dwarf: { skin: "#a87850", hair: "#3a1818", accent: ACCENT.dark_dwarf, trim: "#3a2010", eye: "#a83020" },
  rune_knight: { skin: SKIN.tan, hair: HAIR.black, accent: ACCENT.rune_knight, trim: "#3a1818", eye: "#a83020" },
  dark_elf: { skin: "#5a4060", hair: HAIR.silver, accent: ACCENT.dark_elf, trim: "#7858a0", eye: "#a04880" },
  silver_knight: { skin: SKIN.pale, hair: HAIR.silver, accent: "#a8a8c0", trim: "#5060a0", eye: "#5078a0" },
  giant_bat: { skin: "#3a2030", hair: "#5a3040", accent: "#3a1828", trim: "#7a3050", eye: "#f04060" },
  dark_mage: { skin: SKIN.pale, hair: HAIR.purple, accent: ACCENT.dark_mage, trim: "#5b34a8", eye: "#a040d0" },
  zombie: { skin: "#7a8a5a", hair: "#3a3a18", accent: "#4a3a2a", trim: "#3a2818", eye: "#f0d038" },
  skeleton: { skin: SKIN.bone, hair: "#a89a78", accent: "#5a5040", trim: "#3a2818", eye: "#f04020" },
  ghoul_boss: { skin: "#7a8a5a", hair: "#3a1818", accent: "#3a2818", trim: "#1a0a08", eye: "#f04020" },
  lizardman: { skin: "#3a8848", hair: "#205a30", accent: "#5a3818", trim: "#a87038", eye: "#f0c038" },
  dark_priest: { skin: SKIN.pale, hair: HAIR.black, accent: "#3a1828", trim: "#a8208a", eye: "#a040d0" },
  pegasus_knight: { skin: SKIN.light, hair: HAIR.silver, accent: "#404858", trim: "#a8a8c0", eye: "#3878a0" },
  hellhound: { skin: "#3a1818", hair: "#5a2818", accent: ACCENT.hellhound, trim: "#1a0808", eye: "#f04020" },
  master_mage_boss: { skin: SKIN.pale, hair: HAIR.purple, accent: "#5a1830", trim: "#c038a0", eye: "#f040c0" },
  artillery: { skin: SKIN.tan, hair: HAIR.brown, accent: "#5a4838", trim: "#3a2818", eye: "#a87038" },
  sniper: { skin: SKIN.light, hair: HAIR.black, accent: "#3a1818", trim: "#a87038", eye: "#a83830" },
  bowrider: { skin: SKIN.tan, hair: HAIR.red, accent: "#5a3a18", trim: "#a87038", eye: "#a83830" },
  mannequin: { skin: SKIN.bone, hair: HAIR.red, accent: "#a83a3a", trim: "#3a1818", eye: "#1a0a08" },
  dire_clown: { skin: SKIN.pale, hair: HAIR.red, accent: "#4a3a78", trim: "#a83838", eye: "#a83830" },
  evil_puppet: { skin: SKIN.bone, hair: HAIR.purple, accent: "#5a3848", trim: "#3a1828", eye: "#f04060" },
  elliot_boss: { skin: SKIN.tan, hair: HAIR.red, accent: "#a83838", trim: "#d4a040", eye: "#a04020" },
  seabat: { skin: "#406088", hair: "#5078a0", accent: "#304868", trim: "#5078a0", eye: "#f0a040" },
  conch: { skin: "#a87858", hair: "#5a3818", accent: "#3a2010", trim: "#a06038", eye: "#f0c038" },
  shellfish: { skin: "#a87858", hair: "#5a3818", accent: "#3a2010", trim: "#a06038", eye: "#f0c038" },
  worm: { skin: "#a86040", hair: "#5a3010", accent: "#3a1808", trim: "#a06030", eye: "#f04030" },
  gargoyle: { skin: "#404058", hair: "#5a5078", accent: "#202830", trim: "#7868a0", eye: "#f04060" },
  balbazak_boss: { skin: SKIN.tan, hair: HAIR.black, accent: "#3a2818", trim: "#a83030", eye: "#a04020" },
  marionette_boss: { skin: SKIN.bone, hair: HAIR.purple, accent: "#5a3848", trim: "#3a1828", eye: "#f04060" },
  golem: { skin: "#807060", hair: "#3a2818", accent: "#5a4838", trim: "#7a6850", eye: "#f0c038" },
  high_priest: { skin: SKIN.pale, hair: HAIR.white, accent: "#5a3828", trim: "#a83838", eye: "#a040d0" },
  belial: { skin: "#3a1828", hair: "#5a1830", accent: "#3a0818", trim: "#a83048", eye: "#f04060" },
  minotaur: { skin: "#5a3828", hair: "#3a1808", accent: "#3a1808", trim: "#a04020", eye: "#f04020" },
  ice_worm: { skin: "#a8c8e0", hair: "#7898c0", accent: "#306080", trim: "#a8d0f0", eye: "#80c0f0" },
  wyvern: { skin: "#3a4878", hair: "#506a98", accent: ACCENT.dragon_enemy, trim: "#506a98", eye: "#f04020" },
  horseman: { skin: SKIN.tan, hair: HAIR.black, accent: "#5a3030", trim: "#a83030", eye: "#a04020" },
  cerberus: { skin: "#3a1818", hair: "#5a1818", accent: "#3a0808", trim: "#a83020", eye: "#f04020" },
  demon_master: { skin: "#a85878", hair: HAIR.purple, accent: "#3a1830", trim: "#a83898", eye: "#f040c0" },
  durahan: { skin: "#a8a8c0", hair: HAIR.black, accent: "#404858", trim: "#a8a8c0", eye: "#f04020" },
  armed_skeleton: { skin: SKIN.bone, hair: "#a89a78", accent: "#5a3030", trim: "#3a1818", eye: "#f04020" },
  laser_eye: { skin: "#a83838", hair: "#3a0808", accent: ACCENT.demon, trim: "#3a0818", eye: "#f0f040" },
  torch_eye: { skin: "#a83838", hair: "#3a0808", accent: "#a83838", trim: "#5a1818", eye: "#f0c040" },
  mishaela_boss: { skin: SKIN.pale, hair: HAIR.red, accent: "#5a1830", trim: "#a83898", eye: "#f04060" },
  jet: { skin: "#506098", hair: "#7080b8", accent: "#304060", trim: "#506098", eye: "#f04060" },
  steel_claw: { skin: "#a8a8a8", hair: "#606060", accent: "#404040", trim: "#808080", eye: "#f04060" },
  blue_dragon: { skin: "#3a4878", hair: "#506a98", accent: "#3a4878", trim: "#7090c0", eye: "#f0c038" },
  chimera: { skin: "#a83838", hair: "#5a1818", accent: "#7a2828", trim: "#a04020", eye: "#f0c038" },
  chaos_boss: { skin: "#a02828", hair: "#5a0808", accent: ACCENT.demon, trim: "#3a0808", eye: "#f0c038" },
  colossus_boss: { skin: "#807060", hair: "#3a2818", accent: "#5a4838", trim: "#a06030", eye: "#f0c038" },
  kane_boss: { skin: SKIN.tan, hair: HAIR.silver, accent: "#202830", trim: "#a83030", eye: "#f04020" },
  ramladu_boss: { skin: SKIN.light, hair: HAIR.black, accent: "#404858", trim: "#d4a040", eye: "#a83830" },
  darksol_boss: { skin: "#a85878", hair: HAIR.purple, accent: "#1a0818", trim: "#a83898", eye: "#f040c0" },
  dark_dragon_side: { skin: "#3a3878", hair: "#5040a0", accent: "#1a1840", trim: "#5040a0", eye: "#f04020" },
  dark_dragon_main: { skin: "#5a1830", hair: "#3a0818", accent: "#1a0818", trim: "#a83048", eye: "#f04020" },
};

// Class default palettes (used when no character-specific entry exists).
const CLASS_PALETTES: Record<string, Palette> = {
  knight: { skin: SKIN.light, hair: HAIR.brown, accent: ACCENT.knight, trim: "#7080a0", eye: "#3a2818" },
  paladin: { skin: SKIN.light, hair: HAIR.silver, accent: ACCENT.paladin, trim: "#80a0c0", eye: "#4878a0" },
  warrior: { skin: SKIN.tan, hair: HAIR.brown, accent: ACCENT.warrior, trim: "#3a1818", eye: "#7a4828" },
  archer: { skin: SKIN.light, hair: HAIR.green, accent: ACCENT.archer, trim: "#a08038", eye: "#5a9c40" },
  healer: { skin: SKIN.pale, hair: HAIR.blond, accent: ACCENT.healer, trim: "#c0a060", eye: "#3a78a0" },
  mage: { skin: SKIN.pale, hair: HAIR.purple, accent: ACCENT.mage, trim: "#702030", eye: "#a040d0" },
  monk: { skin: SKIN.tan, hair: HAIR.white, accent: ACCENT.monk, trim: "#a06030", eye: "#3a2018" },
  ninja: { skin: SKIN.light, hair: HAIR.black, accent: ACCENT.ninja, trim: "#a82828", eye: "#f04030" },
  samurai: { skin: SKIN.tan, hair: HAIR.black, accent: ACCENT.samurai, trim: "#d4a040", eye: "#3a2818" },
  birdman: { skin: SKIN.light, hair: HAIR.brown, accent: ACCENT.birdman, trim: "#80a0c0", eye: "#3878a0" },
  werewolf: { skin: "#3a2820", hair: "#704830", accent: ACCENT.werewolf, trim: "#5a4030", eye: "#f0c038" },
  dragon: { skin: "#5ab880", hair: "#4aa078", accent: ACCENT.dragon, trim: "#80d0a0", eye: "#f0c038" },
  wing_knight: { skin: SKIN.pale, hair: HAIR.brown, accent: ACCENT.wing_knight, trim: "#8a5828", eye: "#6a4828" },
  steam_knight: { skin: SKIN.tan, hair: HAIR.black, accent: ACCENT.steam_knight, trim: "#7a5028", eye: "#3a2818" },
  assault_knight: { skin: SKIN.tan, hair: HAIR.green, accent: ACCENT.assault_knight, trim: "#80a050", eye: "#5a9050" },
  robot: { skin: "#a8a8b8", hair: "#a8a8b8", accent: ACCENT.robot, trim: "#5070a0", eye: "#80f0ff" },
  magic_creature: { skin: "#a8d0f0", hair: HAIR.white, accent: ACCENT.magic_creature, trim: "#9888d8", eye: "#3098f0" },
};

// Fallback palette for completely unknown units.
const DEFAULT_PALETTE: Palette = {
  skin: SKIN.light,
  hair: HAIR.brown,
  accent: "#5a5060",
  trim: "#80707a",
  eye: "#3a2818",
};

// --- enemy archetype mapping (id-based since enemy classes overlap a lot) ---

const ENEMY_ARCHETYPE_BY_ID: Record<string, ArchetypeFn> = {
  goblin: goblinPortrait,
  dark_dwarf: darkDwarfPortrait,
  rune_knight: knightPortrait,
  dark_elf: archerPortrait,
  silver_knight: knightPortrait,
  giant_bat: birdmanPortrait,
  dark_mage: darkMagePortrait,
  zombie: skeletonPortrait,
  skeleton: skeletonPortrait,
  ghoul_boss: skeletonPortrait,
  lizardman: dragonPortrait,
  dark_priest: darkMagePortrait,
  pegasus_knight: knightPortrait,
  hellhound: werewolfPortrait,
  master_mage_boss: darkMagePortrait,
  artillery: warriorPortrait,
  sniper: archerPortrait,
  bowrider: archerPortrait,
  mannequin: yogurtPortrait,
  dire_clown: warriorPortrait,
  evil_puppet: yogurtPortrait,
  elliot_boss: heroPortrait,
  seabat: birdmanPortrait,
  conch: magicCreaturePortrait,
  shellfish: magicCreaturePortrait,
  worm: dragonPortrait,
  gargoyle: birdmanPortrait,
  balbazak_boss: warriorPortrait,
  marionette_boss: darkMagePortrait,
  golem: robotPortrait,
  high_priest: darkMagePortrait,
  belial: birdmanPortrait,
  minotaur: warriorPortrait,
  ice_worm: dragonPortrait,
  wyvern: dragonPortrait,
  horseman: knightPortrait,
  cerberus: werewolfPortrait,
  demon_master: darkMagePortrait,
  durahan: knightPortrait,
  armed_skeleton: skeletonPortrait,
  laser_eye: magicCreaturePortrait,
  torch_eye: magicCreaturePortrait,
  mishaela_boss: darkMagePortrait,
  jet: birdmanPortrait,
  steel_claw: robotPortrait,
  blue_dragon: dragonPortrait,
  chimera: dragonPortrait,
  chaos_boss: magicCreaturePortrait,
  colossus_boss: robotPortrait,
  kane_boss: heroPortrait,
  ramladu_boss: knightPortrait,
  darksol_boss: darkMagePortrait,
  dark_dragon_side: dragonPortrait,
  dark_dragon_main: dragonPortrait,
};

// --- public API -------------------------------------------------------

// Anything that has at minimum an id + class string. Character templates
// satisfy this directly; UnitInstance callers should pass unit.template.
export interface PortraitSubject {
  id: string;
  class: string;
  name?: string;
}

export function portraitSvgFor(subject: PortraitSubject): string {
  const palette =
    CHARACTER_PALETTES[subject.id] ?? CLASS_PALETTES[subject.class] ?? DEFAULT_PALETTE;

  const archetype =
    ENEMY_ARCHETYPE_BY_ID[subject.id] ??
    CLASS_TO_ARCHETYPE[subject.class] ??
    ((p: Palette) => generic(p, subject.name ?? subject.id));

  return archetype(palette);
}

// Preload a portrait into a Phaser scene's texture cache so it can be used
// as an image sprite on battle tiles. Returns a promise that resolves once
// the texture is registered.
export function preloadPortraitTexture(
  scene: Phaser.Scene,
  textureKey: string,
  svgString: string
): Promise<void> {
  if (scene.textures.exists(textureKey)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        scene.textures.addImage(textureKey, img);
      } catch (e) {
        // already registered or other texture cache issue; ignore
      }
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}

export function portraitTextureKey(id: string): string {
  return `portrait_${id}`;
}
