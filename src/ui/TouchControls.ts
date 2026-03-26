import Phaser from 'phaser';
import { PlayerLight } from '../entities/PlayerLight';

interface TouchButton {
  x: number;
  y: number;
  radius: number;
  active: boolean;
  graphics: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

/**
 * Virtual joystick (left thumb) + action buttons (right side) for mobile.
 * Detects touch devices automatically via pointer count / no keyboard.
 */
export class TouchControls {
  private scene: Phaser.Scene;
  private player: PlayerLight;
  private enabled = false;

  // Joystick
  private joystickBase: Phaser.GameObjects.Graphics;
  private joystickKnob: Phaser.GameObjects.Graphics;
  private joystickX = 0;
  private joystickY = 0;
  private joystickBaseX = 0;
  private joystickBaseY = 0;
  private joystickBaseRadius = 50;
  private joystickKnobRadius = 22;
  private joystickPointerId = -1;

  // Action buttons
  private sprintBtn!: TouchButton;
  private obstacleBtn!: TouchButton;
  private pauseBtn!: TouchButton;
  private buttons: TouchButton[] = [];

  // Sprint state
  private sprintHeld = false;

  // Callbacks
  private onPause: () => void;
  private onPlaceObstacle: (pointer: Phaser.Input.Pointer) => void;

  // Layout
  private readonly JOYSTICK_DEAD_ZONE = 0.15;

  constructor(
    scene: Phaser.Scene,
    player: PlayerLight,
    onPause: () => void,
    onPlaceObstacle: (pointer: Phaser.Input.Pointer) => void,
  ) {
    this.scene = scene;
    this.player = player;
    this.onPause = onPause;
    this.onPlaceObstacle = onPlaceObstacle;

    // Create joystick graphics (hidden until enabled)
    this.joystickBase = scene.add.graphics().setDepth(300).setVisible(false);
    this.joystickKnob = scene.add.graphics().setDepth(301).setVisible(false);

    this.createButtons();
    this.setupInput();
  }

  /** Enable/disable touch controls. When disabled, player uses keyboard. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.player.useTouchInput = enabled;
    this.joystickBase.setVisible(enabled);
    this.joystickKnob.setVisible(enabled);
    for (const btn of this.buttons) {
      btn.graphics.setVisible(enabled);
      btn.label.setVisible(enabled);
    }

    if (enabled) {
      this.layoutElements();
    }

    // Reset state
    if (!enabled) {
      this.player.setTouchMove(0, 0);
      this.player.setTouchSprint(false);
      this.sprintHeld = false;
      this.joystickPointerId = -1;
    }
  }

  /** Check if currently active (touch input detected) */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Recalculate positions (call on resize) */
  layoutElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // Joystick — bottom-left
    this.joystickBaseX = 80;
    this.joystickBaseY = H - 100;

    // Action buttons — bottom-right
    const btnSize = 36;
    const gap = 16;
    const rightX = W - 80;

    this.layoutButton(this.obstacleBtn, rightX - gap - btnSize, H - 100, btnSize);
    this.layoutButton(this.sprintBtn, rightX, H - 100 - gap - btnSize, btnSize);
    this.layoutButton(this.pauseBtn, W - 36, 36, 24);

    // Redraw joystick at rest
    this.drawJoystickRest();
  }

  destroy(): void {
    this.joystickBase.destroy();
    this.joystickKnob.destroy();
    for (const btn of this.buttons) {
      btn.graphics.destroy();
      btn.label.destroy();
    }
  }

  // ── Private ──

  private createButtons(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const depth = 300;

    // Sprint button (B)
    this.sprintBtn = this.makeButton(W - 80, H - 180, 36, 'SPRINT', depth);

    // Obstacle button (A)
    this.obstacleBtn = this.makeButton(W - 132, H - 100, 36, 'WALL', depth);

    // Pause button (top-right)
    this.pauseBtn = this.makeButton(W - 36, 36, 24, '❚❚', depth);

    this.buttons = [this.sprintBtn, this.obstacleBtn, this.pauseBtn];
    for (const btn of this.buttons) {
      btn.graphics.setVisible(false);
      btn.label.setVisible(false);
    }
  }

  private makeButton(x: number, y: number, radius: number, label: string, depth: number): TouchButton {
    const g = this.scene.add.graphics().setDepth(depth);
    const t = this.scene.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '10px', color: '#aaaacc',
    }).setOrigin(0.5).setDepth(depth + 1);

    return { x, y, radius, active: false, graphics: g, label: t };
  }

  private layoutButton(btn: TouchButton, x: number, y: number, radius: number): void {
    btn.x = x;
    btn.y = y;
    btn.radius = radius;
    btn.label.setPosition(x, y);
    this.drawButton(btn);
  }

  private drawButton(btn: TouchButton): void {
    const g = btn.graphics;
    g.clear();
    const alpha = btn.active ? 0.6 : 0.3;
    g.fillStyle(0x2a2a5a, alpha);
    g.fillCircle(btn.x, btn.y, btn.radius);
    g.lineStyle(2, btn.active ? 0x6a6aaff : 0x4a4a88, 0.5);
    g.strokeCircle(btn.x, btn.y, btn.radius);
    btn.label.setColor(btn.active ? '#ffd700' : '#aaaacc');
  }

  private drawJoystickRest(): void {
    this.joystickBase.clear();
    this.joystickBase.lineStyle(2, 0x4a4a88, 0.3);
    this.joystickBase.strokeCircle(this.joystickBaseX, this.joystickBaseY, this.joystickBaseRadius);
    this.joystickBase.fillStyle(0x1a1a3a, 0.2);
    this.joystickBase.fillCircle(this.joystickBaseX, this.joystickBaseY, this.joystickBaseRadius);

    this.joystickKnob.clear();
    this.joystickKnob.fillStyle(0x3a3a6a, 0.5);
    this.joystickKnob.fillCircle(this.joystickBaseX, this.joystickBaseY, this.joystickKnobRadius);
  }

  private setupInput(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled) return;

      // Only handle touch pointers (not mouse)
      if (!pointer.wasTouch) return;

      const px = pointer.x;
      const py = pointer.y;

      // Check buttons first (right side)
      if (this.hitButton(this.pauseBtn, px, py)) {
        this.pauseBtn.active = true;
        this.drawButton(this.pauseBtn);
        this.onPause();
        return;
      }

      if (this.hitButton(this.sprintBtn, px, py)) {
        this.sprintBtn.active = true;
        this.sprintHeld = true;
        this.drawButton(this.sprintBtn);
        this.player.setTouchSprint(true);
        return;
      }

      if (this.hitButton(this.obstacleBtn, px, py)) {
        this.obstacleBtn.active = true;
        this.drawButton(this.obstacleBtn);
        // Place obstacle at player position
        this.onPlaceObstacle(pointer);
        return;
      }

      // Left half = joystick zone
      if (px < this.scene.scale.width / 2) {
        this.joystickPointerId = pointer.id;
        // Snap base to touch position for comfort
        this.joystickBaseX = px;
        this.joystickBaseY = py;
        this.joystickX = px;
        this.joystickY = py;
        this.drawJoystickRest();
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      if (pointer.id !== this.joystickPointerId) return;

      const dx = pointer.x - this.joystickBaseX;
      const dy = pointer.y - this.joystickBaseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = this.joystickBaseRadius;

      let normX = 0;
      let normY = 0;

      if (dist > this.JOYSTICK_DEAD_ZONE * maxDist) {
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        normX = (clampedDist / maxDist) * Math.cos(angle);
        normY = (clampedDist / maxDist) * Math.sin(angle);

        this.joystickX = this.joystickBaseX + normX * maxDist;
        this.joystickY = this.joystickBaseY + normY * maxDist;
      } else {
        this.joystickX = this.joystickBaseX;
        this.joystickY = this.joystickBaseY;
      }

      this.player.setTouchMove(normX, normY);

      // Redraw knob
      this.joystickKnob.clear();
      this.joystickKnob.fillStyle(0x5a5a8a, 0.7);
      this.joystickKnob.fillCircle(this.joystickX, this.joystickY, this.joystickKnobRadius);
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled) return;

      if (pointer.id === this.joystickPointerId) {
        this.joystickPointerId = -1;
        this.player.setTouchMove(0, 0);
        this.joystickX = this.joystickBaseX;
        this.joystickY = this.joystickBaseY;
        this.drawJoystickRest();
      }

      // Release buttons
      if (this.sprintBtn.active) {
        this.sprintBtn.active = false;
        this.sprintHeld = false;
        this.drawButton(this.sprintBtn);
        this.player.setTouchSprint(false);
      }
      if (this.obstacleBtn.active) {
        this.obstacleBtn.active = false;
        this.drawButton(this.obstacleBtn);
      }
      if (this.pauseBtn.active) {
        this.pauseBtn.active = false;
        this.drawButton(this.pauseBtn);
      }
    });

    // Handle resize
    this.scene.scale.on('resize', () => {
      if (this.enabled) this.layoutElements();
    });
  }

  private hitButton(btn: TouchButton, px: number, py: number): boolean {
    const dx = px - btn.x;
    const dy = py - btn.y;
    return dx * dx + dy * dy <= btn.radius * btn.radius;
  }
}
