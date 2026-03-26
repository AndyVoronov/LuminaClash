/**
 * JuiceSystem — screen shake, slow-motion, combo counter, vignette, capture flash.
 * Makes the game feel punchy and responsive.
 */

import Phaser from 'phaser';

export interface ComboState {
  count: number;
  timer: number;   // ms since last capture
  mult: number;    // score multiplier
}

export class JuiceSystem {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;
  private originalX = 0;
  private originalY = 0;

  // Slow-motion
  private slowMoScale = 1;
  private slowMoTimer = 0;
  private slowMoDuration = 0;

  // Combo
  private combo: ComboState = { count: 0, timer: 0, mult: 1 };
  private comboWindow = 1200; // ms to chain captures
  private comboText: Phaser.GameObjects.Text | null = null;
  private comboContainer: Phaser.GameObjects.Container | null = null;

  // Vignette
  private vignetteGraphics: Phaser.GameObjects.Graphics | null = null;

  // Capture flash
  private flashGraphics: Phaser.GameObjects.Graphics | null = null;
  private flashAlpha = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(300);
  }

  // ── Screen Shake ──

  /**
   * Shake the camera.
   * @param intensity Max pixel displacement
   * @param duration  Duration in ms
   */
  shake(intensity: number = 4, duration: number = 200): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    if (this.shakeTimer === 0) {
      this.originalX = this.scene.cameras.main.scrollX;
      this.originalY = this.scene.cameras.main.scrollY;
    }
    this.shakeTimer = this.shakeDuration;
  }

  private updateShake(delta: number): void {
    if (this.shakeTimer <= 0) {
      if (this.shakeOffsetX !== 0 || this.shakeOffsetY !== 0) {
        this.scene.cameras.main.scrollX -= this.shakeOffsetX;
        this.scene.cameras.main.scrollY -= this.shakeOffsetY;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
      return;
    }

    this.shakeTimer -= delta;
    const progress = 1 - this.shakeTimer / this.shakeDuration;
    const currentIntensity = this.shakeIntensity * (1 - progress);

    // Remove previous offset
    this.scene.cameras.main.scrollX -= this.shakeOffsetX;
    this.scene.cameras.main.scrollY -= this.shakeOffsetY;

    // New offset
    this.shakeOffsetX = (Math.random() * 2 - 1) * currentIntensity;
    this.shakeOffsetY = (Math.random() * 2 - 1) * currentIntensity;

    this.scene.cameras.main.scrollX += this.shakeOffsetX;
    this.scene.cameras.main.scrollY += this.shakeOffsetY;
  }

  // ── Slow Motion ──

  /**
   * Slow down time.
   * @param scale Time scale (0.3 = very slow)
   * @param duration Duration in ms
   */
  triggerSlowMo(scale: number = 0.3, duration: number = 500): void {
    if (this.slowMoTimer > 0) return; // Don't stack
    this.slowMoScale = scale;
    this.slowMoDuration = duration;
    this.slowMoTimer = duration;
    this.scene.time.timeScale = scale;
  }

  private updateSlowMo(delta: number): void {
    if (this.slowMoTimer <= 0) return;

    this.slowMoTimer -= delta;
    if (this.slowMoTimer <= 0) {
      this.scene.time.timeScale = 1;
      this.slowMoScale = 1;
    } else {
      // Smooth ease-out in last 30%
      const remaining = this.slowMoTimer / this.slowMoDuration;
      if (remaining < 0.3) {
        const t = remaining / 0.3; // 0..1
        const eased = this.slowMoScale + (1 - this.slowMoScale) * (1 - t);
        this.scene.time.timeScale = eased;
      }
    }
  }

  // ── Combo ──

  /**
   * Register a capture event. Call when player captures a cell.
   * @param worldX Screen X of capture
   * @param worldY Screen Y of capture
   */
  addCapture(worldX: number, worldY: number): void {
    const now = this.scene.time.now;

    if (now - this.combo.timer < this.comboWindow) {
      this.combo.count++;
    } else {
      this.combo.count = 1;
    }
    this.combo.timer = now;

    // Multiplier: 1x below 5, 2x at 5-9, 3x at 10-14, 4x at 15+
    if (this.combo.count >= 15) this.combo.mult = 4;
    else if (this.combo.count >= 10) this.combo.mult = 3;
    else if (this.combo.count >= 5) this.combo.mult = 2;
    else this.combo.mult = 1;

    this.showComboText(worldX, worldY);
  }

  /** Reset combo (e.g. when player dies or gets stunned) */
  resetCombo(): void {
    this.combo.count = 0;
    this.combo.mult = 1;
    this.combo.timer = 0;
    this.hideComboText();
  }

  getComboMult(): number {
    return this.combo.mult;
  }

  private showComboText(x: number, y: number): void {
    // Hide existing
    this.hideComboText();

    if (this.combo.count < 3) return; // Show from 3rd capture

    const text = `${this.combo.count}x COMBO`;
    const color = this.combo.mult >= 4 ? '#ff4488' :
                  this.combo.mult >= 3 ? '#ffaa00' :
                  this.combo.mult >= 2 ? '#44ff88' : '#8888aa';

    this.comboContainer = this.scene.add.container(x, y - 20).setDepth(250);
    this.comboText = this.scene.add.text(0, 0, text, {
      fontFamily: 'monospace',
      fontSize: this.combo.mult >= 3 ? '18px' : '14px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.comboContainer.add(this.comboText);

    // Float up and fade
    this.scene.tweens.add({
      targets: this.comboContainer,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => this.hideComboText(),
    });
  }

  private hideComboText(): void {
    if (this.comboContainer) {
      this.comboContainer.destroy();
      this.comboContainer = null;
      this.comboText = null;
    }
  }

  // ── Vignette ──

  /** Show/hide vignette based on urgency. Call each frame with current state. */
  updateVignette(timeLeft: number, matchDuration: number, playerHealth: number = 1): void {
    if (!this.vignetteGraphics) {
      this.vignetteGraphics = this.scene.add.graphics().setDepth(299).setScrollFactor(0);
    }

    const urgency = this.calcUrgency(timeLeft, matchDuration, playerHealth);
    if (urgency <= 0) {
      this.vignetteGraphics.clear();
      return;
    }

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const maxDim = Math.max(W, H);
    const innerRadius = Math.max(1, maxDim * 0.3 * (1 - urgency * 0.3));
    const outerRadius = Math.max(innerRadius + 1, maxDim * 0.75);

    this.vignetteGraphics.clear();
    this.vignetteGraphics.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,
      0, 0, 0, Math.floor(urgency * 0.6),
    );
    this.vignetteGraphics.slice(
      W / 2, H / 2, outerRadius,
      Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(360), false,
    );
    this.vignetteGraphics.fillPath();
  }

  private calcUrgency(timeLeft: number, matchDuration: number, health: number): number {
    if (matchDuration <= 0) return 0;
    const timeRatio = timeLeft / matchDuration;

    let urgency = 0;
    if (timeRatio < 0.1) urgency = 1;
    else if (timeRatio < 0.25) urgency = 0.7;
    else if (timeRatio < 0.4) urgency = 0.3;

    // Health factor (if shield is used, health < 1 = urgent)
    urgency = Math.max(urgency, (1 - health) * 0.5);

    return Math.min(1, urgency);
  }

  // ── Capture Flash ──

  /** Brief screen flash on power-up activation */
  flash(color: number = 0xffffff, alpha: number = 0.15, duration: number = 150): void {
    this.flashAlpha = alpha;
    this.flashColor = color;

    if (!this.flashGraphics) {
      this.flashGraphics = this.scene.add.graphics().setDepth(298).setScrollFactor(0);
    }

    this.flashGraphics.clear();
    this.flashGraphics.fillStyle(color, alpha);
    this.flashGraphics.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);

    this.scene.tweens.addCounter({
      from: alpha,
      to: 0,
      duration,
      ease: 'Power2',
      onUpdate: (tween) => {
        const a = tween.getValue() ?? 0;
        if (this.flashGraphics && a > 0.001) {
          this.flashGraphics.clear();
          this.flashGraphics.fillStyle(color, a);
          this.flashGraphics.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
        }
      },
      onComplete: () => {
        if (this.flashGraphics) this.flashGraphics.clear();
      },
    });
  }

  private flashColor = 0xffffff;

  // ── Territory Pulse ──

  /** Pulse the border when territory % crosses thresholds */
  private lastTerritoryPct = -1;

  checkTerritoryMilestone(pct: number): void {
    const milestones = [10, 25, 50, 75, 90];
    for (const m of milestones) {
      if (this.lastTerritoryPct < m && pct >= m) {
        this.flash(0x44ff88, 0.08, 300);
        break;
      }
    }
    this.lastTerritoryPct = pct;
  }

  // ── Main update ──

  update(delta: number): number {
    // Apply slow-mo to delta for consistent feel
    const realDelta = delta;
    this.updateShake(realDelta);
    this.updateSlowMo(realDelta);

    return realDelta * this.slowMoScale;
  }

  destroy(): void {
    this.hideComboText();
    if (this.vignetteGraphics) this.vignetteGraphics.destroy();
    if (this.flashGraphics) this.flashGraphics.destroy();
    this.container.destroy();
    if (this.scene.time.timeScale !== 1) {
      this.scene.time.timeScale = 1;
    }
  }
}
