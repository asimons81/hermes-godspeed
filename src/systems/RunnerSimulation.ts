import { DEFAULT_DIFFICULTY, getDifficultyPreset } from '../game/difficulty';
import type {
  ActiveBoon,
  DifficultyLevel,
  GamePhase,
  GameSnapshot,
  LaneIndex,
  RunDirectorSnapshot,
  RunMode,
  RunStartDetail,
  PowerUpKind,
  RouteSegmentId
} from '../game/types';

const GRAVITY = 2600;
const JUMP_VELOCITY = 1040;
const MAX_STRIKES = 3;

const POWER_DURATIONS: Record<Exclude<PowerUpKind, 'bolt'>, number> = {
  chomp: 7200,
  sandals: 5200,
  goblet: 9000,
  magnet: 7800
};

const POWER_LABELS: Record<PowerUpKind, string> = {
  chomp: 'Divine Chomp',
  sandals: 'Winged Sandals',
  goblet: 'Golden Goblet',
  bolt: 'Zeus Bolt',
  magnet: 'Lobster Magnet'
};

const DEFAULT_SEED = 1;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class RunnerSimulation {
  private phase: GamePhase = 'ready';
  private difficulty: DifficultyLevel = DEFAULT_DIFFICULTY;
  private runMode: RunMode = 'classic';
  private seed = DEFAULT_SEED;
  private dailyId = '';
  private segmentId: RouteSegmentId = 'olympus';
  private segmentElapsedMs = 0;
  private activeBoon?: ActiveBoon;
  private activeEvent: GameSnapshot['activeEvent'] = 'none';
  private courierSeals = 0;
  private score = 0;
  private lobsters = 0;
  private combo = 0;
  private comboTimerMs = 0;
  private elapsedMs = 0;
  private strikesTaken = 0;
  private playerLane: LaneIndex = 1;
  private verticalOffset = 0;
  private verticalVelocity = 0;
  private isSliding = false;
  private speed = getDifficultyPreset(DEFAULT_DIFFICULTY).baseSpeed;
  private bestCombo = 1;
  private powerupsCollected = 0;
  private obstaclesSmashed = 0;
  private topSpeed = this.speed;
  private powerTimers: Record<Exclude<PowerUpKind, 'bolt'>, number> = {
    chomp: 0,
    sandals: 0,
    goblet: 0,
    magnet: 0
  };

  reset(phase: GamePhase = 'ready') {
    const preset = getDifficultyPreset(this.difficulty);
    this.phase = phase;
    this.segmentId = 'olympus';
    this.segmentElapsedMs = 0;
    this.activeBoon = undefined;
    this.activeEvent = 'none';
    this.courierSeals = 0;
    this.score = 0;
    this.lobsters = 0;
    this.combo = 0;
    this.comboTimerMs = 0;
    this.elapsedMs = 0;
    this.strikesTaken = 0;
    this.playerLane = 1;
    this.verticalOffset = 0;
    this.verticalVelocity = 0;
    this.isSliding = false;
    this.speed = preset.baseSpeed;
    this.bestCombo = 1;
    this.powerupsCollected = 0;
    this.obstaclesSmashed = 0;
    this.topSpeed = preset.baseSpeed;
    this.powerTimers.chomp = 0;
    this.powerTimers.sandals = 0;
    this.powerTimers.goblet = 0;
    this.powerTimers.magnet = 0;
  }

  start(detail?: Partial<RunStartDetail>) {
    if (detail?.difficulty) {
      this.difficulty = detail.difficulty;
    }

    this.runMode = detail?.mode ?? 'classic';
    this.seed = detail?.seed ?? DEFAULT_SEED;
    this.dailyId = detail?.dailyId ?? '';
    this.reset('playing');
  }

  pause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      return;
    }

    if (this.phase === 'paused') {
      this.phase = 'playing';
    }
  }

  gameOver() {
    if (this.phase === 'playing') {
      this.phase = 'gameover';
    }
  }

  setDifficulty(difficulty: DifficultyLevel) {
    if (this.phase === 'playing' || this.phase === 'paused') {
      return;
    }

    this.difficulty = difficulty;
    const preset = getDifficultyPreset(difficulty);
    this.speed = preset.baseSpeed;
    this.topSpeed = Math.max(this.topSpeed, preset.baseSpeed);
  }

  update(deltaMs: number) {
    if (this.phase !== 'playing') {
      return;
    }

    const seconds = deltaMs / 1000;
    this.elapsedMs += deltaMs;

    const preset = getDifficultyPreset(this.difficulty);
    const ramp = Math.min(this.elapsedMs / 1000, 120) * preset.rampPerSecond;
    const sandalBoost = this.powerTimers.sandals > 0 ? 1.18 : 1;
    const boonBoost = this.activeBoon?.kind === 'wing-tempo' ? 1.12 : 1;
    this.speed = clamp((preset.baseSpeed + ramp) * sandalBoost * boonBoost, preset.baseSpeed, preset.maxSpeed);
    this.topSpeed = Math.max(this.topSpeed, this.speed);

    this.score += seconds * this.speed * 0.08 * this.multiplier;

    if (this.comboTimerMs > 0) {
      this.comboTimerMs = Math.max(0, this.comboTimerMs - deltaMs);
      if (this.comboTimerMs === 0) {
        this.combo = 0;
      }
    }

    for (const key of Object.keys(this.powerTimers) as Array<Exclude<PowerUpKind, 'bolt'>>) {
      this.powerTimers[key] = Math.max(0, this.powerTimers[key] - deltaMs);
    }

    this.updateJump(seconds);
  }

  setDirectorSnapshot(snapshot: RunDirectorSnapshot) {
    this.runMode = snapshot.runMode;
    this.seed = snapshot.seed;
    this.dailyId = snapshot.dailyId;
    this.segmentId = snapshot.segmentId;
    this.segmentElapsedMs = snapshot.segmentElapsedMs;
    this.activeBoon = snapshot.activeBoon;
    this.activeEvent = snapshot.activeEvent;
  }

  moveLane(direction: -1 | 1) {
    if (this.phase !== 'playing') {
      return;
    }

    this.playerLane = clamp(this.playerLane + direction, 0, 2) as LaneIndex;
  }

  jump() {
    if (this.phase !== 'playing' || this.verticalOffset > 0 || this.isSliding) {
      return false;
    }

    this.verticalVelocity = JUMP_VELOCITY;
    return true;
  }

  setSliding(active: boolean) {
    if (this.phase !== 'playing') {
      this.isSliding = false;
      return;
    }

    this.isSliding = active && this.verticalOffset <= 4;
  }

  eatLobster(golden = false) {
    if (this.phase !== 'playing') {
      return 0;
    }

    this.lobsters += golden ? 3 : 1;
    this.combo = Math.min(30, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimerMs = getDifficultyPreset(this.difficulty).comboGraceMs;

    const goldenTouch = this.activeBoon?.kind === 'golden-touch';
    const base = golden || goldenTouch ? 320 : 90;
    const bonus = goldenTouch && !golden ? 1.35 : 1;
    const reward = (base + this.combo * 12) * this.multiplier * bonus;
    this.score += reward;
    return reward;
  }

  smashObstacle() {
    if (this.phase !== 'playing') {
      return 0;
    }

    const reward = 70 * this.multiplier;
    this.score += reward;
    this.obstaclesSmashed += 1;
    return reward;
  }

  recordObstacleHit() {
    if (this.phase !== 'playing') {
      return this.strikesTaken;
    }

    this.strikesTaken = Math.min(MAX_STRIKES, this.strikesTaken + 1);
    if (this.strikesTaken >= MAX_STRIKES) {
      this.gameOver();
    }

    return this.strikesTaken;
  }

  activateBoon(boon: ActiveBoon) {
    if (this.phase !== 'playing') {
      return;
    }

    this.activeBoon = boon;
  }

  grantCourierSeal(count = 1) {
    if (this.phase !== 'playing') {
      return 0;
    }

    this.courierSeals += count;
    const reward = 550 * count * this.multiplier;
    this.score += reward;
    return reward;
  }

  activatePowerUp(kind: PowerUpKind) {
    if (this.phase !== 'playing') {
      return;
    }

    this.powerupsCollected += 1;

    if (kind === 'bolt') {
      this.score += 220 * this.multiplier;
      return;
    }

    this.powerTimers[kind] = Math.round(POWER_DURATIONS[kind] * getDifficultyPreset(this.difficulty).powerDurationMultiplier);
  }

  get snapshot(): GameSnapshot {
    return {
      phase: this.phase,
      difficulty: this.difficulty,
      runMode: this.runMode,
      seed: this.seed,
      dailyId: this.dailyId,
      segmentId: this.segmentId,
      segmentElapsedMs: this.segmentElapsedMs,
      activeBoon: this.activeBoon,
      activeEvent: this.activeEvent,
      courierSeals: this.courierSeals,
      score: Math.floor(this.score),
      lobsters: this.lobsters,
      combo: Math.max(1, this.combo || 1),
      strikesTaken: this.strikesTaken,
      maxStrikes: MAX_STRIKES,
      speed: Math.round(this.speed),
      multiplier: this.multiplier,
      elapsedMs: this.elapsedMs,
      survivalMs: this.elapsedMs,
      bestCombo: this.bestCombo,
      powerupsCollected: this.powerupsCollected,
      obstaclesSmashed: this.obstaclesSmashed,
      topSpeed: Math.round(this.topSpeed),
      playerLane: this.playerLane,
      verticalOffset: this.verticalOffset,
      isSliding: this.isSliding,
      invulnerable: this.invulnerable,
      canEatObstacles: this.canEatObstacles,
      activePowerLabel: this.activePowerLabel
    };
  }

  get currentSpeed() {
    return this.speed;
  }

  get canEatObstacles() {
    return this.powerTimers.chomp > 0 || this.activeBoon?.kind === 'storm-shield';
  }

  get invulnerable() {
    return this.canEatObstacles;
  }

  get magnetActive() {
    return this.powerTimers.magnet > 0;
  }

  private get multiplier() {
    const base = this.powerTimers.goblet > 0 ? 3 : 1;
    return this.activeBoon?.kind === 'laurel-rush' ? base + 1 : base;
  }

  private get activePowerLabel() {
    if (this.activeBoon) {
      return this.activeBoon.label;
    }

    const active = (Object.keys(this.powerTimers) as Array<Exclude<PowerUpKind, 'bolt'>>).find(
      (kind) => this.powerTimers[kind] > 0
    );

    return active ? POWER_LABELS[active] : 'Ready';
  }

  private updateJump(seconds: number) {
    if (this.verticalOffset <= 0 && this.verticalVelocity <= 0) {
      this.verticalOffset = 0;
      this.verticalVelocity = 0;
      return;
    }

    this.verticalOffset += this.verticalVelocity * seconds;
    this.verticalVelocity -= GRAVITY * seconds;

    if (this.verticalOffset <= 0) {
      this.verticalOffset = 0;
      this.verticalVelocity = 0;
    }
  }
}
