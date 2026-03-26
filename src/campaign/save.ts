/**
 * Campaign save data — persisted in localStorage.
 * Tracks unlocked levels, stars per level, total XP, cosmetics.
 */

import { LEVELS, type LevelDef } from './levels';

const SAVE_KEY = 'luminaclash_campaign';

export interface LevelSave {
  stars: number;         // 0-3
  bestTime: number;      // seconds (0 = not completed)
  bestPct: number;       // best territory %
  completed: boolean;
  xpAwarded: number;     // total XP ever awarded for this level (prevents double-count)
}

export interface CampaignSave {
  levels: Record<string, LevelSave>;
  totalXP: number;
  playerLevel: number;
  selectedColor: string;
  unlockedColors: string[];
}

const DEFAULT_SAVE: CampaignSave = {
  levels: {},
  totalXP: 0,
  playerLevel: 1,
  selectedColor: '#ffd700',
  unlockedColors: ['#ffd700'],
};

export function loadSave(): CampaignSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CampaignSave;
      return { ...DEFAULT_SAVE, ...parsed, levels: { ...DEFAULT_SAVE.levels, ...parsed.levels } };
    }
  } catch { /* corrupted — reset */ }
  return { ...DEFAULT_SAVE, levels: {} };
}

export function writeSave(save: CampaignSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch { /* storage full — ignore */ }
}

export function isLevelUnlocked(levelId: string, save: CampaignSave): boolean {
  const idx = LEVELS.findIndex(l => l.id === levelId);
  if (idx === 0) return true;
  if (idx < 0) return false;
  const prevLevel = LEVELS[idx - 1];
  return save.levels[prevLevel.id]?.completed ?? false;
}

export function calcStars(
  level: LevelDef,
  completed: boolean,
  timeSeconds: number,
  territoryPct: number,
): number {
  if (!completed) return 0;

  // No time limit levels
  if (level.matchDuration === 0) {
    if (territoryPct >= level.stars.performance) return 3;
    if (territoryPct >= 40) return 2;
    return 1;
  }

  // Time-limited levels
  let stars = 1;
  const timeMet = level.stars.time > 0 && timeSeconds <= level.stars.time;
  const perfMet = level.primary.type === 'capture_pct'
    ? territoryPct >= level.stars.performance
    : territoryPct >= level.stars.performance;

  if (timeMet) stars = 2;
  if (timeMet && perfMet) stars = 3;

  return Math.min(3, stars);
}

export function calcLevelXP(level: LevelDef, stars: number, placement: number): number {
  let xp = 0;
  if (stars >= 1) xp += 50;   // completion
  if (stars >= 2) xp += 30;   // time bonus
  if (stars >= 3) xp += 50;   // perf bonus
  if (placement === 1) xp += 20; // win bonus
  return xp;
}

export function submitLevelResult(
  save: CampaignSave,
  levelId: string,
  completed: boolean,
  timeSeconds: number,
  territoryPct: number,
  placement: number,
): { save: CampaignSave; xpEarned: number; stars: number; newBest: boolean } {
  const level = LEVELS.find(l => l.id === levelId);
  if (!level) return { save, xpEarned: 0, stars: 0, newBest: false };

  const stars = calcStars(level, completed, timeSeconds, territoryPct);
  if (stars === 0) return { save, xpEarned: 0, stars: 0, newBest: false };

  const xp = calcLevelXP(level, stars, placement);
  const prev = save.levels[levelId];
  const newBest = !prev || stars > prev.stars;

  if (!newBest) return { save, xpEarned: 0, stars: prev.stars, newBest: false };

  // Calculate additional XP (only the difference)
  const prevXP = prev?.xpAwarded ?? 0;
  const additionalXP = xp - prevXP;
  const newTotalXP = save.totalXP + additionalXP;
  const newPlayerLevel = Math.floor(newTotalXP / 200) + 1;

  const newSave: CampaignSave = {
    ...save,
    totalXP: newTotalXP,
    playerLevel: newPlayerLevel,
    levels: {
      ...save.levels,
      [levelId]: {
        stars,
        bestTime: !prev || timeSeconds < (prev.bestTime || Infinity) ? timeSeconds : prev.bestTime,
        bestPct: !prev || territoryPct > prev.bestPct ? territoryPct : prev.bestPct,
        completed,
        xpAwarded: xp,
      },
    },
  };

  return { save: newSave, xpEarned: additionalXP, stars, newBest: true };
}

/** Color unlocks by player level */
export const COLOR_UNLOCKS: { level: number; color: string; name: string }[] = [
  { level: 1, color: '#ffd700', name: 'Gold' },
  { level: 2, color: '#4a9eff', name: 'Azure' },
  { level: 3, color: '#ff6b6b', name: 'Coral' },
  { level: 5, color: '#4aff8b', name: 'Mint' },
  { level: 7, color: '#b44aff', name: 'Violet' },
  { level: 10, color: '#ff44aa', name: 'Magenta' },
  { level: 13, color: '#44ffff', name: 'Cyan' },
  { level: 16, color: '#ff8800', name: 'Amber' },
  { level: 20, color: '#ffffff', name: 'White' },
];

/** Check and unlock new colors based on player level */
export function checkColorUnlocks(save: CampaignSave): CampaignSave {
  let changed = false;
  let newColor: string | null = null;
  const unlocked = new Set(save.unlockedColors);

  for (const unlock of COLOR_UNLOCKS) {
    if (save.playerLevel >= unlock.level && !unlocked.has(unlock.color)) {
      unlocked.add(unlock.color);
      newColor = unlock.color;
      changed = true;
    }
  }

  if (changed) {
    return {
      ...save,
      unlockedColors: [...unlocked],
      selectedColor: newColor || save.selectedColor,
    };
  }
  return save;
}

export function getTotalStars(save: CampaignSave): number {
  return Object.values(save.levels).reduce((sum, l) => sum + l.stars, 0);
}

export function getChapterStars(save: CampaignSave, chapter: number): number {
  return LEVELS
    .filter(l => l.chapter === chapter)
    .reduce((sum, l) => sum + (save.levels[l.id]?.stars ?? 0), 0);
}
