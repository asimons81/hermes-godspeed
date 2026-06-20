import { getDifficultyPreset } from '../game/difficulty';
import type {
  ActiveBoon,
  BoonKind,
  DifficultyLevel,
  GateChoice,
  GameSnapshot,
  LaneIndex,
  PowerUpKind,
  RouteSegmentId,
  RunDirectorEvent,
  RunDirectorSnapshot,
  RunMode,
  RunSeed,
  RunStartDetail,
  SpawnCommand,
  SpawnPattern
} from '../game/types';

type SegmentDefinition = {
  id: RouteSegmentId;
  label: string;
  boon: BoonKind;
  spawnScale: number;
  powerScale: number;
  weights: Record<SpawnPattern, number>;
};

type ConvoyState = 'idle' | 'armed' | 'warning' | 'active';

const ROUTE_SEGMENTS: Record<RouteSegmentId, SegmentDefinition> = {
  olympus: {
    id: 'olympus',
    label: 'Olympus Circuit',
    boon: 'wing-tempo',
    spawnScale: 1,
    powerScale: 1,
    weights: {
      'lobster-line': 42,
      'lobster-lure': 20,
      'low-obstacle': 11,
      'high-obstacle': 10,
      'jump-slide-pair': 7,
      'split-lane-trap': 10
    }
  },
  storm: {
    id: 'storm',
    label: 'Storm Gate',
    boon: 'storm-shield',
    spawnScale: 0.88,
    powerScale: 1.15,
    weights: {
      'lobster-line': 20,
      'lobster-lure': 14,
      'low-obstacle': 18,
      'high-obstacle': 18,
      'jump-slide-pair': 16,
      'split-lane-trap': 14
    }
  },
  agora: {
    id: 'agora',
    label: 'Neon Agora',
    boon: 'golden-touch',
    spawnScale: 1.06,
    powerScale: 0.9,
    weights: {
      'lobster-line': 52,
      'lobster-lure': 27,
      'low-obstacle': 6,
      'high-obstacle': 5,
      'jump-slide-pair': 4,
      'split-lane-trap': 6
    }
  },
  undercloud: {
    id: 'undercloud',
    label: 'Undercloud Descent',
    boon: 'laurel-rush',
    spawnScale: 0.94,
    powerScale: 1.05,
    weights: {
      'lobster-line': 24,
      'lobster-lure': 15,
      'low-obstacle': 12,
      'high-obstacle': 20,
      'jump-slide-pair': 18,
      'split-lane-trap': 11
    }
  }
};

const SEGMENT_ORDER: RouteSegmentId[] = ['olympus', 'storm', 'agora', 'undercloud'];
const BOON_LABELS: Record<BoonKind, string> = {
  'golden-touch': 'Golden Touch',
  'laurel-rush': 'Laurel Rush',
  'storm-shield': 'Storm Shield',
  'wing-tempo': 'Wing Tempo'
};
const POWER_SEQUENCE: PowerUpKind[] = ['chomp', 'sandals', 'goblet', 'bolt', 'magnet'];
const EMPTY_DAILY_ID = '';
const START_SEGMENT: RouteSegmentId = 'olympus';
const BOON_DURATION_MS = 9400;
const WARNING_MS = 920;
const CONVOY_MS = 5400;

export const getSegmentLabel = (segmentId: RouteSegmentId) => ROUTE_SEGMENTS[segmentId].label;

export const getBoonLabel = (boon: BoonKind) => BOON_LABELS[boon];

export const createDailyId = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const hashSeed = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const createRunSeed = (mode: RunMode, difficulty: DifficultyLevel, date = new Date()): RunSeed => {
  if (mode === 'daily') {
    const dailyId = createDailyId(date);
    return {
      mode,
      dailyId,
      seed: hashSeed(`hermes-daily:${dailyId}:${difficulty}`)
    };
  }

  const seed = hashSeed(`hermes-classic:${difficulty}:${Date.now()}:${Math.random()}`);
  return {
    mode,
    dailyId: EMPTY_DAILY_ID,
    seed
  };
};

export class RunDirector {
  private mode: RunMode = 'classic';
  private difficulty: DifficultyLevel = 'normal';
  private seed = 1;
  private dailyId = EMPTY_DAILY_ID;
  private rng = new SeededRandom(this.seed);
  private elapsedMs = 0;
  private segmentElapsedMs = 0;
  private segmentId: RouteSegmentId = START_SEGMENT;
  private segmentIndex = 0;
  private spawnTimerMs = 0;
  private powerTimerMs = 0;
  private nextGateMs = 28000;
  private pendingGate?: GateChoice[];
  private activeBoon?: ActiveBoon;
  private activeEvent: RunDirectorEvent = 'none';
  private convoyState: ConvoyState = 'idle';
  private convoyTimerMs = 0;
  private lastConvoySegmentIndex = -1;
  private routeOrder: RouteSegmentId[] = SEGMENT_ORDER;
  private courierSeals = 0;

  start(detail: RunStartDetail) {
    this.mode = detail.mode;
    this.difficulty = detail.difficulty;
    this.seed = detail.seed || 1;
    this.dailyId = detail.dailyId;
    this.rng = new SeededRandom(this.seed);
    this.elapsedMs = 0;
    this.segmentElapsedMs = 0;
    this.segmentIndex = 0;
    this.segmentId = this.mode === 'daily' ? this.buildDailyRoute()[0] : START_SEGMENT;
    this.spawnTimerMs = 0;
    this.powerTimerMs = 0;
    this.nextGateMs = this.rollGateMs();
    this.pendingGate = undefined;
    this.activeBoon = undefined;
    this.activeEvent = 'none';
    this.convoyState = 'idle';
    this.convoyTimerMs = 0;
    this.lastConvoySegmentIndex = -1;
    this.courierSeals = 0;
  }

  reset() {
    this.start({
      mode: this.mode,
      difficulty: this.difficulty,
      seed: this.seed,
      dailyId: this.dailyId
    });
  }

  update(deltaMs: number, snapshot: GameSnapshot): SpawnCommand[] {
    if (snapshot.phase !== 'playing') {
      return [];
    }

    this.elapsedMs += deltaMs;
    this.segmentElapsedMs += deltaMs;
    this.spawnTimerMs += deltaMs;
    this.powerTimerMs += deltaMs;
    this.tickBoon(deltaMs);

    const commands = this.updateConvoy(deltaMs);
    if (commands.length > 0) {
      return commands;
    }

    if (this.pendingGate) {
      this.activeEvent = 'gate';
      return [];
    }

    if (this.segmentElapsedMs >= this.nextGateMs) {
      this.pendingGate = this.buildGateChoices();
      this.activeEvent = 'gate';
      return [{ kind: 'gate', choices: this.pendingGate }];
    }

    const spawnInterval = this.getSpawnInterval(snapshot);
    if (this.spawnTimerMs < spawnInterval) {
      return [];
    }

    this.spawnTimerMs = 0;
    return [this.createSpawnCommand(snapshot)];
  }

  chooseGate(lane: LaneIndex) {
    const choice = this.pendingGate?.find((candidate) => candidate.lane === lane);
    if (!choice) {
      return undefined;
    }

    this.pendingGate = undefined;
    this.segmentId = choice.segmentId;
    this.segmentIndex += 1;
    this.segmentElapsedMs = 0;
    this.nextGateMs = this.rollGateMs();
    this.activeEvent = 'none';
    this.activeBoon = {
      kind: choice.boon,
      label: BOON_LABELS[choice.boon],
      remainingMs: BOON_DURATION_MS
    };

    if (this.elapsedMs >= 70000 && this.segmentIndex % 3 === 0 && this.segmentIndex !== this.lastConvoySegmentIndex) {
      this.convoyState = 'armed';
      this.lastConvoySegmentIndex = this.segmentIndex;
    }

    return choice;
  }

  recordCourierSeal(count = 1) {
    this.courierSeals += count;
  }

  get snapshot(): RunDirectorSnapshot {
    return {
      runMode: this.mode,
      seed: this.seed,
      dailyId: this.dailyId,
      segmentId: this.segmentId,
      segmentElapsedMs: this.segmentElapsedMs,
      activeBoon: this.activeBoon,
      activeEvent: this.activeEvent,
      courierSeals: this.courierSeals,
      nextGateInMs: Math.max(0, this.nextGateMs - this.segmentElapsedMs)
    };
  }

  private updateConvoy(deltaMs: number): SpawnCommand[] {
    if (this.convoyState === 'idle') {
      if (this.activeEvent === 'convoy') {
        this.activeEvent = 'none';
      }
      return [];
    }

    if (this.convoyState === 'armed') {
      this.convoyState = 'warning';
      this.convoyTimerMs = 0;
      this.activeEvent = 'convoy';
      const lanes = this.pickConvoyLanes();
      return [{ kind: 'warning', lanes, label: 'OPENCLAW CONVOY', durationMs: WARNING_MS }];
    }

    this.convoyTimerMs += deltaMs;

    if (this.convoyState === 'warning' && this.convoyTimerMs >= WARNING_MS) {
      this.convoyState = 'active';
      this.convoyTimerMs = 0;
      const lanes = this.pickConvoyLanes();
      return [
        {
          kind: 'convoy',
          lanes,
          rewardLane: this.pickOpenLane(lanes),
          sealReward: this.difficulty === 'godspeed' ? 2 : 1
        }
      ];
    }

    if (this.convoyState === 'active' && this.convoyTimerMs >= CONVOY_MS) {
      this.convoyState = 'idle';
      this.convoyTimerMs = 0;
      this.activeEvent = 'none';
    }

    return [];
  }

  private tickBoon(deltaMs: number) {
    if (!this.activeBoon) {
      return;
    }

    const remainingMs = Math.max(0, this.activeBoon.remainingMs - deltaMs);
    this.activeBoon = remainingMs > 0 ? { ...this.activeBoon, remainingMs } : undefined;
  }

  private createSpawnCommand(snapshot: GameSnapshot): SpawnCommand {
    const preset = getDifficultyPreset(snapshot.difficulty);
    const segment = ROUTE_SEGMENTS[this.segmentId];

    if (this.powerTimerMs > preset.powerupCooldownMs * segment.powerScale && snapshot.elapsedMs > preset.powerupFirstMs) {
      this.powerTimerMs = 0;
      return {
        kind: 'powerup',
        lane: this.randomLane(),
        power: POWER_SEQUENCE[this.rng.int(0, POWER_SEQUENCE.length - 1)]
      };
    }

    const pattern = this.pickPattern();
    const lane = this.randomLane();

    if ((pattern === 'low-obstacle' || pattern === 'high-obstacle') && snapshot.elapsedMs < 5200) {
      return {
        kind: 'pattern',
        pattern: 'lobster-line',
        lane,
        count: 2 + this.rng.int(0, 1),
        golden: this.rollGolden()
      };
    }

    if (pattern === 'split-lane-trap') {
      return {
        kind: 'pattern',
        pattern,
        lane,
        rewardLane: this.pickOtherLane(lane),
        count: this.segmentId === 'agora' ? 4 : 2 + this.rng.int(0, 1),
        high: this.rng.bool(0.55)
      };
    }

    if (pattern === 'jump-slide-pair') {
      return {
        kind: 'pattern',
        pattern,
        lane,
        firstHigh: this.rng.bool(0.5)
      };
    }

    return {
      kind: 'pattern',
      pattern,
      lane,
      count: this.getLobsterCount(pattern),
      high: pattern === 'high-obstacle' ? true : pattern === 'low-obstacle' ? false : this.rng.bool(0.48),
      golden: this.rollGolden()
    };
  }

  private pickPattern(): SpawnPattern {
    const segment = ROUTE_SEGMENTS[this.segmentId];
    const difficultyWeights = getDifficultyPreset(this.difficulty).patternMultipliers;
    const entries = Object.entries(segment.weights).map(([pattern, weight]) => ({
      pattern: pattern as SpawnPattern,
      weight: weight * (difficultyWeights[pattern] ?? 1)
    }));
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng.float() * total;

    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.pattern;
      }
    }

    return 'lobster-line';
  }

  private getSpawnInterval(snapshot: GameSnapshot) {
    const preset = getDifficultyPreset(snapshot.difficulty);
    const segment = ROUTE_SEGMENTS[this.segmentId];
    const speedOverBase = snapshot.speed - preset.baseSpeed;
    const runPhaseScale = snapshot.elapsedMs > preset.phaseMs.late ? 0.78 : snapshot.elapsedMs > preset.phaseMs.mid ? 0.88 : 1;
    return Math.max(330, (900 - speedOverBase * 0.5) * preset.spawnIntervalMultiplier * segment.spawnScale * runPhaseScale);
  }

  private getLobsterCount(pattern: SpawnPattern) {
    if (pattern === 'lobster-lure') {
      return this.segmentId === 'agora' ? 4 : 2 + this.rng.int(0, 1);
    }

    if (pattern === 'lobster-line') {
      return this.segmentId === 'agora' ? 3 + this.rng.int(0, 2) : 1 + this.rng.int(0, 3);
    }

    return 1;
  }

  private buildGateChoices(): GateChoice[] {
    const nextSegments = this.mode === 'daily' ? this.nextDailySegments() : this.nextClassicSegments();

    return nextSegments.map((segmentId, lane) => {
      const segment = ROUTE_SEGMENTS[segmentId];
      return {
        lane: lane as LaneIndex,
        segmentId,
        boon: segment.boon,
        label: segment.label
      };
    });
  }

  private nextClassicSegments() {
    const pool = SEGMENT_ORDER.filter((segment) => segment !== this.segmentId);
    const choices: RouteSegmentId[] = [];

    while (choices.length < 3) {
      const candidate = pool.splice(this.rng.int(0, pool.length - 1), 1)[0];
      choices.push(candidate ?? START_SEGMENT);
    }

    return choices;
  }

  private nextDailySegments() {
    const offset = (this.segmentIndex + 1) % this.routeOrder.length;
    return [0, 1, 2].map((index) => this.routeOrder[(offset + index) % this.routeOrder.length]);
  }

  private buildDailyRoute() {
    const offset = this.seed % SEGMENT_ORDER.length;
    this.routeOrder = [...SEGMENT_ORDER.slice(offset), ...SEGMENT_ORDER.slice(0, offset)];
    return this.routeOrder;
  }

  private rollGateMs() {
    return 25000 + this.rng.int(0, 10000);
  }

  private rollGolden() {
    const chance = this.segmentId === 'agora' ? 0.22 : 0.1;
    return this.rng.bool(chance);
  }

  private pickConvoyLanes() {
    const first = this.randomLane();
    return [first, this.pickOtherLane(first)] as LaneIndex[];
  }

  private pickOpenLane(blocked: LaneIndex[]) {
    return ([0, 1, 2] as LaneIndex[]).find((lane) => !blocked.includes(lane)) ?? this.randomLane();
  }

  private randomLane() {
    return this.rng.int(0, 2) as LaneIndex;
  }

  private pickOtherLane(lane: LaneIndex) {
    const lanes = ([0, 1, 2] as LaneIndex[]).filter((candidate) => candidate !== lane);
    return lanes[this.rng.int(0, lanes.length - 1)];
  }
}

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  float() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number) {
    return Math.floor(this.float() * (max - min + 1)) + min;
  }

  bool(chance: number) {
    return this.float() < chance;
  }
}
