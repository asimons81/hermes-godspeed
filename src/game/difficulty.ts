import type { DifficultyLevel } from './types';

export type DifficultyPreset = {
  label: string;
  baseSpeed: number;
  maxSpeed: number;
  rampPerSecond: number;
  comboGraceMs: number;
  powerDurationMultiplier: number;
  phaseMs: {
    mid: number;
    late: number;
  };
  spawnIntervalMultiplier: number;
  powerupFirstMs: number;
  powerupCooldownMs: number;
  patternMultipliers: Partial<Record<string, number>>;
};

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyPreset> = {
  easy: {
    label: 'Easy',
    baseSpeed: 320,
    maxSpeed: 840,
    rampPerSecond: 5.4,
    comboGraceMs: 1900,
    powerDurationMultiplier: 1.2,
    phaseMs: { mid: 22000, late: 60000 },
    spawnIntervalMultiplier: 1.18,
    powerupFirstMs: 6000,
    powerupCooldownMs: 5200,
    patternMultipliers: {
      'low-obstacle': 0.72,
      'high-obstacle': 0.62,
      'jump-slide-pair': 0.55,
      'split-lane-trap': 0.65,
      'powerup-window': 1.25
    }
  },
  normal: {
    label: 'Normal',
    baseSpeed: 360,
    maxSpeed: 920,
    rampPerSecond: 6.2,
    comboGraceMs: 1500,
    powerDurationMultiplier: 1,
    phaseMs: { mid: 15000, late: 45000 },
    spawnIntervalMultiplier: 1,
    powerupFirstMs: 8200,
    powerupCooldownMs: 6500,
    patternMultipliers: {}
  },
  hard: {
    label: 'Hard',
    baseSpeed: 410,
    maxSpeed: 1020,
    rampPerSecond: 7.4,
    comboGraceMs: 1200,
    powerDurationMultiplier: 0.88,
    phaseMs: { mid: 11000, late: 36000 },
    spawnIntervalMultiplier: 0.86,
    powerupFirstMs: 10000,
    powerupCooldownMs: 7800,
    patternMultipliers: {
      'low-obstacle': 1.16,
      'high-obstacle': 1.22,
      'jump-slide-pair': 1.42,
      'split-lane-trap': 1.35,
      'powerup-window': 0.8
    }
  },
  godspeed: {
    label: 'GODSPEED!',
    baseSpeed: 470,
    maxSpeed: 1180,
    rampPerSecond: 8.8,
    comboGraceMs: 950,
    powerDurationMultiplier: 0.78,
    phaseMs: { mid: 7000, late: 26000 },
    spawnIntervalMultiplier: 0.72,
    powerupFirstMs: 13500,
    powerupCooldownMs: 9800,
    patternMultipliers: {
      'lobster-line': 0.82,
      'low-obstacle': 1.34,
      'high-obstacle': 1.5,
      'jump-slide-pair': 1.95,
      'split-lane-trap': 1.82,
      'powerup-window': 0.55
    }
  }
};

export const DEFAULT_DIFFICULTY: DifficultyLevel = 'normal';

export const getDifficultyPreset = (difficulty: DifficultyLevel) => DIFFICULTY_PRESETS[difficulty];

export const isDifficultyLevel = (value: unknown): value is DifficultyLevel =>
  typeof value === 'string' && value in DIFFICULTY_PRESETS;

export const normalizeDifficulty = (value: unknown): DifficultyLevel =>
  isDifficultyLevel(value) ? value : DEFAULT_DIFFICULTY;

export const getDifficultyLabel = (difficulty: DifficultyLevel) => getDifficultyPreset(difficulty).label;
