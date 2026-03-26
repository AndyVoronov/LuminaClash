import Phaser from 'phaser';
import { CELL_SIZE, PLAYER_COLORS } from '../config';
import { LightSystem } from '../systems/LightSystem';

export class PlayerLight {
  container: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Graphics;
  core: Phaser.GameObjects.Arc;
  id: string;
  color: number;
  lightRadius: number;
  lightSpeed: number;

  // World position (center of the light)
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
  private readonly SPRINT_COST = 40; // per second
  private readonly SPRINT_REGEN = 15; // per second
  private readonly SPRINT_MULT = 1.8;

  // Illuminated cells for rendering
  illuminatedCells: Set<string> = new Set();

  // Obstacle placement
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

    // Glow effect
    this.glow = scene.add.graphics();
    this.glow.setDepth(3);

    // Core circle
    this.core = scene.add.circle(0, 0, 8, color);
    this.core.setStrokeStyle(2, 0xffffff, 0.6);
    this.core.setDepth(6);

    this.container = scene.add.container(0, 0, [this.glow, this.core]);

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
  }

  update(delta: number, gridWidth: number, gridHeight: number, offsetX: number, offsetY: number): void {
    // For player: read keyboard input (resets moveX/Y)
    // For bots: moveX/Y were set by BotAI via setMoveInput(), keep them
    if (this.cursors) {
      this.moveX = 0;
      this.moveY = 0;

      if (this.cursors.left.isDown || this.wasd!.A.isDown) this.moveX = -1;
      if (this.cursors.right.isDown || this.wasd!.D.isDown) this.moveX = 1;
      if (this.cursors.up.isDown || this.wasd!.W.isDown) this.moveY = -1;
      if (this.cursors.down.isDown || this.wasd!.S.isDown) this.moveY = 1;
    }

    // Normalize diagonal movement
    if (this.moveX !== 0 && this.moveY !== 0) {
      const norm = 1 / Math.sqrt(2);
      this.moveX *= norm;
      this.moveY *= norm;
    }

    // Apply movement
    let speed = this.lightSpeed * (delta / 1000);

    // Sprint logic (player only)
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

    // Clamp to grid bounds
    const minX = offsetX;
    const maxX = offsetX + gridWidth * CELL_SIZE;
    const minY = offsetY;
    const maxY = offsetY + gridHeight * CELL_SIZE;

    this.wx = Phaser.Math.Clamp(this.wx, minX, maxX);
    this.wy = Phaser.Math.Clamp(this.wy, minY, maxY);

    this.container.setPosition(this.wx, this.wy);
  }

  renderGlow(): void {
    this.glow.clear();
    const r = (this.color >> 16) & 0xff;
    const g = (this.color >> 8) & 0xff;
    const b = this.color & 0xff;

    // Outer glow
    const radiusPx = this.lightRadius * CELL_SIZE;
    this.glow.fillGradientStyle(
      Phaser.Display.Color.GetColor(r, g, b), Phaser.Display.Color.GetColor(r, g, b),
      Phaser.Display.Color.GetColor(r, g, b), Phaser.Display.Color.GetColor(r, g, b),
      0.06, 0.06, 0.06, 0.06,
    );
    this.glow.fillCircle(0, 0, radiusPx);

    // Inner glow
    this.glow.fillGradientStyle(
      Phaser.Display.Color.GetColor(r, g, b), Phaser.Display.Color.GetColor(r, g, b),
      Phaser.Display.Color.GetColor(r, g, b), Phaser.Display.Color.GetColor(r, g, b),
      0.15, 0.15, 0.15, 0.15,
    );
    this.glow.fillCircle(0, 0, radiusPx * 0.6);

    // Core glow
    this.glow.fillGradientStyle(
      Phaser.Display.Color.GetColor(255, 255, 255), Phaser.Display.Color.GetColor(255, 255, 255),
      Phaser.Display.Color.GetColor(r, g, b), Phaser.Display.Color.GetColor(r, g, b),
      0.3, 0.3, 0.1, 0.1,
    );
    this.glow.fillCircle(0, 0, radiusPx * 0.15);
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

  getSprintInfo(): { energy: number; max: number; active: boolean } | null {
    if (!this.shiftKey) return null;
    return { energy: this.sprintEnergy, max: this.SPRINT_MAX, active: this.sprinting };
  }

  destroy(): void {
    this.container.destroy();
  }
}
