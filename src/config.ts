// Game balance and configuration
export const CELL_SIZE = 32;

export const PLAYER_COLORS: Record<string, number> = {
  player: 0xffd700,  // Gold
  bot1: 0x4a9eff,    // Blue
  bot2: 0xb44aff,    // Purple
  bot3: 0x4aff8b,    // Green
};

export const CELL_STATE = {
  NEUTRAL: 0,
  CLAIMING: 1,
  OWNED: 2,
  DECAYING: 3,
} as const;

export type CellState = (typeof CELL_STATE)[keyof typeof CELL_STATE];

export interface GameConfig {
  mapWidth: number;    // in cells
  mapHeight: number;   // in cells
  lightRadius: number; // in cells
  lightSpeed: number;  // pixels per second
  claimTime: number;   // ms to claim a cell
  decayTime: number;   // ms for a cell to decay
  matchDuration: number; // seconds, 0 = unlimited
  winPercent: number;  // % to win
  obstacleBudget: number;
  obstacleCooldown: number; // ms between placements
}

export interface PlayerConfig {
  id: string;
  color: number;
  lightRadius: number;
  lightSpeed: number;
  startX: number; // cell
  startY: number; // cell
  obstacleBudget: number;
  reactionDelay: number; // for bots, ms between AI decisions
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ObstacleConfig {
  type: 'wall' | 'tower' | 'blinker' | 'mirror';
  width: number;  // in cells
  height: number; // in cells
  blinkInterval?: number; // ms for blinkers
}

// Default configs for game modes
export const DEFAULT_CONFIG: GameConfig = {
  mapWidth: 24,
  mapHeight: 18,
  lightRadius: 6,
  lightSpeed: 160,
  claimTime: 300,
  decayTime: 500,
  matchDuration: 120,
  winPercent: 60,
  obstacleBudget: 10,
  obstacleCooldown: 1000,
};
