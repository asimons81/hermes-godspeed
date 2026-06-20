import { describe, expect, it } from 'vitest';
import type { RunStartDetail } from '../game/types';
import { RunnerSimulation } from './RunnerSimulation';

const startDetail = (): RunStartDetail => ({
  mode: 'classic',
  difficulty: 'normal',
  seed: 7,
  dailyId: ''
});

const startSimulation = () => {
  const sim = new RunnerSimulation();
  sim.start(startDetail());
  return sim;
};

describe('RunnerSimulation obstacle rules', () => {
  it('only explicit smash or protection states make obstacles safe', () => {
    const sandals = startSimulation();
    sandals.activatePowerUp('sandals');
    expect(sandals.snapshot.canEatObstacles).toBe(false);
    expect(sandals.snapshot.invulnerable).toBe(false);

    const chomp = startSimulation();
    chomp.activatePowerUp('chomp');
    expect(chomp.snapshot.canEatObstacles).toBe(true);
    expect(chomp.snapshot.invulnerable).toBe(true);

    const shield = startSimulation();
    shield.activateBoon({ kind: 'storm-shield', label: 'Storm Shield', remainingMs: 6000 });
    expect(shield.snapshot.canEatObstacles).toBe(true);
    expect(shield.snapshot.invulnerable).toBe(true);
  });

  it('records obstacle strikes and ends the run at the strike limit', () => {
    const sim = startSimulation();

    expect(sim.recordObstacleHit()).toBe(1);
    expect(sim.recordObstacleHit()).toBe(2);
    expect(sim.snapshot.phase).toBe('playing');
    expect(sim.recordObstacleHit()).toBe(3);
    expect(sim.snapshot.phase).toBe('gameover');
    expect(sim.snapshot.strikesTaken).toBe(3);
  });

  it('awards smash rewards without adding strikes during smash mode', () => {
    const sim = startSimulation();
    sim.activatePowerUp('chomp');

    const scoreBefore = sim.snapshot.score;
    const reward = sim.smashObstacle();

    expect(reward).toBeGreaterThan(0);
    expect(sim.snapshot.score).toBeGreaterThan(scoreBefore);
    expect(sim.snapshot.obstaclesSmashed).toBe(1);
    expect(sim.snapshot.strikesTaken).toBe(0);
  });
});
