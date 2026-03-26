import Phaser from 'phaser';
import { CELL_SIZE, PLAYER_COLORS } from '../config';
import type { GridSystem } from './GridSystem';
import type { ObstacleSystem } from './ObstacleSystem';
import type { PlayerLight } from '../entities/PlayerLight';

export type PowerUpType = 'speed' | 'expand' | 'shield' | 'bomb' | 'steal';

interface PowerUpDef {
  type: PowerUpType;
  color: number;
  label: string;
  duration: number; // ms, 0 = instant
}

export const POWERUP_DEFS: Record<PowerUpType, PowerUpDef> = {
  speed:  { type: 'speed',  color: 0xffd700, label: 'SPD', duration: 3000 },
  expand: { type: 'expand', color: 0x4a9eff, label: 'EXP', duration: 5000 },
  shield: { type: 'shield', color: 0x4aff8b, label: 'SHD', duration: 4000 },
  bomb:   { type: 'bomb',   color: 0xff4444, label: 'BMB', duration: 0 },
  steal:  { type: 'steal',  color: 0xb44aff, label: 'STL', duration: 3000 },
};

const ALL_TYPES: PowerUpType[] = ['speed', 'expand', 'shield', 'bomb', 'steal'];

interface ActiveEffect {
  type: PowerUpType;
  playerId: string;
  expiresAt: number;
}

interface PowerUpSpawn {
  cx: number;
  cy: number;
  type: PowerUpType;
  spawnTime: number;
  alive: boolean;
}

export class PowerUpSystem {
  private grid: GridSystem;
  private obstacles: ObstacleSystem;
  private spawns: PowerUpSpawn[] = [];
  private activeEffects: ActiveEffect[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private effectLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private spawnLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  // Config
  private readonly SPAWN_INTERVAL = 12000; // ms between spawn attempts
  private readonly MAX_ON_MAP = 3;
  private lastSpawnTime: number = 0;

  // Callbacks
  onBomb?: (cx: number, cy: number, playerId: string) => void;

  constructor(scene: Phaser.Scene, grid: GridSystem, obstacles: ObstacleSystem) {
    this.scene = scene;
    this.grid = grid;
    this.obstacles = obstacles;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(6);
  }

  update(delta: number, players: PlayerLight[], offsetX: number, offsetY: number): ActiveEffect[] {
    const now = Date.now();

    // Spawn new power-ups
    if (now - this.lastSpawnTime > this.SPAWN_INTERVAL && this.spawns.filter(s => s.alive).length < this.MAX_ON_MAP) {
      this.trySpawn();
      this.lastSpawnTime = now;
    }

    // Check pickups — any player walking over a power-up
    for (const spawn of this.spawns) {
      if (!spawn.alive) continue;

      const worldX = offsetX + (spawn.cx + 0.5) * CELL_SIZE;
      const worldY = offsetY + (spawn.cy + 0.5) * CELL_SIZE;

      for (const player of players) {
        const dx = player.wx - worldX;
        const dy = player.wy - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CELL_SIZE * 0.7) {
          this.activatePowerUp(player, spawn);
          break;
        }
      }
    }

    // Clean expired effects
    this.activeEffects = this.activeEffects.filter(e => now < e.expiresAt);

    // Render
    this.render(offsetX, offsetY, now);

    return this.activeEffects;
  }

  hasEffect(playerId: string, type: PowerUpType): boolean {
    return this.activeEffects.some(e => e.playerId === playerId && e.type === type);
  }

  getActiveEffects(): ActiveEffect[] {
    return this.activeEffects;
  }

  private trySpawn(): void {
    const w = this.grid.width;
    const h = this.grid.height;
    const obstacles = this.obstacles.getObstacleCells();

    // Try 20 random positions
    for (let attempt = 0; attempt < 20; attempt++) {
      const cx = 2 + Math.floor(Math.random() * (w - 4));
      const cy = 2 + Math.floor(Math.random() * (h - 4));
      const key = `${cx},${cy}`;

      // Not on obstacle
      if (obstacles.has(key)) continue;
      // Not on another power-up
      if (this.spawns.some(s => s.alive && s.cx === cx && s.cy === cy)) continue;
      // Not on owned territory (spawn on neutral or contested)
      const cell = this.grid.getCell(cx, cy);
      if (!cell || cell.state !== 0) continue;

      const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
      this.spawns.push({ cx, cy, type, spawnTime: Date.now(), alive: true });
      return;
    }
  }

  private activatePowerUp(player: PlayerLight, spawn: PowerUpSpawn): void {
    spawn.alive = false;
    const def = POWERUP_DEFS[spawn.type];
    const now = Date.now();

    // Remove existing effect of same type for this player
    this.activeEffects = this.activeEffects.filter(e => !(e.playerId === player.id && e.type === spawn.type));

    if (spawn.type === 'bomb') {
      // Instant: destroy nearby obstacles
      if (this.onBomb) this.onBomb(spawn.cx, spawn.cy, player.id);
      return;
    }

    // Timed effect
    this.activeEffects.push({
      type: spawn.type,
      playerId: player.id,
      expiresAt: now + def.duration,
    });
  }

  private render(offsetX: number, offsetY: number, now: number): void {
    const cs = CELL_SIZE;
    this.graphics.clear();

    // Clean stale labels
    for (const [key, label] of this.spawnLabels) {
      if (!this.spawns.some(s => s.alive && `${s.cx},${s.cy}` === key)) {
        label.destroy();
        this.spawnLabels.delete(key);
      }
    }

    for (const spawn of this.spawns) {
      if (!spawn.alive) continue;

      const def = POWERUP_DEFS[spawn.type];
      const px = offsetX + spawn.cx * cs;
      const py = offsetY + spawn.cy * cs;
      const cx = px + cs / 2;
      const cy = py + cs / 2;
      const key = `${spawn.cx},${spawn.cy}`;

      const age = (now - spawn.spawnTime) / 1000;
      const floatY = Math.sin(age * 3) * 2;
      const pulse = 0.8 + Math.sin(age * 4) * 0.2;

      // Outer glow (additive)
      const r = (def.color >> 16) & 0xff;
      const g = (def.color >> 8) & 0xff;
      const b = def.color & 0xff;

      this.graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 0.08 * pulse);
      this.graphics.fillCircle(cx, cy + floatY, cs * 0.8);

      this.graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 0.15 * pulse);
      this.graphics.fillCircle(cx, cy + floatY, cs * 0.4);

      // Core orb
      this.graphics.fillStyle(def.color, 0.85);
      this.graphics.fillCircle(cx, cy + floatY, 6);

      // White center
      this.graphics.fillStyle(0xffffff, 0.5 * pulse);
      this.graphics.fillCircle(cx, cy + floatY, 3);

      // Label
      if (!this.spawnLabels.has(key)) {
        const lbl = this.scene.add.text(cx - 10, cy + floatY + 16, def.label, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#' + def.color.toString(16).padStart(6, '0'),
        }).setDepth(6).setAlpha(0.6);
        this.spawnLabels.set(key, lbl);
      } else {
        const lbl = this.spawnLabels.get(key)!;
        lbl.setPosition(cx - 10, cy + floatY + 16);
      }
    }

    // Clean stale effect labels
    const activeKeys = new Set(this.activeEffects.map(e => `${e.playerId}:${e.type}`));
    for (const [key, label] of this.effectLabels) {
      if (!activeKeys.has(key)) {
        label.destroy();
        this.effectLabels.delete(key);
      }
    }
  }

  renderPlayerEffects(players: PlayerLight[]): void {
    const now = Date.now();
    for (const effect of this.activeEffects) {
      const def = POWERUP_DEFS[effect.type];
      const remaining = (effect.expiresAt - now) / 1000;
      const alpha = remaining < 1 ? remaining * (0.5 + 0.5 * Math.sin(now / 80)) : 1;

      const player = players.find(p => p.id === effect.playerId);
      if (!player) continue;

      // Ring around the player orb
      const r = (def.color >> 16) & 0xff;
      const g = (def.color >> 8) & 0xff;
      const b = def.color & 0xff;

      this.graphics.lineStyle(2, Phaser.Display.Color.GetColor(r, g, b), alpha * 0.7);
      this.graphics.strokeCircle(player.wx, player.wy, 14);

      // Timer text
      const ekey = `${effect.playerId}:${effect.type}`;
      if (def.duration > 0) {
        if (!this.effectLabels.has(ekey)) {
          const lbl = this.scene.add.text(player.wx - 8, player.wy + 20, remaining.toFixed(1), {
            fontFamily: 'monospace',
            fontSize: '8px',
            color: '#' + def.color.toString(16).padStart(6, '0'),
          }).setDepth(6).setAlpha(0.5);
          this.effectLabels.set(ekey, lbl);
        } else {
          const lbl = this.effectLabels.get(ekey)!;
          lbl.setPosition(player.wx - 8, player.wy + 20);
          lbl.setText(remaining.toFixed(1));
          lbl.setAlpha(alpha * 0.5);
        }
      }
    }
  }

  /** Get current spawn world positions (for bot AI targeting). */
  getSpawnPositions(): { wx: number; wy: number }[] {
    return this.spawns.filter(s => s.alive).map(s => {
      const px = s.cx * 32 + 16; // approximate world position
      const py = s.cy * 32 + 16;
      return { wx: px, wy: py };
    });
  }

  destroy(): void {
    this.graphics.destroy();
    for (const [, label] of this.spawnLabels) label.destroy();
    for (const [, label] of this.effectLabels) label.destroy();
    this.spawnLabels.clear();
    this.effectLabels.clear();
    this.spawns.length = 0;
    this.activeEffects.length = 0;
  }
}
