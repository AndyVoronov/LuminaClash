import Phaser from 'phaser';
import { PLAYER_COLORS } from '../config';

export class HUD {
  private scene: Phaser.Scene;
  private statsTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private timerText: Phaser.GameObjects.Text;
  private obstacleText: Phaser.GameObjects.Text;
  private container: Phaser.GameObjects.Container;
  private playerObstacles: { id: string; budget: number; used: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    // Background panel
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(5, 5, 220, 160, 8);
    bg.lineStyle(1, 0x333344, 0.5);
    bg.strokeRoundedRect(5, 5, 220, 160, 8);
    this.container.add(bg);

    this.timerText = scene.add.text(15, 15, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
    });
    this.container.add(this.timerText);

    this.obstacleText = scene.add.text(15, 40, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    });
    this.container.add(this.obstacleText);
  }

  addPlayer(id: string, name: string): void {
    const y = 65 + this.statsTexts.size * 22;
    const colorHex = '#' + (PLAYER_COLORS[id] || 0xffffff).toString(16).padStart(6, '0');

    // Color indicator
    const dot = this.scene.add.circle(22, y + 7, 5, PLAYER_COLORS[id] || 0xffffff);
    this.container.add(dot);

    const text = this.scene.add.text(35, y, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: colorHex,
    });
    text.setName(id);
    this.container.add(text);
    this.statsTexts.set(id, text);
  }

  update(time: number, stats: Map<string, number>, totalCells: number): void {
    // Timer
    if (time >= 0) {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      this.timerText.setText(`⏱ ${mins}:${secs.toString().padStart(2, '0')}`);
    } else {
      this.timerText.setText('⏱ --:--');
    }

    // Player stats
    for (const [id, count] of stats) {
      const text = this.statsTexts.get(id);
      if (text) {
        const percent = ((count / totalCells) * 100).toFixed(1);
        text.setText(`${id === 'player' ? 'You' : id}: ${count} (${percent}%)`);
      }
    }

    // Ensure all players are shown (even with 0)
    for (const [id, text] of this.statsTexts) {
      const count = stats.get(id) || 0;
      const percent = ((count / totalCells) * 100).toFixed(1);
      text.setText(`${id === 'player' ? 'You' : id}: ${count} (${percent}%)`);
    }
  }

  updateObstacles(available: number, total: number): void {
    this.obstacleText.setText(`🧱 Obstacles: ${total - available}/${total}`);
  }

  destroy(): void {
    this.container.destroy();
  }
}
