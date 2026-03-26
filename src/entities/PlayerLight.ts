import Phaser from 'phaser';
import { CELL_SIZE } from '../config';

export class PlayerLight {
  container: Phaser.GameObjects.Container;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private coreGraphics: Phaser.GameObjects.Graphics;
  id: string;
  color: number;
  lightRadius: number;
  lightSpeed: number;

  wx: number = 0;
  wy: number = 0;

  // Movement
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key } | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private moveX: number = 0;
  private moveY: number = 0;

  // Sprint
  private sprinting = false;
  private sprintEnergy = 100;
  private readonly SPRINT_MAX = 100;
  private readonly SPRINT_COST = 40;
  private readonly SPRINT_REGEN = 15;
  private readonly SPRINT_MULT = 1.8;

  // Visual
  private pulsePhase: number;
  private label: Phaser.GameObjects.Text | null = null;

  // Power-up modifiers
  private speedMult: number = 1;
  private radiusBonus: number = 0;
  private shielded: boolean = false;

  illuminatedCells: Set<string> = new Set();

  obstacleBudget: number;
  lastPlacementTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    id: string,
    color: number,
    lightRadius: number,
    lightSpeed: number,
    obstacleBudget: number,
    isPlayer: boolean,
  ) {
    this.id = id;
    this.color = color;
    this.lightRadius = lightRadius;
    this.lightSpeed = lightSpeed;
    this.obstacleBudget = obstacleBudget;
    this.pulsePhase = Math.random() * Math.PI * 2;

    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setDepth(3);

    this.coreGraphics = scene.add.graphics();
    this.coreGraphics.setDepth(7);

    this.container = scene.add.container(0, 0, [this.glowGraphics, this.coreGraphics]);

    // Player label
    if (isPlayer) {
      this.label = scene.add.text(0, -18, 'YOU', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.5).setDepth(7);
    } else {
      this.label = scene.add.text(0, -18, id.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#aaaaaa',
      }).setOrigin(0.5).setAlpha(0.4).setDepth(7);
    }

    if (isPlayer) {
      this.cursors = scene.input.keyboard!.createCursorKeys();
      this.wasd = {
        W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.shiftKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }
  }

  setPosition(wx: number, wy: number): void {
    this.wx = wx;
    this.wy = wy;
    this.container.setPosition(wx, wy);
    if (this.label) this.label.setPosition(wx, wy - 20);
  }

  update(delta: number, gridWidth: number, gridHeight: number, offsetX: number, offsetY: number): void {
    if (this.cursors) {
      this.moveX = 0;
      this.moveY = 0;
      if (this.cursors.left.isDown || this.wasd!.A.isDown) this.moveX = -1;
      if (this.cursors.right.isDown || this.wasd!.D.isDown) this.moveX = 1;
      if (this.cursors.up.isDown || this.wasd!.W.isDown) this.moveY = -1;
      if (this.cursors.down.isDown || this.wasd!.S.isDown) this.moveY = 1;
    }

    if (this.moveX !== 0 && this.moveY !== 0) {
      const norm = 1 / Math.sqrt(2);
      this.moveX *= norm;
      this.moveY *= norm;
    }

    let speed = this.lightSpeed * (delta / 1000) * this.speedMult;

    if (this.shiftKey) {
      this.sprinting = this.shiftKey.isDown && this.sprintEnergy > 0 && (this.moveX !== 0 || this.moveY !== 0);
      if (this.sprinting) {
        speed *= this.SPRINT_MULT;
        this.sprintEnergy = Math.max(0, this.sprintEnergy - this.SPRINT_COST * (delta / 1000));
      } else {
        this.sprintEnergy = Math.min(this.SPRINT_MAX, this.sprintEnergy + this.SPRINT_REGEN * (delta / 1000));
      }
    }

    this.wx += this.moveX * speed;
    this.wy += this.moveY * speed;

    const minX = offsetX;
    const maxX = offsetX + gridWidth * CELL_SIZE;
    const minY = offsetY;
    const maxY = offsetY + gridHeight * CELL_SIZE;

    this.wx = Phaser.Math.Clamp(this.wx, minX, maxX);
    this.wy = Phaser.Math.Clamp(this.wy, minY, maxY);

    this.container.setPosition(this.wx, this.wy);
    if (this.label) this.label.setPosition(this.wx, this.wy - 20);
  }

  renderGlow(): void {
    const g = this.glowGraphics;
    g.clear();
    const r = (this.color >> 16) & 0xff;
    const gb = (this.color >> 8) & 0xff;
    const b = this.color & 0xff;

    const t = Date.now() / 1000;
    this.pulsePhase += 0.03;
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.08;
    const radiusPx = this.lightRadius * CELL_SIZE * pulse;

    // Layer 1: Wide ambient halo
    g.fillStyle(Phaser.Display.Color.GetColor(r, gb, b), 0.03);
    g.fillCircle(0, 0, radiusPx * 1.15);

    // Layer 2: Main glow
    g.fillStyle(Phaser.Display.Color.GetColor(r, gb, b), 0.05);
    g.fillCircle(0, 0, radiusPx * 0.85);

    // Layer 3: Bright inner zone
    g.fillStyle(Phaser.Display.Color.GetColor(r, gb, b), 0.1);
    g.fillCircle(0, 0, radiusPx * 0.5);

    // Layer 4: Hot core
    g.fillStyle(Phaser.Display.Color.GetColor(
      Math.min(255, r + 80), Math.min(255, gb + 80), Math.min(255, b + 80),
    ), 0.15);
    g.fillCircle(0, 0, radiusPx * 0.2);

    // ── Core orb ──
    const c = this.coreGraphics;
    c.clear();

    // Sprint trail effect
    if (this.sprinting) {
      c.fillStyle(Phaser.Display.Color.GetColor(r, gb, b), 0.15);
      c.fillCircle(
        -this.moveX * 6 - this.moveY * 3,
        -this.moveY * 6 + this.moveX * 3,
        10,
      );
      c.fillCircle(
        -this.moveX * 12 - this.moveY * 5,
        -this.moveY * 12 + this.moveX * 5,
        6,
      );
    }

    // Outer ring
    c.lineStyle(1.5, Phaser.Display.Color.GetColor(r, gb, b), 0.4);
    c.strokeCircle(0, 0, 10);

    // Core fill — bright center
    c.fillStyle(Phaser.Display.Color.GetColor(
      Math.min(255, r + 120), Math.min(255, gb + 120), Math.min(255, b + 120),
    ), 0.9);
    c.fillCircle(0, 0, 6);

    // White hot center
    c.fillStyle(0xffffff, 0.7);
    c.fillCircle(0, 0, 3);
  }

  getGridPosition(offsetX: number, offsetY: number): { cx: number; cy: number } {
    return {
      cx: (this.wx - offsetX) / CELL_SIZE,
      cy: (this.wy - offsetY) / CELL_SIZE,
    };
  }

  setMoveInput(x: number, y: number): void {
    this.moveX = x;
    this.moveY = y;
  }

  // ── Power-up modifiers ──

  setSpeedMult(mult: number): void { this.speedMult = mult; }
  setRadiusBonus(bonus: number): void { this.radiusBonus = bonus; }
  setShielded(active: boolean): void { this.shielded = active; }

  get effectiveRadius(): number {
    return this.lightRadius + this.radiusBonus;
  }

  getSprintInfo(): { energy: number; max: number; active: boolean } | null {
    if (!this.shiftKey) return null;
    return { energy: this.sprintEnergy, max: this.SPRINT_MAX, active: this.sprinting };
  }

  destroy(): void {
    if (this.label) this.label.destroy();
    this.container.destroy();
  }
}
