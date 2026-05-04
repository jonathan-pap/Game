// Grid coordinate helpers shared by movement, range checks, and rendering.

export interface Coord {
  x: number;
  y: number;
}

export const TILE_SIZE = 32;

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function tileToPixel(c: Coord): Coord {
  return { x: c.x * TILE_SIZE + TILE_SIZE / 2, y: c.y * TILE_SIZE + TILE_SIZE / 2 };
}

export function pixelToTile(p: Coord): Coord {
  return { x: Math.floor(p.x / TILE_SIZE), y: Math.floor(p.y / TILE_SIZE) };
}

export function inBounds(c: Coord, cols: number, rows: number): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows;
}
