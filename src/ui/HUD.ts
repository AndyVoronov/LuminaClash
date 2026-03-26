import Phaser from 'phaser';
import { PLAYER_COLORS, CELL_STATE } from '../config';
import type { GridSystem } from '../systems/GridSystem';

export class HUD {
  private scene: Phaser.Scene;
  private statsEntries: Map<string, {
    text: Phaser.GameObjects.Text;
    bar: Phaser.GameObjects.Graphics;
    barBg: Phaser.GameObjects.Graphics;
  }> = new Map();
  private timerText: Phaser.GameObjects.Text;
  private obstacleText: Phaser.GameObjects.Text;
  private sprintBar: Phaser.GameObjects.Graphics;
  private sprintText: Phaser.GameObjects.Text;
  private panelBg: Phaser.GameObjects.Graphics;
  private minimapGraphics: Phaser.GameObjects.Graphics;
  private grid: GridSystem | null = null;
  private readonly MINIMAP_CELL = 3;
  private minimapX = 0;
  private minimapY = 0;
  private panelWidth = 230;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Glass panel background
    this.panelBg = scene.add.graphics();
    this.panelBg.setDepth(100);
    this.panelBg.setScrollFactor(0);

    this.timerText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#e8e8f0',
      fontStyle: 'bold',
    }).setDepth(101).setScrollFactor(0);

    this.obstacleText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8888aa',
    }).setDepth(101).setScrollFactor(0);

    this.sprintBar = scene.add.graphics();
    this.sprintBar.setDepth(101);
    this.sprintBar.setScrollFactor(0);

    this.sprintText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#666688',
    }).setDepth(101).setScrollFactor(0);

    this.minimapGraphics = scene.add.graphics();
    this.minimapGraphics.setDepth(100);
    this.minimapGraphics.setScrollFactor(0);

    this.renderPanel();
  }

  private renderPanel(): void {
    const bg = this.panelBg;
    const w = this.panelWidth;
    const h = 190;
    const px = 8;
    const py = 8;

    bg.clear();

    // Glass background
    bg.fillStyle(0x0a0a14, 0.75);
    bg.fillRoundedRect(px, py, w, h, 10);

    // Subtle top highlight
    bg.fillStyle(0xffffff, 0.03);
    bg.fillRect(px + 2, py + 2, w - 4, 1);

    // Border
    bg.lineStyle(1, 0x2a2a44, 0.4);
    bg.strokeRoundedRect(px, py, w, h, 10);

    // Position elements
    this.timerText.setPosition(px + 16, py + 14);
    this.obstacleText.setPosition(px + 16, py + 42);
    this.sprintText.setPosition(px + 16, py + 62);
  }

  setGrid(grid: GridSystem): void {
    this.grid = grid;
    this.minimapX = this.scene.scale.width - (grid.width * this.MINIMAP_CELL) - 14;
    this.minimapY = this.scene.scale.height - (grid.height * this.MINIMAP_CELL) - 14;
  }

  addPlayer(id: string, name: string): void {
    const y = 100 + this.statsEntries.size * 28;
    const px = 8;
    const color = PLAYER_COLORS[id] || 0xffffff;
    const colorHex = '#' + color.toString(16).padStart(6, '0');

    // Color dot
    const dot = this.scene.add.circle(px + 24, y + 10, 5, color);
    dot.setDepth(101).setScrollFactor(0);

    // Name + count text
    const text = this.scene.add.text(px + 36, y + 2, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: colorHex,
    }).setDepth(101).setScrollFactor(0);

    // Progress bar background
    const barBg = this.scene.add.graphics();
    barBg.setDepth(101).setScrollFactor(0);
    barBg.fillStyle(0x151520, 0.8);
    barBg.fillRoundedRect(px + 16, y + 20, 196, 5, 2);

    // Progress bar fill
    const bar = this.scene.add.graphics();
    bar.setDepth(101).setScrollFactor(0);

    this.statsEntries.set(id, { text, bar, barBg });
  }

  update(time: number, stats: Map<string, number>, totalCells: number): void {
    if (time >= 0) {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      this.timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`);

      // Flash timer when low
      if (time < 30) {
        const flash = Math.sin(Date.now() / 300) > 0;
        this.timerText.setColor(flash ? '#ff6666' : '#e8e8f0');
      } else {
        this.timerText.setColor('#e8e8f0');
      }
    } else {
      this.timerText.setText('--:--');
    }

    for (const [id, entry] of this.statsEntries) {
      const count = stats.get(id) || 0;
      const pct = totalCells > 0 ? (count / totalCells) * 100 : 0;
      const label = id === 'player' ? 'YOU' : id.toUpperCase();
      entry.text.setText(`${label}  ${count}  ${pct.toFixed(1)}%`);

      // Progress bar
      const color = PLAYER_COLORS[id] || 0xffffff;
      entry.bar.clear();
      const barW = Math.max(0, 196 * (pct / 100));
      if (barW > 0) {
        entry.bar.fillStyle(color, 0.6);
        entry.bar.fillRoundedRect(8 + 16, 100 + [...this.statsEntries.keys()].indexOf(id) * 28 + 20, barW, 5, 2);
      }
    }
  }

  updateObstacles(available: number, total: number): void {
    const used = total - available;
    this.obstacleText.setText(`Obstacles  ${used} / ${total}`);
  }

  updateSprint(energy: number, max: number, active: boolean): void {
    const barX = 24;
    const barY = 76;
    const barW = 120;
    const barH = 6;
    const pct = energy / max;

    this.sprintBar.clear();

    // Background
    this.sprintBar.fillStyle(0x151520, 0.8);
    this.sprintBar.fillRoundedRect(barX, barY, barW, barH, 3);

    // Fill
    if (pct > 0) {
      const color = active ? 0xffd700 : 0x4a9eff;
      this.sprintBar.fillStyle(color, active ? 0.9 : 0.5);
      this.sprintBar.fillRoundedRect(barX, barY, barW * pct, barH, 3);
    }

    this.sprintText.setText(active ? 'SPRINT' : 'Sprint [SHIFT]');
    this.sprintText.setPosition(barX + barW + 8, barY - 2);
    this.sprintText.setColor(active ? '#ffd700' : '#555566');
  }

  renderMinimap(): void {
    if (!this.grid) return;
    const g = this.minimapGraphics;
    g.clear();

    const cs = this.MINIMAP_CELL;
    const mx = this.minimapX;
    const my = this.minimapY;
    const mw = this.grid.width * cs;
    const mh = this.grid.height * cs;

    // Background with glass effect
    g.fillStyle(0x08080e, 0.8);
    g.fillRoundedRect(mx - 4, my - 4, mw + 8, mh + 8, 6);
    g.lineStyle(1, 0x2a2a44, 0.3);
    g.strokeRoundedRect(mx - 4, my - 4, mw + 8, mh + 8, 6);

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.getCell(x, y);
        if (!cell || cell.state === CELL_STATE.NEUTRAL) continue;

        const color = PLAYER_COLORS[cell.ownerId!] || 0x444444;
        const alpha = cell.state === CELL_STATE.CLAIMING
          ? 0.3 + cell.progress * 0.5
          : cell.state === CELL_STATE.DECAYING
            ? cell.progress * 0.7
            : 0.85;

        g.fillStyle(color, alpha);
        g.fillRect(mx + x * cs, my + y * cs, cs - 1, cs - 1);
      }
    }
  }

  destroy(): void {
    this.panelBg.destroy();
    this.timerText.destroy();
    this.obstacleText.destroy();
    this.sprintBar.destroy();
    this.sprintText.destroy();
    this.minimapGraphics.destroy();
    for (const [, entry] of this.statsEntries) {
      entry.text.destroy();
      entry.bar.destroy();
      entry.barBg.destroy();
    }
  }
}
