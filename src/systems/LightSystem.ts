import { GridSystem } from '../systems/GridSystem';
import { CELL_STATE } from '../config';

export class LightSystem {
  private grid: GridSystem;
  private getObstacles: () => Set<string>;

  constructor(grid: GridSystem, getObstacles: () => Set<string>) {
    this.grid = grid;
    this.getObstacles = getObstacles;
  }

  /**
   * First pass: compute illuminated cells for a player (raycasting only, no claiming).
   */
  computeIllumination(
    sourceCX: number,
    sourceCY: number,
    radius: number,
    illuminatedCells: Set<string>,
  ): void {
    illuminatedCells.clear();
    const r = Math.ceil(radius);
    const srcX = Math.round(sourceCX);
    const srcY = Math.round(sourceCY);
    const obstacles = this.getObstacles();

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = srcX + dx;
        const cy = srcY + dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        const cell = this.grid.getCell(cx, cy);
        if (!cell) continue;
        if (this.grid.isBlocked(cx, cy, obstacles)) continue;
        if (!this.grid.hasLineOfSight(srcX, srcY, cx, cy, obstacles)) continue;

        illuminatedCells.add(`${cx},${cy}`);
      }
    }
  }

  /**
   * Second pass: claim territory for a player, respecting contested cells.
   */
  claimTerritory(
    playerId: string,
    sourceCX: number,
    sourceCY: number,
    radius: number,
    illuminatedCells: Set<string>,
    contestedCells: Set<string>,
    shieldedOwnerIds: Set<string> = new Set(),
  ): void {
    const r = Math.ceil(radius);
    const srcX = Math.round(sourceCX);
    const srcY = Math.round(sourceCY);
    const obstacles = this.getObstacles();

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = srcX + dx;
        const cy = srcY + dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        const cell = this.grid.getCell(cx, cy);
        if (!cell) continue;
        if (this.grid.isBlocked(cx, cy, obstacles)) continue;

        const key = `${cx},${cy}`;
        const isLit = illuminatedCells.has(key);
        const isContested = contestedCells.has(key);

        if (isLit && !isContested) {
          // ── Solely illuminated: claim territory ──
          if (cell.state === CELL_STATE.NEUTRAL || cell.state === CELL_STATE.DECAYING) {
            cell.ownerId = playerId;
            cell.progress = cell.state === CELL_STATE.DECAYING ? cell.progress : 0;
            cell.state = CELL_STATE.CLAIMING;
          } else if (cell.state === CELL_STATE.CLAIMING && cell.ownerId === playerId) {
            // Continue claiming
          } else if (cell.state === CELL_STATE.OWNED && cell.ownerId !== playerId) {
            // Overwrite enemy territory
            cell.ownerId = playerId;
            cell.progress = 0.3;
            cell.state = CELL_STATE.CLAIMING;
          }
          // else: OWNED by us — territory persists
        } else if (!isLit) {
          // ── IN SHADOW: erase territory ──
          // Shielded players' territory doesn't decay
          const isShielded = cell.ownerId ? shieldedOwnerIds.has(cell.ownerId) : false;
          if (!isShielded) {
            if (cell.state === CELL_STATE.OWNED || cell.state === CELL_STATE.CLAIMING) {
              cell.state = CELL_STATE.DECAYING;
            }
          }
        }
        // else: contested or lit-but-contested → do nothing (neutral zone)
      }
    }
  }
}
