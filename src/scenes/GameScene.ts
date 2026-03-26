import Phaser from 'phaser';
import { CELL_SIZE, CELL_STATE, PLAYER_COLORS, DEFAULT_CONFIG, XP_REWARDS, sessionStats, type GameConfig } from '../config';
import { GridSystem } from '../systems/GridSystem';
import { LightSystem } from '../systems/LightSystem';
import { ObstacleSystem } from '../systems/ObstacleSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { generateMap, placeGeneratedMap } from '../systems/MapGenerator';
import { PlayerLight } from '../entities/PlayerLight';
import { BotAI } from '../ai/BotAI';
import { HUD } from '../ui/HUD';
import { AudioManager } from '../audio/AudioManager';

export class GameScene extends Phaser.Scene {
  private config!: GameConfig;
  private grid!: GridSystem;
  private lightSystem!: LightSystem;
  private obstacleSystem!: ObstacleSystem;
  private particles!: ParticleSystem;
  private powerUps!: PowerUpSystem;
  private players: PlayerLight[] = [];
  private botAIs: BotAI[] = [];
  private hud!: HUD;
  private audio!: AudioManager;

  private offsetX = 0;
  private offsetY = 0;
  private matchTimeLeft: number = 0;
  private matchStartTime: number = 0;
  private gameActive = false;
  private winner: string | null = null;
  private paused = false;

  // Pause overlay
  private pauseElements: Phaser.GameObjects.GameObject[] = [];

  // Pointer for obstacle placement
  private pointerCell: { cx: number; cy: number } | null = null;
  private placementPreview: Phaser.GameObjects.Graphics | null = null;

  // Cached illumination for rendering while paused
  private cachedIlluminated: Map<string, Set<string>> = new Map();

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { config?: GameConfig }): void {
    this.config = data.config ? { ...DEFAULT_CONFIG, ...data.config } : { ...DEFAULT_CONFIG };
    this.matchTimeLeft = this.config.matchDuration;
    this.matchStartTime = 0;
    this.gameActive = true;
    this.winner = null;
    this.paused = false;
    this.players = [];
    this.botAIs = [];
    this.cachedIlluminated = new Map();
    this.pauseElements = [];
    this.audio = new AudioManager();

    const mapWidthPx = this.config.mapWidth * CELL_SIZE;
    const mapHeightPx = this.config.mapHeight * CELL_SIZE;
    this.offsetX = Math.floor((this.scale.width - mapWidthPx) / 2);
    this.offsetY = Math.floor((this.scale.height - mapHeightPx) / 2);
  }

  create(): void {
    this.grid = new GridSystem(this, this.config.mapWidth, this.config.mapHeight, this.offsetX, this.offsetY);
    this.obstacleSystem = new ObstacleSystem(this);
    this.particles = new ParticleSystem(this);
    this.powerUps = new PowerUpSystem(this, this.grid, this.obstacleSystem);
    this.lightSystem = new LightSystem(this.grid, () => this.obstacleSystem.getObstacleCells());

    this.grid.onCellCaptured = (wx, wy, ownerId) => {
      const color = PLAYER_COLORS[ownerId] || 0xffffff;
      this.particles.queueCapture(wx, wy, color);
      if (ownerId === 'player') {
        const stats = this.grid.getStats();
        const total = this.config.mapWidth * this.config.mapHeight;
        const myCount = stats.get(ownerId) || 0;
        this.audio.playCapture(total > 0 ? (myCount / total) * 100 : 0);
      }
    };
    this.grid.onCellDecayed = (wx, wy, lastOwnerId) => {
      const color = PLAYER_COLORS[lastOwnerId] || 0xffffff;
      this.particles.queueDecay(wx, wy, color);
      if (lastOwnerId === 'player') {
        this.audio.playDecay();
      }
    };

    this.placeInitialObstacles();

    // Player
    const playerStartX = Math.floor(this.config.mapWidth * 0.25);
    const playerStartY = Math.floor(this.config.mapHeight / 2);
    const player = new PlayerLight(
      this, 'player', PLAYER_COLORS.player,
      this.config.lightRadius, this.config.lightSpeed,
      this.config.obstacleBudget, true,
    );
    player.setPosition(
      this.offsetX + (playerStartX + 0.5) * CELL_SIZE,
      this.offsetY + (playerStartY + 0.5) * CELL_SIZE,
    );
    this.players.push(player);

    // Bots — dynamic based on config
    const botSpawnDefs = [
      { id: 'bot1', color: PLAYER_COLORS.bot1, sx: 0.75, sy: 0.25 },
      { id: 'bot2', color: PLAYER_COLORS.bot2, sx: 0.75, sy: 0.75 },
      { id: 'bot3', color: PLAYER_COLORS.bot3, sx: 0.25, sy: 0.25 },
    ];

    const botConfigs: { id: string; startX: number; startY: number; radius: number; speed: number; reaction: number }[] = [];

    for (let i = 0; i < this.config.botCount && i < botSpawnDefs.length; i++) {
      const def = botSpawnDefs[i];
      const startX = Math.floor(this.config.mapWidth * def.sx);
      const startY = Math.floor(this.config.mapHeight * def.sy);

      const bot = new PlayerLight(
        this, def.id, def.color,
        Math.floor(this.config.lightRadius * this.config.botRadiusMult),
        Math.floor(this.config.lightSpeed * this.config.botSpeedMult),
        Math.floor(this.config.obstacleBudget * 0.7),
        false,
      );
      bot.setPosition(
        this.offsetX + (startX + 0.5) * CELL_SIZE,
        this.offsetY + (startY + 0.5) * CELL_SIZE,
      );
      this.players.push(bot);

      botConfigs.push({
        id: def.id,
        startX, startY,
        radius: Math.floor(this.config.lightRadius * this.config.botRadiusMult),
        speed: Math.floor(this.config.lightSpeed * this.config.botSpeedMult),
        reaction: this.config.botReactionDelay,
      });
    }

    for (const p of this.players) {
      if (p.id !== 'player') {
        const bc = botConfigs.find(b => b.id === p.id)!;
        this.botAIs.push(new BotAI(p, this.grid, this.obstacleSystem, bc.reaction, this.players, this.config.difficulty, this.powerUps));
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

    // PowerUp bomb callback
    this.powerUps.onBomb = (cx, cy, playerId) => {
      this.audio.playBomb();
      const destroyed = this.obstacleSystem.destroyInRadius(cx, cy, 3);
      // Visual feedback — burst particles at each destroyed obstacle
      if (destroyed > 0) {
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (Math.sqrt(dx * dx + dy * dy) > 3) continue;
            const color = PLAYER_COLORS[playerId] || 0xff4444;
            this.particles.queueCapture(
              this.offsetX + (cx + dx + 0.5) * CELL_SIZE,
              this.offsetY + (cy + dy + 0.5) * CELL_SIZE,
              color,
            );
          }
        }
      }
    };

    // PowerUp pickup callback
    this.powerUps.onPickup = (playerId, type) => {
      this.audio.playPowerUpPickup();
      if (type !== 'bomb') {
        this.audio.playPowerUpActivate();
      }
    };

    // Pointer
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerCell = {
        cx: Math.floor((pointer.x - this.offsetX) / CELL_SIZE),
        cy: Math.floor((pointer.y - this.offsetY) / CELL_SIZE),
      };
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.gameActive || this.paused) return;
      this.tryPlaceObstacle(pointer.x, pointer.y);
      this.audio.playMenuClick();
    });

    // Border
    const border = this.add.graphics();
    border.setDepth(0);
    border.lineStyle(2, 0x2a2a4a, 0.8);
    border.strokeRect(
      this.offsetX - 1, this.offsetY - 1,
      this.config.mapWidth * CELL_SIZE + 2, this.config.mapHeight * CELL_SIZE + 2,
    );

    // ESC — pause / resume
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.winner) return;
      this.togglePause();
    });

    this.matchStartTime = Date.now();
    this.audio.playMatchStart();
    this.audio.startMusic();
  }

  // ── Pause ──

  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) this.showPauseOverlay();
    else this.hidePauseOverlay();
  }

  private showPauseOverlay(): void {
    this.clearPauseOverlay();

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    // Dim
    const dim = this.add.graphics().setDepth(200);
    dim.fillStyle(0x050508, 0.8);
    dim.fillRect(0, 0, W, H);
    this.pauseElements.push(dim);

    // Panel
    const panelW = 320;
    const panelH = 310;
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;

    const panel = this.add.graphics().setDepth(201);
    panel.fillStyle(0x0c0c18, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(1, 0x333366, 0.3);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    this.pauseElements.push(panel);

    // Title
    const title = this.add.text(cx, panelY + 36, 'PAUSED', {
      fontFamily: 'monospace', fontSize: '28px', color: '#8888aa', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(202);
    this.pauseElements.push(title);

    // Buttons
    const btns = [
      { label: 'Resume', action: () => this.togglePause(), y: panelY + 90 },
      { label: 'Restart', action: () => { this.clearPauseOverlay(); this.scene.restart({ config: this.config }); }, y: panelY + 140 },
      { label: 'Quit to Menu', action: () => { this.clearPauseOverlay(); this.scene.start('MenuScene', { lastConfig: this.config }); }, y: panelY + 190 },
    ];

    for (const btn of btns) {
      const bw = 200;
      const bh = 38;
      const bx = cx - bw / 2;
      const by = btn.y;

      const bg = this.add.graphics().setDepth(202);
      bg.fillStyle(0x161630, 0.8);
      bg.fillRoundedRect(bx, by, bw, bh, 6);
      bg.lineStyle(1, 0x333366, 0.2);
      bg.strokeRoundedRect(bx, by, bw, bh, 6);
      this.pauseElements.push(bg);

      const txt = this.add.text(cx, by + bh / 2, btn.label, {
        fontFamily: 'monospace', fontSize: '15px', color: '#aaaacc',
      }).setOrigin(0.5).setDepth(203);
      this.pauseElements.push(txt);

      const zone = this.add.zone(cx, by + bh / 2, bw, bh)
        .setInteractive({ useHandCursor: true }).setDepth(204);
      this.pauseElements.push(zone);

      zone.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x1e1e3a, 0.9);
        bg.fillRoundedRect(bx, by, bw, bh, 6);
        bg.lineStyle(1, 0x4a4a88, 0.4);
        bg.strokeRoundedRect(bx, by, bw, bh, 6);
        txt.setColor('#ffffff');
      });
      zone.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x161630, 0.8);
        bg.fillRoundedRect(bx, by, bw, bh, 6);
        bg.lineStyle(1, 0x333366, 0.2);
        bg.strokeRoundedRect(bx, by, bw, bh, 6);
        txt.setColor('#aaaacc');
      });
      zone.on('pointerdown', btn.action);
    }

    // Volume controls
    const volY = panelY + 238;
    const volLabel = this.add.text(panelX + 20, volY, 'VOL', {
      fontFamily: 'monospace', fontSize: '11px', color: '#555577', letterSpacing: 2,
    }).setDepth(202);
    this.pauseElements.push(volLabel);

    // Master bar
    const barW = 180;
    const barH = 6;
    const barX = panelX + 60;
    this.pauseElements.push(this.add.text(barX + barW / 2, volY - 10, `${Math.round(this.audio.masterVol * 100)}%`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#666688',
    }).setOrigin(0.5).setDepth(202).setName('volText'));

    const volBar = this.add.graphics().setDepth(202);
    this.pauseElements.push(volBar);
    this.renderVolumeBar(volBar, barX, volY, barW, barH, this.audio.masterVol);

    // Click to toggle volume levels
    const volZone = this.add.zone(barX + barW / 2, volY + barH / 2, barW, 20)
      .setInteractive({ useHandCursor: true }).setDepth(204);
    this.pauseElements.push(volZone);
    volZone.on('pointerdown', () => {
      // Cycle: 0% → 25% → 50% → 75% → 100% → 0%
      const levels = [0, 0.25, 0.5, 0.75, 1.0];
      const cur = levels.indexOf(this.audio.masterVol);
      const next = (cur + 1) % levels.length;
      this.audio.masterVol = levels[next];
      this.audio.sfxVol = levels[next];
      this.renderVolumeBar(volBar, barX, volY, barW, barH, levels[next]);
      const vt = this.pauseElements.find(e => e.name === 'volText');
      if (vt) (vt as Phaser.GameObjects.Text).setText(`${Math.round(levels[next] * 100)}%`);
    });

    // Hint
    const hint = this.add.text(cx, panelY + panelH - 24, 'ESC to resume', {
      fontFamily: 'monospace', fontSize: '11px', color: '#3a3a55',
    }).setOrigin(0.5).setDepth(202);
    this.pauseElements.push(hint);

    // Keyboard shortcuts
    this.input.keyboard!.once('keydown-R', () => {
      if (this.paused) { this.clearPauseOverlay(); this.scene.restart({ config: this.config }); }
    });
  }

  private renderVolumeBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, vol: number): void {
    g.clear();
    g.fillStyle(0x1a1a30, 0.8);
    g.fillRoundedRect(x, y, w, h, 3);
    if (vol > 0) {
      g.fillStyle(0xffd700, 0.6);
      g.fillRoundedRect(x, y, w * vol, h, 3);
    }
    g.lineStyle(1, 0x333366, 0.3);
    g.strokeRoundedRect(x, y, w, h, 3);
  }

  private hidePauseOverlay(): void {
    this.clearPauseOverlay();
  }

  private clearPauseOverlay(): void {
    for (const el of this.pauseElements) el.destroy();
    this.pauseElements = [];
  }

  // ── Obstacles ──

  private placeInitialObstacles(): void {
    // Gather spawn positions
    const spawns: { x: number; y: number }[] = [];
    for (const p of this.players) {
      const pos = p.getGridPosition(this.offsetX, this.offsetY);
      spawns.push({ x: Math.round(pos.cx), y: Math.round(pos.cy) });
    }

    const obstacles = generateMap(
      this.config.mapTemplate,
      this.config.mapWidth,
      this.config.mapHeight,
      this.config.mapSeed,
      spawns,
    );
    placeGeneratedMap(this.obstacleSystem, obstacles);
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
      this.audio.playObstaclePlace();
    }
  }

  // ── Main update ──

  update(time: number, delta: number): void {
    if (!this.gameActive || !!this.winner) return;

    // ── Logic (skip when paused) ──
    if (!this.paused) {
      // Timer
      if (this.config.matchDuration > 0) {
        this.matchTimeLeft -= delta / 1000;
        // Timer sounds
        if (this.matchTimeLeft <= 10 && this.matchTimeLeft > 0) {
          const sec = Math.ceil(this.matchTimeLeft);
          if (Math.abs(this.matchTimeLeft - sec) < delta / 1000 * 1.1) {
            this.audio.playTimerTick(true);
          }
        } else if (this.matchTimeLeft <= 30 && this.matchTimeLeft > 10) {
          const sec = Math.ceil(this.matchTimeLeft);
          if (sec % 5 === 0 && Math.abs(this.matchTimeLeft - sec) < delta / 1000 * 1.1) {
            this.audio.playTimerTick(false);
            if (sec === 30) this.audio.intensifyMusic();
          }
        }
        if (this.matchTimeLeft <= 0) {
          this.matchTimeLeft = 0;
          this.endMatch();
          return;
        }
      }

      // Obstacles
      this.obstacleSystem.update(delta);

      // Player movement
      const humanPlayer = this.players.find(p => p.id === 'player');
      if (humanPlayer) {
        humanPlayer.update(delta, this.config.mapWidth, this.config.mapHeight, this.offsetX, this.offsetY);
      }

      // Bot AI + movement
      for (const ai of this.botAIs) ai.update(time, delta, this.offsetX, this.offsetY);
      for (const bot of this.players) {
        if (bot.id === 'player') continue;
        bot.update(delta, this.config.mapWidth, this.config.mapHeight, this.offsetX, this.offsetY);
      }

      // Illumination
      const illuminatedMap = new Map<string, Set<string>>();
      const lightPositions = new Map<string, { cx: number; cy: number; radius: number }>();

      // ── Apply power-up effects to players ──
      const activeEffects = this.powerUps.update(delta, this.players, this.offsetX, this.offsetY);
      const shieldedOwnerIds = new Set<string>();

      // Reset modifiers, then apply from active effects
      for (const p of this.players) {
        p.setSpeedMult(1);
        p.setRadiusBonus(0);
        p.setShielded(false);
      }

      for (const effect of activeEffects) {
        const player = this.players.find(p => p.id === effect.playerId);
        if (!player) continue;

        switch (effect.type) {
          case 'speed':
            player.setSpeedMult(1.8);
            break;
          case 'expand':
            player.setRadiusBonus(Math.floor(this.config.lightRadius * 0.5));
            break;
          case 'shield':
            player.setShielded(true);
            shieldedOwnerIds.add(player.id);
            break;
          case 'steal':
            // Directly claim enemy cells in range
            this.executeSteal(player, this.offsetX, this.offsetY);
            break;
        }
      }

      for (const p of this.players) {
        const pos = p.getGridPosition(this.offsetX, this.offsetY);
        const effectiveR = p.effectiveRadius;
        lightPositions.set(p.id, { cx: pos.cx, cy: pos.cy, radius: effectiveR });
        this.lightSystem.computeIllumination(pos.cx, pos.cy, effectiveR, p.illuminatedCells);
        illuminatedMap.set(p.id, p.illuminatedCells);

        // Add mirror-reflected cells
        const mirrorCells = this.obstacleSystem.mirrorIlluminated.get(p.id);
        if (mirrorCells) {
          for (const key of mirrorCells) {
            p.illuminatedCells.add(key);
          }
        }
      }

      // Contested cells
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

      // Territory
      for (const p of this.players) {
        const pos = p.getGridPosition(this.offsetX, this.offsetY);
        this.lightSystem.claimTerritory(
          p.id, pos.cx, pos.cy, p.effectiveRadius,
          p.illuminatedCells, contestedCells, shieldedOwnerIds,
        );
      }

      this.obstacleSystem.setLightPositions(lightPositions);
      this.grid.update(delta);

      // Cache for rendering
      this.cachedIlluminated = illuminatedMap;

      // HUD data
      const stats = this.grid.getStats();
      const mainPlayer = this.players.find(p => p.id === 'player');
      const usedObstacles = mainPlayer ? this.obstacleSystem.getObstacleCount('player') : 0;
      this.hud.update(this.matchTimeLeft, stats, this.grid.getTotalCells());
      if (mainPlayer) {
        this.hud.updateObstacles(mainPlayer.obstacleBudget - usedObstacles, mainPlayer.obstacleBudget);
        const sprint = mainPlayer.getSprintInfo();
        if (sprint) this.hud.updateSprint(sprint.energy, sprint.max, sprint.active);
      }

      this.checkWinCondition(stats);
    }

    // ── Render (always) ──
    this.grid.render(this.offsetX, this.offsetY, this.cachedIlluminated);
    for (const p of this.players) p.renderGlow();
    this.obstacleSystem.render(this.offsetX, this.offsetY);
    this.particles.update(delta);
    this.powerUps.renderPlayerEffects(this.players);
    this.hud.renderMinimap();
    this.renderPlacementPreview();
  }

  // ── Steal power-up: directly claim enemy cells in player's light ──

  private executeSteal(player: PlayerLight, offsetX: number, offsetY: number): void {
    const pos = player.getGridPosition(offsetX, offsetY);
    const r = Math.ceil(player.effectiveRadius);
    const gcx = Math.round(pos.cx);
    const gcy = Math.round(pos.cy);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = gcx + dx;
        const cy = gcy + dy;
        if (Math.sqrt(dx * dx + dy * dy) > player.effectiveRadius) continue;

        const cell = this.grid.getCell(cx, cy);
        if (!cell) continue;
        if (cell.ownerId === player.id) continue;
        if (cell.state === CELL_STATE.NEUTRAL) continue;
        // Steal enemy territory
        this.grid.directClaim(player.id, cx, cy);
      }
    }
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
      this.placementPreview.fillStyle(0x000000, 0.3);
      this.placementPreview.fillRoundedRect(px + 3, py + 3, CELL_SIZE, CELL_SIZE, 4);
      this.placementPreview.fillStyle(canPlace ? 0x2a2a4a : 0x4a1a1a, 0.7);
      this.placementPreview.fillRoundedRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
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

  // ── Match end ──

  private endMatch(): void {
    this.gameActive = false;
    this.paused = false;
    this.clearPauseOverlay();
    this.audio.stopMusic();

    const stats = this.grid.getStats();

    // Sort by territory count
    const rankings: { id: string; count: number }[] = [];
    for (const [id, count] of stats) rankings.push({ id, count });
    rankings.sort((a, b) => b.count - a.count);

    // Find player placement
    const playerPlacement = rankings.findIndex(r => r.id === 'player');
    const isPlayerWin = playerPlacement === 0;
    if (isPlayerWin) {
      this.audio.playVictory();
    } else {
      this.audio.playDefeat();
    }

    // Calculate XP
    const playerCount = stats.get('player') || 0;
    const playerPct = this.grid.getTotalCells() > 0 ? (playerCount / this.grid.getTotalCells()) * 100 : 0;
    const timePlayed = (Date.now() - this.matchStartTime) / 1000;
    const timeRemaining = Math.max(0, this.config.matchDuration - timePlayed);

    const placementXP = playerPlacement < XP_REWARDS.placement.length
      ? XP_REWARDS.placement[playerPlacement]
      : XP_REWARDS.placement[XP_REWARDS.placement.length - 1];
    const territoryXP = Math.floor(playerPct * XP_REWARDS.territoryMult);
    const timeXP = isPlayerWin && this.config.matchDuration > 0
      ? Math.floor(timeRemaining / XP_REWARDS.timeBonusDiv)
      : 0;
    const totalXP = placementXP + territoryXP + timeXP;

    // Update session
    sessionStats.totalXP += totalXP;
    sessionStats.matchesPlayed++;
    if (isPlayerWin) sessionStats.wins++;

    // ── Build overlay ──
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    const total = this.grid.getTotalCells();
    const panelW = 380;
    const panelH = 320 + rankings.length * 26;
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;

    // Dim
    const overlay = this.add.graphics().setDepth(200);
    overlay.fillStyle(0x050508, 0.85);
    overlay.fillRect(0, 0, W, H);

    // Panel
    const panel = this.add.graphics().setDepth(201);
    panel.fillStyle(0x0c0c18, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(1, isPlayerWin ? 0xffd700 : 0xff4444, 0.3);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

    // Title
    const titles = ['VICTORY', '2ND PLACE', '3RD PLACE', '4TH PLACE'];
    const titleColors = ['#ffd700', '#aaaacc', '#888899', '#666677'];
    const titleText = titles[playerPlacement] || `${playerPlacement + 1}TH`;

    if (isPlayerWin) {
      this.add.text(cx + 1, panelY + 38, titleText, {
        fontFamily: 'monospace', fontSize: '34px', color: '#ff8800', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.2).setDepth(202);
    }

    this.add.text(cx, panelY + 36, titleText, {
      fontFamily: 'monospace', fontSize: '34px',
      color: titleColors[playerPlacement] || '#888899', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(203);

    // Scores
    let scoreY = panelY + 80;
    for (const rank of rankings) {
      const pct = ((rank.count / total) * 100).toFixed(1);
      const color = PLAYER_COLORS[rank.id] || 0xffffff;
      const colorHex = '#' + color.toString(16).padStart(6, '0');
      const label = rank.id === 'player' ? 'YOU' : rank.id.toUpperCase();
      const isMe = rank.id === 'player';

      this.add.circle(panelX + 32, scoreY + 8, 5, color).setDepth(203);

      // Progress bar bg
      const barBg = this.add.graphics().setDepth(203);
      barBg.fillStyle(0x151520, 0.8);
      barBg.fillRoundedRect(panelX + 48, scoreY + 2, 240, 10, 3);

      // Progress bar fill
      const barFill = this.add.graphics().setDepth(203);
      const barW = Math.max(0, 240 * (rank.count / total));
      if (barW > 0) {
        barFill.fillStyle(color, isMe ? 0.6 : 0.4);
        barFill.fillRoundedRect(panelX + 48, scoreY + 2, barW, 10, 3);
      }

      const scoreText = this.add.text(panelX + 48, scoreY - 10, `${label}  ${rank.count}  (${pct}%)`, {
        fontFamily: 'monospace', fontSize: '12px',
        color: isMe ? '#ffffff' : colorHex,
      }).setDepth(203);

      scoreY += 26;
    }

    // XP
    const xpY = scoreY + 12;
    this.add.text(cx, xpY, `+${totalXP} XP`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(203);

    const xpBreakdown = `${placementXP} placement + ${territoryXP} territory${timeXP > 0 ? ` + ${timeXP} time` : ''}`;
    this.add.text(cx, xpY + 22, xpBreakdown, {
      fontFamily: 'monospace', fontSize: '11px', color: '#555566',
    }).setOrigin(0.5).setDepth(203);

    // Session
    this.add.text(cx, xpY + 44, `Session:  ${sessionStats.totalXP} XP  |  ${sessionStats.wins}/${sessionStats.matchesPlayed} wins`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#3a3a55',
    }).setOrigin(0.5).setDepth(203);

    // Buttons
    const btnY = panelY + panelH - 60;
    const buttons = [
      { label: 'Next Match', x: cx - 180, w: 150, action: () => this.scene.restart({ config: this.config }) },
      { label: 'Settings', x: cx - 10, w: 130, action: () => this.scene.start('MenuScene', { lastConfig: this.config }) },
      { label: 'Menu', x: cx + 150, w: 100, action: () => this.scene.start('MenuScene') },
    ];

    for (const btn of buttons) {
      const bh = 38;
      const bx = btn.x - btn.w / 2;

      const bg = this.add.graphics().setDepth(202);
      bg.fillStyle(0x161630, 0.8);
      bg.fillRoundedRect(bx, btnY, btn.w, bh, 6);
      bg.lineStyle(1, 0x333366, 0.2);
      bg.strokeRoundedRect(bx, btnY, btn.w, bh, 6);

      const txt = this.add.text(btn.x, btnY + bh / 2, btn.label, {
        fontFamily: 'monospace', fontSize: '13px', color: '#aaaacc',
      }).setOrigin(0.5).setDepth(203);

      const zone = this.add.zone(btn.x, btnY + bh / 2, btn.w, bh)
        .setInteractive({ useHandCursor: true }).setDepth(204);

      zone.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x1e1e3a, 0.9);
        bg.fillRoundedRect(bx, btnY, btn.w, bh, 6);
        bg.lineStyle(1, 0x4a4a88, 0.4);
        bg.strokeRoundedRect(bx, btnY, btn.w, bh, 6);
        txt.setColor('#ffffff');
      });
      zone.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x161630, 0.8);
        bg.fillRoundedRect(bx, btnY, btn.w, bh, 6);
        bg.lineStyle(1, 0x333366, 0.2);
        bg.strokeRoundedRect(bx, btnY, btn.w, bh, 6);
        txt.setColor('#aaaacc');
      });
      zone.on('pointerdown', btn.action);
    }

    // Keyboard shortcuts (still work)
    this.input.keyboard!.once('keydown-R', () => {
      this.scene.restart({ config: this.config });
    });
    this.input.keyboard!.once('keydown-ESC', () => {
      this.scene.start('MenuScene', { lastConfig: this.config });
    });
  }
}
