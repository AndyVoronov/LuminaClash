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
   * Process illumination for a player.
   *
   * Rules:
   * - Cells with line of sight to the light → get claimed (illuminated)
   * - Cells within radius but BLOCKED by obstacle → in shadow → if owned, start decaying
   * - Cells outside all light radii → keep their current state (no change)
   *
   * Territory is permanent. Only obstacle shadows erase it.
   */
  processLight(
    playerId: string,
    sourceCX: number,
    sourceCY: number,
    radius: number,
    illuminatedCells: Set<string>,
  ): void {
    illuminatedCells.clear();
    const grid = this.grid;
    const r = Math.ceil(radius);
    const srcX = Math.round(sourceCX);
    const srcY = Math.round(sourceCY);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = srcX + dx;
        const cy = srcY + dy;

        // Circular radius check
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        const cell = grid.getCell(cx, cy);
        if (!cell) continue;

        // Obstacle cell itself — skip
        if (grid.isBlocked(cx, cy, this.getObstacles())) continue;

        const key = `${cx},${cy}`;
        const hasLOS = grid.hasLineOfSight(srcX, srcY, cx, cy, this.getObstacles());

        if (hasLOS) {
          // ── ILLUMINATED: claim territory ──
          illuminatedCells.add(key);

          if (cell.state === CELL_STATE.NEUTRAL || cell.state === CELL_STATE.DECAYING) {
            cell.ownerId = playerId;
            cell.progress = cell.state === CELL_STATE.DECAYING ? cell.progress : 0;
            cell.state = CELL_STATE.CLAIMING;
          } else if (cell.state === CELL_STATE.CLAIMING && cell.ownerId === playerId) {
            // Continue claiming — progress updated in GridSystem.update()
          } else if (cell.state === CELL_STATE.OWNED && cell.ownerId !== playerId) {
            // Another player owns this cell — overwrite it
            cell.ownerId = playerId;
            cell.progress = 0.3;
            cell.state = CELL_STATE.CLAIMING;
          }
          // else: OWNED by us — do nothing, territory persists
        } else {
          // ── IN SHADOW (obstacle blocks line of sight) ──
          // If this cell is owned by anyone, start erasing it
          if (cell.state === CELL_STATE.OWNED || cell.state === CELL_STATE.CLAIMING) {
            cell.state = CELL_STATE.DECAYING;
            // progress decreases in GridSystem.update()
          }
          // DECAYING cells stay decaying — progress continues decreasing
          // NEUTRAL cells stay neutral — nothing to erase
        }
      }
    }
  }
}
