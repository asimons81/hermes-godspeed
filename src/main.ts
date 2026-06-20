import Phaser from 'phaser';
import './styles.css';
import { AssetManifest } from './assets/manifest';
import { DEFAULT_DIFFICULTY, getDifficultyLabel, normalizeDifficulty } from './game/difficulty';
import { Action, type ActionEventDetail, type ActionName } from './input/actions';
import type { DifficultyLevel, GameSnapshot, GhostSample, RunMode, RunStartDetail, SfxName } from './game/types';
import { IntroScene } from './scenes/IntroScene';
import { RunnerScene } from './scenes/RunnerScene';
import {
  THEME_COSMETICS,
  TITLE_COSMETICS,
  TRAIL_COSMETICS,
  applyRunToProfile,
  buyOrEquipCosmetic,
  formatMetricValue,
  getActiveMissions,
  getCosmetic,
  getDailyBest,
  getGhostForRun,
  markIntroWatched,
  loadProfile,
  recordGhostForRun,
  resetProfile,
  saveProfile,
  snapshotToRunSummary,
  type CosmeticLoadout,
  type CosmeticUnlock,
  type PlayerProfile,
  type ProgressionResult
} from './systems/Progression';
import { createDailyId, createRunSeed, getSegmentLabel } from './systems/RunDirector';
import { RunRecorder, type RunRecorderSnapshot } from './systems/RunRecorder';

declare global {
  interface Window {
    __PHASER_GAME__?: Phaser.Game;
  }
}

const getElement = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
};

const scoreEl = getElement('score');
const bestScoreEl = getElement('bestScore');
const lobsterEl = getElement('lobsters');
const strikeCountEl = getElement('strikeCount');
const speedEl = getElement('speed');
const routeModeHudEl = getElement('routeModeHud');
const routeSegmentHudEl = getElement('routeSegmentHud');
const powerChipEl = getElement('powerChip');
const comboChipEl = getElement('comboChip');
const startPanel = getElement('startPanel');
const gameOverPanel = getElement('gameOverPanel');
const pausePanel = getElement('pausePanel');
const helpModal = getElement('helpModal');
const settingsModal = getElement('settingsModal');
const startBestScoreEl = getElement('startBestScore');
const startLaurelsEl = getElement('startLaurels');
const startCourierSealsEl = getElement('startCourierSeals');
const startTitleEl = getElement('startTitle');
const startDifficultyEl = getElement('startDifficulty');
const missionHeaderEl = getElement('missionHeader');
const startMissionListEl = getElement('startMissionList');
const missionPreviewEl = getElement('missionPreview');
const finalScoreEl = getElement('finalScore');
const finalLobstersEl = getElement('finalLobsters');
const finalBestScoreEl = getElement('finalBestScore');
const finalDifficultyEl = getElement('finalDifficulty');
const finalTimeEl = getElement('finalTime');
const finalBestComboEl = getElement('finalBestCombo');
const finalTopSpeedEl = getElement('finalTopSpeed');
const finalPowerupsEl = getElement('finalPowerups');
const finalSmashedEl = getElement('finalSmashed');
const finalRunModeEl = getElement('finalRunMode');
const finalRouteEl = getElement('finalRoute');
const finalCourierSealsEl = getElement('finalCourierSeals');
const finalDailyBestEl = getElement('finalDailyBest');
const earnedLaurelsEl = getElement('earnedLaurels');
const completedMissionCountEl = getElement('completedMissionCount');
const gameOverLaurelsEl = getElement('gameOverLaurels');
const gameOverMissionListEl = getElement('gameOverMissionList');
const completedMissionListEl = getElement('completedMissionList');
const newRecordBadgeEl = getElement('newRecordBadge');
const toastEl = getElement('toast');
const introOverlay = getElement('introOverlay');
const introCaptionEl = getElement('introCaption');
const introSoundButton = getElement<HTMLButtonElement>('introSoundButton');
const introSkipButton = getElement<HTMLButtonElement>('introSkipButton');
const startButton = getElement<HTMLButtonElement>('startButton');
const retryButton = getElement<HTMLButtonElement>('retryButton');
const menuButton = getElement<HTMLButtonElement>('menuButton');
const modeClassicButton = getElement<HTMLButtonElement>('modeClassicButton');
const modeDailyButton = getElement<HTMLButtonElement>('modeDailyButton');
const dailyDispatchLabelEl = getElement('dailyDispatchLabel');
const pauseMenuButton = getElement<HTMLButtonElement>('pauseMenuButton');
const resumeButton = getElement<HTMLButtonElement>('resumeButton');
const helpButtons = [
  getElement<HTMLButtonElement>('helpButtonStart'),
  getElement<HTMLButtonElement>('helpButtonGameOver'),
  getElement<HTMLButtonElement>('helpButtonPause')
];
const settingsButtons = [
  getElement<HTMLButtonElement>('settingsButtonStart'),
  getElement<HTMLButtonElement>('settingsButtonGameOver'),
  getElement<HTMLButtonElement>('settingsButtonPause')
];
const pauseButton = getElement<HTMLButtonElement>('pauseButton');
const trailSelect = getElement<HTMLSelectElement>('trailSelect');
const titleSelect = getElement<HTMLSelectElement>('titleSelect');
const themeSelect = getElement<HTMLSelectElement>('themeSelect');
const resetProfileButton = getElement<HTMLButtonElement>('resetProfileButton');
const replayIntroButton = getElement<HTMLButtonElement>('replayIntroButton');
const musicToggle = getElement<HTMLInputElement>('musicToggle');
const sfxToggle = getElement<HTMLInputElement>('sfxToggle');
const reducedMotionToggle = getElement<HTMLInputElement>('reducedMotionToggle');
const difficultySelect = getElement<HTMLSelectElement>('difficultySelect');
const recordToggles = [
  getElement<HTMLInputElement>('recordToggleStart'),
  getElement<HTMLInputElement>('recordToggleGameOver')
];
const recordStatusEls = [getElement('recordStatusStart'), getElement('recordStatusGameOver')];
const recordSummaryEls = [getElement('recordSummaryStart'), getElement('recordSummaryGameOver')];
const saveRecordingButtons = [
  getElement<HTMLButtonElement>('saveRecordingStart'),
  getElement<HTMLButtonElement>('saveRecordingGameOver')
];
const copyShareButton = getElement<HTMLButtonElement>('copyShareButton');
const shareStatusEl = getElement('shareStatus');

let latestSnapshot: GameSnapshot | undefined;
let toastTimer = 0;
let audioContext: AudioContext | undefined;
let recordNextRun = false;
const HIGH_SCORE_STORAGE_KEY = 'hermes-godspeed.highScore.v1';
const HIGH_SCORES_STORAGE_KEY = 'hermes-godspeed.highScores.v2';
const SETTINGS_STORAGE_KEY = 'hermes-godspeed.settings.v1';
let settings = loadSettings();
let highScores = loadHighScores();
let profile: PlayerProfile = loadProfile(getBestHighScore(highScores).score);
let lastProgressionResult: ProgressionResult | undefined;
let gameOverProcessed = false;
let runMode: RunMode = 'classic';
let latestRunSummary = '';
let currentGhostSamples: GhostSample[] = [];
let lastGhostSampleMs = 0;
let musicPlaying = false;
let musicStarting = false;
let musicStep = 0;
let musicTimer = 0;
let introSoundEnabled = false;
let introAudioPlaying = false;
let introMusicStep = 0;
let introMusicTimer = 0;
let introNarrationStarted = false;
let introNarrationBufferPromise: Promise<AudioBuffer> | undefined;
let introNarrationNodes: IntroNarrationNode[] = [];
let introSkipRequested = false;
let activeModal: HTMLElement | undefined;
let appDisposing = false;

type ToneLayer = {
  frequency: number;
  gain: number;
  duration: number;
  type: OscillatorType;
  delay?: number;
  endFrequency?: number;
};

type MusicStep = {
  pluck: number;
  bass?: number;
  chord?: number[];
};

type IntroNarrationNode = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

type GameSettings = {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  difficulty: DifficultyLevel;
};

type HighScoreRecord = {
  score: number;
  lobsters: number;
  achievedAt: string;
};

type HighScoreTable = Record<DifficultyLevel, HighScoreRecord>;

type IntroCaptionDetail = {
  text: string;
};

const INTRO_NARRATION =
  'Olympus is losing its signal. OpenClaws jam the road to dawn. Every stolen spark slows Olympus. Hermes runs the relay. Jump the faults. Slide the sparks. Chain the chomp. Chase the laurel. Hermes: Godspeed. One more run.';
const GAME_MUSIC_VOLUME = 1.7;
const GAME_SFX_VOLUME = 1.45;
const INTRO_MUSIC_STEP_MS = 360;
const INTRO_MUSIC_PATTERN: MusicStep[] = [
  { bass: 110, chord: [220, 293.66, 440], pluck: 880 },
  { pluck: 659.25 },
  { pluck: 587.33 },
  { pluck: 440 },
  { bass: 146.83, chord: [293.66, 440, 587.33], pluck: 987.77 },
  { pluck: 739.99 },
  { pluck: 659.25 },
  { pluck: 493.88 },
  { bass: 130.81, chord: [261.63, 392, 523.25], pluck: 783.99 },
  { pluck: 659.25 },
  { pluck: 523.25 },
  { pluck: 392 },
  { bass: 98, chord: [196, 293.66, 392], pluck: 783.99 },
  { pluck: 587.33 },
  { pluck: 440 },
  { pluck: 293.66 }
];

const MUSIC_STEP_MS = 285;
const MUSIC_PATTERN: MusicStep[] = [
  { bass: 110, chord: [220, 329.63, 440], pluck: 659.25 },
  { pluck: 493.88 },
  { pluck: 440 },
  { pluck: 329.63 },
  { bass: 146.83, chord: [293.66, 440, 587.33], pluck: 587.33 },
  { pluck: 493.88 },
  { pluck: 392 },
  { pluck: 293.66 },
  { bass: 130.81, chord: [261.63, 392, 523.25], pluck: 659.25 },
  { pluck: 523.25 },
  { pluck: 392 },
  { pluck: 329.63 },
  { bass: 98, chord: [196, 293.66, 392], pluck: 587.33 },
  { pluck: 440 },
  { pluck: 392 },
  { pluck: 293.66 }
];

const SFX_LAYERS: Record<SfxName, ToneLayer[]> = {
  start: [
    { frequency: 420, endFrequency: 620, gain: 0.025, duration: 0.12, type: 'triangle' },
    { frequency: 840, gain: 0.014, duration: 0.08, type: 'sine', delay: 0.045 }
  ],
  chomp: [
    { frequency: 165, endFrequency: 90, gain: 0.04, duration: 0.16, type: 'triangle' },
    { frequency: 360, endFrequency: 220, gain: 0.016, duration: 0.07, type: 'square', delay: 0.018 }
  ],
  power: [
    { frequency: 520, endFrequency: 880, gain: 0.034, duration: 0.18, type: 'triangle' },
    { frequency: 1040, gain: 0.018, duration: 0.12, type: 'sine', delay: 0.055 }
  ],
  bolt: [
    { frequency: 120, endFrequency: 72, gain: 0.052, duration: 0.2, type: 'triangle' },
    { frequency: 900, endFrequency: 380, gain: 0.03, duration: 0.12, type: 'sawtooth', delay: 0.015 },
    { frequency: 1460, gain: 0.012, duration: 0.05, type: 'sine', delay: 0.09 }
  ],
  hit: [
    { frequency: 92, endFrequency: 58, gain: 0.05, duration: 0.17, type: 'triangle' },
    { frequency: 240, endFrequency: 130, gain: 0.022, duration: 0.09, type: 'square', delay: 0.012 }
  ],
  gameover: [
    { frequency: 196, endFrequency: 98, gain: 0.042, duration: 0.28, type: 'triangle' },
    { frequency: 82, endFrequency: 55, gain: 0.038, duration: 0.38, type: 'sine', delay: 0.08 }
  ]
};

const searchParams = new URLSearchParams(window.location.search);
const skipIntro = searchParams.get('skipIntro') === '1';
document.body.dataset.phase = skipIntro ? 'ready' : 'intro';
document.body.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
introOverlay.setAttribute('aria-hidden', skipIntro ? 'true' : 'false');
introSoundButton.disabled = skipIntro;
introSkipButton.disabled = skipIntro;

window.addEventListener('intro:caption', (event) => {
  const detail = (event as CustomEvent<IntroCaptionDetail>).detail;
  introCaptionEl.textContent = detail?.text ?? '';
});
window.addEventListener('intro:complete', () => {
  introSkipRequested = false;
  stopIntroAudio();
  profile = markIntroWatched(profile, true);
  saveProfile(profile);
  introOverlay.setAttribute('aria-hidden', 'true');
  introSoundButton.disabled = true;
  introSkipButton.disabled = true;
});
window.addEventListener('intro:ready', () => {
  if (introSkipRequested && document.body.dataset.phase === 'intro') {
    window.dispatchEvent(new CustomEvent('intro:skip'));
  }
});
introSoundButton.addEventListener('click', () => void enableIntroSound());
introSkipButton.addEventListener('click', () => requestIntroSkip());

const rendererParam = searchParams.get('renderer');
const rendererType =
  rendererParam === 'webgl' ? Phaser.WEBGL : rendererParam === 'auto' ? Phaser.AUTO : Phaser.CANVAS;

const game = new Phaser.Game({
  type: rendererType,
  parent: 'game',
  backgroundColor: '#101c4f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance'
  },
  scene: skipIntro ? [RunnerScene] : [IntroScene, RunnerScene]
});

if (import.meta.env.DEV) {
  window.__PHASER_GAME__ = game;
}

const recorder = new RunRecorder({
  forceUnsupported: searchParams.get('recording') === 'unsupported',
  onChange: (snapshot) => {
    renderRecorder(snapshot);
    dispatchRecorderSnapshot(snapshot);
  }
});

const dispatchAction = (action: ActionName, pressed = true) => {
  window.dispatchEvent(new CustomEvent<ActionEventDetail>('ui:action', { detail: { action, pressed } }));
};

const beginRun = async (eventName: 'ui:start' | 'ui:retry') => {
  const detail = createRunStartDetail();
  const activeAudioContext = await ensureAudio();
  applySettings();
  dispatchGhost(detail);
  currentGhostSamples = [];
  lastGhostSampleMs = 0;
  shareStatusEl.textContent = 'Dispatch summary ready';

  if (recordNextRun && recorder.supported) {
    recorder.setAudioContext(activeAudioContext);
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (!canvas || !recorder.start(canvas)) {
      showToast('Recording unavailable');
    }
  }

  window.dispatchEvent(new CustomEvent<RunStartDetail>(eventName, { detail }));
};

startButton.addEventListener('click', () => void beginRun('ui:start'));
retryButton.addEventListener('click', () => void beginRun('ui:retry'));
menuButton.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ui:menu')));
modeClassicButton.addEventListener('click', () => setRunMode('classic'));
modeDailyButton.addEventListener('click', () => setRunMode('daily'));
pauseMenuButton.addEventListener('click', () => {
  closeModal();
  window.dispatchEvent(new CustomEvent('ui:menu'));
});
resumeButton.addEventListener('click', () => dispatchAction(Action.Pause));
pauseButton.addEventListener('click', () => dispatchAction(Action.Pause));
for (const button of helpButtons) {
  button.addEventListener('click', () => openModal(helpModal));
}
for (const button of settingsButtons) {
  button.addEventListener('click', () => openModal(settingsModal));
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close-modal]')) {
  button.addEventListener('click', () => closeModal());
}
musicToggle.addEventListener('change', () => updateSettings({ music: musicToggle.checked }));
sfxToggle.addEventListener('change', () => updateSettings({ sfx: sfxToggle.checked }));
reducedMotionToggle.addEventListener('change', () => updateSettings({ reducedMotion: reducedMotionToggle.checked }));
difficultySelect.addEventListener('change', () => updateSettings({ difficulty: normalizeDifficulty(difficultySelect.value) }));
trailSelect.addEventListener('change', () => handleCosmeticChoice(trailSelect.value));
titleSelect.addEventListener('change', () => handleCosmeticChoice(titleSelect.value));
themeSelect.addEventListener('change', () => handleCosmeticChoice(themeSelect.value));
resetProfileButton.addEventListener('click', () => {
  if (!window.confirm('Reset missions, laurels, stats, and cosmetics? High score stays intact.')) {
    return;
  }

  profile = resetProfile(getBestHighScore(highScores).score);
  lastProgressionResult = undefined;
  saveProfile(profile);
  renderProfile();
  dispatchCosmetics();
  showToast('PROFILE RESET');
});
replayIntroButton.addEventListener('click', () => {
  profile = markIntroWatched(profile, false);
  saveProfile(profile);
  const url = new URL(window.location.href);
  url.searchParams.delete('skipIntro');
  window.location.href = url.toString();
});
copyShareButton.addEventListener('click', () => void copyShareSummary());

for (const toggle of recordToggles) {
  toggle.addEventListener('change', () => setRecordNextRun(toggle.checked));
}

for (const button of saveRecordingButtons) {
  button.addEventListener('click', () => {
    if (recorder.save()) {
      showToast('Saving MP4');
    }
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  const action = button.dataset.action as ActionName;
  const release = () => dispatchAction(action, false);

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    void ensureAudio();
    dispatchAction(action, true);
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', () => {
    if (action === Action.Slide) {
      release();
    }
  });
}

window.addEventListener('game:snapshot', (event) => {
  latestSnapshot = (event as CustomEvent<GameSnapshot>).detail;
  collectGhostSample(latestSnapshot);
  renderSnapshot(latestSnapshot);
});

window.addEventListener('game:phase', (event) => {
  const phase = (event as CustomEvent<string>).detail;
  document.body.dataset.phase = phase;
  startPanel.classList.toggle('is-visible', phase === 'ready');
  gameOverPanel.classList.toggle('is-visible', phase === 'gameover');
  pausePanel.classList.toggle('is-visible', phase === 'paused');

  if (phase === 'ready') {
    applySettings();
    renderHighScore();
    renderProfile();
  }

  if (phase === 'paused') {
    stopMusic();
    showToast('PAUSED');
  } else if (phase === 'playing') {
    newRecordBadgeEl.hidden = true;
    gameOverProcessed = false;
    lastProgressionResult = undefined;
    renderRewards();
    startMusic();
    showToast('');
  }

  if (phase === 'gameover') {
    stopMusic();
  }

  if (phase === 'gameover' && latestSnapshot && !gameOverProcessed) {
    gameOverProcessed = true;
    const newRecord = commitHighScore(latestSnapshot);
    const runSummary = snapshotToRunSummary(latestSnapshot);
    lastProgressionResult = applyRunToProfile(profile, runSummary);
    profile = recordGhostForRun(lastProgressionResult.profile, runSummary, currentGhostSamples);
    latestRunSummary = buildShareSummary(latestSnapshot);
    saveProfile(profile);
    renderProfile();
    renderSnapshot(latestSnapshot);
    renderRewards();
    renderRunMode();
    renderShareSummary();
    newRecordBadgeEl.hidden = !newRecord;

    showToast('');
  }

  if (phase === 'gameover' && recorder.state === 'recording' && latestSnapshot) {
    recorder.finish({
      score: latestSnapshot.score,
      lobsters: latestSnapshot.lobsters
    });
  }
});

window.addEventListener('game:sfx', (event) => {
  playSfx((event as CustomEvent<SfxName>).detail);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && latestSnapshot?.phase === 'playing') {
    dispatchAction(Action.Pause);
  }
});

document.addEventListener('keydown', (event) => {
  const introSkipKey =
    event.key === 'Escape' ||
    event.key === 'Enter' ||
    event.key === ' ' ||
    event.key === 'Spacebar' ||
    event.code === 'Space';

  if (document.body.dataset.phase === 'intro' && introSkipKey) {
    event.preventDefault();
    requestIntroSkip();
    return;
  }

  if (event.key !== 'Escape') {
    return;
  }

  if (activeModal) {
    closeModal();
    return;
  }

  if (latestSnapshot?.phase === 'playing' || latestSnapshot?.phase === 'paused') {
    dispatchAction(Action.Pause);
  }
});

window.addEventListener('beforeunload', disposeAppForPageExit);

renderRecorder(recorder.snapshot);
dispatchRecorderSnapshot(recorder.snapshot);
renderHighScore();
populateCosmeticSelects();
renderProfile();
renderRewards();
dispatchCosmetics();
renderSettings();
saveSettings();
applySettings();

function renderSnapshot(snapshot: GameSnapshot) {
  scoreEl.textContent = snapshot.score.toLocaleString();
  lobsterEl.textContent = snapshot.lobsters.toString();
  strikeCountEl.textContent = `${snapshot.strikesTaken}/${snapshot.maxStrikes}`;
  speedEl.textContent = snapshot.speed.toString();
  routeModeHudEl.textContent = snapshot.runMode === 'daily' ? snapshot.dailyId || 'Daily' : 'Classic';
  routeSegmentHudEl.textContent = getSegmentLabel(snapshot.segmentId);
  bestScoreEl.textContent = getHighScore(snapshot.difficulty).score.toLocaleString();
  powerChipEl.textContent = snapshot.activeBoon
    ? `${snapshot.activePowerLabel} ${Math.ceil(snapshot.activeBoon.remainingMs / 1000)}s`
    : snapshot.activePowerLabel;
  comboChipEl.textContent = `x${snapshot.multiplier > 1 ? snapshot.multiplier : snapshot.combo}`;
  comboChipEl.classList.toggle('is-hot', snapshot.combo > 5 || snapshot.multiplier > 1);
  powerChipEl.classList.toggle('is-live', snapshot.activePowerLabel !== 'Ready');
  pauseButton.textContent = snapshot.phase === 'paused' ? 'GO' : 'II';

  if (snapshot.phase === 'gameover') {
    finalScoreEl.textContent = snapshot.score.toLocaleString();
    finalLobstersEl.textContent = snapshot.lobsters.toString();
    finalBestScoreEl.textContent = Math.max(getHighScore(snapshot.difficulty).score, snapshot.score).toLocaleString();
    finalDifficultyEl.textContent = getDifficultyLabel(snapshot.difficulty);
    finalTimeEl.textContent = formatRunTime(snapshot.survivalMs);
    finalBestComboEl.textContent = `x${snapshot.bestCombo}`;
    finalTopSpeedEl.textContent = snapshot.topSpeed.toString();
    finalPowerupsEl.textContent = snapshot.powerupsCollected.toString();
    finalSmashedEl.textContent = snapshot.obstaclesSmashed.toString();
    finalRunModeEl.textContent = snapshot.runMode === 'daily' ? 'Daily Dispatch' : 'Classic';
    finalRouteEl.textContent = getSegmentLabel(snapshot.segmentId);
    finalCourierSealsEl.textContent = snapshot.courierSeals.toLocaleString();
    const dailyBest = snapshot.dailyId ? getDailyBest(profile, snapshot.dailyId, snapshot.difficulty) : undefined;
    finalDailyBestEl.textContent = dailyBest ? dailyBest.score.toLocaleString() : snapshot.runMode === 'daily' ? 'First run' : '-';
  }
}

function formatRunTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function createEmptyHighScores(): HighScoreTable {
  return {
    easy: createHighScoreRecord(),
    normal: createHighScoreRecord(),
    hard: createHighScoreRecord(),
    godspeed: createHighScoreRecord()
  };
}

function createHighScoreRecord(patch: Partial<HighScoreRecord> = {}): HighScoreRecord {
  return {
    score: safeScoreNumber(patch.score),
    lobsters: safeScoreNumber(patch.lobsters),
    achievedAt: typeof patch.achievedAt === 'string' ? patch.achievedAt : ''
  };
}

function loadHighScores(): HighScoreTable {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORES_STORAGE_KEY);
    if (raw) {
      return repairHighScores(JSON.parse(raw) as Partial<Record<DifficultyLevel, Partial<HighScoreRecord>>>);
    }
  } catch {
    return migrateLegacyHighScore();
  }

  return migrateLegacyHighScore();
}

function migrateLegacyHighScore() {
  const next = createEmptyHighScores();
  const legacy = loadLegacyHighScore();
  if (legacy.score > 0) {
    next.normal = legacy;
  }
  saveHighScores(next);
  return next;
}

function loadLegacyHighScore() {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    if (!raw) {
      return createHighScoreRecord();
    }

    const parsed = JSON.parse(raw) as Partial<{ score: number; lobsters: number; achievedAt: string }>;
    return createHighScoreRecord(parsed);
  } catch {
    return createHighScoreRecord();
  }
}

function repairHighScores(raw: Partial<Record<DifficultyLevel, Partial<HighScoreRecord>>>): HighScoreTable {
  const next = createEmptyHighScores();
  for (const difficulty of Object.keys(next) as DifficultyLevel[]) {
    next[difficulty] = createHighScoreRecord(raw[difficulty]);
  }
  return next;
}

function saveHighScores(scores: HighScoreTable = highScores) {
  try {
    window.localStorage.setItem(HIGH_SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // Locked-down storage should not block play.
  }
}

function getHighScore(difficulty: DifficultyLevel) {
  return highScores[difficulty] ?? createHighScoreRecord();
}

function getBestHighScore(scores: HighScoreTable) {
  return (Object.values(scores) as HighScoreRecord[]).reduce(
    (best, candidate) => (candidate.score > best.score ? candidate : best),
    createHighScoreRecord()
  );
}

function safeScoreNumber(value: unknown) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 0;
}

function commitHighScore(snapshot: GameSnapshot) {
  const current = getHighScore(snapshot.difficulty);
  if (snapshot.score <= current.score) {
    renderHighScore(snapshot.difficulty);
    return false;
  }

  highScores = {
    ...highScores,
    [snapshot.difficulty]: {
    score: snapshot.score,
    lobsters: snapshot.lobsters,
    achievedAt: new Date().toISOString()
    }
  };

  saveHighScores();

  renderHighScore(snapshot.difficulty);
  return true;
}

function renderHighScore(difficulty: DifficultyLevel = settings.difficulty) {
  const formattedScore = getHighScore(difficulty).score.toLocaleString();
  bestScoreEl.textContent = formattedScore;
  startBestScoreEl.textContent = formattedScore;
  finalBestScoreEl.textContent = formattedScore;
}

function renderProfile() {
  const title = getCosmetic(profile.loadout.title);
  startLaurelsEl.textContent = profile.laurels.toLocaleString();
  startCourierSealsEl.textContent = profile.courierSeals.toLocaleString();
  startTitleEl.textContent = title?.label ?? 'Winged Runner';
  startDifficultyEl.textContent = getDifficultyLabel(settings.difficulty);
  missionHeaderEl.textContent = `${profile.stats.totalRuns.toLocaleString()} runs`;
  gameOverLaurelsEl.textContent = `${profile.laurels.toLocaleString()} laurels`;
  document.documentElement.style.setProperty('--accent', getThemeAccent(profile.loadout.theme));
  renderMissionPreview(profile);
  renderMissionList(startMissionListEl, profile);
  renderMissionList(gameOverMissionListEl, profile);
  syncCosmeticSelects();
  dispatchGhost(createRunStartDetail());
}

function setRunMode(mode: RunMode) {
  runMode = mode;
  renderRunMode();
  dispatchGhost(createRunStartDetail());
}

function renderRunMode() {
  const dailyId = createDailyId();
  const dailyBest = getDailyBest(profile, dailyId, settings.difficulty);
  modeClassicButton.classList.toggle('is-active', runMode === 'classic');
  modeDailyButton.classList.toggle('is-active', runMode === 'daily');
  modeClassicButton.setAttribute('aria-pressed', runMode === 'classic' ? 'true' : 'false');
  modeDailyButton.setAttribute('aria-pressed', runMode === 'daily' ? 'true' : 'false');
  dailyDispatchLabelEl.textContent = dailyBest
    ? `Daily ${dailyId} best ${dailyBest.score.toLocaleString()}`
    : `Daily ${dailyId} route ready`;
}

function createRunStartDetail(): RunStartDetail {
  const seed = createRunSeed(runMode, settings.difficulty);
  return {
    ...seed,
    difficulty: settings.difficulty
  };
}

function dispatchGhost(detail: RunStartDetail) {
  const ghost = getGhostForRun(profile, detail.mode, detail.difficulty, detail.dailyId);
  window.dispatchEvent(new CustomEvent<GhostSample[]>('profile:ghost', { detail: ghost?.samples ?? [] }));
}

function collectGhostSample(snapshot: GameSnapshot) {
  if (snapshot.phase !== 'playing') {
    return;
  }

  if (snapshot.elapsedMs - lastGhostSampleMs < 150) {
    return;
  }

  lastGhostSampleMs = snapshot.elapsedMs;
  currentGhostSamples.push({
    t: snapshot.elapsedMs,
    lane: snapshot.playerLane,
    y: snapshot.verticalOffset,
    slide: snapshot.isSliding,
    score: snapshot.score
  });

  if (currentGhostSamples.length > 360) {
    currentGhostSamples.shift();
  }
}

function buildShareSummary(snapshot: GameSnapshot) {
  const modeLabel = snapshot.runMode === 'daily' ? `Daily Dispatch ${snapshot.dailyId}` : 'Classic';
  const difficulty = getDifficultyLabel(snapshot.difficulty);
  return `Hermes: Godspeed - ${modeLabel} ${difficulty} | Score ${snapshot.score.toLocaleString()} | Lobsters ${snapshot.lobsters} | Route ${getSegmentLabel(snapshot.segmentId)} | Seals ${snapshot.courierSeals}`;
}

function renderShareSummary() {
  if (!latestRunSummary) {
    shareStatusEl.textContent = 'Dispatch summary ready';
    return;
  }

  shareStatusEl.textContent = latestRunSummary;
}

async function copyShareSummary() {
  const summary = latestRunSummary || (latestSnapshot ? buildShareSummary(latestSnapshot) : '');
  if (!summary) {
    showToast('NO RUN YET');
    return;
  }

  try {
    await navigator.clipboard.writeText(summary);
    showToast('SHARE COPIED');
    shareStatusEl.textContent = 'Copied to clipboard';
  } catch {
    shareStatusEl.textContent = summary;
    showToast('COPY UNAVAILABLE');
  }
}

function loadSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaultSettings();
    }

    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return repairSettings(parsed);
  } catch {
    return defaultSettings();
  }
}

function defaultSettings(): GameSettings {
  return {
    music: true,
    sfx: true,
    reducedMotion: false,
    difficulty: DEFAULT_DIFFICULTY
  };
}

function repairSettings(raw: Partial<GameSettings>): GameSettings {
  return {
    music: typeof raw.music === 'boolean' ? raw.music : true,
    sfx: typeof raw.sfx === 'boolean' ? raw.sfx : true,
    reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : false,
    difficulty: normalizeDifficulty(raw.difficulty)
  };
}

function saveSettings() {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Locked-down storage should not block play.
  }
}

function updateSettings(patch: Partial<GameSettings>) {
  settings = repairSettings({ ...settings, ...patch });
  saveSettings();
  renderSettings();
  renderHighScore();
  renderProfile();
  renderRunMode();
  applySettings();
}

function renderSettings() {
  musicToggle.checked = settings.music;
  sfxToggle.checked = settings.sfx;
  reducedMotionToggle.checked = settings.reducedMotion;
  difficultySelect.value = settings.difficulty;
  startDifficultyEl.textContent = getDifficultyLabel(settings.difficulty);
  renderRunMode();
}

function applySettings() {
  document.body.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';

  if (!settings.sfx) {
    stopIntroNarration();
  } else if (introSoundEnabled && document.body.dataset.phase === 'intro') {
    speakIntroNarration();
  }

  if (!settings.music) {
    stopMusic();
  } else if (latestSnapshot?.phase === 'playing') {
    startMusic();
  }

  window.dispatchEvent(new CustomEvent<GameSettings>('settings:changed', { detail: settings }));
}

function openModal(modal: HTMLElement) {
  closeModal();
  activeModal = modal;
  modal.classList.add('is-visible');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  if (!activeModal) {
    return;
  }

  activeModal.classList.remove('is-visible');
  activeModal.setAttribute('aria-hidden', 'true');
  activeModal = undefined;
}

function renderMissionPreview(sourceProfile: PlayerProfile) {
  missionPreviewEl.replaceChildren();
  const [entry] = getActiveMissions(sourceProfile);
  const label = document.createElement('span');
  const title = document.createElement('strong');
  const reward = document.createElement('span');
  const meter = document.createElement('span');
  const fill = document.createElement('span');

  label.className = 'hud-label';
  meter.className = 'mission-meter';

  if (!entry) {
    label.textContent = 'Next Mission';
    title.textContent = 'Laurel board clear';
    reward.textContent = 'Start a run to refresh the board';
    fill.style.setProperty('--mission-progress', '100%');
  } else {
    const value = Math.min(entry.progress.value, entry.definition.target);
    const percent = Math.max(0, Math.min(100, (value / entry.definition.target) * 100));

    label.textContent = 'Next Mission';
    title.textContent = entry.definition.label;
    reward.textContent = `${formatMetricValue(entry.definition, value)} / ${formatMetricValue(entry.definition, entry.definition.target)} - ${entry.definition.laurels} laurels`;
    fill.style.setProperty('--mission-progress', `${percent}%`);
  }

  meter.append(fill);
  missionPreviewEl.append(label, title, reward, meter);
}

function renderMissionList(container: HTMLElement, sourceProfile: PlayerProfile) {
  container.replaceChildren();

  for (const entry of getActiveMissions(sourceProfile)) {
    const row = document.createElement('div');
    const title = document.createElement('span');
    const reward = document.createElement('span');
    const meter = document.createElement('span');
    const fill = document.createElement('span');
    const value = Math.min(entry.progress.value, entry.definition.target);
    const percent = Math.max(0, Math.min(100, (value / entry.definition.target) * 100));

    row.className = 'mission-row';
    title.className = 'mission-title';
    reward.className = 'mission-reward';
    meter.className = 'mission-meter';
    title.textContent = entry.definition.label;
    reward.textContent = `${formatMetricValue(entry.definition, value)} / ${formatMetricValue(entry.definition, entry.definition.target)} - ${entry.definition.laurels} laurels`;
    fill.style.setProperty('--mission-progress', `${percent}%`);
    meter.append(fill);
    row.append(title, reward, meter);
    container.append(row);
  }
}

function renderRewards() {
  const completed = lastProgressionResult?.completedMissions ?? [];
  const earned = lastProgressionResult?.laurelsEarned ?? 0;
  earnedLaurelsEl.textContent = earned.toLocaleString();
  completedMissionCountEl.textContent = `${completed.length} ${completed.length === 1 ? 'mission' : 'missions'}`;
  completedMissionListEl.replaceChildren();

  for (const mission of completed) {
    const item = document.createElement('div');
    item.className = 'completed-item';
    item.textContent = `Complete: ${mission.label} (+${mission.laurels} laurels)`;
    completedMissionListEl.append(item);
  }
}

function populateCosmeticSelects() {
  populateCosmeticSelect(trailSelect, TRAIL_COSMETICS);
  populateCosmeticSelect(titleSelect, TITLE_COSMETICS);
  populateCosmeticSelect(themeSelect, THEME_COSMETICS);
}

function populateCosmeticSelect(select: HTMLSelectElement, cosmetics: CosmeticUnlock[]) {
  select.replaceChildren();

  for (const cosmetic of cosmetics) {
    const option = document.createElement('option');
    option.value = cosmetic.id;
    option.textContent = cosmetic.label;
    select.append(option);
  }
}

function syncCosmeticSelects() {
  trailSelect.value = profile.loadout.trail;
  titleSelect.value = profile.loadout.title;
  themeSelect.value = profile.loadout.theme;
  updateCosmeticOptions(trailSelect, TRAIL_COSMETICS);
  updateCosmeticOptions(titleSelect, TITLE_COSMETICS);
  updateCosmeticOptions(themeSelect, THEME_COSMETICS);
}

function updateCosmeticOptions(select: HTMLSelectElement, cosmetics: CosmeticUnlock[]) {
  for (const option of Array.from(select.options)) {
    const cosmetic = cosmetics.find((item) => item.id === option.value);
    if (!cosmetic) {
      continue;
    }

    const owned = profile.unlockedCosmetics.includes(cosmetic.id);
    const selected = profile.loadout[cosmetic.kind] === cosmetic.id;
    option.textContent = owned ? `${cosmetic.label}${selected ? ' - Equipped' : ''}` : `${cosmetic.label} - ${cosmetic.cost} laurels`;
  }
}

function handleCosmeticChoice(cosmeticId: string) {
  const result = buyOrEquipCosmetic(profile, cosmeticId);
  profile = result.profile;

  if (result.status === 'locked') {
    renderProfile();
    showToast('NEED MORE LAURELS');
    return;
  }

  saveProfile(profile);
  renderProfile();
  dispatchCosmetics();
  showToast(result.status === 'bought' ? 'UNLOCKED' : 'EQUIPPED');
}

function dispatchCosmetics() {
  window.dispatchEvent(new CustomEvent<CosmeticLoadout>('profile:cosmetics', { detail: profile.loadout }));
}

function getThemeAccent(themeId: string) {
  const theme = THEME_COSMETICS.find((item) => item.id === themeId);
  return theme?.accent ?? '#65f4ff';
}

function setRecordNextRun(enabled: boolean) {
  recordNextRun = enabled && recorder.supported;

  if (recordNextRun) {
    recorder.arm();
  } else {
    recorder.disarm();
  }

  renderRecorder(recorder.snapshot);
  dispatchRecorderSnapshot(recorder.snapshot);
}

function renderRecorder(snapshot: RunRecorderSnapshot) {
  const isBusy = snapshot.state === 'recording' || snapshot.state === 'finalizing';
  const isArmedOrBusy = recordNextRun || isBusy;
  const canSave = Boolean(snapshot.objectUrl && snapshot.fileName && snapshot.blobSize > 0);

  for (const toggle of recordToggles) {
    toggle.checked = isArmedOrBusy;
    toggle.disabled = !snapshot.supported || isBusy;
  }

  for (const status of recordStatusEls) {
    status.textContent = snapshot.statusLabel;
    status.dataset.state = snapshot.state;
  }

  for (const summary of recordSummaryEls) {
    summary.textContent = snapshot.statusLabel;
    summary.dataset.state = snapshot.state;
  }

  for (const button of saveRecordingButtons) {
    button.disabled = !canSave;
  }
}

function dispatchRecorderSnapshot(snapshot: RunRecorderSnapshot) {
  window.dispatchEvent(new CustomEvent<RunRecorderSnapshot>('recording:snapshot', { detail: snapshot }));
}

function showToast(message: string) {
  window.clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.toggle('is-visible', Boolean(message));

  if (message && message !== 'PAUSED') {
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 950);
  }
}

function disposeAppForPageExit() {
  if (appDisposing) {
    return;
  }

  appDisposing = true;
  stopIntroAudio();
  stopMusic();
  recorder.dispose();
  void audioContext?.close().catch(() => {
    // Page teardown can race the audio backend; the browser will finish cleanup.
  });
  game.destroy(true);
}

function requestIntroSkip() {
  if (skipIntro || document.body.dataset.phase !== 'intro') {
    return;
  }

  introSkipRequested = true;
  window.dispatchEvent(new CustomEvent('intro:skip'));
}

async function ensureAudio() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch {
      // Browsers can reject resume if the user gesture was lost; the next input will retry.
    }
  }

  return audioContext;
}

async function ensureRunningAudio() {
  const activeAudioContext = await ensureAudio();

  if (activeAudioContext.state !== 'running') {
    throw new Error(`Audio context is ${activeAudioContext.state}.`);
  }

  return activeAudioContext;
}

async function enableIntroSound() {
  if (introSoundEnabled || document.body.dataset.phase !== 'intro') {
    return;
  }

  introSoundEnabled = true;
  introSoundButton.disabled = true;
  introSoundButton.textContent = settings.music || settings.sfx ? 'ON' : 'MUTED';

  await ensureAudio();
  window.dispatchEvent(new CustomEvent('intro:sound'));
  startIntroAudio();
}

function startIntroAudio() {
  if (!audioContext || document.body.dataset.phase !== 'intro') {
    return;
  }

  if (settings.music && !introAudioPlaying) {
    introAudioPlaying = true;
    introMusicStep = 0;
    window.clearTimeout(introMusicTimer);
    scheduleIntroMusicStep();
  }

  if (settings.sfx) {
    speakIntroNarration();
  }
}

function stopIntroAudio() {
  introAudioPlaying = false;
  window.clearTimeout(introMusicTimer);
  introMusicTimer = 0;
  stopIntroNarration();
}

function scheduleIntroMusicStep() {
  if (!audioContext || !introAudioPlaying || !settings.music || document.body.dataset.phase !== 'intro') {
    return;
  }

  const step = INTRO_MUSIC_PATTERN[introMusicStep % INTRO_MUSIC_PATTERN.length];
  const now = audioContext.currentTime + 0.02;

  if (step.bass) {
    scheduleLayers([{ frequency: step.bass, gain: 0.018, duration: 0.32, type: 'sine' }], now, 1);
  }

  if (step.chord) {
    for (const frequency of step.chord) {
      scheduleLayers([{ frequency, gain: 0.004, duration: 1.35, type: 'sine' }], now, 1);
    }
  }

  scheduleLayers([{ frequency: step.pluck, gain: 0.013, duration: 0.18, type: 'triangle' }], now, 1);
  introMusicStep += 1;
  introMusicTimer = window.setTimeout(scheduleIntroMusicStep, INTRO_MUSIC_STEP_MS);
}

function speakIntroNarration() {
  if (introNarrationStarted || !settings.sfx || document.body.dataset.phase !== 'intro') {
    return;
  }

  introNarrationStarted = true;
  void loadIntroNarrationBuffer()
    .then((buffer) => {
      if (!introNarrationStarted || !settings.sfx || document.body.dataset.phase !== 'intro') {
        return;
      }

      playIntroNarrationBuffer(buffer);
    })
    .catch(() => {
      if (!introNarrationStarted || !settings.sfx || document.body.dataset.phase !== 'intro') {
        return;
      }

      speakBrowserIntroNarration();
    });
}

async function loadIntroNarrationBuffer() {
  if (!audioContext) {
    throw new Error('Intro narration needs an audio context.');
  }

  introNarrationBufferPromise ??= fetch(AssetManifest.audio.introNarration.url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Intro narration request failed with ${response.status}.`);
      }

      return response.arrayBuffer();
    })
    .then((buffer) => audioContext!.decodeAudioData(buffer));

  return introNarrationBufferPromise;
}

function playIntroNarrationBuffer(buffer: AudioBuffer) {
  if (!audioContext) {
    return;
  }

  stopIntroNarration({ preserveStarted: true });
  const startTime = audioContext.currentTime + 0.02;

  for (const destination of getAudioDestinations()) {
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const node = { source, gain };
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.78, startTime);
    source.connect(gain);
    gain.connect(destination);
    introNarrationNodes.push(node);
    source.addEventListener('ended', () => {
      disconnectIntroNarrationNode(node);
      introNarrationNodes = introNarrationNodes.filter((candidate) => candidate !== node);
    });
    source.start(startTime);
  }
}

function stopIntroNarration(options: { preserveStarted?: boolean } = {}) {
  for (const { source, gain } of introNarrationNodes) {
    try {
      source.stop();
    } catch {
      // Already-ended one-shot sources throw when stopped again.
    }

    disconnectIntroNarrationNode({ source, gain });
  }

  introNarrationNodes = [];

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if (!options.preserveStarted) {
    introNarrationStarted = false;
  }
}

function disconnectIntroNarrationNode({ source, gain }: IntroNarrationNode) {
  try {
    source.disconnect();
  } catch {
    // Disconnection may already have happened through the ended event.
  }

  try {
    gain.disconnect();
  } catch {
    // Disconnection may already have happened through the ended event.
  }
}

function speakBrowserIntroNarration() {
  if (!settings.sfx || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(INTRO_NARRATION);
  utterance.rate = 0.96;
  utterance.pitch = 0.92;
  utterance.volume = 0.86;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function playSfx(name: SfxName) {
  if (!settings.sfx) {
    return;
  }

  void ensureRunningAudio()
    .then((activeAudioContext) => {
      if (!settings.sfx) {
        return;
      }

      scheduleLayers(SFX_LAYERS[name], activeAudioContext.currentTime, GAME_SFX_VOLUME);
    })
    .catch(() => {
      // The next user gesture will try to unlock Web Audio again.
    });
}

function startMusic() {
  if (musicPlaying || musicStarting || !settings.music) {
    return;
  }

  musicStarting = true;
  void ensureRunningAudio()
    .then(() => {
      musicStarting = false;

      if (musicPlaying || !settings.music || document.body.dataset.phase !== 'playing') {
        return;
      }

      musicPlaying = true;
      window.clearTimeout(musicTimer);
      scheduleMusicStep();
    })
    .catch(() => {
      musicStarting = false;
      // The next user gesture will try to unlock Web Audio again.
    });
}

function stopMusic() {
  musicPlaying = false;
  musicStarting = false;
  window.clearTimeout(musicTimer);
  musicTimer = 0;
}

function scheduleMusicStep() {
  if (!audioContext || !musicPlaying || !settings.music) {
    return;
  }

  const step = MUSIC_PATTERN[musicStep % MUSIC_PATTERN.length];
  const now = audioContext.currentTime + 0.02;

  if (step.bass) {
    scheduleLayers([{ frequency: step.bass, gain: 0.018, duration: 0.22, type: 'sine' }], now, GAME_MUSIC_VOLUME);
  }

  if (step.chord) {
    for (const frequency of step.chord) {
      scheduleLayers([{ frequency, gain: 0.0045, duration: 1.05, type: 'sine' }], now, GAME_MUSIC_VOLUME);
    }
  }

  scheduleLayers([{ frequency: step.pluck, gain: 0.012, duration: 0.16, type: 'triangle' }], now, GAME_MUSIC_VOLUME);
  musicStep += 1;
  musicTimer = window.setTimeout(scheduleMusicStep, MUSIC_STEP_MS);
}

function scheduleLayers(layers: ToneLayer[], baseTime: number, volume: number) {
  if (!audioContext) {
    return;
  }

  const destinations = getAudioDestinations();

  for (const layer of layers) {
    for (const destination of destinations) {
      scheduleLayer(layer, destination, baseTime, volume);
    }
  }
}

function scheduleLayer(layer: ToneLayer, destination: AudioNode, baseTime: number, volume: number) {
  if (!audioContext) {
    return;
  }

  const startTime = baseTime + (layer.delay ?? 0);
  const endTime = startTime + layer.duration;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = layer.type;
  oscillator.frequency.setValueAtTime(layer.frequency, startTime);

  if (layer.endFrequency) {
    oscillator.frequency.linearRampToValueAtTime(layer.endFrequency, endTime);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(layer.gain * volume, startTime + 0.014);
  gain.gain.linearRampToValueAtTime(0.0001, endTime);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    gain.disconnect();
  });
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.03);
}

function getAudioDestinations() {
  const destinations: AudioNode[] = [];

  if (audioContext) {
    destinations.push(audioContext.destination);
  }

  const recordingDestination = recorder.getActiveAudioDestination();
  if (recordingDestination) {
    destinations.push(recordingDestination);
  }

  return destinations;
}

void game;
