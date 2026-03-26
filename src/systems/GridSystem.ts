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
  private bgGraphics: Phaser.GameObjects.Graphics;
  private cellGraphics: Phaser.GameObjects.Graphics;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private borderGraphics: Phaser.GameObjects.Graphics;
  width: number;
  height: number;

  // Optional callbacks for visual feedback
  onCellCaptured?: (worldX: number, worldY: number, ownerId: string) => void;
  onCellDecayed?: (worldX: number, worldY: number, lastOwnerId: string) => void;

  // Contested cells (illuminated by 2+ players)
  contestedCells: Set<string> = new Set();

  // Background star field
  private stars: { x: number; y: number; brightness: number; speed: number }[] = [];

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

    // Generate subtle background stars
    const totalPx = mapWidth * CELL_SIZE;
    const totalPy = mapHeight * CELL_SIZE;
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * totalPx,
        y: Math.random() * totalPy,
        brightness: 0.03 + Math.random() * 0.06,
        speed: 0.5 + Math.random() * 1.5,
      });
    }

    // Layers: bg → cells → borders → glow
    this.bgGraphics = scene.add.graphics();
    this.bgGraphics.setDepth(0);
    this.cellGraphics = scene.add.graphics();
    this.cellGraphics.setDepth(1);
    this.borderGraphics = scene.add.graphics();
    this.borderGraphics.setDepth(2);
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setDepth(3);

    // Render static background once
    this.renderBackground(offsetX, offsetY);
  }

  private renderBackground(offsetX: number, offsetY: number): void {
    const w = this.width * CELL_SIZE;
    const h = this.height * CELL_SIZE;

    // Base fill
    this.bgGraphics.fillStyle(0x08080e, 1);
    this.bgGraphics.fillRect(offsetX, offsetY, w, h);

    // Subtle noise pattern — random dim dots
    for (let i = 0; i < 200; i++) {
      const nx = offsetX + Math.random() * w;
      const ny = offsetY + Math.random() * h;
      this.bgGraphics.fillStyle(0x161625, 0.3 + Math.random() * 0.3);
      this.bgGraphics.fillRect(Math.floor(nx), Math.floor(ny), 1, 1);
    }
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
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
      if (cx === x0 && cy === y0) continue;
      if (cx === x1 && cy === y1) break;
      if (this.isBlocked(cx, cy, obstacles)) return false;
    }
    return true;
  }

  update(delta: number): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.state === CELL_STATE.CLAIMING && cell.ownerId) {
          cell.progress += delta / 300;
          if (cell.progress >= 1) {
            cell.progress = 1;
            cell.state = CELL_STATE.OWNED;
            if (this.onCellCaptured) {
              this.onCellCaptured(
                x * CELL_SIZE + CELL_SIZE / 2,
                y * CELL_SIZE + CELL_SIZE / 2,
                cell.ownerId,
              );
            }
          }
        } else if (cell.state === CELL_STATE.DECAYING) {
          cell.progress -= delta / 500;
          if (cell.progress <= 0) {
            if (this.onCellDecayed && cell.ownerId) {
              this.onCellDecayed(
                x * CELL_SIZE + CELL_SIZE / 2,
                y * CELL_SIZE + CELL_SIZE / 2,
                cell.ownerId,
              );
            }
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
    const t = Date.now() / 1000;
    const cs = CELL_SIZE;
    const inset = 1;

    // ── Pass 1: Cell fills ──
    this.cellGraphics.clear();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const px = offsetX + x * cs;
        const py = offsetY + y * cs;
        const key = `${x},${y}`;

        if (cell.state === CELL_STATE.NEUTRAL) {
          if (this.contestedCells.has(key)) {
            // Contested zone — shimmer
            const flicker = 0.08 + Math.sin(t * 5 + x * 0.7 + y * 0.5) * 0.04;
            this.cellGraphics.fillStyle(0x99aacc, flicker);
            this.cellGraphics.fillRect(px, py, cs, cs);
          }
          // else: already drawn by bgGraphics
        } else {
          const color = PLAYER_COLORS[cell.ownerId!] || 0x444444;
          const cr = (color >> 16) & 0xff;
          const cg = (color >> 8) & 0xff;
          const cb = color & 0xff;

          // Darken color for base fill
          const baseAlpha = cell.state === CELL_STATE.CLAIMING
            ? 0.2 + cell.progress * 0.45
            : cell.state === CELL_STATE.DECAYING
              ? Math.max(0.05, cell.progress * 0.55)
              : 0.65;

          this.cellGraphics.fillStyle(Phaser.Display.Color.GetColor(
            Math.floor(cr * 0.4), Math.floor(cg * 0.4), Math.floor(cb * 0.4),
          ), baseAlpha);
          this.cellGraphics.fillRect(px, py, cs, cs);

          // Inner lighter core — gives depth
          const innerAlpha = baseAlpha * 0.35;
          this.cellGraphics.fillStyle(Phaser.Display.Color.GetColor(cr, cg, cb), innerAlpha);
          this.cellGraphics.fillRect(px + 3, py + 3, cs - 6, cs - 6);
        }
      }
    }

    // ── Pass 2: Territory border edges ──
    this.borderGraphics.clear();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.state === CELL_STATE.NEUTRAL) continue;

        const color = PLAYER_COLORS[cell.ownerId!] || 0x444444;
        const px = offsetX + x * cs;
        const py = offsetY + y * cs;
        const alpha = cell.state === CELL_STATE.DECAYING
          ? cell.progress * 0.5
          : 0.45;

        // Draw bright edge only where territory meets neutral/other
        const dirs: [number, number, number, number, number, number][] = [
          [0, -1, px, py, px + cs, py],           // top
          [0, 1, px, py + cs, px + cs, py + cs],   // bottom
          [-1, 0, px, py, px, py + cs],             // left
          [1, 0, px + cs, py, px + cs, py + cs],   // right
        ];

        for (const [dx, dy, x1, y1, x2, y2] of dirs) {
          const neighbor = this.getCell(x + dx, y + dy);
          if (!neighbor || neighbor.ownerId !== cell.ownerId || neighbor.state === CELL_STATE.NEUTRAL) {
            this.borderGraphics.lineStyle(1.5, color, alpha);
            this.borderGraphics.lineBetween(x1, y1, x2, y2);
          }
        }
      }
    }

    // ── Pass 3: Grid lines (very subtle) ──
    this.borderGraphics.lineStyle(1, 0x161622, 0.2);
    for (let y = 0; y <= this.height; y++) {
      this.borderGraphics.lineBetween(
        offsetX, offsetY + y * cs,
        offsetX + this.width * cs, offsetY + y * cs,
      );
    }
    for (let x = 0; x <= this.width; x++) {
      this.borderGraphics.lineBetween(
        offsetX + x * cs, offsetY,
        offsetX + x * cs, offsetY + this.height * cs,
      );
    }

    // ── Pass 4: Light glow overlay (additive, no contested) ──
    this.glowGraphics.clear();
    this.glowGraphics.setBlendMode(Phaser.BlendModes.ADD);

    for (const [ownerId, cells] of illuminatedCells) {
      const color = PLAYER_COLORS[ownerId] || 0xffd700;
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;

      for (const key of cells) {
        if (this.contestedCells.has(key)) continue;
        const [cx, cy] = key.split(',').map(Number);
        const px = offsetX + cx * cs;
        const py = offsetY + cy * cs;

        // Soft light tint
        this.glowGraphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 0.04);
        this.glowGraphics.fillRect(px, py, cs, cs);
      }
    }

    this.glowGraphics.setBlendMode(Phaser.BlendModes.NORMAL);
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
    this.bgGraphics.destroy();
    this.cellGraphics.destroy();
    this.borderGraphics.destroy();
    this.glowGraphics.destroy();
  }
}
