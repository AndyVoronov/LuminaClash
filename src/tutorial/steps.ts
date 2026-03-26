/**
 * Tutorial system — step-by-step onboarding overlay.
 * Shows guided instructions during first match (or from menu "How to Play").
 *
 * Steps:
 *   1. Move (WASD/arrows)
 *   2. Territory capture (move over cells)
 *   3. Sprint (Shift)
 *   4. Place obstacles (click)
 *   5. Power-ups
 *   6. Win condition (timer + territory)
 */

export interface TutorialStep {
  text: string;
  /** Phaser key constant for the highlighted area (e.g., 'W', 'A', 'S', 'D') */
  highlight?: string;
  /** Position of the text bubble: 'top' | 'center' | 'bottom' */
  position: 'top' | 'center' | 'bottom';
  /** Auto-advance after this many ms (0 = wait for action) */
  autoAdvance?: number;
  /** Key or pointer action to advance */
  advanceOn?: 'move' | 'click' | 'sprint' | 'any';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    text: 'Use WASD or Arrow Keys to move your light orb',
    position: 'bottom',
    advanceOn: 'move',
  },
  {
    text: 'Cells you illuminate change to your color — that\'s your territory!',
    position: 'bottom',
    autoAdvance: 3000,
  },
  {
    text: 'Hold SHIFT to sprint — faster capture but uses energy',
    position: 'bottom',
    advanceOn: 'sprint',
  },
  {
    text: 'Click to place walls — block opponents from your territory',
    position: 'bottom',
    advanceOn: 'click',
  },
  {
    text: 'Grab ⚡ speed, 💣 bombs, and 🛡️ shields when they appear',
    position: 'top',
    autoAdvance: 3000,
  },
  {
    text: 'Control the most territory before time runs out — good luck!',
    position: 'center',
    advanceOn: 'any',
  },
];
