import Phaser from 'phaser';
import { CELL_SIZE, PLAYER_COLORS, DEFAULT_CONFIG, type GameConfig } from '../config';
import { GridSystem } from '../systems/GridSystem';
import { LightSystem } from '../systems/LightSystem';
import { ObstacleSystem } from '../systems/ObstacleSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { PlayerLight } from '../entities/PlayerLight';
import { BotAI } from '../ai/BotAI';
import { HUD } from '../ui/HUD';

export class GameScene extends Phaser.Scene {
  private config!: GameConfig;
  private grid!: GridSystem;
  private lightSystem!: LightSystem;
  private obstacleSystem!: ObstacleSystem;
  private particles!: ParticleSystem;
  private players: PlayerLight[] = [];
  private botAIs: BotAI[] = [];
  private hud!: HUD;

  private offsetX = 0;
  private offsetY = 0;
  private matchTimeLeft: number = 0;
  private gameActive = false;
  private winner: string | null = null;

  // Pointer for obstacle placement
  private pointerCell: { cx: number; cy: number } | null = null;
  private placementPreview: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { config?: GameConfig }): void {
    this.config = data.config || { ...DEFAULT_CONFIG };
    this.matchTimeLeft = this.config.matchDuration;
    this.gameActive = true;
    this.winner = null;
    this.players = [];
    this.botAIs = [];

    // Calculate offset to center the grid
    const mapWidthPx = this.config.mapWidth * CELL_SIZE;
    const mapHeightPx = this.config.mapHeight * CELL_SIZE;
    this.offsetX = Math.floor((this.scale.width - mapWidthPx) / 2);
    this.offsetY = Math.floor((this.scale.height - mapHeightPx) / 2);
  }

  create(): void {
    // Clear previous scene objects
    this.grid = new GridSystem(this, this.config.mapWidth, this.config.mapHeight, this.offsetX, this.offsetY);
    this.obstacleSystem = new ObstacleSystem(this);
    this.particles = new ParticleSystem(this);
    this.lightSystem = new LightSystem(this.grid, () => this.obstacleSystem.getObstacleCells());

    // Connect particle callbacks
    this.grid.onCellCaptured = (wx, wy, ownerId) => {
      const color = PLAYER_COLORS[ownerId] || 0xffffff;
      this.particles.queueCapture(wx, wy, color);
    };
    this.grid.onCellDecayed = (wx, wy, lastOwnerId) => {
      const color = PLAYER_COLORS[lastOwnerId] || 0xffffff;
      this.particles.queueDecay(wx, wy, color);
    };

    // Add some initial obstacles on the map (walls)
    this.placeInitialObstacles();

    // Create player
    const playerStartX = Math.floor(this.config.mapWidth * 0.25);
    const playerStartY = Math.floor(this.config.mapHeight / 2);
    const player = new PlayerLight(
      this,
      'player',
      PLAYER_COLORS.player,
      this.config.lightRadius,
      this.config.lightSpeed,
      this.config.obstacleBudget,
      true,
    );
    player.setPosition(
      this.offsetX + (playerStartX + 0.5) * CELL_SIZE,
      this.offsetY + (playerStartY + 0.5) * CELL_SIZE,
    );
    this.players.push(player);

    // Create bots
    const botConfigs = [
      {
        id: 'bot1',
        color: PLAYER_COLORS.bot1,
        startX: Math.floor(this.config.mapWidth * 0.75),
        startY: Math.floor(this.config.mapHeight * 0.25),
        radius: Math.floor(this.config.lightRadius * 1.1),
        speed: Math.floor(this.config.lightSpeed * 0.85),
        reaction: 1500,
      },
      {
        id: 'bot2',
        color: PLAYER_COLORS.bot2,
        startX: Math.floor(this.config.mapWidth * 0.75),
        startY: Math.floor(this.config.mapHeight * 0.75),
        radius: this.config.lightRadius,
        speed: Math.floor(this.config.lightSpeed * 0.85),
        reaction: 1200,
      },
    ];

    for (const bc of botConfigs) {
      const bot = new PlayerLight(
        this,
        bc.id,
        bc.color,
        bc.radius,
        bc.speed,
        Math.floor(this.config.obstacleBudget * 0.7),
        false,
      );
      bot.setPosition(
        this.offsetX + (bc.startX + 0.5) * CELL_SIZE,
        this.offsetY + (bc.startY + 0.5) * CELL_SIZE,
      );
      this.players.push(bot);
    }

    // Create bot AIs
    for (const p of this.players) {
      if (p.id !== 'player') {
        const config = botConfigs.find(bc => bc.id === p.id);
        this.botAIs.push(new BotAI(p, this.grid, this.obstacleSystem, config!.reaction, this.players));
      }
    }

    // HUD
    this.hud = new HUD(this);
    this.hud.setGrid(this.grid);
    this.hud.addPlayer('player', 'You');
    for (const bc of botConfigs) {
      this.hud.addPlayer(bc.id, bc.id);
    }

    // Placement preview
    this.placementPreview = this.add.graphics();
    this.placementPreview.setDepth(10);

    // Pointer events
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerCell = {
        cx: Math.floor((pointer.x - this.offsetX) / CELL_SIZE),
        cy: Math.floor((pointer.y - this.offsetY) / CELL_SIZE),
      };
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.gameActive) return;
      this.tryPlaceObstacle(pointer.x, pointer.y);
    });

    // Border frame
    const border = this.add.graphics();
    border.setDepth(0);
    border.lineStyle(2, 0x2a2a4a, 0.8);
    border.strokeRect(
      this.offsetX - 1,
      this.offsetY - 1,
      this.config.mapWidth * CELL_SIZE + 2,
      this.config.mapHeight * CELL_SIZE + 2,
    );
  }

  private placeInitialObstacles(): void {
    const mid = { x: Math.floor(this.config.mapWidth / 2), y: Math.floor(this.config.mapHeight / 2) };
    // Central cluster
    this.obstacleSystem.place(mid.x, mid.y, 'system', 'tower');
    this.obstacleSystem.place(mid.x - 2, mid.y - 1, 'system', 'wall');
    this.obstacleSystem.place(mid.x + 2, mid.y + 1, 'system', 'wall');
    this.obstacleSystem.place(mid.x, mid.y - 2, 'system', 'wall');
    this.obstacleSystem.place(mid.x, mid.y + 2, 'system', 'wall');

    // Corner obstacles
    this.obstacleSystem.place(3, 3, 'system', 'wall');
    this.obstacleSystem.place(this.config.mapWidth - 4, 3, 'system', 'wall');
    this.obstacleSystem.place(3, this.config.mapHeight - 4, 'system', 'wall');
    this.obstacleSystem.place(this.config.mapWidth - 4, this.config.mapHeight - 4, 'system', 'wall');

    // Side walls
    this.obstacleSystem.place(Math.floor(this.config.mapWidth * 0.3), Math.floor(this.config.mapHeight * 0.2), 'system', 'wall');
    this.obstacleSystem.place(Math.floor(this.config.mapWidth * 0.7), Math.floor(this.config.mapHeight * 0.8), 'system', 'wall');
    this.obstacleSystem.place(Math.floor(this.config.mapWidth * 0.3), Math.floor(this.config.mapHeight * 0.8), 'system', 'wall');
    this.obstacleSystem.place(Math.floor(this.config.mapWidth * 0.7), Math.floor(this.config.mapHeight * 0.2), 'system', 'wall');
  }

  private tryPlaceObstacle(worldX: number, worldY: number): void {
    const player = this.players.find(p => p.id === 'player');
    if (!player) return;

    const cx = Math.floor((worldX - this.offsetX) / CELL_SIZE);
    const cy = Math.floor((worldY - this.offsetY) / CELL_SIZE);

    const usedBudget = this.obstacleSystem.getObstacleCount('player');
    if (usedBudget >= player.obstacleBudget) return;
    if (Date.now() - player.lastPlacementTime < this.config.obstacleCooldown) return;

    if (this.obstacleSystem.canPlace(cx, cy, 'player', this.grid)) {
      this.obstacleSystem.place(cx, cy, 'player');
      player.lastPlacementTime = Date.now();
    }
  }

  update(time: number, delta: number): void {
    if (!this.gameActive) return;

    // Update match timer
    if (this.config.matchDuration > 0) {
      this.matchTimeLeft -= delta / 1000;
      if (this.matchTimeLeft <= 0) {
        this.matchTimeLeft = 0;
        this.endMatch();
        return;
      }
    }

    // Update obstacles
    this.obstacleSystem.update(delta);

    // Update player movement
    const humanPlayer = this.players.find(p => p.id === 'player');
    if (humanPlayer) {
      humanPlayer.update(delta, this.config.mapWidth, this.config.mapHeight, this.offsetX, this.offsetY);
    }

    // Update bot AI (before bot.update so moveInput is set for this frame)
    for (const ai of this.botAIs) {
      ai.update(time, delta, this.offsetX, this.offsetY);
    }

    // Update bots
    for (const bot of this.players) {
      if (bot.id === 'player') continue;
      bot.update(delta, this.config.mapWidth, this.config.mapHeight, this.offsetX, this.offsetY);
    }

    // Process lights and territory
    const illuminatedMap = new Map<string, Set<string>>();
    const lightPositions = new Map<string, { cx: number; cy: number; radius: number }>();

    // Pass 1: compute illumination for all players
    for (const p of this.players) {
      const pos = p.getGridPosition(this.offsetX, this.offsetY);
      lightPositions.set(p.id, { cx: pos.cx, cy: pos.cy, radius: p.lightRadius });

      this.lightSystem.computeIllumination(
        pos.cx, pos.cy, p.lightRadius, p.illuminatedCells,
      );
      illuminatedMap.set(p.id, p.illuminatedCells);
    }

    // Find contested cells — illuminated by 2+ players
    const contestedCells = new Set<string>();
    const cellOwners = new Map<string, number>();
    for (const [, cells] of illuminatedMap) {
      for (const key of cells) {
        const count = (cellOwners.get(key) || 0) + 1;
        cellOwners.set(key, count);
        if (count >= 2) contestedCells.add(key);
      }
    }
    this.grid.contestedCells = contestedCells;

    // Pass 2: claim territory, skipping contested cells
    for (const p of this.players) {
      const pos = p.getGridPosition(this.offsetX, this.offsetY);
      this.lightSystem.claimTerritory(
        p.id, pos.cx, pos.cy, p.lightRadius,
        p.illuminatedCells, contestedCells,
      );
    }

    // Update obstacle system with light positions (for dissolution)
    this.obstacleSystem.setLightPositions(lightPositions);

    // Update grid cell states
    this.grid.update(delta);

    // Render
    this.grid.render(this.offsetX, this.offsetY, illuminatedMap);

    // Render player glows
    for (const p of this.players) {
      p.renderGlow();
    }

    // Render obstacles
    this.obstacleSystem.render(this.offsetX, this.offsetY);

    // Update particles
    this.particles.update(delta);

    // Render minimap
    this.hud.renderMinimap();

    // Render placement preview
    this.renderPlacementPreview();

    // Update HUD
    const stats = this.grid.getStats();
    const mainPlayer = this.players.find(p => p.id === 'player');
    const usedObstacles = mainPlayer ? this.obstacleSystem.getObstacleCount('player') : 0;
    this.hud.update(this.matchTimeLeft, stats, this.grid.getTotalCells());
    if (mainPlayer) {
      this.hud.updateObstacles(mainPlayer.obstacleBudget - usedObstacles, mainPlayer.obstacleBudget);
      const sprint = mainPlayer.getSprintInfo();
      if (sprint) {
        this.hud.updateSprint(sprint.energy, sprint.max, sprint.active);
      }
    }

    // Check win condition
    this.checkWinCondition(stats);
  }

  private renderPlacementPreview(): void {
    if (!this.placementPreview || !this.pointerCell) return;
    this.placementPreview.clear();

    const { cx, cy } = this.pointerCell;
    const player = this.players.find(p => p.id === 'player');
    if (!player) return;

    const canPlace = this.obstacleSystem.canPlace(cx, cy, 'player', this.grid) &&
      this.obstacleSystem.getObstacleCount('player') < player.obstacleBudget;

    const px = this.offsetX + cx * CELL_SIZE;
    const py = this.offsetY + cy * CELL_SIZE;

    if (cx >= 0 && cx < this.config.mapWidth && cy >= 0 && cy < this.config.mapHeight) {
      // Shadow
      this.placementPreview.fillStyle(0x000000, 0.3);
      this.placementPreview.fillRoundedRect(px + 3, py + 3, CELL_SIZE, CELL_SIZE, 4);

      // Preview block
      this.placementPreview.fillStyle(canPlace ? 0x2a2a4a : 0x4a1a1a, 0.7);
      this.placementPreview.fillRoundedRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);

      // Border
      this.placementPreview.lineStyle(1.5, canPlace ? 0x44ff88 : 0xff4444, 0.6);
      this.placementPreview.strokeRoundedRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
    }
  }

  private checkWinCondition(stats: Map<string, number>): void {
    const total = this.grid.getTotalCells();
    const winCount = Math.floor(total * (this.config.winPercent / 100));

    for (const [id, count] of stats) {
      if (count >= winCount) {
        this.winner = id;
        this.endMatch();
        return;
      }
    }
  }

  private endMatch(): void {
    this.gameActive = false;

    const stats = this.grid.getStats();
    let maxCells = 0;
    let winner = 'Nobody';

    for (const [id, count] of stats) {
      if (count > maxCells) {
        maxCells = count;
        winner = id;
      }
    }

    const isPlayerWin = winner === 'player';

    // Show result overlay
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const overlay = this.add.graphics();
    overlay.setDepth(200);
    overlay.fillStyle(0x050508, 0.85);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);

    // Result panel background
    const panelW = 360;
    const panelH = 220;
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;

    const panel = this.add.graphics().setDepth(201);
    panel.fillStyle(0x0c0c18, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(1, isPlayerWin ? 0xffd700 : 0xff4444, 0.3);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

    // Title
    // Title
    const title = isPlayerWin ? 'VICTORY' : 'DEFEATED';
    const sub = winner === 'player'
      ? 'Your light shines brightest'
      : `${winner === 'Nobody' ? 'Nobody' : winner.toUpperCase()} dominates`;

    // Title glow
    if (isPlayerWin) {
      this.add.text(cx + 1, cy - 60 + 1, title, {
        fontFamily: 'monospace',
        fontSize: '38px',
        color: '#ff8800',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.2).setDepth(202);
    }

    this.add.text(cx, cy - 60, title, {
      fontFamily: 'monospace',
      fontSize: '38px',
      color: isPlayerWin ? '#ffd700' : '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(203);

    this.add.text(cx, cy - 18, sub, {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#8888aa',
    }).setOrigin(0.5).setDepth(203);

    // Final scores
    const total = this.grid.getTotalCells();
    let scoreY = cy + 14;
    for (const [id, count] of stats) {
      const pct = ((count / total) * 100).toFixed(1);
      const colorHex = '#' + (PLAYER_COLORS[id] || 0xffffff).toString(16).padStart(6, '0');
      const label = id === 'player' ? 'YOU' : id.toUpperCase();

      this.add.circle(panelX + 30, scoreY + 7, 4, PLAYER_COLORS[id] || 0xffffff)
        .setDepth(203);

      this.add.text(panelX + 42, scoreY, `${label}  ${count}  (${pct}%)`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: colorHex,
      }).setDepth(203);

      scoreY += 22;
    }

    // Actions
    this.add.text(cx, cy + panelH / 2 - 42, '[R] Restart     [ESC] Menu', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#555577',
    }).setOrigin(0.5).setDepth(203);

    // Restart key
    this.input.keyboard!.once('keydown-R', () => {
      this.scene.restart({ config: this.config });
    });

    this.input.keyboard!.once('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }
}
