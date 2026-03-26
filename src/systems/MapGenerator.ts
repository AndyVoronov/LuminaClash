/**
 * Procedural map generation with 4 templates:
 * - arena:  open field, scattered obstacles, central tower
 * - maze:   corridor-based with strategic openings
 * - fortress: defensive walls with choke points
 * - chaos:  random mix of all obstacle types
 */

import type { ObstacleSystem } from './ObstacleSystem';

export type MapTemplate = 'arena' | 'maze' | 'fortress' | 'chaos';

export interface PlacedObstacle {
  cx: number;
  cy: number;
  type: 'wall' | 'tower' | 'blinker' | 'mirror';
  mirrorDir?: number;
}

const MIRROR_DIRS = [0, 1, 2, 3] as const;

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Check that a cell is not near any spawn point (min 3 cell distance).
 */
function isNearSpawn(cx: number, cy: number, spawns: { x: number; y: number }[], minDist: number): boolean {
  for (const sp of spawns) {
    if (Math.abs(cx - sp.x) < minDist && Math.abs(cy - sp.y) < minDist) return true;
  }
  return false;
}

/**
 * Get all valid cells (not near spawn, not out of bounds).
 */
function validCells(mw: number, mh: number, spawns: { x: number; y: number }[], minDist: number): { cx: number; cy: number }[] {
  const cells: { cx: number; cy: number }[] = [];
  for (let y = 1; y < mh - 1; y++) {
    for (let x = 1; x < mw - 1; x++) {
      if (!isNearSpawn(x, y, spawns, minDist)) {
        cells.push({ cx: x, cy: y });
      }
    }
  }
  return cells;
}

// ── Template: Arena ──
// Open field, central tower, scattered walls/mirrors at edges
function generateArena(mw: number, mh: number, seed: number, spawns: { x: number; y: number }[]): PlacedObstacle[] {
  const rand = rng(seed);
  const mid = { x: Math.floor(mw / 2), y: Math.floor(mh / 2) };
  const obs: PlacedObstacle[] = [];

  // Central tower
  obs.push({ cx: mid.x, cy: mid.y, type: 'tower' });

  // 4 walls around center in diamond pattern
  const offsets = [[-3, 0], [3, 0], [0, -3], [0, 3]];
  for (const [dx, dy] of offsets) {
    const nx = mid.x + dx, ny = mid.y + dy;
    if (nx > 0 && nx < mw - 1 && ny > 0 && ny < mh - 1) {
      obs.push({ cx: nx, cy: ny, type: 'wall' });
    }
  }

  // Scattered walls in each quadrant (3-4 per quadrant)
  const quadrants = [
    { x0: 2, y0: 2, x1: mid.x - 2, y1: mid.y - 2 },
    { x0: mid.x + 2, y0: 2, x1: mw - 3, y1: mid.y - 2 },
    { x0: 2, y0: mid.y + 2, x1: mid.x - 2, y1: mh - 3 },
    { x0: mid.x + 2, y0: mid.y + 2, x1: mw - 3, y1: mh - 3 },
  ];
  for (const q of quadrants) {
    const count = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const cx = q.x0 + Math.floor(rand() * (q.x1 - q.x0));
      const cy = q.y0 + Math.floor(rand() * (q.y1 - q.y0));
      if (!isNearSpawn(cx, cy, spawns, 3)) {
        obs.push({ cx, cy, type: 'wall' });
      }
    }
  }

  // Mirrors on the flanks
  const mirrorPositions = shuffle(
    [
      { cx: Math.floor(mw * 0.15), cy: Math.floor(mh * 0.5) },
      { cx: Math.floor(mw * 0.85), cy: Math.floor(mh * 0.5) },
      { cx: Math.floor(mw * 0.5), cy: Math.floor(mh * 0.15) },
      { cx: Math.floor(mw * 0.5), cy: Math.floor(mh * 0.85) },
    ],
    rand,
  );
  for (let i = 0; i < 2; i++) {
    const mp = mirrorPositions[i];
    if (mp && !isNearSpawn(mp.cx, mp.cy, spawns, 3)) {
      obs.push({ cx: mp.cx, cy: mp.cy, type: 'mirror', mirrorDir: MIRROR_DIRS[i * 2] });
    }
  }

  return obs;
}

// ── Template: Maze ──
// Corridor-based layout with strategic openings
function generateMaze(mw: number, mh: number, seed: number, spawns: { x: number; y: number }[]): PlacedObstacle[] {
  const rand = rng(seed);
  const obs: PlacedObstacle[] = [];

  // Horizontal walls with gaps
  const hWalls = Math.floor(mh / 5);
  for (let i = 1; i <= hWalls; i++) {
    const y = Math.floor((mh / (hWalls + 1)) * i);
    // Create wall with 2 gaps
    const gap1 = 2 + Math.floor(rand() * (mw * 0.3));
    const gap2 = mw - 3 - Math.floor(rand() * (mw * 0.3));
    const gapWidth = 2 + Math.floor(rand() * 2);
    for (let x = 1; x < mw - 1; x++) {
      if ((x >= gap1 && x < gap1 + gapWidth) || (x >= gap2 && x < gap2 + gapWidth)) continue;
      if (!isNearSpawn(x, y, spawns, 2)) {
        obs.push({ cx: x, cy: y, type: 'wall' });
      }
    }
  }

  // Vertical walls with gaps (fewer, to create rooms)
  const vWalls = Math.floor(mw / 6);
  for (let i = 1; i <= vWalls; i++) {
    const x = Math.floor((mw / (vWalls + 1)) * i);
    const gapY = 2 + Math.floor(rand() * (mh - 4));
    for (let y = 1; y < mh - 1; y++) {
      if (y >= gapY && y < gapY + 3) continue;
      if (!isNearSpawn(x, y, spawns, 2)) {
        obs.push({ cx: x, cy: y, type: 'wall' });
      }
    }
  }

  // Mirrors at corridor intersections
  const cells = validCells(mw, mh, spawns, 3);
  const shuffled = shuffle(cells, rand);
  for (let i = 0; i < Math.min(2, shuffled.length); i++) {
    const c = shuffled[i];
    obs.push({ cx: c.cx, cy: c.cy, type: 'mirror', mirrorDir: MIRROR_DIRS[i % 4] });
  }

  // Blinkers guarding key passages
  for (let i = 2; i < Math.min(4, shuffled.length); i++) {
    const c = shuffled[i];
    obs.push({ cx: c.cx, cy: c.cy, type: 'blinker' });
  }

  return obs;
}

// ── Template: Fortress ──
// Defensive walls around spawn areas, central争夺 zone
function generateFortress(mw: number, mh: number, seed: number, spawns: { x: number; y: number }[]): PlacedObstacle[] {
  const rand = rng(seed);
  const mid = { x: Math.floor(mw / 2), y: Math.floor(mh / 2) };
  const obs: PlacedObstacle[] = [];

  // Central tower
  obs.push({ cx: mid.x, cy: mid.y, type: 'tower' });

  // Ring of walls around center
  const ringRadius = Math.min(mw, mh) * 0.18;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
    const cx = Math.round(mid.x + Math.cos(angle) * ringRadius);
    const cy = Math.round(mid.y + Math.sin(angle) * ringRadius);
    if (cx > 0 && cx < mw - 1 && cy > 0 && cy < mh - 1) {
      obs.push({ cx, cy, type: 'wall' });
    }
  }

  // Openings in the ring (4 cardinal directions)
  for (const dir of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
    const cx = mid.x + Math.round(dir.dx * ringRadius);
    const cy = mid.y + Math.round(dir.dy * ringRadius);
    // Remove wall at this position
    const idx = obs.findIndex(o => o.cx === cx && o.cy === cy && o.type === 'wall');
    if (idx !== -1) obs.splice(idx, 1);
  }

  // Small fortress walls near each spawn
  for (const sp of spawns) {
    const wallCount = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < wallCount; i++) {
      const angle = (Math.PI * 2 / wallCount) * i + rand() * 0.5;
      const dist = 3 + Math.floor(rand() * 2);
      const cx = Math.round(sp.x + Math.cos(angle) * dist);
      const cy = Math.round(sp.y + Math.sin(angle) * dist);
      if (cx > 0 && cx < mw - 1 && cy > 0 && cy < mh - 1 && !isNearSpawn(cx, cy, spawns, 2)) {
        obs.push({ cx, cy, type: 'wall' });
      }
    }
  }

  // Mirrors pointing toward center from flanks
  const mirrorSpots = [
    { cx: Math.floor(mw * 0.1), cy: mid.y, dir: 0 },
    { cx: Math.floor(mw * 0.9), cy: mid.y, dir: 2 },
    { cx: mid.x, cy: Math.floor(mh * 0.1), dir: 1 },
    { cx: mid.x, cy: Math.floor(mh * 0.9), dir: 3 },
  ];
  const picked = shuffle(mirrorSpots, rand).slice(0, 2);
  for (const m of picked) {
    if (!isNearSpawn(m.cx, m.cy, spawns, 3)) {
      obs.push({ cx: m.cx, cy: m.cy, type: 'mirror', mirrorDir: m.dir });
    }
  }

  // Blinkers at choke points (ring openings)
  for (const dir of [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }]) {
    const cx = mid.x + Math.round(dir.dx * (ringRadius + 2));
    const cy = mid.y + Math.round(dir.dy * (ringRadius + 2));
    if (cx > 0 && cx < mw - 1 && cy > 0 && cy < mh - 1) {
      obs.push({ cx, cy, type: 'blinker' });
    }
  }

  return obs;
}

// ── Template: Chaos ──
// Random mix of everything, clusters of obstacles
function generateChaos(mw: number, mh: number, seed: number, spawns: { x: number; y: number }[]): PlacedObstacle[] {
  const rand = rng(seed);
  const obs: PlacedObstacle[] = [];
  const cells = validCells(mw, mh, spawns, 3);
  const shuffled = shuffle(cells, rand);

  // 3-5 random clusters of walls
  const clusterCount = 3 + Math.floor(rand() * 3);
  for (let c = 0; c < clusterCount; c++) {
    const origin = shuffled[Math.floor(rand() * shuffled.length)];
    const size = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < size; i++) {
      const cx = origin.cx + Math.floor(rand() * 5) - 2;
      const cy = origin.cy + Math.floor(rand() * 5) - 2;
      if (cx > 0 && cx < mw - 1 && cy > 0 && cy < mh - 1 && !isNearSpawn(cx, cy, spawns, 3)) {
        obs.push({ cx, cy, type: 'wall' });
      }
    }
  }

  // Random towers (2-3)
  const towerCount = 2 + Math.floor(rand() * 2);
  let usedIdx = Math.min(clusterCount * 4, shuffled.length);
  for (let i = 0; i < towerCount && usedIdx < shuffled.length; i++) {
    const c = shuffled[usedIdx++];
    obs.push({ cx: c.cx, cy: c.cy, type: 'tower' });
  }

  // Random blinkers (2-4)
  const blinkerCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < blinkerCount && usedIdx < shuffled.length; i++) {
    const c = shuffled[usedIdx++];
    obs.push({ cx: c.cx, cy: c.cy, type: 'blinker' });
  }

  // Random mirrors (2-3)
  const mirrorCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < mirrorCount && usedIdx < shuffled.length; i++) {
    const c = shuffled[usedIdx++];
    obs.push({ cx: c.cx, cy: c.cy, type: 'mirror', mirrorDir: MIRROR_DIRS[Math.floor(rand() * 4)] });
  }

  return obs;
}

// ── Public API ──

const GENERATORS: Record<MapTemplate, (mw: number, mh: number, seed: number, spawns: { x: number; y: number }[]) => PlacedObstacle[]> = {
  arena: generateArena,
  maze: generateMaze,
  fortress: generateFortress,
  chaos: generateChaos,
};

export const MAP_TEMPLATE_LABELS: Record<MapTemplate, string> = {
  arena: 'Arena',
  maze: 'Maze',
  fortress: 'Fortress',
  chaos: 'Chaos',
};

export function generateMap(
  template: MapTemplate,
  mw: number,
  mh: number,
  seed: number,
  spawns: { x: number; y: number }[],
): PlacedObstacle[] {
  return GENERATORS[template](mw, mh, seed, spawns);
}

export function placeGeneratedMap(
  obstacleSystem: ObstacleSystem,
  obstacles: PlacedObstacle[],
): void {
  for (const o of obstacles) {
    obstacleSystem.place(o.cx, o.cy, 'system', o.type, o.mirrorDir);
  }
}
