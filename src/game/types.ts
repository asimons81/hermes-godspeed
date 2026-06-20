export type LaneIndex = 0 | 1 | 2;

export type GamePhase = 'ready' | 'playing' | 'paused' | 'gameover';

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'godspeed';

export type PowerUpKind = 'chomp' | 'sandals' | 'goblet' | 'bolt' | 'magnet';

export type RunMode = 'classic' | 'daily';

export type RouteSegmentId = 'olympus' | 'storm' | 'agora' | 'undercloud';

export type BoonKind = 'laurel-rush' | 'storm-shield' | 'golden-touch' | 'wing-tempo';

export type RunDirectorEvent = 'none' | 'gate' | 'convoy';

export type SpawnPattern =
  | 'lobster-line'
  | 'lobster-lure'
  | 'low-obstacle'
  | 'high-obstacle'
  | 'jump-slide-pair'
  | 'split-lane-trap';

export type RunSeed = {
  mode: RunMode;
  seed: number;
  dailyId: string;
};

export type ActiveBoon = {
  kind: BoonKind;
  label: string;
  remainingMs: number;
};

export type GateChoice = {
  lane: LaneIndex;
  segmentId: RouteSegmentId;
  boon: BoonKind;
  label: string;
};

export type SpawnCommand =
  | {
      kind: 'pattern';
      pattern: SpawnPattern;
      lane: LaneIndex;
      rewardLane?: LaneIndex;
      count?: number;
      high?: boolean;
      firstHigh?: boolean;
      golden?: boolean;
    }
  | {
      kind: 'powerup';
      lane: LaneIndex;
      power: PowerUpKind;
    }
  | {
      kind: 'gate';
      choices: GateChoice[];
    }
  | {
      kind: 'warning';
      lanes: LaneIndex[];
      label: string;
      durationMs: number;
    }
  | {
      kind: 'convoy';
      lanes: LaneIndex[];
      rewardLane: LaneIndex;
      sealReward: number;
    };

export type RunDirectorSnapshot = {
  runMode: RunMode;
  seed: number;
  dailyId: string;
  segmentId: RouteSegmentId;
  segmentElapsedMs: number;
  activeBoon?: ActiveBoon;
  activeEvent: RunDirectorEvent;
  courierSeals: number;
  nextGateInMs: number;
};

export type RunStartDetail = RunSeed & {
  difficulty: DifficultyLevel;
};

export type GhostSample = {
  t: number;
  lane: LaneIndex;
  y: number;
  slide: boolean;
  score: number;
};

export type GameSnapshot = {
  phase: GamePhase;
  difficulty: DifficultyLevel;
  runMode: RunMode;
  seed: number;
  dailyId: string;
  segmentId: RouteSegmentId;
  segmentElapsedMs: number;
  activeBoon?: ActiveBoon;
  activeEvent: RunDirectorEvent;
  courierSeals: number;
  score: number;
  lobsters: number;
  combo: number;
  strikesTaken: number;
  maxStrikes: number;
  speed: number;
  multiplier: number;
  elapsedMs: number;
  survivalMs: number;
  bestCombo: number;
  powerupsCollected: number;
  obstaclesSmashed: number;
  topSpeed: number;
  playerLane: LaneIndex;
  verticalOffset: number;
  isSliding: boolean;
  invulnerable: boolean;
  canEatObstacles: boolean;
  activePowerLabel: string;
};

export type SfxName = 'start' | 'chomp' | 'power' | 'bolt' | 'hit' | 'gameover';
