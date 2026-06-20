import { describe, expect, it } from 'vitest';
import type { GameSnapshot, RunStartDetail } from '../game/types';
import { createRunSeed, RunDirector } from './RunDirector';

const baseSnapshot = (patch: Partial<GameSnapshot> = {}): GameSnapshot => ({
  phase: 'playing',
  difficulty: 'normal',
  runMode: 'daily',
  seed: 1,
  dailyId: '2026-06-03',
  segmentId: 'olympus',
  segmentElapsedMs: 0,
  activeEvent: 'none',
  courierSeals: 0,
  score: 0,
  lobsters: 0,
  combo: 1,
  strikesTaken: 0,
  maxStrikes: 3,
  speed: 430,
  multiplier: 1,
  elapsedMs: 0,
  survivalMs: 0,
  bestCombo: 1,
  powerupsCollected: 0,
  obstaclesSmashed: 0,
  topSpeed: 430,
  playerLane: 1,
  verticalOffset: 0,
  isSliding: false,
  invulnerable: false,
  canEatObstacles: false,
  activePowerLabel: 'Ready',
  ...patch
});

const dailyDetail = (): RunStartDetail => ({
  ...createRunSeed('daily', 'normal', new Date('2026-06-03T12:00:00')),
  difficulty: 'normal'
});

describe('RunDirector', () => {
  it('creates stable daily seeds and rotates by date', () => {
    const first = createRunSeed('daily', 'normal', new Date('2026-06-03T12:00:00'));
    const same = createRunSeed('daily', 'normal', new Date('2026-06-03T23:59:00'));
    const next = createRunSeed('daily', 'normal', new Date('2026-06-04T00:01:00'));

    expect(first).toEqual(same);
    expect(first.seed).not.toBe(next.seed);
    expect(first.dailyId).toBe('2026-06-03');
  });

  it('emits deterministic command streams for the same seed', () => {
    const a = new RunDirector();
    const b = new RunDirector();
    const detail = dailyDetail();
    a.start(detail);
    b.start(detail);

    const aCommands = [];
    const bCommands = [];
    let elapsedMs = 0;

    for (let index = 0; index < 80; index += 1) {
      elapsedMs += 500;
      const snapshot = baseSnapshot({ elapsedMs, speed: 420 + index });
      aCommands.push(...a.update(500, snapshot));
      bCommands.push(...b.update(500, snapshot));
    }

    expect(aCommands).toEqual(bCommands);
    expect(aCommands.some((command) => command.kind === 'gate')).toBe(true);
  });

  it('applies gate boons and expires them', () => {
    const director = new RunDirector();
    director.start(dailyDetail());

    let gateSeen = false;
    for (let elapsedMs = 0; elapsedMs < 40000 && !gateSeen; elapsedMs += 1000) {
      const commands = director.update(1000, baseSnapshot({ elapsedMs }));
      const gate = commands.find((command) => command.kind === 'gate');
      if (gate?.kind === 'gate') {
        gateSeen = true;
        const choice = director.chooseGate(0);
        expect(choice).toBeDefined();
        expect(director.snapshot.activeBoon?.remainingMs).toBeGreaterThan(0);
      }
    }

    expect(gateSeen).toBe(true);
    director.update(10000, baseSnapshot({ elapsedMs: 50000 }));
    expect(director.snapshot.activeBoon).toBeUndefined();
  });

  it('keeps pattern commands avoidable by leaving at least one lane open', () => {
    const director = new RunDirector();
    director.start(dailyDetail());

    for (let elapsedMs = 0; elapsedMs < 22000; elapsedMs += 700) {
      const commands = director.update(700, baseSnapshot({ elapsedMs, speed: 460 }));
      for (const command of commands) {
        if (command.kind !== 'pattern') {
          continue;
        }

        if (command.pattern === 'split-lane-trap') {
          expect(command.rewardLane).not.toBe(command.lane);
        }
      }
    }
  });
});
