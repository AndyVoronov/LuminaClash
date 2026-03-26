import Phaser from 'phaser';
import {
  DIFFICULTY_PRESETS,
  MAP_PRESETS,
  DURATION_OPTIONS,
  PLAYER_COLORS,
  buildGameConfig,
  sessionStats,
  type GameConfig,
  type MapTemplate,
} from '../config';
import { MAP_TEMPLATE_LABELS } from '../systems/MapGenerator';
import { AudioManager } from '../audio/AudioManager';

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
  private screen: 'main' | 'settings' = 'main';
  private audio!: AudioManager;

  // Settings state
  private difficulty: 'easy' | 'medium' | 'hard' | 'nightmare' = 'medium';
  private mapKey: 'small' | 'medium' | 'large' = 'medium';
  private mapTemplate: MapTemplate = 'arena';
  private duration: number = 120;

  // Animated background
  private particles: MenuParticle[] = [];
  private glowGraphics!: Phaser.GameObjects.Graphics;
  private particleGraphics!: Phaser.GameObjects.Graphics;

  // Screen elements (tracked for cleanup)
  private screenEls: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  init(data: { lastConfig?: GameConfig }): void {
    if (data?.lastConfig) {
      this.difficulty = data.lastConfig.difficulty || 'medium';
      this.mapKey = this.matchMapPreset(data.lastConfig.mapWidth, data.lastConfig.mapHeight) || 'medium';
      this.mapTemplate = data.lastConfig.mapTemplate || 'arena';
      this.duration = data.lastConfig.matchDuration;
      this.screen = 'settings';
    } else {
      this.screen = 'main';
    }
    this.audio = new AudioManager();
  }

  private matchMapPreset(w: number, h: number): 'small' | 'medium' | 'large' | null {
    for (const [key, val] of Object.entries(MAP_PRESETS)) {
      if (val.mapWidth === w && val.mapHeight === h) return key as 'small' | 'medium' | 'large';
    }
    return null;
  }

  create(): void {
    // Static background
    const bg = this.add.graphics();
    bg.fillStyle(0x08080e, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    for (let i = 0; i < 300; i++) {
      bg.fillStyle(0x12121e, 0.2 + Math.random() * 0.2);
      bg.fillRect(Math.floor(Math.random() * this.scale.width), Math.floor(Math.random() * this.scale.height), 1, 1);
    }

    // Animated layers
    this.glowGraphics = this.add.graphics();
    this.glowGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.glowGraphics.setDepth(1);

    this.particleGraphics = this.add.graphics();
    this.particleGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.particleGraphics.setDepth(2);

    // Seed ambient particles
    const colors = [0xffd700, 0x4a9eff, 0xb44aff];
    for (let i = 0; i < 30; i++) {
      this.spawnAmbient(colors[i % 3]);
    }

    // Show initial screen
    this.showCurrentScreen();

    // Keyboard
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.screen === 'main') this.screen = 'settings';
      this.showCurrentScreen();
    });
  }

  // ── Screen management ──

  private clearScreen(): void {
    for (const el of this.screenEls) el.destroy();
    this.screenEls = [];
  }

  private showCurrentScreen(): void {
    this.clearScreen();
    if (this.screen === 'main') this.buildMainScreen();
    else this.buildSettingsScreen();
  }

  private track(...els: Phaser.GameObjects.GameObject[]): void {
    this.screenEls.push(...els);
  }

  // ── Main screen ──

  private buildMainScreen(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // Title glow
    for (const gc of [0xffd700, 0xffa500]) {
      const t = this.add.text(cx + 1, 149, 'LUMINACLASH', {
        fontFamily: 'monospace', fontSize: '52px',
        color: '#' + gc.toString(16).padStart(6, '0'), fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.15).setDepth(3);
      this.track(t);
    }

    // Title
    const title = this.add.text(cx, 148, 'LUMINACLASH', {
      fontFamily: 'monospace', fontSize: '52px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    this.track(title);

    // Subtitle
    const sub = this.add.text(cx, 200, 'Conquer the darkness with light', {
      fontFamily: 'monospace', fontSize: '15px', color: '#7777aa',
    }).setOrigin(0.5).setDepth(4);
    this.track(sub);

    // Start button
    const btnW = 260;
    const btnH = 54;
    const btnX = cx - btnW / 2;
    const btnY = 270;

    const btnBg = this.add.graphics().setDepth(4);
    this.track(btnBg);
    this.renderButton(btnBg, btnX, btnY, btnW, btnH, false);

    const btnText = this.add.text(cx, btnY + btnH / 2, 'START GAME', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ccccdd', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(5);
    this.track(btnText);

    const startZone = this.add.zone(cx, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(6);
    this.track(startZone);

    startZone.on('pointerover', () => {
      this.audio.playMenuHover();
      this.renderButton(btnBg, btnX, btnY, btnW, btnH, true);
      btnText.setColor('#ffd700');
    });
    startZone.on('pointerout', () => {
      this.renderButton(btnBg, btnX, btnY, btnW, btnH, false);
      btnText.setColor('#ccccdd');
    });
    startZone.on('pointerdown', () => {
      this.audio.playMenuClick();
      this.screen = 'settings';
      this.showCurrentScreen();
    });

    // Controls
    const ctrlY = 380;
    this.track(this.add.text(cx, ctrlY, 'CONTROLS', {
      fontFamily: 'monospace', fontSize: '12px', color: '#3a3a55', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(4));

    const controls = [
      ['WASD / Arrows', 'Move'],
      ['SHIFT', 'Sprint'],
      ['Click', 'Place obstacle'],
      ['ESC', 'Pause'],
    ];
    controls.forEach(([key, desc], i) => {
      this.track(this.add.text(cx - 60, ctrlY + 24 + i * 20, key, {
        fontFamily: 'monospace', fontSize: '12px', color: '#8888aa',
      }).setOrigin(0.5).setDepth(4));
      this.track(this.add.text(cx + 50, ctrlY + 24 + i * 20, desc, {
        fontFamily: 'monospace', fontSize: '12px', color: '#555570',
      }).setOrigin(0.5).setDepth(4));
    });

    // Session stats
    if (sessionStats.matchesPlayed > 0) {
      const st = this.add.text(cx, H - 70, `Matches: ${sessionStats.matchesPlayed}   Wins: ${sessionStats.wins}   XP: ${sessionStats.totalXP}`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#3a3a55',
      }).setOrigin(0.5).setDepth(4);
      this.track(st);
    }

    // Footer
    this.track(this.add.text(cx, H - 24, 'GameConveyor', {
      fontFamily: 'monospace', fontSize: '11px', color: '#2a2a3a',
    }).setOrigin(0.5).setDepth(4));
  }

  // ── Settings screen ──

  private buildSettingsScreen(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // Title
    this.track(this.add.text(cx, 60, 'MATCH SETTINGS', {
      fontFamily: 'monospace', fontSize: '18px', color: '#8888aa', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(4));

    // Difficulty
    this.buildOptionRow(cx, 110, 'DIFFICULTY',
      Object.entries(DIFFICULTY_PRESETS).map(([k, v]) => ({ value: k, label: v.label })),
      this.difficulty,
      (v) => { this.difficulty = v as 'easy' | 'medium' | 'hard' | 'nightmare'; },
    );

    // Map size
    this.buildOptionRow(cx, 190, 'MAP SIZE',
      Object.entries(MAP_PRESETS).map(([k, v]) => ({ value: k, label: v.label })),
      this.mapKey,
      (v) => { this.mapKey = v as 'small' | 'medium' | 'large'; },
    );

    // Map template
    this.buildOptionRow(cx, 270, 'MAP TYPE',
      (Object.entries(MAP_TEMPLATE_LABELS) as [MapTemplate, string][]).map(([k, v]) => ({ value: k, label: v })),
      this.mapTemplate,
      (v) => { this.mapTemplate = v as MapTemplate; },
    );

    // Duration
    this.buildOptionRow(cx, 350, 'TIME LIMIT',
      DURATION_OPTIONS.map(o => ({ value: String(o.value), label: o.label })),
      String(this.duration),
      (v) => { this.duration = Number(v); },
    );

    // Map preview
    const previewW = 320;
    const previewH = 140;
    const previewX = cx - previewW / 2;
    const previewY = 400;

    const previewBg = this.add.graphics().setDepth(4);
    this.track(previewBg);
    previewBg.fillStyle(0x08080e, 0.9);
    previewBg.fillRoundedRect(previewX, previewY, previewW, previewH, 8);
    previewBg.lineStyle(1, 0x2a2a44, 0.3);
    previewBg.strokeRoundedRect(previewX, previewY, previewW, previewH, 8);

    this.renderMapPreview(cx, previewY + previewH / 2, previewW - 40, previewH - 30);

    // Bot info line
    const dp = DIFFICULTY_PRESETS[this.difficulty];
    const info = this.add.text(cx, previewY + previewH + 16, `${dp.botCount} bot${dp.botCount > 1 ? 's' : ''}  •  ${dp.label} difficulty`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#555577',
    }).setOrigin(0.5).setDepth(4);
    this.track(info);

    // Back button
    const backW = 160;
    const backH = 46;
    const backX = cx - backW - 40;
    const backY = H - 80;

    const backBg = this.add.graphics().setDepth(4);
    this.track(backBg);
    this.renderButton(backBg, backX, backY, backW, backH, false);

    const backText = this.add.text(backX + backW / 2, backY + backH / 2, '← BACK', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8888aa',
    }).setOrigin(0.5).setDepth(5);
    this.track(backText);

    const backZone = this.add.zone(backX + backW / 2, backY + backH / 2, backW, backH)
      .setInteractive({ useHandCursor: true }).setDepth(6);
    this.track(backZone);
    backZone.on('pointerover', () => { this.renderButton(backBg, backX, backY, backW, backH, true); backText.setColor('#ccccdd'); this.audio.playMenuHover(); });
    backZone.on('pointerout', () => { this.renderButton(backBg, backX, backY, backW, backH, false); backText.setColor('#8888aa'); });
    backZone.on('pointerdown', () => { this.audio.playMenuClick(); this.screen = 'main'; this.showCurrentScreen(); });

    // Play button
    const playW = 200;
    const playH = 46;
    const playX = cx + 40;
    const playY = H - 80;

    const playBg = this.add.graphics().setDepth(4);
    this.track(playBg);
    this.renderPlayButton(playBg, playX, playY, playW, playH, false);

    const playText = this.add.text(playX + playW / 2, playY + playH / 2, 'PLAY →', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
    this.track(playText);

    const playZone = this.add.zone(playX + playW / 2, playY + playH / 2, playW, playH)
      .setInteractive({ useHandCursor: true }).setDepth(6);
    this.track(playZone);
    playZone.on('pointerover', () => { this.renderPlayButton(playBg, playX, playY, playW, playH, true); this.audio.playMenuHover(); });
    playZone.on('pointerout', () => { this.renderPlayButton(playBg, playX, playY, playW, playH, false); });
    playZone.on('pointerdown', () => { this.audio.playMenuClick(); this.startGame(); });

    // Keyboard shortcut
    this.input.keyboard!.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard!.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard!.once('keydown-ESC', () => { this.screen = 'main'; this.showCurrentScreen(); });
  }

  // ── Option row builder ──

  private buildOptionRow(
    cx: number, y: number, label: string,
    options: { value: string; label: string }[],
    current: string,
    onSelect: (v: string) => void,
  ): void {
    // Label
    const lbl = this.add.text(cx, y, label, {
      fontFamily: 'monospace', fontSize: '13px', color: '#555577', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(4);
    this.track(lbl);

    // Buttons
    const btnH = 34;
    const gap = 10;
    const totalW = options.reduce((s, o) => s + o.label.length * 10 + 32, 0) + (options.length - 1) * gap;
    let bx = cx - totalW / 2;
    const by = y + 28;

    for (const opt of options) {
      const w = opt.label.length * 10 + 32;
      const selected = opt.value === current;

      const bg = this.add.graphics().setDepth(4);
      this.track(bg);
      this.renderOptionBtn(bg, bx, by, w, btnH, selected);

      const txt = this.add.text(bx + w / 2, by + btnH / 2, opt.label, {
        fontFamily: 'monospace', fontSize: '14px',
        color: selected ? '#ffd700' : '#7777aa',
      }).setOrigin(0.5).setDepth(5);
      this.track(txt);

      const zone = this.add.zone(bx + w / 2, by + btnH / 2, w, btnH)
        .setInteractive({ useHandCursor: true }).setDepth(6);
      this.track(zone);

      zone.on('pointerover', () => {
        if (!selected) {
          bg.clear();
          bg.fillStyle(0x1a1a30, 0.8);
          bg.fillRoundedRect(bx, by, w, btnH, 6);
          txt.setColor('#ccccdd');
        }
      });
      zone.on('pointerout', () => {
        bg.clear();
        this.renderOptionBtn(bg, bx, by, w, btnH, selected);
        txt.setColor(selected ? '#ffd700' : '#7777aa');
      });
      zone.on('pointerdown', () => {
        onSelect(opt.value);
        this.showCurrentScreen();
      });

      bx += w + gap;
    }
  }

  private renderOptionBtn(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, selected: boolean): void {
    if (selected) {
      g.fillStyle(0x1e1e3a, 0.9);
      g.fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(1, 0xffd700, 0.5);
      g.strokeRoundedRect(x, y, w, h, 6);
    } else {
      g.fillStyle(0x12122a, 0.5);
      g.fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(1, 0x333355, 0.2);
      g.strokeRoundedRect(x, y, w, h, 6);
    }
  }

  // ── Map preview ──

  private renderMapPreview(cx: number, cy: number, maxW: number, maxH: number): void {
    const mp = MAP_PRESETS[this.mapKey];
    const cellPx = Math.floor(Math.min(maxW / mp.mapWidth, maxH / mp.mapHeight));
    const gridW = mp.mapWidth * cellPx;
    const gridH = mp.mapHeight * cellPx;
    const ox = cx - gridW / 2;
    const oy = cy - gridH / 2;

    const g = this.add.graphics().setDepth(5);
    this.track(g);

    // Grid lines
    g.lineStyle(1, 0x1a1a2e, 0.4);
    for (let x = 0; x <= mp.mapWidth; x++) {
      g.lineBetween(ox + x * cellPx, oy, ox + x * cellPx, oy + gridH);
    }
    for (let y = 0; y <= mp.mapHeight; y++) {
      g.lineBetween(ox, oy + y * cellPx, ox + gridW, oy + y * cellPx);
    }

    // Spawn points
    const playerSpawn = { x: 0.25, y: 0.5 };
    const botSpawns = [
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.75 },
      { x: 0.25, y: 0.25 },
    ];

    // Player
    g.fillStyle(PLAYER_COLORS.player, 0.9);
    g.fillCircle(ox + playerSpawn.x * gridW, oy + playerSpawn.y * gridH, 4);
    this.track(this.add.text(ox + playerSpawn.x * gridW + 8, oy + playerSpawn.y * gridH - 5, 'YOU', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ffd700',
    }).setDepth(5));

    // Bots
    const botColors = [PLAYER_COLORS.bot1, PLAYER_COLORS.bot2, PLAYER_COLORS.bot3];
    for (let i = 0; i < DIFFICULTY_PRESETS[this.difficulty].botCount; i++) {
      const sp = botSpawns[i];
      g.fillStyle(botColors[i], 0.8);
      g.fillCircle(ox + sp.x * gridW, oy + sp.y * gridH, 3);
    }
  }

  // ── Helpers ──

  private renderButton(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean): void {
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 2, y + 2, w, h, 8);
    g.fillStyle(hover ? 0x1e1e3a : 0x12122a, 0.9);
    g.fillRoundedRect(x, y, w, h, 8);
    g.fillStyle(0xffffff, 0.04);
    g.fillRect(x + 4, y + 2, w - 8, 1);
    g.lineStyle(1, hover ? 0xffd700 : 0x333355, hover ? 0.6 : 0.3);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  private renderPlayButton(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean): void {
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 2, y + 2, w, h, 8);
    g.fillStyle(hover ? 0x2a2240 : 0x1a1830, 0.95);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, 0xffd700, hover ? 0.8 : 0.4);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  private startGame(): void {
    const config = buildGameConfig(this.difficulty, this.mapKey, this.duration, this.mapTemplate);
    this.scene.start('GameScene', { config });
  }

  // ── Background animation ──

  private spawnAmbient(color: number): void {
    this.particles.push({
      x: Math.random() * this.scale.width,
      y: Math.random() * this.scale.height,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 3000 + Math.random() * 4000,
      maxLife: 6000,
      color,
      size: 1 + Math.random() * 2,
    });
  }

  update(): void {
    // Glow blobs
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

    // Ambient particles
    this.particleGraphics.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 16.67;
      if (p.life <= 0) {
        const colors = [0xffd700, 0x4a9eff, 0xb44aff];
        this.spawnAmbient(colors[i % 3]);
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      if (p.x < 0) p.x += this.scale.width;
      if (p.x > this.scale.width) p.x -= this.scale.width;
      if (p.y < 0) p.y += this.scale.height;
      if (p.y > this.scale.height) p.y -= this.scale.height;

      const lr = p.life / p.maxLife;
      const r = (p.color >> 16) & 0xff;
      const g = (p.color >> 8) & 0xff;
      const b = p.color & 0xff;

      this.particleGraphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), lr * 0.3);
      this.particleGraphics.fillCircle(p.x, p.y, p.size);
    }
  }
}
