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

// ── Difficulty presets ──

export interface DifficultyConfig {
  botCount: number;
  botReactionDelay: number;
  botSpeedMult: number;
  botRadiusMult: number;
  obstacleBudget: number;
  label: string;
}

export const DIFFICULTY_PRESETS: Record<'easy' | 'medium' | 'hard', DifficultyConfig> = {
  easy: {
    botCount: 1,
    botReactionDelay: 2000,
    botSpeedMult: 0.8,
    botRadiusMult: 0.9,
    obstacleBudget: 14,
    label: 'Easy',
  },
  medium: {
    botCount: 2,
    botReactionDelay: 1500,
    botSpeedMult: 0.85,
    botRadiusMult: 1.0,
    obstacleBudget: 10,
    label: 'Medium',
  },
  hard: {
    botCount: 3,
    botReactionDelay: 800,
    botSpeedMult: 1.0,
    botRadiusMult: 1.1,
    obstacleBudget: 8,
    label: 'Hard',
  },
};

// ── Map presets ──

export const MAP_PRESETS: Record<'small' | 'medium' | 'large', { mapWidth: number; mapHeight: number; label: string }> = {
  small: { mapWidth: 20, mapHeight: 14, label: 'Small' },
  medium: { mapWidth: 24, mapHeight: 18, label: 'Medium' },
  large: { mapWidth: 30, mapHeight: 20, label: 'Large' },
};

// ── Duration options ──

export const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: '60s' },
  { value: 120, label: '120s' },
  { value: 180, label: '180s' },
  { value: 0, label: '∞' },
];

// ── XP system ──

export const XP_REWARDS = {
  placement: [100, 50, 25, 10], // 1st, 2nd, 3rd, 4th
  territoryMult: 0.5,           // XP per 1% territory
  timeBonusDiv: 5,              // XP per second remaining (win only)
};

export interface SessionStats {
  totalXP: number;
  matchesPlayed: number;
  wins: number;
}

export const sessionStats: SessionStats = {
  totalXP: 0,
  matchesPlayed: 0,
  wins: 0,
};

// ── Game config ──

export type MapTemplate = 'arena' | 'maze' | 'fortress' | 'chaos';

export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  mapTemplate: MapTemplate;
  mapSeed: number;
  lightRadius: number;
  lightSpeed: number;
  claimTime: number;
  decayTime: number;
  matchDuration: number;
  winPercent: number;
  obstacleBudget: number;
  obstacleCooldown: number;
  difficulty: 'easy' | 'medium' | 'hard';
  botCount: number;
  botReactionDelay: number;
  botSpeedMult: number;
  botRadiusMult: number;
}

export interface PlayerConfig {
  id: string;
  color: number;
  lightRadius: number;
  lightSpeed: number;
  startX: number;
  startY: number;
  obstacleBudget: number;
  reactionDelay: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ObstacleConfig {
  type: 'wall' | 'tower' | 'blinker' | 'mirror';
  width: number;
  height: number;
  blinkInterval?: number;
}

// ── Build config from selections ──

export function buildGameConfig(
  difficulty: 'easy' | 'medium' | 'hard',
  mapKey: 'small' | 'medium' | 'large',
  duration: number,
  mapTemplate: MapTemplate = 'arena',
  mapSeed?: number,
): GameConfig {
  const dp = DIFFICULTY_PRESETS[difficulty];
  const mp = MAP_PRESETS[mapKey];

  return {
    mapWidth: mp.mapWidth,
    mapHeight: mp.mapHeight,
    mapTemplate,
    mapSeed: mapSeed ?? Date.now(),
    lightRadius: 6,
    lightSpeed: 160,
    claimTime: 300,
    decayTime: 500,
    matchDuration: duration,
    winPercent: 60,
    obstacleBudget: dp.obstacleBudget,
    obstacleCooldown: 1000,
    difficulty,
    botCount: dp.botCount,
    botReactionDelay: dp.botReactionDelay,
    botSpeedMult: dp.botSpeedMult,
    botRadiusMult: dp.botRadiusMult,
  };
}

export const DEFAULT_CONFIG: GameConfig = buildGameConfig('medium', 'medium', 120);
