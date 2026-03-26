import Phaser from 'phaser';
import { CELL_SIZE } from '../config';

export interface ObstacleData {
  id: string;
  cx: number;
  cy: number;
  ownerId: string;
  type: 'wall' | 'tower' | 'blinker';
  createdAt: number;
  dissolveStart: number | null;
  blinkOn: boolean;
}

export class ObstacleSystem {
  private obstacles: Map<string, ObstacleData> = new Map();
  private obstacleCells: Set<string> = new Set();
  private graphics: Phaser.GameObjects.Graphics;
  private shadowGraphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private lightPositions: Map<string, { cx: number; cy: number; radius: number }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.shadowGraphics = scene.add.graphics();
    this.shadowGraphics.setDepth(4);
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5);
  }

  setLightPositions(positions: Map<string, { cx: number; cy: number; radius: number }>): void {
    this.lightPositions = positions;
  }

  canPlace(cx: number, cy: number, playerId: string, grid: { getCell: (x: number, y: number) => { ownerId: string | null; state: number } | null }): boolean {
    const key = `${cx},${cy}`;
    if (this.obstacleCells.has(key)) return false;
    const cell = grid.getCell(cx, cy);
    if (!cell) return false;
    if (cell.ownerId === playerId) return false;
    return true;
  }

  place(cx: number, cy: number, ownerId: string, type: 'wall' | 'tower' | 'blinker' = 'wall'): ObstacleData | null {
    if (this.obstacleCells.has(`${cx},${cy}`)) return null;

    const obstacle: ObstacleData = {
      id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cx, cy, ownerId, type,
      createdAt: Date.now(),
      dissolveStart: null,
      blinkOn: true,
    };

    this.obstacles.set(obstacle.id, obstacle);
    this.obstacleCells.add(`${cx},${cy}`);
    return obstacle;
  }

  remove(obstacleId: string): void {
    const obs = this.obstacles.get(obstacleId);
    if (!obs) return;
    this.obstacleCells.delete(`${obs.cx},${obs.cy}`);
    this.obstacles.delete(obstacleId);
  }

  update(delta: number): void {
    const toRemove: string[] = [];

    for (const [id, obs] of this.obstacles) {
      if (obs.type === 'blinker') {
        const elapsed = Date.now() - obs.createdAt;
        obs.blinkOn = Math.floor(elapsed / 2000) % 2 === 0;
        if (obs.blinkOn) {
          this.obstacleCells.add(`${obs.cx},${obs.cy}`);
        } else {
          this.obstacleCells.delete(`${obs.cx},${obs.cy}`);
        }
      }

      const DISSOLVE_DISTANCE = 1.5;
      const DISSOLVE_TIME = 2000;
      let nearLight = false;
      for (const [, light] of this.lightPositions) {
        const dist = Math.sqrt((obs.cx - light.cx) ** 2 + (obs.cy - light.cy) ** 2);
        if (dist < DISSOLVE_DISTANCE) { nearLight = true; break; }
      }

      if (nearLight) {
        if (obs.dissolveStart === null) obs.dissolveStart = Date.now();
        else if (Date.now() - obs.dissolveStart > DISSOLVE_TIME) toRemove.push(id);
      } else {
        obs.dissolveStart = null;
      }
    }

    for (const id of toRemove) this.remove(id);
  }

  render(offsetX: number, offsetY: number): void {
    const cs = CELL_SIZE;
    this.shadowGraphics.clear();
    this.graphics.clear();

    for (const [, obs] of this.obstacles) {
      const px = offsetX + obs.cx * cs;
      const py = offsetY + obs.cy * cs;

      let alpha = 1;
      if (obs.dissolveStart) {
        const dp = Math.min(1, (Date.now() - obs.dissolveStart) / 2000);
        alpha = (1 - dp) * (0.5 + 0.5 * Math.sin(Date.now() / 80));
      }
      if (obs.type === 'blinker' && !obs.blinkOn) alpha *= 0.15;

      const m = 2; // margin

      // Drop shadow
      this.shadowGraphics.fillStyle(0x000000, alpha * 0.35);
      this.shadowGraphics.fillRoundedRect(px + m + 3, py + m + 3, cs - m * 2, cs - m * 2, 4);

      // Base block — darker tinted
      let baseColor: number;
      let topColor: number;
      let sideColor: number;
      if (obs.type === 'tower') {
        baseColor = 0x5a3520; topColor = 0x8b5530; sideColor = 0x3a1a08;
      } else if (obs.type === 'blinker') {
        baseColor = 0x3a3a5a; topColor = 0x5a5a8a; sideColor = 0x2a2a3a;
      } else {
        baseColor = 0x2a2a3a; topColor = 0x4a4a5a; sideColor = 0x1a1a28;
      }

      // Side (bottom + right) — gives 3D depth
      this.graphics.fillStyle(sideColor, alpha);
      this.graphics.fillRoundedRect(px + m + 2, py + m + 2, cs - m * 2, cs - m * 2, 4);

      // Main face
      this.graphics.fillStyle(baseColor, alpha);
      this.graphics.fillRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);

      // Top edge highlight
      this.graphics.fillStyle(topColor, alpha * 0.6);
      this.graphics.fillRect(px + m + 2, py + m, cs - m * 2 - 4, 3);

      // Left edge highlight
      this.graphics.fillStyle(topColor, alpha * 0.2);
      this.graphics.fillRect(px + m, py + m + 3, 2, cs - m * 2 - 6);

      // Inner cross pattern for towers
      if (obs.type === 'tower') {
        this.graphics.lineStyle(1, 0x8b6540, alpha * 0.4);
        const inner = cs / 2;
        this.graphics.lineBetween(px + inner, py + m + 4, px + inner, py + cs - m - 4);
        this.graphics.lineBetween(px + m + 4, py + inner, px + cs - m - 4, py + inner);
      }

      // Blinker indicator
      if (obs.type === 'blinker' && obs.blinkOn) {
        const t = Date.now() / 1000;
        const blinkAlpha = (0.3 + Math.sin(t * 6) * 0.2) * alpha;
        this.graphics.fillStyle(0x8888ff, blinkAlpha);
        this.graphics.fillCircle(px + cs / 2, py + cs / 2, 4);
      }

      // Thin border
      this.graphics.lineStyle(1, 0x666688, alpha * 0.25);
      this.graphics.strokeRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);

      // Dissolve progress bar
      if (obs.dissolveStart) {
        const dp = Math.min(1, (Date.now() - obs.dissolveStart) / 2000);
        this.graphics.fillStyle(0xff4444, alpha * 0.8);
        this.graphics.fillRoundedRect(px + m + 2, py + cs - m - 5, (cs - m * 2 - 4) * dp, 3, 1);
      }
    }
  }

  /**
   * Remove all obstacles within a radius (used by BOMB power-up).
   */
  destroyInRadius(cx: number, cy: number, radius: number): number {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.sqrt(dx * dx + dy * dy) > radius) continue;
        const key = `${cx + dx},${cy + dy}`;
        if (this.obstacleCells.has(key)) {
          // Find and remove the obstacle
          for (const [id, obs] of this.obstacles) {
            if (obs.cx === cx + dx && obs.cy === cy + dy) {
              this.obstacles.delete(id);
              break;
            }
          }
          this.obstacleCells.delete(key);
          count++;
        }
      }
    }
    return count;
  }

  getObstacleCells(): Set<string> {
    return this.obstacleCells;
  }

  getObstacleCount(ownerId: string | null): number {
    if (ownerId === null) return this.obstacles.size;
    let count = 0;
    for (const [, obs] of this.obstacles) {
      if (obs.ownerId === ownerId) count++;
    }
    return count;
  }

  destroy(): void {
    this.graphics.destroy();
    this.shadowGraphics.destroy();
    this.obstacles.clear();
    this.obstacleCells.clear();
  }
}
