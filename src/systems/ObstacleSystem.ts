import Phaser from 'phaser';
import { CELL_SIZE } from '../config';
import { GridSystem } from '../systems/GridSystem';
import type { PlayerLight } from '../entities/PlayerLight';

export interface ObstacleData {
  id: string;
  cx: number;
  cy: number;
  ownerId: string;
  type: 'wall' | 'tower' | 'blinker' | 'mirror';
  createdAt: number;
  dissolveStart: number | null;
  blinkOn: boolean;
  mirrorDir: number; // 0=right, 1=down, 2=left, 3=up (4-directional)
  mirrorHits: number; // remaining hits before destruction
}

export class ObstacleSystem {
  private obstacles: Map<string, ObstacleData> = new Map();
  private obstacleCells: Set<string> = new Set();
  private graphics: Phaser.GameObjects.Graphics;
  private shadowGraphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private lightPositions: Map<string, { cx: number; cy: number; radius: number }> = new Map();

  // Mirror reflected light — additional illuminated cells from mirrors
  mirrorIlluminated: Map<string, Set<string>> = new Map();

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

  place(cx: number, cy: number, ownerId: string, type: 'wall' | 'tower' | 'blinker' | 'mirror' = 'wall', mirrorDir: number = 0): ObstacleData | null {
    if (this.obstacleCells.has(`${cx},${cy}`)) return null;

    const obstacle: ObstacleData = {
      id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cx, cy, ownerId, type,
      createdAt: Date.now(),
      dissolveStart: null,
      blinkOn: true,
      mirrorDir: type === 'mirror' ? mirrorDir : 0,
      mirrorHits: type === 'mirror' ? 2 : 0,
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

  /**
   * Check if player orb is colliding with a tower (for tower destruction).
   */
  checkPlayerTowerCollision(player: PlayerLight, offsetX: number, offsetY: number): string | null {
    const pos = player.getGridPosition(offsetX, offsetY);
    const gcx = Math.round(pos.cx);
    const gcy = Math.round(pos.cy);

    // Check cells within 1 cell radius
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${gcx + dx},${gcy + dy}`;
        const obs = this.findObstacleAt(gcx + dx, gcy + dy);
        if (obs && obs.type === 'tower') {
          return obs.id;
        }
      }
    }
    return null;
  }

  /**
   * Hit a mirror (reduce hits, destroy at 0).
   */
  hitMirror(obstacleId: string): void {
    const obs = this.obstacles.get(obstacleId);
    if (!obs || obs.type !== 'mirror') return;
    obs.mirrorHits--;
    if (obs.mirrorHits <= 0) {
      this.remove(obstacleId);
    }
  }

  update(delta: number): void {
    const toRemove: string[] = [];

    for (const [id, obs] of this.obstacles) {
      if (obs.type === 'blinker') {
        const elapsed = Date.now() - obs.createdAt;
        // Blink cycle: 2.5s on, 1.5s off
        const cycleTime = 4000;
        const phase = elapsed % cycleTime;
        obs.blinkOn = phase < 2500;
        if (obs.blinkOn) {
          this.obstacleCells.add(`${obs.cx},${obs.cy}`);
        } else {
          this.obstacleCells.delete(`${obs.cx},${obs.cy}`);
        }
      }

      // Towers don't dissolve from light — only from player collision
      if (obs.type === 'tower') continue;

      // Mirrors dissolve slowly
      const DISSOLVE_DISTANCE = obs.type === 'mirror' ? 1.0 : 1.5;
      const DISSOLVE_TIME = obs.type === 'mirror' ? 3000 : 2000;

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

    // Compute mirror reflections
    this.computeMirrorReflections();
  }

  /**
   * For each mirror, compute reflected illumination cone.
   */
  private computeMirrorReflections(): void {
    this.mirrorIlluminated.clear();

    for (const [, obs] of this.obstacles) {
      if (obs.type !== 'mirror' || !obs.blinkOn) continue;

      // Direction vectors for mirror: 0=right, 1=down, 2=left, 3=up
      const dirVecs = [
        { dx: 1, dy: 0 },  // mirror facing right → reflects downward
        { dx: 0, dy: 1 },  // mirror facing down → reflects leftward
        { dx: -1, dy: 0 }, // mirror facing left → reflects upward
        { dx: 0, dy: -1 }, // mirror facing up → reflects rightward
      ];
      const reflectDirs = [
        { dx: 0, dy: 1 },  // right → down
        { dx: -1, dy: 0 }, // down → left
        { dx: 0, dy: -1 }, // left → up
        { dx: 1, dy: 0 },  // up → right
      ];

      // Check if any player light has line of sight to this mirror
      for (const [playerId, light] of this.lightPositions) {
        const grid = this.scene as unknown as { grid: GridSystem };
        if (!(grid as any)?.grid?.hasLineOfSight) continue;
        const gs = (grid as any).grid as GridSystem;

        if (!gs.hasLineOfSight(Math.round(light.cx), Math.round(light.cy), obs.cx, obs.cy, this.obstacleCells)) continue;

        // Light reaches this mirror — reflect in the mirror direction
        const reflect = reflectDirs[obs.mirrorDir];
        const reflected = new Set<string>();
        const range = Math.floor(light.radius * 0.6);

        for (let i = 1; i <= range; i++) {
          const rx = obs.cx + reflect.dx * i;
          const ry = obs.cy + reflect.dy * i;
          const key = `${rx},${ry}`;

          if (this.obstacleCells.has(key)) break;

          const cell = gs.getCell(rx, ry);
          if (!cell) break;

          // Also allow spread (1 cell width perpendicular to reflection direction)
          for (const perp of this.getPerpendicularCells(rx, ry, reflect)) {
            if (!this.obstacleCells.has(`${perp.cx},${perp.cy}`)) {
              const pCell = gs.getCell(perp.cx, perp.cy);
              if (pCell) reflected.add(`${perp.cx},${perp.cy}`);
            }
          }

          reflected.add(key);
        }

        if (reflected.size > 0) {
          this.mirrorIlluminated.set(playerId, reflected);
        }
      }
    }
  }

  private getPerpendicularCells(cx: number, cy: number, dir: { dx: number; dy: number }): { cx: number; cy: number }[] {
    // Perpendicular to (dx, dy) is (-dy, dx) and (dy, -dx)
    return [
      { cx: cx - dir.dy, cy: cy + dir.dx },
      { cx: cx + dir.dy, cy: cy - dir.dx },
    ];
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
        const dp = Math.min(1, (Date.now() - obs.dissolveStart) / (obs.type === 'mirror' ? 3000 : 2000));
        alpha = (1 - dp) * (0.5 + 0.5 * Math.sin(Date.now() / 80));
      }
      if (obs.type === 'blinker' && !obs.blinkOn) alpha *= 0.15;

      const m = 2;

      // Drop shadow
      this.shadowGraphics.fillStyle(0x000000, alpha * 0.35);
      this.shadowGraphics.fillRoundedRect(px + m + 3, py + m + 3, cs - m * 2, cs - m * 2, 4);

      // Type-specific rendering
      if (obs.type === 'mirror') {
        this.renderMirror(px, py, cs, m, obs, alpha);
      } else if (obs.type === 'tower') {
        this.renderTower(px, py, cs, m, obs, alpha);
      } else if (obs.type === 'blinker') {
        this.renderBlinker(px, py, cs, m, obs, alpha);
      } else {
        this.renderWall(px, py, cs, m, obs, alpha);
      }
    }
  }

  private renderWall(px: number, py: number, cs: number, m: number, obs: ObstacleData, alpha: number): void {
    // Side
    this.graphics.fillStyle(0x1a1a28, alpha);
    this.graphics.fillRoundedRect(px + m + 2, py + m + 2, cs - m * 2, cs - m * 2, 4);
    // Face
    this.graphics.fillStyle(0x2a2a3a, alpha);
    this.graphics.fillRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    // Top highlight
    this.graphics.fillStyle(0x4a4a5a, alpha * 0.6);
    this.graphics.fillRect(px + m + 2, py + m, cs - m * 2 - 4, 3);
    // Left highlight
    this.graphics.fillStyle(0x4a4a5a, alpha * 0.2);
    this.graphics.fillRect(px + m, py + m + 3, 2, cs - m * 2 - 6);
    // Border
    this.graphics.lineStyle(1, 0x666688, alpha * 0.25);
    this.graphics.strokeRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    // Dissolve bar
    this.renderDissolveBar(px, py, cs, m, obs, alpha);
  }

  private renderTower(px: number, py: number, cs: number, m: number, obs: ObstacleData, alpha: number): void {
    const t = Date.now() / 1000;
    // Side (taller shadow)
    this.graphics.fillStyle(0x2a1508, alpha);
    this.graphics.fillRoundedRect(px + m + 2, py + m + 3, cs - m * 2, cs - m * 2, 4);
    // Main face
    this.graphics.fillStyle(0x5a3520, alpha);
    this.graphics.fillRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    // Top edge
    this.graphics.fillStyle(0x8b5530, alpha * 0.7);
    this.graphics.fillRect(px + m + 2, py + m, cs - m * 2 - 4, 3);
    // Cross pattern
    this.graphics.lineStyle(1, 0x8b6540, alpha * 0.4);
    const inner = cs / 2;
    this.graphics.lineBetween(px + inner, py + m + 4, px + inner, py + cs - m - 4);
    this.graphics.lineBetween(px + m + 4, py + inner, px + cs - m - 4, py + inner);
    // Crown (small triangle on top)
    this.graphics.fillStyle(0xa06030, alpha * 0.5);
    this.graphics.fillTriangle(px + cs / 2, py + m - 2, px + cs / 2 - 4, py + m + 3, px + cs / 2 + 4, py + m + 3);
    // Subtle pulse glow
    this.graphics.fillStyle(0xff6633, alpha * (0.03 + Math.sin(t * 2) * 0.02));
    this.graphics.fillCircle(px + cs / 2, py + cs / 2, cs * 0.5);
    // Border
    this.graphics.lineStyle(1, 0x8b5530, alpha * 0.4);
    this.graphics.strokeRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    // "T" label
    this.graphics.fillStyle(0xddaa66, alpha * 0.3);
    this.graphics.fillRect(px + cs / 2 - 4, py + m + 5, 8, 2);
    this.graphics.fillRect(px + cs / 2 - 1, py + m + 5, 2, 6);
  }

  private renderBlinker(px: number, py: number, cs: number, m: number, obs: ObstacleData, alpha: number): void {
    const t = Date.now() / 1000;
    const elapsed = Date.now() - obs.createdAt;
    const cycleTime = 4000;
    const phase = elapsed % cycleTime;

    // Warning shimmer before turning on (last 0.5s of off phase)
    const warningPhase = phase >= 2500 && phase < 3000;
    const warningAlpha = warningPhase ? 0.2 + Math.sin(t * 12) * 0.15 : 0;

    // Side
    this.graphics.fillStyle(0x1a1a30, alpha + warningAlpha * 0.3);
    this.graphics.fillRoundedRect(px + m + 2, py + m + 2, cs - m * 2, cs - m * 2, 4);
    // Face
    this.graphics.fillStyle(0x3a3a5a, alpha + warningAlpha * 0.3);
    this.graphics.fillRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    // Top
    this.graphics.fillStyle(0x5a5a8a, (alpha * 0.6) + warningAlpha);
    this.graphics.fillRect(px + m + 2, py + m, cs - m * 2 - 4, 3);

    if (obs.blinkOn) {
      // Active indicator
      const blinkA = (0.3 + Math.sin(t * 6) * 0.2) * alpha;
      this.graphics.fillStyle(0x8888ff, blinkA);
      this.graphics.fillCircle(px + cs / 2, py + cs / 2, 4);
    }
    // Warning ring
    if (warningPhase && !obs.blinkOn) {
      this.graphics.lineStyle(1, 0x6666ff, 0.3 + Math.sin(t * 10) * 0.2);
      this.graphics.strokeRoundedRect(px + m - 1, py + m - 1, cs - m * 2 + 2, cs - m * 2 + 2, 5);
    }
    // Border
    this.graphics.lineStyle(1, 0x5a5a8a, alpha * 0.3);
    this.graphics.strokeRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    this.renderDissolveBar(px, py, cs, m, obs, alpha);
  }

  private renderMirror(px: number, py: number, cs: number, m: number, obs: ObstacleData, alpha: number): void {
    const t = Date.now() / 1000;
    // Direction arrow indicators (4 directions)
    const dirOffsets = [
      { dx: cs / 2, dy: 0 },   // right
      { dx: 0, dy: cs / 2 },   // down
      { dx: -cs / 2, dy: 0 },  // left
      { dx: 0, dy: -cs / 2 },  // up
    ];
    const reflectOffsets = [
      { dx: 0, dy: 1 },   // right → reflects down
      { dx: -1, dy: 0 },  // down → reflects left
      { dx: 0, dy: -1 },  // left → reflects up
      { dx: 1, dy: 0 },   // up → reflects right
    ];

    const reflect = reflectOffsets[obs.mirrorDir];
    const cx = px + cs / 2;
    const cy = py + cs / 2;

    // Glow showing reflection direction
    this.graphics.fillStyle(0x44ddff, alpha * (0.06 + Math.sin(t * 3) * 0.03));
    this.graphics.fillCircle(cx + reflect.dx * cs * 0.4, cy + reflect.dy * cs * 0.4, cs * 0.5);

    // Side
    this.graphics.fillStyle(0x0a2030, alpha);
    this.graphics.fillRoundedRect(px + m + 2, py + m + 2, cs - m * 2, cs - m * 2, 4);
    // Face — cyan tint
    this.graphics.fillStyle(0x1a3a5a, alpha);
    this.graphics.fillRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    // Reflective surface (diagonal line)
    this.graphics.lineStyle(2, 0x66ccff, alpha * 0.6);
    // Draw diagonal slash across the cell
    const slashMargin = 6;
    this.graphics.lineBetween(px + slashMargin, py + cs - slashMargin, px + cs - slashMargin, py + slashMargin);
    // Highlight shimmer
    const shimmer = Math.sin(t * 5) * 0.3 + 0.3;
    this.graphics.lineStyle(1, 0xaaddff, alpha * shimmer * 0.5);
    this.graphics.lineBetween(px + slashMargin + 1, py + cs - slashMargin - 1, px + cs - slashMargin - 1, py + slashMargin + 1);
    // Border
    this.graphics.lineStyle(1, 0x44aadd, alpha * 0.4);
    this.graphics.strokeRoundedRect(px + m, py + m, cs - m * 2, cs - m * 2, 4);
    // Hits indicator
    if (obs.mirrorHits < 2) {
      this.graphics.fillStyle(0xff4444, alpha * 0.5);
      this.graphics.fillCircle(px + cs - m - 4, py + m + 4, 2);
    }
    this.renderDissolveBar(px, py, cs, m, obs, alpha);
  }

  private renderDissolveBar(px: number, py: number, cs: number, m: number, obs: ObstacleData, alpha: number): void {
    if (!obs.dissolveStart) return;
    const dp = Math.min(1, (Date.now() - obs.dissolveStart) / 2000);
    this.graphics.fillStyle(0xff4444, alpha * 0.8);
    this.graphics.fillRoundedRect(px + m + 2, py + cs - m - 5, (cs - m * 2 - 4) * dp, 3, 1);
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

  getObstacleAt(cx: number, cy: number): ObstacleData | null {
    return this.findObstacleAt(cx, cy);
  }

  private findObstacleAt(cx: number, cy: number): ObstacleData | null {
    for (const [, obs] of this.obstacles) {
      if (obs.cx === cx && obs.cy === cy) return obs;
    }
    return null;
  }

  destroy(): void {
    this.graphics.destroy();
    this.shadowGraphics.destroy();
    this.obstacles.clear();
    this.obstacleCells.clear();
  }
}
