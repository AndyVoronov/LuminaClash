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
  private readonly MAX_PER_FRAME = 6;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);
  }

  queueCapture(worldX: number, worldY: number, color: number): void {
    this.pendingCaptures.push({ x: worldX, y: worldY, color });
  }

  queueDecay(worldX: number, worldY: number, color: number): void {
    this.pendingDecays.push({ x: worldX, y: worldY, color });
  }

  update(delta: number): void {
    const captureCount = Math.min(this.pendingCaptures.length, this.MAX_PER_FRAME);
    for (let i = 0; i < captureCount; i++) {
      const e = this.pendingCaptures[i];
      this.spawnBurst(e.x, e.y, e.color, 5, 400, 2.5, false);
    }
    this.pendingCaptures.splice(0, captureCount);

    const decayCount = Math.min(this.pendingDecays.length, this.MAX_PER_FRAME);
    for (let i = 0; i < decayCount; i++) {
      const e = this.pendingDecays[i];
      this.spawnBurst(e.x, e.y, e.color, 3, 250, 2, true);
    }
    this.pendingDecays.splice(0, decayCount);

    // Cap total particles
    if (this.particles.length > 200) {
      this.particles.splice(0, this.particles.length - 200);
    }

    // Draw with additive blend
    this.graphics.clear();
    this.graphics.setBlendMode(Phaser.BlendModes.ADD);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.vx *= 0.94;
      p.vy *= 0.94;

      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio * 0.6;
      const cr = (p.color >> 16) & 0xff;
      const cg = (p.color >> 8) & 0xff;
      const cb = p.color & 0xff;

      // Outer glow (additive — blends naturally)
      this.graphics.fillStyle(Phaser.Display.Color.GetColor(cr, cg, cb), alpha * 0.3);
      this.graphics.fillCircle(p.x, p.y, p.size * lifeRatio * 2);

      // Core
      this.graphics.fillStyle(Phaser.Display.Color.GetColor(cr, cg, cb), alpha);
      this.graphics.fillCircle(p.x, p.y, p.size * lifeRatio);
    }

    this.graphics.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private spawnBurst(
    wx: number, wy: number, color: number,
    count: number, life: number, size: number,
    upward = false,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = upward
        ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8
        : Math.random() * Math.PI * 2;
      const speed = upward ? 12 + Math.random() * 20 : 15 + Math.random() * 35;

      this.particles.push({
        x: wx + (Math.random() - 0.5) * CELL_SIZE * 0.3,
        y: wy + (Math.random() - 0.5) * CELL_SIZE * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life + Math.random() * 200,
        maxLife: life + 200,
        color,
        size: size + Math.random() * 1.5,
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
