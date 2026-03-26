import Phaser from 'phaser';
import { TUTORIAL_STEPS, type TutorialStep } from './steps';

const SAVE_KEY = 'luminaclash_tutorial_done';

/**
 * Renders a step-by-step tutorial overlay in the game scene.
 * Tracks completion via localStorage so it only shows once.
 */
export class TutorialOverlay {
  private scene: Phaser.Scene;
  private steps: TutorialStep[] = [];
  private currentStep = 0;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private active = false;
  private onStepComplete?: (step: TutorialStep) => void;
  private onComplete?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Check if tutorial has been completed before */
  static isDone(): boolean {
    try { return localStorage.getItem(SAVE_KEY) === 'true'; } catch { return false; }
  }

  /** Mark tutorial as done */
  static markDone(): void {
    try { localStorage.setItem(SAVE_KEY, 'true'); } catch { /* noop */ }
  }

  /** Reset tutorial (for "How to Play" re-play) */
  static reset(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
  }

  /**
   * Start tutorial overlay.
   * @param onComplete called when all steps are done
   */
  start(
    onStepComplete?: (step: TutorialStep) => void,
    onComplete?: () => void,
  ): void {
    this.steps = [...TUTORIAL_STEPS];
    this.currentStep = 0;
    this.onStepComplete = onStepComplete;
    this.onComplete = onComplete;
    this.active = true;
    this.showStep();
  }

  /** Call from game update when player moves */
  notifyMove(): void {
    if (!this.active) return;
    const step = this.steps[this.currentStep];
    if (step?.advanceOn === 'move') this.advance();
  }

  /** Call when player clicks/obstacle placed */
  notifyClick(): void {
    if (!this.active) return;
    const step = this.steps[this.currentStep];
    if (step?.advanceOn === 'click' || step?.advanceOn === 'any') this.advance();
  }

  /** Call when player activates sprint */
  notifySprint(): void {
    if (!this.active) return;
    const step = this.steps[this.currentStep];
    if (step?.advanceOn === 'sprint') this.advance();
  }

  /** Call from any key press */
  notifyKey(): void {
    if (!this.active) return;
    const step = this.steps[this.currentStep];
    if (step?.advanceOn === 'any') this.advance();
  }

  isActive(): boolean {
    return this.active;
  }

  dismiss(): void {
    this.clear();
    this.active = false;
    TutorialOverlay.markDone();
    this.onComplete?.();
  }

  destroy(): void {
    this.clear();
  }

  private showStep(): void {
    this.clear();

    if (this.currentStep >= this.steps.length) {
      this.dismiss();
      return;
    }

    const step = this.steps[this.currentStep];
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // Dim overlay (not too dark — player should still see the game)
    const dim = this.scene.add.graphics().setDepth(400);
    dim.fillStyle(0x050508, 0.5);
    dim.fillRect(0, 0, W, H);
    this.elements.push(dim);

    // Text bubble
    const bubbleW = Math.min(500, W - 40);
    const bubbleH = 70;
    let bubbleX = W / 2 - bubbleW / 2;
    let bubbleY: number;

    switch (step.position) {
      case 'top': bubbleY = 60; break;
      case 'center': bubbleY = H / 2 - bubbleH / 2; break;
      case 'bottom': default: bubbleY = H - bubbleH - 80; break;
    }

    const bubble = this.scene.add.graphics().setDepth(401);
    bubble.fillStyle(0x0c0c1a, 0.92);
    bubble.fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 10);
    bubble.lineStyle(1.5, 0x4a4a88, 0.5);
    bubble.strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 10);
    this.elements.push(bubble);

    // Step text
    const text = this.scene.add.text(W / 2, bubbleY + bubbleH / 2, step.text, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ddddee',
      wordWrap: { width: bubbleW - 32 },
      align: 'center',
    }).setOrigin(0.5).setDepth(402);
    this.elements.push(text);

    // Progress dots
    const dotY = bubbleY + bubbleH + 12;
    for (let i = 0; i < this.steps.length; i++) {
      const dotX = W / 2 + (i - (this.steps.length - 1) / 2) * 16;
      const dot = this.scene.add.circle(dotX, dotY, i === this.currentStep ? 4 : 3,
        i === this.currentStep ? 0x6a6aff : 0x333355,
      ).setDepth(402);
      this.elements.push(dot);
    }

    // Skip button
    const skipText = this.scene.add.text(W - 60, 20, 'Skip ▸', {
      fontFamily: 'monospace', fontSize: '12px', color: '#555577',
    }).setDepth(402).setInteractive({ useHandCursor: true });
    this.elements.push(skipText);
    skipText.on('pointerover', () => skipText.setColor('#aaaacc'));
    skipText.on('pointerout', () => skipText.setColor('#555577'));
    skipText.on('pointerdown', () => this.dismiss());

    // Auto-advance
    if (step.autoAdvance && step.autoAdvance > 0) {
      this.scene.time.delayedCall(step.autoAdvance, () => {
        if (this.active && this.steps[this.currentStep] === step) {
          this.advance();
        }
      });
    }
  }

  private advance(): void {
    if (!this.active) return;
    const completedStep = this.steps[this.currentStep];
    this.currentStep++;
    this.onStepComplete?.(completedStep);
    this.showStep();
  }

  private clear(): void {
    for (const el of this.elements) {
      el.destroy();
    }
    this.elements = [];
  }
}
