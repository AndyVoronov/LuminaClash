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
  active: boolean;
}

export class ParticleSystem {
  private pool: Particle[] = [];
  private activeCount = 0;
  private graphics: Phaser.GameObjects.Graphics;
  private pendingCaptures: { x: number; y: number; color: number }[] = [];
  private pendingDecays: { x: number; y: number; color: number }[] = [];
  private readonly MAX_PER_FRAME = 6;
  private readonly POOL_SIZE = 250;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);

    // Pre-allocate pool
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, color: 0, size: 0,
        active: false,
      });
    }
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
    if (captureCount > 0) this.pendingCaptures.splice(0, captureCount);

    const decayCount = Math.min(this.pendingDecays.length, this.MAX_PER_FRAME);
    for (let i = 0; i < decayCount; i++) {
      const e = this.pendingDecays[i];
      this.spawnBurst(e.x, e.y, e.color, 3, 250, 2, true);
    }
    if (decayCount > 0) this.pendingDecays.splice(0, decayCount);

    // Draw with additive blend
    this.graphics.clear();
    this.graphics.setBlendMode(Phaser.BlendModes.ADD);

    // Iterate active particles (swap-remove on death)
    let i = 0;
    while (i < this.activeCount) {
      const p = this.pool[i];
      p.life -= delta;

      if (p.life <= 0) {
        p.active = false;
        // Swap with last active
        this.activeCount--;
        if (i < this.activeCount) {
          this.pool[i] = this.pool[this.activeCount];
          this.pool[this.activeCount] = p;
        }
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

      // Outer glow
      this.graphics.fillStyle(Phaser.Display.Color.GetColor(cr, cg, cb), alpha * 0.3);
      this.graphics.fillCircle(p.x, p.y, p.size * lifeRatio * 2);

      // Core
      this.graphics.fillStyle(Phaser.Display.Color.GetColor(cr, cg, cb), alpha);
      this.graphics.fillCircle(p.x, p.y, p.size * lifeRatio);

      i++;
    }

    this.graphics.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private spawnBurst(
    wx: number, wy: number, color: number,
    count: number, life: number, size: number,
    upward = false,
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.pool.length) break; // pool exhausted

      const angle = upward
        ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8
        : Math.random() * Math.PI * 2;
      const speed = upward ? 12 + Math.random() * 20 : 15 + Math.random() * 35;
      const p = this.pool[this.activeCount];

      p.x = wx + (Math.random() - 0.5) * CELL_SIZE * 0.3;
      p.y = wy + (Math.random() - 0.5) * CELL_SIZE * 0.3;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = life + Math.random() * 200;
      p.maxLife = life + 200;
      p.color = color;
      p.size = size + Math.random() * 1.5;
      p.active = true;

      this.activeCount++;
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  destroy(): void {
    this.graphics.destroy();
    this.pool.length = 0;
    this.activeCount = 0;
  }
}
