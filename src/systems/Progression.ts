import type { DifficultyLevel, GameSnapshot, GhostSample, RouteSegmentId, RunMode } from '../game/types';

export type MissionMetric =
  | 'lobsters'
  | 'survivalMs'
  | 'powerupsCollected'
  | 'obstaclesSmashed'
  | 'bestCombo'
  | 'score'
  | 'topSpeed'
  | 'courierSeals'
  | 'dailyRuns'
  | 'runs';

export type CosmeticKind = 'trail' | 'title' | 'theme';

export type ThemePalette = {
  accent: string;
  accentSoft: string;
  background: string;
  backgroundAlt: string;
  panel: string;
  panelStrong: string;
  edge: string;
  gold: string;
  cyan: string;
  lobster: string;
  ink: string;
  blue: string;
  text: string;
  mutedText: string;
  metaThemeColor: string;
};

export type CosmeticLoadout = {
  trail: string;
  title: string;
  theme: string;
};

export type LifetimeStats = {
  totalRuns: number;
  totalScore: number;
  totalLobsters: number;
  bestCombo: number;
  topSpeed: number;
  longestRunMs: number;
  obstaclesSmashed: number;
  powerupsCollected: number;
  courierSeals: number;
  dailyRuns: number;
};

export type RunSummary = {
  runMode: RunMode;
  difficulty: DifficultyLevel;
  dailyId: string;
  segmentId: RouteSegmentId;
  score: number;
  lobsters: number;
  survivalMs: number;
  bestCombo: number;
  topSpeed: number;
  powerupsCollected: number;
  obstaclesSmashed: number;
  courierSeals: number;
};

export type MissionDefinition = {
  id: string;
  label: string;
  metric: MissionMetric;
  target: number;
  laurels: number;
  perRun: boolean;
};

export type MissionProgress = {
  id: string;
  value: number;
};

export type CosmeticUnlock = {
  id: string;
  kind: CosmeticKind;
  label: string;
  cost: number;
  color?: string;
  accent?: string;
  palette?: ThemePalette;
  ownedByDefault?: boolean;
};

export type DailyBest = {
  dailyId: string;
  difficulty: DifficultyLevel;
  score: number;
  lobsters: number;
  courierSeals: number;
  segmentId: RouteSegmentId;
  achievedAt: string;
};

export type GhostRun = {
  key: string;
  runMode: RunMode;
  difficulty: DifficultyLevel;
  dailyId: string;
  score: number;
  samples: GhostSample[];
  achievedAt: string;
};

export type PlayerProfile = {
  version: 2;
  laurels: number;
  courierSeals: number;
  introWatched: boolean;
  stats: LifetimeStats;
  missions: MissionProgress[];
  unlockedCosmetics: string[];
  loadout: CosmeticLoadout;
  dailyBests: Record<string, DailyBest>;
  ghosts: GhostRun[];
};

export type ProgressionResult = {
  profile: PlayerProfile;
  completedMissions: MissionDefinition[];
  laurelsEarned: number;
};

export const PROFILE_STORAGE_KEY = 'hermes-godspeed.profile.v1';

export const TRAIL_COSMETICS: CosmeticUnlock[] = [
  { id: 'trail-aether', kind: 'trail', label: 'Aether Cyan', cost: 0, color: '#66f4ff', ownedByDefault: true },
  { id: 'trail-sunfire', kind: 'trail', label: 'Sunfire Gold', cost: 8, color: '#ffd86d' },
  { id: 'trail-rose', kind: 'trail', label: 'Ambrosia Rose', cost: 10, color: '#ff6f91' },
  { id: 'trail-verdant', kind: 'trail', label: 'Laurel Green', cost: 12, color: '#65e68b' },
  { id: 'trail-storm', kind: 'trail', label: 'Storm Gate Arc', cost: 16, color: '#8ee7ff' },
  { id: 'trail-neon', kind: 'trail', label: 'Neon Agora', cost: 18, color: '#ff6ee7' }
];

export const TITLE_COSMETICS: CosmeticUnlock[] = [
  { id: 'title-winged', kind: 'title', label: 'Winged Runner', cost: 0, ownedByDefault: true },
  { id: 'title-laurel', kind: 'title', label: 'Laurel Bearer', cost: 6 },
  { id: 'title-chompion', kind: 'title', label: 'Chompion', cost: 9 },
  { id: 'title-godspeed', kind: 'title', label: 'Godspeed Adept', cost: 14 },
  { id: 'title-herald', kind: 'title', label: 'Herald Breaker', cost: 18 },
  { id: 'title-openclaw', kind: 'title', label: 'OpenClaw Vanquisher', cost: 22 }
];

const TRT_NOIR_THEME: ThemePalette = {
  accent: '#ff3a2f',
  accentSoft: '#ff8d7f',
  background: '#050505',
  backgroundAlt: '#111114',
  panel: 'rgba(10, 10, 12, 0.84)',
  panelStrong: 'rgba(16, 16, 20, 0.96)',
  edge: 'rgba(255, 58, 47, 0.36)',
  gold: '#ffd24a',
  cyan: '#ff6c5f',
  lobster: '#ff6241',
  ink: '#050505',
  blue: '#09090c',
  text: '#fff9f4',
  mutedText: 'rgba(255, 255, 255, 0.75)',
  metaThemeColor: '#050505'
};

const DIVINE_BLUE_THEME: ThemePalette = {
  accent: '#65f4ff',
  accentSoft: '#b9fbff',
  background: '#101c4f',
  backgroundAlt: '#1a2f7a',
  panel: 'rgba(12, 19, 54, 0.78)',
  panelStrong: 'rgba(12, 19, 54, 0.92)',
  edge: 'rgba(255, 238, 173, 0.38)',
  gold: '#ffd86d',
  cyan: '#65f4ff',
  lobster: '#ff6241',
  ink: '#0b1235',
  blue: '#10236a',
  text: '#fbfdff',
  mutedText: 'rgba(255, 255, 255, 0.72)',
  metaThemeColor: '#101c4f'
};

const SUNRISE_THEME: ThemePalette = {
  accent: '#ff8a3d',
  accentSoft: '#ffd18e',
  background: '#1c1408',
  backgroundAlt: '#332010',
  panel: 'rgba(34, 19, 8, 0.84)',
  panelStrong: 'rgba(42, 25, 10, 0.96)',
  edge: 'rgba(255, 208, 98, 0.34)',
  gold: '#ffd86d',
  cyan: '#ffb56e',
  lobster: '#ff6a3d',
  ink: '#120d07',
  blue: '#29180a',
  text: '#fff8ee',
  mutedText: 'rgba(255, 248, 238, 0.72)',
  metaThemeColor: '#1c1408'
};

const EMBER_THEME: ThemePalette = {
  accent: '#ff5c49',
  accentSoft: '#ffb1a4',
  background: '#13070a',
  backgroundAlt: '#291017',
  panel: 'rgba(24, 10, 14, 0.86)',
  panelStrong: 'rgba(33, 14, 19, 0.96)',
  edge: 'rgba(255, 92, 73, 0.32)',
  gold: '#ffc257',
  cyan: '#ff866f',
  lobster: '#ff6241',
  ink: '#0d0507',
  blue: '#1f0d12',
  text: '#fff7f6',
  mutedText: 'rgba(255, 247, 246, 0.74)',
  metaThemeColor: '#13070a'
};

const UNDERCLOUD_THEME: ThemePalette = {
  accent: '#b990ff',
  accentSoft: '#dbc7ff',
  background: '#0b0916',
  backgroundAlt: '#19132d',
  panel: 'rgba(17, 13, 31, 0.84)',
  panelStrong: 'rgba(24, 18, 42, 0.96)',
  edge: 'rgba(185, 144, 255, 0.34)',
  gold: '#ffd86d',
  cyan: '#8ee7ff',
  lobster: '#ff7c9a',
  ink: '#080610',
  blue: '#171126',
  text: '#f8f4ff',
  mutedText: 'rgba(248, 244, 255, 0.74)',
  metaThemeColor: '#0b0916'
};

export const THEME_COSMETICS: CosmeticUnlock[] = [
  { id: 'theme-trt-noir', kind: 'theme', label: 'TRT Noir', cost: 0, ownedByDefault: true, palette: TRT_NOIR_THEME },
  { id: 'theme-divine', kind: 'theme', label: 'Divine Blue', cost: 0, ownedByDefault: true, palette: DIVINE_BLUE_THEME },
  { id: 'theme-sunrise', kind: 'theme', label: 'Sunrise', cost: 10, palette: SUNRISE_THEME },
  { id: 'theme-ember', kind: 'theme', label: 'Ember', cost: 12, palette: EMBER_THEME },
  { id: 'theme-undercloud', kind: 'theme', label: 'Undercloud', cost: 16, palette: UNDERCLOUD_THEME }
];

export const COSMETICS = [...TRAIL_COSMETICS, ...TITLE_COSMETICS, ...THEME_COSMETICS];

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  { id: 'lobsters-40', label: 'Eat 40 lobsters', metric: 'lobsters', target: 40, laurels: 3, perRun: false },
  { id: 'survive-45', label: 'Survive 45 seconds', metric: 'survivalMs', target: 45000, laurels: 4, perRun: true },
  { id: 'powerups-3', label: 'Collect 3 powerups', metric: 'powerupsCollected', target: 3, laurels: 3, perRun: true },
  { id: 'smash-5', label: 'Smash 5 obstacles', metric: 'obstaclesSmashed', target: 5, laurels: 3, perRun: false },
  { id: 'combo-12', label: 'Hit a x12 combo', metric: 'bestCombo', target: 12, laurels: 4, perRun: true },
  { id: 'score-8000', label: 'Score 8,000 in one run', metric: 'score', target: 8000, laurels: 4, perRun: true },
  { id: 'speed-700', label: 'Reach 700 speed', metric: 'topSpeed', target: 700, laurels: 3, perRun: true },
  { id: 'runs-5', label: 'Finish 5 runs', metric: 'runs', target: 5, laurels: 3, perRun: false },
  { id: 'lobsters-100', label: 'Eat 100 lobsters', metric: 'lobsters', target: 100, laurels: 6, perRun: false },
  { id: 'seals-3', label: 'Win 3 courier seals', metric: 'courierSeals', target: 3, laurels: 5, perRun: false },
  { id: 'daily-2', label: 'Finish 2 Daily Dispatches', metric: 'dailyRuns', target: 2, laurels: 5, perRun: false }
];

const DEFAULT_LOADOUT: CosmeticLoadout = {
  trail: 'trail-aether',
  title: 'title-winged',
  theme: 'theme-trt-noir'
};

const defaultStats = (): LifetimeStats => ({
  totalRuns: 0,
  totalScore: 0,
  totalLobsters: 0,
  bestCombo: 1,
  topSpeed: 360,
  longestRunMs: 0,
  obstaclesSmashed: 0,
  powerupsCollected: 0,
  courierSeals: 0,
  dailyRuns: 0
});

const defaultUnlocked = () => COSMETICS.filter((item) => item.ownedByDefault).map((item) => item.id);

const cloneProfile = (profile: PlayerProfile): PlayerProfile => ({
  version: 2,
  laurels: profile.laurels,
  courierSeals: profile.courierSeals,
  introWatched: profile.introWatched,
  stats: { ...profile.stats },
  missions: profile.missions.map((mission) => ({ ...mission })),
  unlockedCosmetics: [...profile.unlockedCosmetics],
  loadout: { ...profile.loadout },
  dailyBests: Object.fromEntries(Object.entries(profile.dailyBests).map(([key, value]) => [key, { ...value }])),
  ghosts: profile.ghosts.map((ghost) => ({
    ...ghost,
    samples: ghost.samples.map((sample) => ({ ...sample }))
  }))
});

export const createDefaultProfile = (): PlayerProfile => ({
  version: 2,
  laurels: 0,
  courierSeals: 0,
  introWatched: false,
  stats: defaultStats(),
  missions: MISSION_DEFINITIONS.slice(0, 3).map((mission) => ({ id: mission.id, value: 0 })),
  unlockedCosmetics: defaultUnlocked(),
  loadout: { ...DEFAULT_LOADOUT },
  dailyBests: {},
  ghosts: []
});

export const getMissionDefinition = (id: string) => MISSION_DEFINITIONS.find((mission) => mission.id === id);

export const getCosmetic = (id: string) => COSMETICS.find((cosmetic) => cosmetic.id === id);

export const getThemePalette = (themeId: string): ThemePalette => {
  const theme = THEME_COSMETICS.find((item) => item.id === themeId);
  return theme?.palette ?? TRT_NOIR_THEME;
};

export const getActiveMissions = (profile: PlayerProfile) =>
  profile.missions
    .map((progress) => {
      const definition = getMissionDefinition(progress.id);
      return definition ? { definition, progress } : undefined;
    })
    .filter((entry): entry is { definition: MissionDefinition; progress: MissionProgress } => Boolean(entry));

export const formatMetricValue = (mission: MissionDefinition, value: number) => {
  if (mission.metric === 'survivalMs') {
    return `${Math.floor(value / 1000)}s`;
  }

  return Math.floor(value).toLocaleString();
};

export const snapshotToRunSummary = (snapshot: GameSnapshot): RunSummary => ({
  runMode: snapshot.runMode,
  difficulty: snapshot.difficulty,
  dailyId: snapshot.dailyId,
  segmentId: snapshot.segmentId,
  score: snapshot.score,
  lobsters: snapshot.lobsters,
  survivalMs: snapshot.survivalMs,
  bestCombo: snapshot.bestCombo,
  topSpeed: snapshot.topSpeed,
  powerupsCollected: snapshot.powerupsCollected,
  obstaclesSmashed: snapshot.obstaclesSmashed,
  courierSeals: snapshot.courierSeals
});

export const loadProfile = (legacyHighScore = 0): PlayerProfile => {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return repairProfile(createDefaultProfile(), legacyHighScore);
    }

    return repairProfile(JSON.parse(raw) as Partial<PlayerProfile>, legacyHighScore);
  } catch {
    return repairProfile(createDefaultProfile(), legacyHighScore);
  }
};

export const saveProfile = (profile: PlayerProfile) => {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage can fail in private or locked-down contexts; the current session remains playable.
  }
};

export const applyRunToProfile = (profile: PlayerProfile, run: RunSummary): ProgressionResult => {
  const next = cloneProfile(repairProfile(profile));
  next.stats.totalRuns += 1;
  next.stats.totalScore += run.score;
  next.stats.totalLobsters += run.lobsters;
  next.stats.bestCombo = Math.max(next.stats.bestCombo, run.bestCombo);
  next.stats.topSpeed = Math.max(next.stats.topSpeed, run.topSpeed);
  next.stats.longestRunMs = Math.max(next.stats.longestRunMs, run.survivalMs);
  next.stats.obstaclesSmashed += run.obstaclesSmashed;
  next.stats.powerupsCollected += run.powerupsCollected;
  next.stats.courierSeals += run.courierSeals;
  next.stats.dailyRuns += run.runMode === 'daily' ? 1 : 0;
  next.courierSeals += run.courierSeals;

  const completedMissions: MissionDefinition[] = [];
  let laurelsEarned = 0;
  const remaining: MissionProgress[] = [];
  const completedIds = new Set<string>();

  for (const missionProgress of next.missions) {
    const definition = getMissionDefinition(missionProgress.id);
    if (!definition) {
      continue;
    }

    const runValue = getRunMetric(run, definition.metric);
    const value = definition.perRun ? Math.max(missionProgress.value, runValue) : missionProgress.value + runValue;

    if (value >= definition.target) {
      completedMissions.push(definition);
      completedIds.add(definition.id);
      laurelsEarned += definition.laurels;
    } else {
      remaining.push({ id: definition.id, value });
    }
  }

  next.laurels += laurelsEarned;
  next.missions = refillMissions(remaining, completedIds, next.stats.totalRuns);
  updateDailyBest(next, run);

  return {
    profile: next,
    completedMissions,
    laurelsEarned
  };
};

export const getDailyBest = (profile: PlayerProfile, dailyId: string, difficulty: DifficultyLevel) =>
  repairProfile(profile).dailyBests[getDailyBestKey(dailyId, difficulty)];

export const getGhostForRun = (profile: PlayerProfile, runMode: RunMode, difficulty: DifficultyLevel, dailyId = '') =>
  repairProfile(profile).ghosts.find((ghost) => ghost.key === getGhostKey(runMode, difficulty, dailyId));

export const recordGhostForRun = (profile: PlayerProfile, run: RunSummary, samples: GhostSample[]) => {
  const next = cloneProfile(repairProfile(profile));
  const key = getGhostKey(run.runMode, run.difficulty, run.dailyId);
  const previous = next.ghosts.find((ghost) => ghost.key === key);

  if (!samples.length || (previous && previous.score > run.score)) {
    return next;
  }

  const ghost: GhostRun = {
    key,
    runMode: run.runMode,
    difficulty: run.difficulty,
    dailyId: run.runMode === 'daily' ? run.dailyId : '',
    score: run.score,
    samples: downsampleGhost(samples),
    achievedAt: new Date().toISOString()
  };

  next.ghosts = [ghost, ...next.ghosts.filter((entry) => entry.key !== key)].slice(0, 16);
  return next;
};

export const markIntroWatched = (profile: PlayerProfile, watched = true) => {
  const next = cloneProfile(repairProfile(profile));
  next.introWatched = watched;
  return next;
};

export const buyOrEquipCosmetic = (profile: PlayerProfile, cosmeticId: string): { profile: PlayerProfile; status: 'equipped' | 'bought' | 'locked' } => {
  const cosmetic = getCosmetic(cosmeticId);
  const next = cloneProfile(repairProfile(profile));

  if (!cosmetic) {
    return { profile: next, status: 'locked' };
  }

  const owned = next.unlockedCosmetics.includes(cosmetic.id);
  if (!owned && next.laurels < cosmetic.cost) {
    return { profile: next, status: 'locked' };
  }

  if (!owned) {
    next.laurels -= cosmetic.cost;
    next.unlockedCosmetics.push(cosmetic.id);
  }

  next.loadout[cosmetic.kind] = cosmetic.id;
  return { profile: next, status: owned ? 'equipped' : 'bought' };
};

export const resetProfile = (legacyHighScore = 0) => repairProfile(createDefaultProfile(), legacyHighScore);

const repairProfile = (raw: Partial<PlayerProfile>, legacyHighScore = 0): PlayerProfile => {
  const profile: PlayerProfile = {
    version: 2,
    laurels: safeNumber(raw.laurels, 0),
    courierSeals: safeNumber(raw.courierSeals, 0),
    introWatched: typeof raw.introWatched === 'boolean' ? raw.introWatched : false,
    stats: {
      ...defaultStats(),
      ...(typeof raw.stats === 'object' && raw.stats ? raw.stats : {})
    },
    missions: Array.isArray(raw.missions) ? raw.missions : [],
    unlockedCosmetics: Array.isArray(raw.unlockedCosmetics) ? raw.unlockedCosmetics : defaultUnlocked(),
    loadout: {
      ...DEFAULT_LOADOUT,
      ...(typeof raw.loadout === 'object' && raw.loadout ? raw.loadout : {})
    },
    dailyBests: repairDailyBests(raw.dailyBests),
    ghosts: repairGhosts(raw.ghosts)
  };

  profile.stats.totalRuns = safeNumber(profile.stats.totalRuns, 0);
  profile.stats.totalScore = Math.max(safeNumber(profile.stats.totalScore, 0), legacyHighScore);
  profile.stats.totalLobsters = safeNumber(profile.stats.totalLobsters, 0);
  profile.stats.bestCombo = Math.max(1, safeNumber(profile.stats.bestCombo, 1));
  profile.stats.topSpeed = Math.max(360, safeNumber(profile.stats.topSpeed, 360));
  profile.stats.longestRunMs = safeNumber(profile.stats.longestRunMs, 0);
  profile.stats.obstaclesSmashed = safeNumber(profile.stats.obstaclesSmashed, 0);
  profile.stats.powerupsCollected = safeNumber(profile.stats.powerupsCollected, 0);
  profile.stats.courierSeals = safeNumber(profile.stats.courierSeals, 0);
  profile.stats.dailyRuns = safeNumber(profile.stats.dailyRuns, 0);
  profile.courierSeals = Math.max(profile.courierSeals, profile.stats.courierSeals);
  profile.unlockedCosmetics = Array.from(new Set([...defaultUnlocked(), ...profile.unlockedCosmetics])).filter((id) => Boolean(getCosmetic(id)));

  for (const kind of ['trail', 'title', 'theme'] as const) {
    const selected = getCosmetic(profile.loadout[kind]);
    if (!selected || selected.kind !== kind || !profile.unlockedCosmetics.includes(selected.id)) {
      profile.loadout[kind] = DEFAULT_LOADOUT[kind];
    }
  }

  const validMissions = profile.missions
    .filter((mission): mission is MissionProgress => Boolean(mission && getMissionDefinition(mission.id)))
    .map((mission) => ({ id: mission.id, value: safeNumber(mission.value, 0) }));
  profile.missions = refillMissions(validMissions, new Set(), profile.stats.totalRuns);

  return profile;
};

const refillMissions = (missions: MissionProgress[], excludedIds: Set<string>, seed: number) => {
  const next = [...missions];
  const used = new Set(next.map((mission) => mission.id));
  const offset = seed % MISSION_DEFINITIONS.length;
  const ordered = [...MISSION_DEFINITIONS.slice(offset), ...MISSION_DEFINITIONS.slice(0, offset)];

  for (const definition of ordered) {
    if (next.length >= 3) {
      break;
    }

    if (used.has(definition.id) || excludedIds.has(definition.id)) {
      continue;
    }

    next.push({ id: definition.id, value: 0 });
    used.add(definition.id);
  }

  return next.slice(0, 3);
};

const getRunMetric = (run: RunSummary, metric: MissionMetric) => {
  if (metric === 'runs') {
    return 1;
  }

  if (metric === 'dailyRuns') {
    return run.runMode === 'daily' ? 1 : 0;
  }

  return run[metric];
};

const safeNumber = (value: unknown, fallback: number) =>
  Number.isFinite(value) && Number(value) >= 0 ? Math.floor(Number(value)) : fallback;

const getDailyBestKey = (dailyId: string, difficulty: DifficultyLevel) => `${dailyId}:${difficulty}`;

const getGhostKey = (runMode: RunMode, difficulty: DifficultyLevel, dailyId = '') =>
  `${runMode}:${difficulty}:${runMode === 'daily' ? dailyId : 'classic'}`;

const updateDailyBest = (profile: PlayerProfile, run: RunSummary) => {
  if (run.runMode !== 'daily' || !run.dailyId) {
    return;
  }

  const key = getDailyBestKey(run.dailyId, run.difficulty);
  const current = profile.dailyBests[key];
  if (current && current.score >= run.score) {
    return;
  }

  profile.dailyBests[key] = {
    dailyId: run.dailyId,
    difficulty: run.difficulty,
    score: run.score,
    lobsters: run.lobsters,
    courierSeals: run.courierSeals,
    segmentId: run.segmentId,
    achievedAt: new Date().toISOString()
  };
};

const repairDailyBests = (raw: unknown) => {
  const next: Record<string, DailyBest> = {};
  if (!raw || typeof raw !== 'object') {
    return next;
  }

  for (const [key, value] of Object.entries(raw as Record<string, Partial<DailyBest>>)) {
    if (!value || typeof value !== 'object' || !value.dailyId || !value.difficulty) {
      continue;
    }

    next[key] = {
      dailyId: String(value.dailyId),
      difficulty: value.difficulty,
      score: safeNumber(value.score, 0),
      lobsters: safeNumber(value.lobsters, 0),
      courierSeals: safeNumber(value.courierSeals, 0),
      segmentId: value.segmentId ?? 'olympus',
      achievedAt: typeof value.achievedAt === 'string' ? value.achievedAt : ''
    };
  }

  return next;
};

const repairGhosts = (raw: unknown) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry): GhostRun | undefined => {
      if (!entry || typeof entry !== 'object') {
        return undefined;
      }

      const ghost = entry as Partial<GhostRun>;
      if (!ghost.key || !ghost.runMode || !ghost.difficulty || !Array.isArray(ghost.samples)) {
        return undefined;
      }

      return {
        key: String(ghost.key),
        runMode: ghost.runMode,
        difficulty: ghost.difficulty,
        dailyId: typeof ghost.dailyId === 'string' ? ghost.dailyId : '',
        score: safeNumber(ghost.score, 0),
        samples: downsampleGhost(ghost.samples),
        achievedAt: typeof ghost.achievedAt === 'string' ? ghost.achievedAt : ''
      };
    })
    .filter((entry): entry is GhostRun => Boolean(entry))
    .slice(0, 16);
};

const downsampleGhost = (samples: GhostSample[]) => {
  const repaired = samples
    .filter((sample): sample is GhostSample => Boolean(sample && Number.isFinite(sample.t)))
    .map((sample) => ({
      t: safeNumber(sample.t, 0),
      lane: ([0, 1, 2] as const).includes(sample.lane) ? sample.lane : 1,
      y: safeNumber(sample.y, 0),
      slide: Boolean(sample.slide),
      score: safeNumber(sample.score, 0)
    }));

  if (repaired.length <= 240) {
    return repaired;
  }

  const stride = Math.ceil(repaired.length / 240);
  return repaired.filter((_, index) => index % stride === 0).slice(0, 240);
};
