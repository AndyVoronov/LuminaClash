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
  private scene: Phaser.Scene;

  // For obstacle dissolution (proximity to light sources)
  private lightPositions: Map<string, { cx: number; cy: number; radius: number }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5);
  }

  setLightPositions(positions: Map<string, { cx: number; cy: number; radius: number }>): void {
    this.lightPositions = positions;
  }

  canPlace(cx: number, cy: number, playerId: string, grid: { getCell: (x: number, y: number) => { ownerId: string | null; state: number } | null }): boolean {
    const key = `${cx},${cy}`;

    // Already occupied
    if (this.obstacleCells.has(key)) return false;

    // Check cell exists and is not owned by placer
    const cell = grid.getCell(cx, cy);
    if (!cell) return false;

    // Can place on neutral or enemy cells, not on your own
    if (cell.ownerId === playerId) return false;

    return true;
  }

  place(cx: number, cy: number, ownerId: string, type: 'wall' | 'tower' | 'blinker' = 'wall'): ObstacleData | null {
    if (this.obstacleCells.has(`${cx},${cy}`)) return null;

    const obstacle: ObstacleData = {
      id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cx,
      cy,
      ownerId,
      type,
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
      // Blinker logic
      if (obs.type === 'blinker') {
        const elapsed = Date.now() - obs.createdAt;
        obs.blinkOn = Math.floor(elapsed / 2000) % 2 === 0;
        if (obs.blinkOn) {
          if (!this.obstacleCells.has(`${obs.cx},${obs.cy}`)) {
            this.obstacleCells.add(`${obs.cx},${obs.cy}`);
          }
        } else {
          this.obstacleCells.delete(`${obs.cx},${obs.cy}`);
        }
      }

      // Check dissolution by light proximity
      const DISSOLVE_DISTANCE = 1.5; // cells
      const DISSOLVE_TIME = 2000; // ms to dissolve

      let nearLight = false;
      for (const [, light] of this.lightPositions) {
        const dist = Math.sqrt(
          (obs.cx - light.cx) ** 2 + (obs.cy - light.cy) ** 2,
        );
        if (dist < DISSOLVE_DISTANCE) {
          nearLight = true;
          break;
        }
      }

      if (nearLight) {
        if (obs.dissolveStart === null) {
          obs.dissolveStart = Date.now();
        } else if (Date.now() - obs.dissolveStart > DISSOLVE_TIME) {
          toRemove.push(id);
        }
      } else {
        obs.dissolveStart = null;
      }
    }

    for (const id of toRemove) {
      this.remove(id);
    }
  }

  render(offsetX: number, offsetY: number): void {
    this.graphics.clear();

    for (const [, obs] of this.obstacles) {
      const px = offsetX + obs.cx * CELL_SIZE;
      const py = offsetY + obs.cy * CELL_SIZE;

      // Dissolution animation
      let alpha = 1;
      if (obs.dissolveStart) {
        const dissolveProgress = Math.min(1, (Date.now() - obs.dissolveStart) / 2000);
        alpha = 1 - dissolveProgress;
        // Pulsing effect
        alpha *= 0.5 + 0.5 * Math.sin(Date.now() / 100);
      }

      // Blinker off
      if (obs.type === 'blinker' && !obs.blinkOn) {
        alpha *= 0.2;
      }

      // Base block
      const color = obs.type === 'tower' ? 0x8b4513 : obs.type === 'blinker' ? 0x4a4a6a : 0x3a3a4a;

      this.graphics.fillStyle(color, alpha);
      this.graphics.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);

      // Top edge highlight
      this.graphics.fillStyle(0xffffff, alpha * 0.15);
      this.graphics.fillRect(px + 1, py + 1, CELL_SIZE - 2, 3);

      // Type indicator for towers (slightly taller visual)
      if (obs.type === 'tower') {
        this.graphics.fillStyle(0x5a3010, alpha);
        this.graphics.fillRect(px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      }

      // Dissolve progress bar
      if (obs.dissolveStart) {
        const dissolveProgress = Math.min(1, (Date.now() - obs.dissolveStart) / 2000);
        this.graphics.fillStyle(0xff4444, 0.8);
        this.graphics.fillRect(px + 2, py + CELL_SIZE - 4, (CELL_SIZE - 4) * dissolveProgress, 2);
      }
    }
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
    this.obstacles.clear();
    this.obstacleCells.clear();
  }
}
