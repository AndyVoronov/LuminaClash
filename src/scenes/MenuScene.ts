import Phaser from 'phaser';

interface MenuParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export class MenuScene extends Phaser.Scene {
  private particles: MenuParticle[] = [];
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private glowGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x08080e, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // Subtle noise
    for (let i = 0; i < 300; i++) {
      const nx = Math.random() * this.scale.width;
      const ny = Math.random() * this.scale.height;
      bg.fillStyle(0x12121e, 0.2 + Math.random() * 0.2);
      bg.fillRect(Math.floor(nx), Math.floor(ny), 1, 1);
    }

    // Animated glow layer
    this.glowGraphics = this.add.graphics();
    this.glowGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.glowGraphics.setDepth(1);

    // Particle layer
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.bgGraphics.setDepth(2);

    // Seed initial ambient particles
    const colors = [0xffd700, 0x4a9eff, 0xb44aff];
    for (let i = 0; i < 30; i++) {
      this.spawnAmbient(colors[i % 3], this.scale.width, this.scale.height);
    }

    // ── Title with glow layers ──
    // Glow shadow (large, blurred feel via multiple offsets)
    const glowColors = [0xffd700, 0xffa500];
    for (const gc of glowColors) {
      this.add.text(cx + 1, cy - 158, 'LUMINACLASH', {
        fontFamily: 'monospace',
        fontSize: '50px',
        color: '#' + gc.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.15).setDepth(3);
    }

    // Main title
    this.add.text(cx, cy - 160, 'LUMINACLASH', {
      fontFamily: 'monospace',
      fontSize: '50px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    // Subtitle
    this.add.text(cx, cy - 110, 'Conquer the darkness with light', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#7777aa',
    }).setOrigin(0.5).setDepth(4);

    // ── Start button ──
    const btnW = 240;
    const btnH = 52;
    const btnX = cx - btnW / 2;
    const btnY = cy - 46;

    const btnBg = this.add.graphics().setDepth(4);
    this.renderButton(btnBg, btnX, btnY, btnW, btnH, false);

    const btnText = this.add.text(cx, cy - 20, 'START GAME', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ccccdd',
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(5);

    const startZone = this.add.zone(cx, cy - 20, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(6);

    startZone.on('pointerover', () => {
      this.renderButton(btnBg, btnX, btnY, btnW, btnH, true);
      btnText.setColor('#ffd700');
    });

    startZone.on('pointerout', () => {
      this.renderButton(btnBg, btnX, btnY, btnW, btnH, false);
      btnText.setColor('#ccccdd');
    });

    startZone.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    // ── Controls ──
    const controlsY = cy + 40;
    this.add.text(cx, controlsY, 'CONTROLS', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#3a3a55',
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(4);

    const controls = [
      ['WASD / Arrows', 'Move'],
      ['SHIFT', 'Sprint'],
      ['Click', 'Place obstacle'],
      ['ESC', 'Menu'],
    ];

    controls.forEach(([key, desc], i) => {
      const y = controlsY + 24 + i * 20;
      this.add.text(cx - 60, y, key, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8888aa',
      }).setOrigin(0.5).setDepth(4);
      this.add.text(cx + 40, y, desc, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#555570',
      }).setOrigin(0.5).setDepth(4);
    });

    // Footer
    this.add.text(cx, this.scale.height - 24, 'GameConveyor', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#2a2a3a',
    }).setOrigin(0.5).setDepth(4);

    // Keyboard shortcuts
    this.input.keyboard!.on('keydown-ENTER', () => this.scene.start('GameScene'));
    this.input.keyboard!.on('keydown-SPACE', () => this.scene.start('GameScene'));
  }

  private renderButton(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean): void {
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 2, y + 2, w, h, 8);

    // Background
    g.fillStyle(hover ? 0x1e1e3a : 0x12122a, 0.9);
    g.fillRoundedRect(x, y, w, h, 8);

    // Top highlight
    g.fillStyle(0xffffff, 0.04);
    g.fillRect(x + 4, y + 2, w - 8, 1);

    // Border
    g.lineStyle(1, hover ? 0xffd700 : 0x333355, hover ? 0.6 : 0.3);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  private spawnAmbient(color: number, w: number, h: number): void {
    this.particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 3000 + Math.random() * 4000,
      maxLife: 6000,
      color,
      size: 1 + Math.random() * 2,
    });
  }

  update(_time: number, delta: number): void {
    // Update glow blobs
    this.glowGraphics.clear();
    const t = Date.now() / 1000;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const blobs = [
      { color: 0xffd700, x: cx - 200 + Math.sin(t * 0.3) * 60, y: cy - 60, r: 100 + Math.sin(t * 0.5) * 25, a: 0.025 },
      { color: 0x4a9eff, x: cx + 200 + Math.cos(t * 0.4) * 50, y: cy + 40, r: 80 + Math.cos(t * 0.6) * 20, a: 0.02 },
      { color: 0xb44aff, x: cx + Math.sin(t * 0.5) * 120, y: cy + 100, r: 70 + Math.sin(t * 0.7) * 15, a: 0.018 },
    ];

    for (const blob of blobs) {
      const r = (blob.color >> 16) & 0xff;
      const g = (blob.color >> 8) & 0xff;
      const b = blob.color & 0xff;
      this.glowGraphics.fillGradientStyle(
        Phaser.Display.Color.GetColor(r, g, b), Phaser.Display.Color.GetColor(r, g, b),
        Phaser.Display.Color.GetColor(r, g, b), Phaser.Display.Color.GetColor(r, g, b),
        blob.a, blob.a, blob.a, blob.a,
      );
      this.glowGraphics.fillCircle(blob.x, blob.y, blob.r);
    }

    // Update ambient particles
    this.bgGraphics.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        const colors = [0xffd700, 0x4a9eff, 0xb44aff];
        this.spawnAmbient(colors[i % 3], this.scale.width, this.scale.height);
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);

      // Wrap around
      if (p.x < 0) p.x += this.scale.width;
      if (p.x > this.scale.width) p.x -= this.scale.width;
      if (p.y < 0) p.y += this.scale.height;
      if (p.y > this.scale.height) p.y -= this.scale.height;

      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio * 0.3;
      const r = (p.color >> 16) & 0xff;
      const g = (p.color >> 8) & 0xff;
      const b = p.color & 0xff;

      this.bgGraphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), alpha);
      this.bgGraphics.fillCircle(p.x, p.y, p.size);
    }
  }
}
