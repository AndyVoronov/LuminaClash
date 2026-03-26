import Phaser from 'phaser';
import { CELL_SIZE, CELL_STATE, type CellState, PLAYER_COLORS } from '../config';

export class CellData {
  state: CellState = CELL_STATE.NEUTRAL;
  ownerId: string | null = null;
  progress: number = 0; // 0-1, used for claiming/decaying animation
  lastOwner: string | null = null;
}

export class GridSystem {
  private cells: CellData[][] = [];
  private graphics: Phaser.GameObjects.Graphics;
  width: number;
  height: number;

  constructor(
    private scene: Phaser.Scene,
    mapWidth: number,
    mapHeight: number,
    offsetX: number,
    offsetY: number,
  ) {
    this.width = mapWidth;
    this.height = mapHeight;

    for (let y = 0; y < mapHeight; y++) {
      this.cells[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        this.cells[y][x] = new CellData();
      }
    }

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(1);
  }

  getCell(cx: number, cy: number): CellData | null {
    if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) return null;
    return this.cells[cy][cx];
  }

  getCellAtWorld(wx: number, wy: number, offsetX: number, offsetY: number): CellData | null {
    const cx = Math.floor((wx - offsetX) / CELL_SIZE);
    const cy = Math.floor((wy - offsetY) / CELL_SIZE);
    return this.getCell(cx, cy);
  }

  getCellCoords(wx: number, wy: number, offsetX: number, offsetY: number): { cx: number; cy: number } {
    return {
      cx: Math.floor((wx - offsetX) / CELL_SIZE),
      cy: Math.floor((wy - offsetY) / CELL_SIZE),
    };
  }

  isBlocked(cx: number, cy: number, obstacles: Set<string>): boolean {
    return obstacles.has(`${cx},${cy}`);
  }

  /**
   * Line-of-sight check using DDA (Digital Differential Analyzer).
   * Returns true if there's a clear path from (x0,y0) to (x1,y1) on the grid.
   */
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number, obstacles: Set<string>): boolean {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (cx !== x1 || cy !== y1) {
      const e2 = 2 * err;

      // Step in X
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      // Step in Y
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }

      // Skip the start cell (light source cell)
      if (cx === x0 && cy === y0) continue;
      // Skip the target cell (we want to know if we can illuminate it)
      if (cx === x1 && cy === y1) break;

      if (this.isBlocked(cx, cy, obstacles)) {
        return false;
      }
    }

    return true;
  }

  update(delta: number): void {
    // Update cell states based on progress
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.state === CELL_STATE.CLAIMING && cell.ownerId) {
          cell.progress += delta / 300; // claimTime normalized
          if (cell.progress >= 1) {
            cell.progress = 1;
            cell.state = CELL_STATE.OWNED;
          }
        } else if (cell.state === CELL_STATE.DECAYING) {
          cell.progress -= delta / 500; // decayTime normalized
          if (cell.progress <= 0) {
            cell.progress = 0;
            cell.state = CELL_STATE.NEUTRAL;
            cell.ownerId = null;
            cell.lastOwner = null;
          }
        }
      }
    }
  }

  render(offsetX: number, offsetY: number, illuminatedCells: Map<string, Set<string>>): void {
    this.graphics.clear();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const px = offsetX + x * CELL_SIZE;
        const py = offsetY + y * CELL_SIZE;

        if (cell.state === CELL_STATE.NEUTRAL) {
          // Dark background with subtle grid
          this.graphics.fillStyle(0x12121a, 1);
          this.graphics.fillRect(px, py, CELL_SIZE, CELL_SIZE);
          this.graphics.lineStyle(1, 0x1a1a2e, 0.5);
          this.graphics.strokeRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
        } else {
          // Owned or transitioning cell
          const color = PLAYER_COLORS[cell.ownerId!] || 0x444444;
          const alpha = cell.state === CELL_STATE.CLAIMING
            ? 0.2 + cell.progress * 0.5
            : cell.state === CELL_STATE.DECAYING
              ? cell.progress * 0.7
              : 0.7;

          this.graphics.fillStyle(color, alpha);
          this.graphics.fillRect(px, py, CELL_SIZE, CELL_SIZE);

          // Grid line
          this.graphics.lineStyle(1, 0x000000, 0.2);
          this.graphics.strokeRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }

    // Render illumination overlay (soft glow)
    this.graphics.setBlendMode(Phaser.BlendModes.ADD);
    for (const [ownerId, cells] of illuminatedCells) {
      const color = PLAYER_COLORS[ownerId] || 0xffd700;
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      this.graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 0.08);
      for (const key of cells) {
        const [cx, cy] = key.split(',').map(Number);
        const px = offsetX + cx * CELL_SIZE;
        const py = offsetY + cy * CELL_SIZE;
        this.graphics.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      }
    }
    this.graphics.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  getStats(): Map<string, number> {
    const stats = new Map<string, number>();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.state === CELL_STATE.OWNED || cell.state === CELL_STATE.CLAIMING) {
          const count = stats.get(cell.ownerId!) || 0;
          stats.set(cell.ownerId!, count + 1);
        }
      }
    }
    return stats;
  }

  getTotalCells(): number {
    return this.width * this.height;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
