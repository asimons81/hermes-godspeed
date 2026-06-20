import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GhostSample } from '../game/types';
import {
  applyRunToProfile,
  createDefaultProfile,
  getDailyBest,
  getGhostForRun,
  loadProfile,
  recordGhostForRun,
  type RunSummary
} from './Progression';

const run = (patch: Partial<RunSummary> = {}): RunSummary => ({
  runMode: 'daily',
  difficulty: 'normal',
  dailyId: '2026-06-03',
  segmentId: 'agora',
  score: 12345,
  lobsters: 44,
  survivalMs: 52000,
  bestCombo: 14,
  topSpeed: 760,
  powerupsCollected: 3,
  obstaclesSmashed: 5,
  courierSeals: 2,
  ...patch
});

describe('Progression v2', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates v2 profiles with relay fields', () => {
    const profile = createDefaultProfile();
    expect(profile.version).toBe(2);
    expect(profile.courierSeals).toBe(0);
    expect(profile.introWatched).toBe(false);
    expect(profile.dailyBests).toEqual({});
    expect(profile.ghosts).toEqual([]);
  });

  it('applies daily runs to stats, seals, missions, and daily best', () => {
    const result = applyRunToProfile(createDefaultProfile(), run());
    const profile = result.profile;
    const dailyBest = getDailyBest(profile, '2026-06-03', 'normal');

    expect(profile.stats.totalRuns).toBe(1);
    expect(profile.stats.dailyRuns).toBe(1);
    expect(profile.stats.courierSeals).toBe(2);
    expect(profile.courierSeals).toBe(2);
    expect(dailyBest?.score).toBe(12345);
    expect(dailyBest?.segmentId).toBe('agora');
    expect(result.laurelsEarned).toBeGreaterThan(0);
  });

  it('keeps only capped best ghost samples per run key', () => {
    const samples: GhostSample[] = Array.from({ length: 400 }, (_, index) => ({
      t: index * 150,
      lane: (index % 3) as 0 | 1 | 2,
      y: index % 2 === 0 ? 0 : 80,
      slide: index % 5 === 0,
      score: index * 10
    }));

    const first = recordGhostForRun(createDefaultProfile(), run({ score: 5000 }), samples);
    const lowerScore = recordGhostForRun(first, run({ score: 1000 }), samples.slice(0, 12));
    const higherScore = recordGhostForRun(lowerScore, run({ score: 7000 }), samples);
    const ghost = getGhostForRun(higherScore, 'daily', 'normal', '2026-06-03');

    expect(getGhostForRun(lowerScore, 'daily', 'normal', '2026-06-03')?.score).toBe(5000);
    expect(ghost?.score).toBe(7000);
    expect(ghost?.samples.length).toBeLessThanOrEqual(240);
  });

  it('repairs corrupted stored profiles to playable defaults', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '{not-json',
        setItem: () => undefined
      }
    });

    const profile = loadProfile(999);

    expect(profile.version).toBe(2);
    expect(profile.stats.totalScore).toBeGreaterThanOrEqual(999);
    expect(profile.missions.length).toBe(3);
  });
});
