/**
 * Level definitions for the campaign mode.
 * 15 levels across 5 chapters, each with unique objectives and escalating difficulty.
 */

export type ObjectiveType = 'capture_pct' | 'survive_time' | 'destroy_towers' | 'no_obstacles';

export interface LevelObjective {
  type: ObjectiveType;
  target: number;       // e.g. 60 for 60%, 90 for 90 seconds, 3 for 3 towers
  description: string;
}

export interface StarThresholds {
  /** 2★: complete within this many seconds (0 = no time bonus) */
  time: number;
  /** 3★: achieve this % territory (only for capture objectives) or this perf metric */
  performance: number;
}

export interface LevelDef {
  id: string;
  chapter: number;         // 1-5
  indexInChapter: number;  // 0-2
  name: string;
  briefing: string;
  hint: string;

  // Game config overrides
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
  mapKey: 'small' | 'medium' | 'large';
  mapTemplate: 'arena' | 'maze' | 'fortress' | 'chaos';
  matchDuration: number;
  mapSeed?: number;         // fixed seed for reproducibility

  // Objectives
  primary: LevelObjective;
  secondary?: LevelObjective;  // bonus objective for extra XP

  // Stars
  stars: StarThresholds;
}

// ── Chapter themes ──

export const CHAPTER_INFO: Record<number, { name: string; subtitle: string; color: number }> = {
  1: { name: 'Awakening', subtitle: 'Learn the basics', color: 0xffd700 },
  2: { name: 'Expansion', subtitle: 'Grow your territory', color: 0x4a9eff },
  3: { name: 'Fortification', subtitle: 'Master obstacles', color: 0xb44aff },
  4: { name: 'Domination', subtitle: 'Crush the competition', color: 0xff6644 },
  5: { name: 'Ascension', subtitle: 'Prove your mastery', color: 0xff44aa },
};

// ── All 15 levels ──

export const LEVELS: LevelDef[] = [
  // ── Chapter 1: Awakening ──
  {
    id: '1-1', chapter: 1, indexInChapter: 0,
    name: 'First Light',
    briefing: 'Your light awakens in the darkness. Capture territory by moving through it.',
    hint: 'Move with WASD. Your light claims cells automatically.',
    difficulty: 'easy', mapKey: 'small', mapTemplate: 'arena',
    matchDuration: 90, mapSeed: 1001,
    primary: { type: 'capture_pct', target: 40, description: 'Capture 40% territory' },
    stars: { time: 60, performance: 55 },
  },
  {
    id: '1-2', chapter: 1, indexInChapter: 1,
    name: 'Gentle Push',
    briefing: 'A single opponent guards the field. Push them back.',
    hint: 'Stay near your territory to keep it claimed.',
    difficulty: 'easy', mapKey: 'small', mapTemplate: 'arena',
    matchDuration: 90, mapSeed: 1002,
    primary: { type: 'capture_pct', target: 45, description: 'Capture 45% territory' },
    stars: { time: 55, performance: 60 },
  },
  {
    id: '1-3', chapter: 1, indexInChapter: 2,
    name: 'Into the Maze',
    briefing: 'The corridors twist and turn. Navigate carefully.',
    hint: 'Maze walls block line of sight. Plan your path.',
    difficulty: 'easy', mapKey: 'small', mapTemplate: 'maze',
    matchDuration: 90, mapSeed: 1003,
    primary: { type: 'capture_pct', target: 40, description: 'Capture 40% territory' },
    stars: { time: 65, performance: 55 },
  },

  // ── Chapter 2: Expansion ──
  {
    id: '2-1', chapter: 2, indexInChapter: 0,
    name: 'Larger Fields',
    briefing: 'The arena expands. Two opponents now challenge you.',
    hint: 'Use obstacles to block enemy paths.',
    difficulty: 'medium', mapKey: 'medium', mapTemplate: 'arena',
    matchDuration: 120, mapSeed: 2001,
    primary: { type: 'capture_pct', target: 35, description: 'Capture 35% territory' },
    stars: { time: 80, performance: 50 },
  },
  {
    id: '2-2', chapter: 2, indexInChapter: 1,
    name: 'Survival Test',
    briefing: 'Survive for 60 seconds against two aggressive bots.',
    hint: 'Focus on holding ground, not expanding.',
    difficulty: 'medium', mapKey: 'small', mapTemplate: 'fortress',
    matchDuration: 60, mapSeed: 2002,
    primary: { type: 'survive_time', target: 60, description: 'Survive for 60 seconds' },
    secondary: { type: 'capture_pct', target: 25, description: 'Capture 25% territory (bonus)' },
    stars: { time: 60, performance: 30 },
  },
  {
    id: '2-3', chapter: 2, indexInChapter: 2,
    name: 'Chaos Reigns',
    briefing: 'Random obstacles everywhere. Adapt or fall.',
    hint: 'Chaos maps change every match. Use what you find.',
    difficulty: 'medium', mapKey: 'medium', mapTemplate: 'chaos',
    matchDuration: 120, mapSeed: 2003,
    primary: { type: 'capture_pct', target: 35, description: 'Capture 35% territory' },
    stars: { time: 85, performance: 48 },
  },

  // ── Chapter 3: Fortification ──
  {
    id: '3-1', chapter: 3, indexInChapter: 0,
    name: 'Tower Siege',
    briefing: 'Destroy all enemy towers to win.',
    hint: 'Towers are indestructible by light. Use bomb power-ups.',
    difficulty: 'medium', mapKey: 'medium', mapTemplate: 'fortress',
    matchDuration: 120, mapSeed: 3001,
    primary: { type: 'destroy_towers', target: 3, description: 'Destroy 3 towers' },
    stars: { time: 90, performance: 35 },
  },
  {
    id: '3-2', chapter: 3, indexInChapter: 1,
    name: 'No Fortifications',
    briefing: 'Win without placing a single obstacle.',
    hint: 'Rely on movement and territory control alone.',
    difficulty: 'medium', mapKey: 'medium', mapTemplate: 'arena',
    matchDuration: 120, mapSeed: 3002,
    primary: { type: 'no_obstacles', target: 1, description: 'Win without obstacles' },
    secondary: { type: 'capture_pct', target: 40, description: 'Capture 40% (bonus)' },
    stars: { time: 90, performance: 45 },
  },
  {
    id: '3-3', chapter: 3, indexInChapter: 2,
    name: 'Mirror Maze',
    briefing: 'Mirrors reflect your light. Use them wisely.',
    hint: 'Mirrors bounce light at angles. Approach from the right side.',
    difficulty: 'hard', mapKey: 'medium', mapTemplate: 'maze',
    matchDuration: 120, mapSeed: 3003,
    primary: { type: 'capture_pct', target: 35, description: 'Capture 35% territory' },
    stars: { time: 80, performance: 45 },
  },

  // ── Chapter 4: Domination ──
  {
    id: '4-1', chapter: 4, indexInChapter: 0,
    name: 'Three Fronts',
    briefing: 'Three opponents. No mercy.',
    hint: 'Target the weakest opponent first.',
    difficulty: 'hard', mapKey: 'medium', mapTemplate: 'arena',
    matchDuration: 120, mapSeed: 4001,
    primary: { type: 'capture_pct', target: 35, description: 'Capture 35% territory' },
    stars: { time: 70, performance: 45 },
  },
  {
    id: '4-2', chapter: 4, indexInChapter: 1,
    name: 'Blitzkrieg',
    briefing: 'Fast match. Capture quickly or lose.',
    hint: 'Sprint (SHIFT) to reach key areas fast.',
    difficulty: 'hard', mapKey: 'small', mapTemplate: 'arena',
    matchDuration: 60, mapSeed: 4002,
    primary: { type: 'capture_pct', target: 40, description: 'Capture 40% territory' },
    stars: { time: 40, performance: 55 },
  },
  {
    id: '4-3', chapter: 4, indexInChapter: 2,
    name: 'Fortress Assault',
    briefing: 'Break through layered defenses.',
    hint: 'Bomb power-ups are essential here.',
    difficulty: 'hard', mapKey: 'large', mapTemplate: 'fortress',
    matchDuration: 150, mapSeed: 4003,
    primary: { type: 'capture_pct', target: 30, description: 'Capture 30% territory' },
    secondary: { type: 'destroy_towers', target: 5, description: 'Destroy 5 towers (bonus)' },
    stars: { time: 100, performance: 40 },
  },

  // ── Chapter 5: Ascension ──
  {
    id: '5-1', chapter: 5, indexInChapter: 0,
    name: 'Nightmare Begins',
    briefing: 'The hardest difficulty. Are you ready?',
    hint: 'Nightmare bots seek power-ups and place obstacles aggressively.',
    difficulty: 'nightmare', mapKey: 'medium', mapTemplate: 'arena',
    matchDuration: 120, mapSeed: 5001,
    primary: { type: 'capture_pct', target: 30, description: 'Capture 30% territory' },
    stars: { time: 80, performance: 40 },
  },
  {
    id: '5-2', chapter: 5, indexInChapter: 1,
    name: 'Endless Night',
    briefing: 'No time limit. Win by territory alone.',
    hint: 'Patience wins. Expand slowly and defend.',
    difficulty: 'nightmare', mapKey: 'medium', mapTemplate: 'chaos',
    matchDuration: 0, mapSeed: 5002,
    primary: { type: 'capture_pct', target: 35, description: 'Capture 35% territory' },
    stars: { time: 0, performance: 42 },
  },
  {
    id: '5-3', chapter: 5, indexInChapter: 2,
    name: 'Lumina Ascended',
    briefing: 'The final test. Prove you are the light.',
    hint: 'Use everything you have learned.',
    difficulty: 'nightmare', mapKey: 'large', mapTemplate: 'maze',
    matchDuration: 150, mapSeed: 5003,
    primary: { type: 'capture_pct', target: 30, description: 'Capture 30% territory' },
    secondary: { type: 'no_obstacles', target: 1, description: 'No obstacles used (bonus)' },
    stars: { time: 100, performance: 38 },
  },
];

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find(l => l.id === id);
}

export function getChapterLevels(chapter: number): LevelDef[] {
  return LEVELS.filter(l => l.chapter === chapter);
}

export function getNextLevelId(currentId: string): string | null {
  const idx = LEVELS.findIndex(l => l.id === currentId);
  if (idx >= 0 && idx < LEVELS.length - 1) return LEVELS[idx + 1].id;
  return null;
}
