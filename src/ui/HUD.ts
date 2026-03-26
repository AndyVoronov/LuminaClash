import Phaser from 'phaser';
import { PLAYER_COLORS, CELL_SIZE, CELL_STATE } from '../config';
import { GridSystem } from '../systems/GridSystem';

export class HUD {
  private scene: Phaser.Scene;
  private statsTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private timerText: Phaser.GameObjects.Text;
  private obstacleText: Phaser.GameObjects.Text;
  private sprintBar: Phaser.GameObjects.Graphics;
  private sprintText: Phaser.GameObjects.Text;
  private container: Phaser.GameObjects.Container;
  private minimapGraphics: Phaser.GameObjects.Graphics;
  private grid: GridSystem | null = null;
  private readonly MINIMAP_CELL = 3;
  private minimapX = 0;
  private minimapY = 0;

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

    // Sprint bar
    this.sprintBar = scene.add.graphics();
    this.sprintBar.setDepth(100);
    this.sprintText = scene.add.text(15, 60, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setDepth(100).setScrollFactor(0);

    // Minimap
    this.minimapGraphics = scene.add.graphics();
    this.minimapGraphics.setDepth(101);
  }

  setGrid(grid: GridSystem): void {
    this.grid = grid;
    this.minimapX = this.scene.scale.width - (grid.width * this.MINIMAP_CELL) - 12;
    this.minimapY = this.scene.scale.height - (grid.height * this.MINIMAP_CELL) - 12;
  }

  addPlayer(id: string, name: string): void {
    const y = 65 + this.statsTexts.size * 22;
    const colorHex = '#' + (PLAYER_COLORS[id] || 0xffffff).toString(16).padStart(6, '0');

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
      this.timerText.setText(`\u23F1 ${mins}:${secs.toString().padStart(2, '0')}`);
    } else {
      this.timerText.setText('\u23F1 --:--');
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
    this.obstacleText.setText(`Obstacles: ${total - available}/${total}`);
  }

  updateSprint(energy: number, max: number, active: boolean): void {
    const barX = 15;
    const barY = 78;
    const barW = 140;
    const barH = 6;
    const pct = energy / max;

    this.sprintBar.clear();
    this.sprintBar.fillStyle(0x222233, 0.8);
    this.sprintBar.fillRoundedRect(barX, barY, barW, barH, 3);

    const color = active ? 0xffd700 : 0x4a9eff;
    this.sprintBar.fillStyle(color, 0.8);
    this.sprintBar.fillRoundedRect(barX, barY, barW * pct, barH, 3);

    this.sprintText.setText(active ? 'SPRINT' : 'SHIFT to sprint');
    this.sprintText.setColor(active ? '#ffd700' : '#666666');
  }

  renderMinimap(): void {
    if (!this.grid) return;
    const g = this.minimapGraphics;
    g.clear();

    const cs = this.MINIMAP_CELL;
    const mx = this.minimapX;
    const my = this.minimapY;

    // Background
    g.fillStyle(0x000000, 0.6);
    g.fillRect(mx - 2, my - 2, this.grid.width * cs + 4, this.grid.height * cs + 4);
    g.lineStyle(1, 0x333344, 0.4);
    g.strokeRect(mx - 2, my - 2, this.grid.width * cs + 4, this.grid.height * cs + 4);

    // Cells
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.getCell(x, y);
        if (!cell || cell.state === CELL_STATE.NEUTRAL) continue;

        const color = PLAYER_COLORS[cell.ownerId!] || 0x444444;
        const alpha = cell.state === CELL_STATE.CLAIMING
          ? 0.3 + cell.progress * 0.5
          : cell.state === CELL_STATE.DECAYING
            ? cell.progress * 0.7
            : 0.8;

        g.fillStyle(color, alpha);
        g.fillRect(mx + x * cs, my + y * cs, cs, cs);
      }
    }
  }

  destroy(): void {
    this.container.destroy();
    this.minimapGraphics.destroy();
    this.sprintBar.destroy();
    this.sprintText.destroy();
  }
}
