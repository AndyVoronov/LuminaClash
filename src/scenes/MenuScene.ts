import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a0f, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // Decorative light circles
    const glow = this.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);

    // Animate glow
    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        glow.clear();
        const t = Date.now() / 1000;

        // Pulsing light 1
        const r1 = 80 + Math.sin(t * 0.5) * 20;
        glow.fillGradientStyle(0xffd700, 0xffd700, 0xffd700, 0xffd700, 0.04, 0.04, 0.04, 0.04);
        glow.fillCircle(cx - 200 + Math.sin(t * 0.3) * 50, cy - 50, r1);

        // Pulsing light 2
        const r2 = 60 + Math.cos(t * 0.7) * 15;
        glow.fillGradientStyle(0x4a9eff, 0x4a9eff, 0x4a9eff, 0x4a9eff, 0.03, 0.03, 0.03, 0.03);
        glow.fillCircle(cx + 180 + Math.cos(t * 0.4) * 40, cy + 30, r2);

        // Pulsing light 3
        const r3 = 50 + Math.sin(t * 0.6) * 10;
        glow.fillGradientStyle(0xb44aff, 0xb44aff, 0xb44aff, 0xb44aff, 0.025, 0.025, 0.025, 0.025);
        glow.fillCircle(cx + Math.sin(t * 0.5) * 100, cy + 80, r3);
      },
    });

    // Title
    this.add.text(cx, cy - 160, 'LUMINACLASH', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 110, 'Conquer the darkness with light', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#666688',
    }).setOrigin(0.5);

    // Start button - use a Zone for reliable hit detection
    const startZone = this.add.zone(cx, cy - 20, 220, 50).setInteractive({ useHandCursor: true });
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a1a3a, 1);
    btnBg.fillRoundedRect(cx - 110, cy - 45, 220, 50, 6);
    btnBg.lineStyle(1, 0x333355, 0.5);
    btnBg.strokeRoundedRect(cx - 110, cy - 45, 220, 50, 6);

    this.add.text(cx, cy - 20, '[ START GAME ]', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5);

    startZone.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x2a2a5a, 1);
      btnBg.fillRoundedRect(cx - 110, cy - 45, 220, 50, 6);
      btnBg.lineStyle(1, 0xffd700, 0.5);
      btnBg.strokeRoundedRect(cx - 110, cy - 45, 220, 50, 6);
    });

    startZone.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x1a1a3a, 1);
      btnBg.fillRoundedRect(cx - 110, cy - 45, 220, 50, 6);
      btnBg.lineStyle(1, 0x333355, 0.5);
      btnBg.strokeRoundedRect(cx - 110, cy - 45, 220, 50, 6);
    });

    startZone.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    // Controls info
    const controlsY = cy + 50;
    this.add.text(cx, controlsY, '─── CONTROLS ───', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#444466',
    }).setOrigin(0.5);

    const controls = [
      'WASD / Arrows  —  Move light',
      'Click  —  Place obstacle',
      'ESC  —  Menu',
    ];

    controls.forEach((text, i) => {
      this.add.text(cx, controlsY + 25 + i * 22, text, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#555577',
      }).setOrigin(0.5);
    });

    // Footer
    this.add.text(cx, this.scale.height - 30, 'P0 Prototype  •  GameConveyor', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#333344',
    }).setOrigin(0.5);

    // Keyboard shortcut - use on() instead of once() for reliability
    this.input.keyboard!.on('keydown-ENTER', () => {
      this.scene.start('GameScene');
    });

    this.input.keyboard!.on('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}
