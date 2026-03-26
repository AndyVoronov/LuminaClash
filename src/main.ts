import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: document.body,
  width: 800,
  height: 600,
  backgroundColor: '#0a0a0f',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MenuScene, GameScene],
  input: {
    keyboard: {
      target: window,
    },
    mouse: {
      target: window,
    },
    touch: {
      target: window,
    },
  },
};

const game = new Phaser.Game(config);

// Export for debugging
(window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
