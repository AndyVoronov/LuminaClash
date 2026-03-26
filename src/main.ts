import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: document.body,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a0f',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    preserveDrawingBuffer: true,
    antialias: true,
  },
  scene: [MenuScene, GameScene],
};

const game = new Phaser.Game(config);

// Export for debugging
(window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
