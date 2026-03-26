import Phaser from 'phaser';
import { CELL_SIZE } from '../config';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private pendingCaptures: { x: number; y: number; color: number }[] = [];
  private pendingDecays: { x: number; y: number; color: number }[] = [];
  private readonly MAX_PER_FRAME = 8;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);
  }

  /**
   * Queue a capture particle burst. Actual emission happens in update()
   * to avoid spawning thousands of particles in a single frame.
   */
  queueCapture(worldX: number, worldY: number, color: number): void {
    this.pendingCaptures.push({ x: worldX, y: worldY, color });
  }

  queueDecay(worldX: number, worldY: number, color: number): void {
    this.pendingDecays.push({ x: worldX, y: worldY, color });
  }

  update(delta: number): void {
    // Process pending events — limit per frame to avoid particle storms
    const captureCount = Math.min(this.pendingCaptures.length, this.MAX_PER_FRAME);
    for (let i = 0; i < captureCount; i++) {
      const e = this.pendingCaptures[i];
      this.spawnBurst(e.x, e.y, e.color, 4, 300, 2);
    }
    this.pendingCaptures.splice(0, captureCount);

    const decayCount = Math.min(this.pendingDecays.length, this.MAX_PER_FRAME);
    for (let i = 0; i < decayCount; i++) {
      const e = this.pendingDecays[i];
      this.spawnBurst(e.x, e.y, e.color, 2, 200, 1.5, true);
    }
    this.pendingDecays.splice(0, decayCount);

    // Draw and update existing particles
    this.graphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.vx *= 0.96;
      p.vy *= 0.96;

      const alpha = (p.life / p.maxLife) * 0.8;
      const r = (p.color >> 16) & 0xff;
      const g = (p.color >> 8) & 0xff;
      const b = p.color & 0xff;

      this.graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), alpha);
      this.graphics.fillCircle(p.x, p.y, p.size * (p.life / p.maxLife));
    }
  }

  private spawnBurst(
    wx: number, wy: number, color: number,
    count: number, life: number, size: number,
    upward = false,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = upward
        ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
        : Math.random() * Math.PI * 2;
      const speed = upward ? 15 + Math.random() * 25 : 20 + Math.random() * 40;

      this.particles.push({
        x: wx + (Math.random() - 0.5) * CELL_SIZE * 0.4,
        y: wy + (Math.random() - 0.5) * CELL_SIZE * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life + Math.random() * 150,
        maxLife: life + 150,
        color,
        size: size + Math.random(),
      });
    }
  }

  get activeCount(): number {
    return this.particles.length;
  }

  destroy(): void {
    this.graphics.destroy();
    this.particles.length = 0;
  }
}
