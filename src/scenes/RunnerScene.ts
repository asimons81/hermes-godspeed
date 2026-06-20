import Phaser from 'phaser';
import { AssetKeys, AssetManifest } from '../assets/manifest';
import { DEFAULT_DIFFICULTY } from '../game/difficulty';
import { Action, type ActionEventDetail } from '../input/actions';
import type {
  ActiveBoon,
  DifficultyLevel,
  GateChoice,
  GameSnapshot,
  GhostSample,
  LaneIndex,
  PowerUpKind,
  RouteSegmentId,
  RunStartDetail,
  SfxName,
  SpawnCommand
} from '../game/types';
import type { CosmeticLoadout } from '../systems/Progression';
import { getBoonLabel, getSegmentLabel, RunDirector } from '../systems/RunDirector';
import type { RunRecorderSnapshot } from '../systems/RunRecorder';
import { RunnerSimulation } from '../systems/RunnerSimulation';

type EntityKind = 'lobster' | 'golden-lobster' | 'obstacle-low' | 'obstacle-high' | 'powerup' | 'gate' | 'warning' | 'courier-seal';

type RunnerEntity = {
  id: number;
  kind: EntityKind;
  lane: LaneIndex;
  object: Phaser.GameObjects.GameObject & { x: number; y: number; destroy: () => void };
  width: number;
  height: number;
  power?: PowerUpKind;
  gateChoice?: GateChoice;
  sealReward?: number;
  expiresAtMs?: number;
  collected: boolean;
  animOffsetMs?: number;
  baseScaleX?: number;
  baseScaleY?: number;
  baseAngle?: number;
  pulseOffset?: number;
};

type GameSettings = {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  difficulty: DifficultyLevel;
};

const POWER_SEQUENCE: PowerUpKind[] = ['chomp', 'sandals', 'goblet', 'bolt', 'magnet'];
const POWER_ASSET_KEYS: Record<PowerUpKind, string> = {
  chomp: AssetKeys.powerupChomp,
  sandals: AssetKeys.powerupSandals,
  goblet: AssetKeys.powerupGoblet,
  bolt: AssetKeys.powerupBolt,
  magnet: AssetKeys.powerupMagnet
};

type CollisionProfile = {
  widthScale: number;
  heightScale: number;
  centerYOffset: number;
};

const ENTITY_COLLISION_PROFILES: Record<EntityKind, CollisionProfile> = {
  lobster: { widthScale: 0.86, heightScale: 0.92, centerYOffset: 0 },
  'golden-lobster': { widthScale: 0.9, heightScale: 0.96, centerYOffset: 0 },
  'obstacle-low': { widthScale: 0.78, heightScale: 0.78, centerYOffset: -0.39 },
  'obstacle-high': { widthScale: 0.8, heightScale: 0.72, centerYOffset: 0 },
  powerup: { widthScale: 0.9, heightScale: 0.9, centerYOffset: 0 },
  gate: { widthScale: 0.82, heightScale: 0.88, centerYOffset: 0 },
  warning: { widthScale: 0, heightScale: 0, centerYOffset: 0 },
  'courier-seal': { widthScale: 0.9, heightScale: 0.9, centerYOffset: 0 }
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const TRAIL_COLORS: Record<string, number> = {
  'trail-aether': 0x66f4ff,
  'trail-sunfire': 0xffd86d,
  'trail-rose': 0xff6f91,
  'trail-verdant': 0x65e68b,
  'trail-storm': 0x8ee7ff,
  'trail-neon': 0xff6ee7
};

const SEGMENT_TINTS: Record<RouteSegmentId, number> = {
  olympus: 0xffffff,
  storm: 0xaeefff,
  agora: 0xffd5f6,
  undercloud: 0xd0c1ff
};

const SEGMENT_ACCENTS: Record<RouteSegmentId, number> = {
  olympus: 0x65f4ff,
  storm: 0x8ee7ff,
  agora: 0xff6ee7,
  undercloud: 0xb990ff
};
const LOCAL_TEST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const canEnableTestHooks = () =>
  (import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_HOOKS === '1') && LOCAL_TEST_HOSTS.has(window.location.hostname);
const getTestEventName = (name: string) => ['test', name].join(':');
const getForceGameOverEventName = () => getTestEventName('forceGameOver');
const getSpawnEntityEventName = () => getTestEventName('spawnEntity');
const getActivatePowerEventName = () => getTestEventName('activatePower');

type TestSpawnDetail = {
  kind?: 'lobster' | 'golden-lobster' | 'obstacle-low' | 'obstacle-high' | 'powerup' | 'gate';
  lane?: LaneIndex;
  x?: number;
  offsetX?: number;
  power?: PowerUpKind;
};

type TestActivatePowerDetail = {
  power?: PowerUpKind;
  boon?: ActiveBoon;
};

type PoseFrame = {
  scaleX: number;
  scaleY: number;
  y: number;
  angle: number;
};

type HermesRunFrame = PoseFrame & {
  offsetX: number;
  flipX: boolean;
};

const HERMES_RUN_FRAMES: HermesRunFrame[] = [
  { scaleX: 1, scaleY: 1, y: 0, angle: -0.35, offsetX: 6, flipX: false },
  { scaleX: 1, scaleY: 1, y: 1, angle: 0.35, offsetX: -61, flipX: false },
  { scaleX: 1, scaleY: 1, y: 0, angle: -0.35, offsetX: 16, flipX: true },
  { scaleX: 1, scaleY: 1, y: -1, angle: 0.35, offsetX: -16, flipX: false }
];

const HERMES_AIR_FRAMES: PoseFrame[] = [
  { scaleX: 0.98, scaleY: 1.04, y: -2, angle: -7 },
  { scaleX: 0.99, scaleY: 1.03, y: -4, angle: -5 },
  { scaleX: 1.01, scaleY: 1.0, y: -5, angle: -2 },
  { scaleX: 1.03, scaleY: 0.98, y: -4, angle: 1 },
  { scaleX: 1.04, scaleY: 0.97, y: -3, angle: 4 },
  { scaleX: 1.02, scaleY: 0.99, y: -1, angle: 6 },
  { scaleX: 1.0, scaleY: 1.01, y: 1, angle: 5 },
  { scaleX: 0.99, scaleY: 1.03, y: 0, angle: 2 }
];

const HERMES_SLIDE_FRAMES: PoseFrame[] = [
  { scaleX: 1.08, scaleY: 0.95, y: 5, angle: -3 },
  { scaleX: 1.11, scaleY: 0.92, y: 7, angle: -5 },
  { scaleX: 1.14, scaleY: 0.9, y: 8, angle: -7 },
  { scaleX: 1.11, scaleY: 0.92, y: 7, angle: -6 },
  { scaleX: 1.09, scaleY: 0.94, y: 6, angle: -4 },
  { scaleX: 1.12, scaleY: 0.91, y: 8, angle: -6 },
  { scaleX: 1.14, scaleY: 0.9, y: 9, angle: -8 },
  { scaleX: 1.1, scaleY: 0.93, y: 6, angle: -5 }
];

const LOBSTER_SCUTTLE_FRAMES: PoseFrame[] = [
  { scaleX: 1.0, scaleY: 1.0, y: 0, angle: -3 },
  { scaleX: 1.05, scaleY: 0.96, y: -3, angle: -1 },
  { scaleX: 1.08, scaleY: 0.93, y: -5, angle: 2 },
  { scaleX: 1.02, scaleY: 0.98, y: -2, angle: 4 },
  { scaleX: 0.98, scaleY: 1.03, y: 1, angle: 2 },
  { scaleX: 0.94, scaleY: 1.07, y: 3, angle: -1 },
  { scaleX: 0.97, scaleY: 1.04, y: 2, angle: -4 },
  { scaleX: 1.02, scaleY: 0.98, y: -1, angle: -5 }
];

export class RunnerScene extends Phaser.Scene {
  private sim = new RunnerSimulation();
  private director = new RunDirector();
  private lanes: number[] = [0, 0, 0];
  private playerX = 220;
  private player!: Phaser.GameObjects.Sprite;
  private ghostSprite!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private background!: Phaser.GameObjects.TileSprite;
  private laneGraphics!: Phaser.GameObjects.Graphics;
  private segmentGraphics!: Phaser.GameObjects.Graphics;
  private trailGraphics!: Phaser.GameObjects.Graphics;
  private recordingGraphics!: Phaser.GameObjects.Graphics;
  private recordingText!: Phaser.GameObjects.Text;
  private recordingFinalText!: Phaser.GameObjects.Text;
  private hitboxGraphics!: Phaser.GameObjects.Graphics;
  private entities: RunnerEntity[] = [];
  private nextEntityId = 1;
  private playerBaseScale = 1;
  private lobsterBaseWidth = 96;
  private spawnTimerMs = 0;
  private powerTimerMs = 0;
  private lastSnapshotMs = 0;
  private lastTrailDrawMs = 0;
  private keyboardSlideHeld = false;
  private uiSlideHeld = false;
  private lastPointer?: Phaser.Math.Vector2;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private recordingSnapshot?: RunRecorderSnapshot;
  private previousPlayerLane: LaneIndex = 1;
  private laneLeanAngle = 0;
  private trailColor = TRAIL_COLORS['trail-aether'];
  private reducedMotion = false;
  private difficulty: DifficultyLevel = DEFAULT_DIFFICULTY;
  private ghostSamples: GhostSample[] = [];
  private showDebugHitboxes = false;
  private testHooksActive = false;
  private manualSpawnsOnly = false;
  private taughtHints = new Set<string>();
  private teachingHintQueue: Array<{ id: string; text: string; color: string }> = [];
  private teachingHintUntilMs = 0;

  constructor() {
    super('runner');
  }

  preload() {
    this.load.image(AssetManifest.hermes.key, AssetManifest.hermes.url);
    this.load.spritesheet(AssetManifest.hermesRun.key, AssetManifest.hermesRun.url, {
      frameWidth: AssetManifest.hermesRun.frameWidth,
      frameHeight: AssetManifest.hermesRun.frameHeight,
      endFrame: AssetManifest.hermesRun.frames - 1
    });
    this.load.image(AssetManifest.lobster.key, AssetManifest.lobster.url);
    this.load.image(AssetManifest.roadway.key, AssetManifest.roadway.url);
    this.load.image(AssetManifest.obstacles.low.key, AssetManifest.obstacles.low.url);
    this.load.image(AssetManifest.obstacles.high.key, AssetManifest.obstacles.high.url);
    for (const asset of Object.values(AssetManifest.powerups)) {
      this.load.image(asset.key, asset.url);
    }
  }

  create() {
    this.reducedMotion = document.body.dataset.reducedMotion === 'true';

    this.background = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, AssetKeys.roadway)
      .setOrigin(0, 0)
      .setDepth(0);

    this.laneGraphics = this.add.graphics().setDepth(1);
    this.segmentGraphics = this.add.graphics().setDepth(2);
    this.trailGraphics = this.add.graphics().setDepth(4);
    this.recordingGraphics = this.add.graphics().setDepth(32);
    this.hitboxGraphics = this.add.graphics().setDepth(42);
    this.recordingText = this.add
      .text(0, 0, '', {
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '16px',
        color: '#fff8d6',
        stroke: '#071033',
        strokeThickness: 4
      })
      .setDepth(33)
      .setVisible(false);
    this.recordingFinalText = this.add
      .text(0, 0, '', {
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '30px',
        color: '#fff8d6',
        align: 'center',
        stroke: '#071033',
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(34)
      .setVisible(false);
    this.shadow = this.add.ellipse(0, 0, 180, 24, 0x0a1646, 0.28).setDepth(2);
    this.ghostSprite = this.add
      .sprite(0, 0, AssetKeys.hermesRun, 0)
      .setOrigin(0.5, 1)
      .setDepth(3)
      .setAlpha(0)
      .setTint(0x92f8ff);
    this.player = this.add.sprite(0, 0, AssetKeys.hermesRun, 0).setOrigin(0.5, 1).setDepth(5);

    this.refreshLayout();
    const searchParams = new URLSearchParams(window.location.search);
    this.testHooksActive = canEnableTestHooks() && searchParams.get('testMode') === '1';
    this.showDebugHitboxes = canEnableTestHooks() && searchParams.get('debugHitboxes') === '1';
    this.manualSpawnsOnly = this.testHooksActive && searchParams.get('manualSpawns') === '1';
    this.setupInput();
    this.dispatchPhase('ready');
    this.dispatchSnapshot();

    this.scale.on('resize', this.refreshLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.refreshLayout, this);
      window.removeEventListener('ui:start', this.startGame);
      window.removeEventListener('ui:retry', this.startGame);
      window.removeEventListener('ui:menu', this.returnToMenu);
      window.removeEventListener('ui:action', this.handleUiAction as EventListener);
      window.removeEventListener('recording:snapshot', this.handleRecordingSnapshot as EventListener);
      window.removeEventListener('profile:cosmetics', this.handleCosmetics as EventListener);
      window.removeEventListener('profile:ghost', this.handleGhostSamples as EventListener);
      window.removeEventListener('settings:changed', this.handleSettings as EventListener);
      if (this.testHooksActive) {
        window.removeEventListener(getForceGameOverEventName(), this.handleForceGameOver);
        window.removeEventListener(getSpawnEntityEventName(), this.handleTestSpawnEntity as EventListener);
        window.removeEventListener(getActivatePowerEventName(), this.handleTestActivatePower as EventListener);
      }
    });

    window.addEventListener('ui:start', this.startGame);
    window.addEventListener('ui:retry', this.startGame);
    window.addEventListener('ui:menu', this.returnToMenu);
    window.addEventListener('ui:action', this.handleUiAction as EventListener);
    window.addEventListener('recording:snapshot', this.handleRecordingSnapshot as EventListener);
    window.addEventListener('profile:cosmetics', this.handleCosmetics as EventListener);
    window.addEventListener('profile:ghost', this.handleGhostSamples as EventListener);
    window.addEventListener('settings:changed', this.handleSettings as EventListener);

    if (this.testHooksActive) {
      window.addEventListener(getForceGameOverEventName(), this.handleForceGameOver);
      window.addEventListener(getSpawnEntityEventName(), this.handleTestSpawnEntity as EventListener);
      window.addEventListener(getActivatePowerEventName(), this.handleTestActivatePower as EventListener);
    }
  }

  update(_: number, rawDeltaMs: number) {
    const deltaMs = Math.min(rawDeltaMs, 34);
    const snapshot = this.sim.snapshot;

    if (snapshot.phase === 'playing') {
      this.sim.setSliding(this.isSlideHeld());
      this.sim.update(deltaMs);
      this.updateSpawns(deltaMs);
      this.updateEntities(deltaMs);
      this.checkCollisions();
    }

    this.renderWorld(deltaMs);

    if (this.time.now - this.lastSnapshotMs > 60 || this.sim.snapshot.phase !== snapshot.phase) {
      this.dispatchSnapshot();
      this.lastSnapshotMs = this.time.now;
    }
  }

  private startGame = (event?: Event) => {
    const detail =
      (event as CustomEvent<RunStartDetail> | undefined)?.detail ??
      ({
        mode: 'classic',
        difficulty: this.difficulty,
        seed: Date.now() >>> 0,
        dailyId: ''
      } satisfies RunStartDetail);

    this.clearEntities();
    this.spawnTimerMs = 0;
    this.powerTimerMs = 0;
    this.teachingHintQueue = [];
    this.teachingHintUntilMs = 0;
    this.keyboardSlideHeld = false;
    this.uiSlideHeld = false;
    this.difficulty = detail.difficulty;
    this.director.start(detail);
    this.sim.start(detail);
    this.sim.setDirectorSnapshot(this.director.snapshot);
    this.previousPlayerLane = this.sim.snapshot.playerLane;
    this.laneLeanAngle = 0;
    this.refreshLayout();
    this.flash(0xfff3a8, 180);
    this.emitSfx('start');
    this.dispatchPhase('playing');
    this.dispatchSnapshot();
  };

  private returnToMenu = () => {
    this.clearEntities();
    this.spawnTimerMs = 0;
    this.powerTimerMs = 0;
    this.teachingHintQueue = [];
    this.teachingHintUntilMs = 0;
    this.keyboardSlideHeld = false;
    this.uiSlideHeld = false;
    this.lastTrailDrawMs = 0;
    this.trailGraphics.clear();
    this.sim.setDifficulty(this.difficulty);
    this.director.reset();
    this.sim.reset('ready');
    this.sim.setDirectorSnapshot(this.director.snapshot);
    this.previousPlayerLane = this.sim.snapshot.playerLane;
    this.laneLeanAngle = 0;
    this.refreshLayout();
    this.dispatchPhase('ready');
    this.dispatchSnapshot();
  };

  private setupInput() {
    if (!this.input.keyboard) {
      return;
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,P') as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.lastPointer = new Phaser.Math.Vector2(pointer.x, pointer.y);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.lastPointer) {
        return;
      }

      const dx = pointer.x - this.lastPointer.x;
      const dy = pointer.y - this.lastPointer.y;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 32) {
        this.sim.moveLane(dx > 0 ? 1 : -1);
        this.emitSfx('start');
      } else if (dy < -28) {
        this.tryJump();
      } else if (dy > 28) {
        this.sim.setSliding(true);
        this.time.delayedCall(260, () => this.sim.setSliding(false));
      } else if (this.sim.snapshot.phase === 'ready' || this.sim.snapshot.phase === 'gameover') {
        this.startGame();
      }

      this.lastPointer = undefined;
    });
  }

  private handleUiAction = (event: Event) => {
    const detail = (event as CustomEvent<ActionEventDetail>).detail;

    if (!detail) {
      return;
    }

    if (detail.action === Action.Jump && detail.pressed) {
      this.tryJump();
    }

    if (detail.action === Action.Slide) {
      this.uiSlideHeld = detail.pressed;
    }

    if (detail.action === Action.LaneLeft && detail.pressed) {
      this.sim.moveLane(-1);
      this.emitSfx('start');
    }

    if (detail.action === Action.LaneRight && detail.pressed) {
      this.sim.moveLane(1);
      this.emitSfx('start');
    }

    if (detail.action === Action.Pause && detail.pressed) {
      this.sim.pause();
      this.dispatchPhase(this.sim.snapshot.phase);
    }
  };

  private handleRecordingSnapshot = (event: Event) => {
    this.recordingSnapshot = (event as CustomEvent<RunRecorderSnapshot>).detail;
    this.updateRecordingOverlay();
  };

  private handleCosmetics = (event: Event) => {
    const loadout = (event as CustomEvent<CosmeticLoadout>).detail;
    this.trailColor = TRAIL_COLORS[loadout.trail] ?? TRAIL_COLORS['trail-aether'];
  };

  private handleGhostSamples = (event: Event) => {
    this.ghostSamples = ((event as CustomEvent<GhostSample[]>).detail ?? []).slice(0, 240);
  };

  private handleSettings = (event: Event) => {
    const settings = (event as CustomEvent<GameSettings>).detail;
    this.reducedMotion = Boolean(settings.reducedMotion);
    this.difficulty = settings.difficulty ?? DEFAULT_DIFFICULTY;

    const phase = this.sim.snapshot.phase;
    if (phase === 'ready' || phase === 'gameover') {
      this.sim.setDifficulty(this.difficulty);
      this.dispatchSnapshot();
    }
  };

  private handleForceGameOver = () => {
    if (this.sim.snapshot.phase === 'playing') {
      this.endRun(this.player.x + 90, this.player.y);
    }
  };

  private handleTestSpawnEntity = (event: Event) => {
    if (this.sim.snapshot.phase !== 'playing') {
      return;
    }

    const detail = (event as CustomEvent<TestSpawnDetail>).detail ?? {};
    const lane = this.normalizeLane(detail.lane);
    const x = typeof detail.x === 'number' ? detail.x : this.player.x + (detail.offsetX ?? 72);

    if (detail.kind === 'obstacle-high') {
      const entity = this.createHighObstacle(lane);
      entity.object.x = x;
      this.entities.push(entity);
      this.showObstacleTeaching(true);
      return;
    }

    if (detail.kind === 'powerup') {
      const entity = this.spawnPowerUp(lane, 0, detail.power ?? 'chomp');
      entity.object.x = x;
      return;
    }

    if (detail.kind === 'lobster' || detail.kind === 'golden-lobster') {
      const entity = this.spawnLobster(lane, 0, detail.kind === 'golden-lobster');
      entity.object.x = x;
      return;
    }

    if (detail.kind === 'gate') {
      const firstGateId = this.nextEntityId;
      this.spawnHeraldGate([
        { lane: 0, segmentId: 'storm', boon: 'storm-shield', label: 'Storm Gate' },
        { lane: 1, segmentId: 'agora', boon: 'golden-touch', label: 'Agora Gate' },
        { lane: 2, segmentId: 'undercloud', boon: 'wing-tempo', label: 'Undercloud Gate' }
      ]);

      for (const entity of this.entities) {
        if (entity.kind === 'gate' && entity.id >= firstGateId) {
          entity.object.x = x;
        }
      }
      return;
    }

    const entity = this.createLowObstacle(lane);
    entity.object.x = x;
    this.entities.push(entity);
    this.showObstacleTeaching(false);
  };

  private handleTestActivatePower = (event: Event) => {
    if (this.sim.snapshot.phase !== 'playing') {
      return;
    }

    const detail = (event as CustomEvent<TestActivatePowerDetail>).detail ?? {};
    if (detail.boon) {
      this.sim.activateBoon(detail.boon);
      this.showSmashTeachingForBoon(detail.boon);
    } else {
      this.sim.activatePowerUp(detail.power ?? 'chomp');
      this.showSmashTeachingForPower(detail.power ?? 'chomp');
    }

    this.dispatchSnapshot();
  };

  private readKeyboard() {
    if (!this.cursors || !this.keys) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryJump();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.keys.A)) {
      this.sim.moveLane(-1);
      this.emitSfx('start');
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keys.D)) {
      this.sim.moveLane(1);
      this.emitSfx('start');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.P)) {
      this.sim.pause();
      this.dispatchPhase(this.sim.snapshot.phase);
    }

    this.keyboardSlideHeld = this.cursors.down.isDown || this.keys.S.isDown;
  }

  private isSlideHeld() {
    return this.keyboardSlideHeld || this.uiSlideHeld;
  }

  private tryJump() {
    if (this.sim.jump()) {
      this.emitSfx('start');
      this.shake(45, 0.0015);
    }
  }

  private updateSpawns(deltaMs: number) {
    if (this.manualSpawnsOnly) {
      return;
    }

    const commands = this.director.update(deltaMs, this.sim.snapshot);
    this.sim.setDirectorSnapshot(this.director.snapshot);

    for (const command of commands) {
      this.processSpawnCommand(command);
    }
  }

  private processSpawnCommand(command: SpawnCommand) {
    if (command.kind === 'pattern') {
      this.spawnDirectedPattern(command);
      return;
    }

    if (command.kind === 'powerup') {
      this.spawnPowerUp(command.lane, 90, command.power);
      return;
    }

    if (command.kind === 'gate') {
      this.spawnHeraldGate(command.choices);
      return;
    }

    if (command.kind === 'warning') {
      this.spawnWarning(command.lanes, command.label, command.durationMs);
      return;
    }

    this.spawnConvoy(command.lanes, command.rewardLane, command.sealReward);
  }

  private spawnDirectedPattern(command: Extract<SpawnCommand, { kind: 'pattern' }>) {
    if (command.pattern === 'lobster-line') {
      this.spawnLobsterLine(command.lane, command.count ?? 2, 0, Boolean(command.golden));
      return;
    }

    if (command.pattern === 'lobster-lure') {
      this.spawnLobsterLine(command.lane, command.count ?? 3, 0, Boolean(command.golden));
      this.spawnObstacle(command.lane, Boolean(command.high), 340);
      return;
    }

    if (command.pattern === 'low-obstacle') {
      this.spawnObstacle(command.lane, false);
      return;
    }

    if (command.pattern === 'high-obstacle') {
      this.spawnObstacle(command.lane, true);
      return;
    }

    if (command.pattern === 'jump-slide-pair') {
      this.spawnJumpSlidePair(command.lane, Boolean(command.firstHigh));
      return;
    }

    this.spawnSplitLaneTrap(command.lane, command.rewardLane ?? this.pickOtherLane(command.lane), Boolean(command.high), command.count ?? 2);
  }

  private updateEntities(deltaMs: number) {
    const seconds = deltaMs / 1000;
    const speed = this.sim.currentSpeed;
    const snapshot = this.sim.snapshot;
    const removeAfterX = -180;

    for (const entity of this.entities) {
      if (entity.collected) {
        continue;
      }

      entity.object.x -= speed * seconds;

      if (entity.expiresAtMs && this.time.now > entity.expiresAtMs) {
        entity.collected = true;
        continue;
      }

      let poseBaseY: number | undefined;

      if (this.sim.magnetActive && (entity.kind === 'lobster' || entity.kind === 'golden-lobster')) {
        const dx = this.player.x - entity.object.x;
        if (Math.abs(dx) < 340) {
          poseBaseY = Phaser.Math.Linear(entity.object.y, this.player.y - 42, 0.12);
          entity.object.y = poseBaseY;
          entity.object.x = Phaser.Math.Linear(entity.object.x, this.player.x + 24, 0.06);
        }
      }

      if (entity.kind === 'lobster' || entity.kind === 'golden-lobster') {
        this.applyLobsterPose(entity, snapshot.elapsedMs, speed, poseBaseY);
      } else if (entity.kind === 'powerup' && 'setScale' in entity.object) {
        const pulse = 1 + Math.sin(snapshot.elapsedMs / 180 + (entity.pulseOffset ?? 0)) * 0.045;
        (entity.object as Phaser.GameObjects.Container).setScale(pulse);
      }
    }

    this.entities = this.entities.filter((entity) => {
      const keep = !entity.collected && entity.object.x > removeAfterX;
      if (!keep) {
        entity.object.destroy();
      }
      return keep;
    });
  }

  private checkCollisions() {
    const playerHazardRect = this.getPlayerHazardHurtbox();
    const playerPickupRect = this.getPlayerPickupBox();
    const snapshot = this.sim.snapshot;

    for (const entity of this.entities) {
      if (entity.kind === 'warning') {
        continue;
      }

      const canCollectAcrossLanes = this.sim.magnetActive && (entity.kind === 'lobster' || entity.kind === 'golden-lobster');
      if (entity.collected || (entity.lane !== snapshot.playerLane && !canCollectAcrossLanes)) {
        continue;
      }

      const playerRect = this.isHazardEntity(entity) ? playerHazardRect : playerPickupRect;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(playerRect, this.getEntityHurtbox(entity))) {
        continue;
      }

      if (entity.kind === 'gate' && entity.gateChoice) {
        entity.collected = true;
        const choice = this.director.chooseGate(entity.gateChoice.lane);
        const activeBoon = this.director.snapshot.activeBoon;

        if (activeBoon) {
          this.sim.activateBoon(activeBoon);
          this.showSmashTeachingForBoon(activeBoon);
        }

        this.sim.setDirectorSnapshot(this.director.snapshot);
        this.burst(entity.object.x, entity.object.y, SEGMENT_ACCENTS[choice?.segmentId ?? entity.gateChoice.segmentId], 16);
        this.floatText(choice ? `${choice.label} / ${getBoonLabel(choice.boon)}` : 'ROUTE LOCKED', entity.object.x, entity.object.y - 54, '#d6fbff');
        this.emitSfx('power');
        this.shake(180, 0.005);
        this.destroyGateEntities();
        this.dispatchSnapshot();
        continue;
      }

      if (entity.kind === 'courier-seal') {
        entity.collected = true;
        const seals = entity.sealReward ?? 1;
        const reward = this.sim.grantCourierSeal(seals);
        this.director.recordCourierSeal(seals);
        this.sim.setDirectorSnapshot(this.director.snapshot);
        this.burst(entity.object.x, entity.object.y, 0xffd86d, 18);
        this.floatText(`SEAL +${seals}  SCORE +${Math.floor(reward)}`, entity.object.x, entity.object.y - 42, '#fff2a6');
        this.emitSfx('power');
        this.shake(180, 0.0055);
        entity.object.destroy();
        this.dispatchSnapshot();
        continue;
      }

      if (entity.kind === 'lobster' || entity.kind === 'golden-lobster') {
        entity.collected = true;
        const golden = entity.kind === 'golden-lobster';
        const reward = this.sim.eatLobster(golden);
        this.burst(entity.object.x, entity.object.y, golden ? 0xffd45c : 0xff5f31, golden ? 12 : 7);
        this.floatText(`+${Math.floor(reward)}`, entity.object.x, entity.object.y - 30, golden ? '#ffe585' : '#ffb08d');
        this.chompFlash(golden);
        this.emitSfx('chomp');
        this.shake(golden ? 130 : 70, golden ? 0.004 : 0.002);
        entity.object.destroy();
        continue;
      }

      if (entity.kind === 'powerup' && entity.power) {
        entity.collected = true;
        this.sim.activatePowerUp(entity.power);
        this.showSmashTeachingForPower(entity.power);
        this.applyPowerUp(entity.power);
        this.burst(entity.object.x, entity.object.y, 0x6fe7ff, 10);
        this.floatText(this.powerLabel(entity.power), entity.object.x, entity.object.y - 34, '#d6fbff');
        this.emitSfx(entity.power === 'bolt' ? 'bolt' : 'power');
        entity.object.destroy();
        continue;
      }

      if (entity.kind === 'obstacle-low' || entity.kind === 'obstacle-high') {
        if (this.sim.snapshot.canEatObstacles) {
          entity.collected = true;
          const reward = this.sim.smashObstacle();
          this.burst(entity.object.x, entity.object.y - entity.height / 2, 0xfff1a1, 12);
          this.floatText(`+${Math.floor(reward)}`, entity.object.x, entity.object.y - 90, '#fff2a6');
          this.emitSfx('hit');
          this.shake(140, 0.005);
          entity.object.destroy();
          this.dispatchSnapshot();
          continue;
        }

        entity.collected = true;
        const hitX = entity.object.x;
        const hitY = entity.object.y;
        const strikesTaken = this.sim.recordObstacleHit();
        const maxStrikes = this.sim.snapshot.maxStrikes;
        this.burst(hitX, hitY - entity.height / 2, strikesTaken >= maxStrikes ? 0xff4d35 : 0xffa257, strikesTaken >= maxStrikes ? 12 : 8);
        this.floatText(`STRIKE ${strikesTaken}/${maxStrikes}`, hitX, hitY - 90, strikesTaken >= maxStrikes ? '#ffb2a7' : '#ffd6a0');
        this.emitSfx('hit');
        this.shake(strikesTaken >= maxStrikes ? 220 : 120, strikesTaken >= maxStrikes ? 0.007 : 0.004);
        entity.object.destroy();
        this.dispatchSnapshot();

        if (strikesTaken >= maxStrikes) {
          this.endRun(hitX, hitY);
          break;
        }

        this.flash(0xffa257, 150);
        continue;
      }
    }
  }

  private renderWorld(deltaMs: number) {
    this.readKeyboard();

    const snapshot = this.sim.snapshot;
    const width = this.scale.width;
    const height = this.scale.height;
    const laneY = this.lanes[snapshot.playerLane];
    const targetY = laneY - snapshot.verticalOffset;
    const seconds = deltaMs / 1000;
    const playerFrame = this.getHermesFrame(snapshot);
    const playerPose = this.getHermesPose(snapshot);
    const runFrame = this.getActiveHermesRunFrame(snapshot, playerFrame);

    if (snapshot.playerLane !== this.previousPlayerLane) {
      this.laneLeanAngle = snapshot.playerLane > this.previousPlayerLane ? 7 : -7;
      this.previousPlayerLane = snapshot.playerLane;
    }

    this.laneLeanAngle = Phaser.Math.Linear(this.laneLeanAngle, 0, 0.18);

    const scrollSpeed = snapshot.phase === 'playing' ? snapshot.speed : 80;
    this.background.tilePositionX += scrollSpeed * seconds * 0.16;
    this.background.setTint(SEGMENT_TINTS[snapshot.segmentId]);
    this.drawSegmentWash(snapshot);
    this.drawLanes();

    const playerScale = this.playerBaseScale;
    this.player.setFrame(playerFrame).setFlipX(runFrame?.flipX ?? false);
    const slideScaleY = snapshot.isSliding ? playerScale * 0.72 : playerScale;
    const slideScaleX = snapshot.isSliding ? playerScale * 1.08 : playerScale;
    this.player.setScale(slideScaleX * playerPose.scaleX, slideScaleY * playerPose.scaleY);
    this.player.x = this.playerX + (runFrame?.offsetX ?? 0) * playerScale;
    this.player.y = Phaser.Math.Linear(this.player.y || targetY, targetY + playerPose.y * playerScale, 0.25);
    this.player.angle = (snapshot.isSliding ? -8 : clamp(snapshot.verticalOffset / 18, 0, 8) - 2) + playerPose.angle + this.laneLeanAngle;
    this.player.setAlpha(snapshot.invulnerable ? 0.92 : 1);
    this.player.setTint(snapshot.invulnerable ? 0xfff2a1 : 0xffffff);
    if (this.testHooksActive) {
      const testWindow = window as unknown as { __hermesPlayerFrame?: number; __hermesPlayerFlipX?: boolean };
      testWindow.__hermesPlayerFrame = Number(this.player.frame.name);
      testWindow.__hermesPlayerFlipX = this.player.flipX;
    }

    this.shadow.x = this.playerX - 6;
    this.shadow.y = laneY + 12;
    this.shadow.width = clamp(this.player.displayWidth * (1 - snapshot.verticalOffset / 270), 70, 190);
    this.shadow.height = clamp(24 * (1 - snapshot.verticalOffset / 330), 9, 24);
    this.shadow.setAlpha(clamp(0.32 - snapshot.verticalOffset / 720, 0.08, 0.32));
    this.updateGhost(snapshot);

    const trailSpeed = snapshot.phase === 'playing' ? snapshot.speed : 0;
    if (trailSpeed <= 0) {
      if (this.lastTrailDrawMs !== 0) {
        this.trailGraphics.clear();
        this.lastTrailDrawMs = 0;
      }
    } else if (this.time.now - this.lastTrailDrawMs > this.getTrailInterval(snapshot.invulnerable)) {
      this.drawTrail(trailSpeed, width, height);
      this.lastTrailDrawMs = this.time.now;
    }

    this.updateRecordingOverlay();
    this.drawDebugHitboxes();
  }

  private refreshLayout = () => {
    const width = this.scale.width;
    const height = this.scale.height;

    this.background?.setSize(width, height);
    this.background?.setDisplaySize(width, height);

    this.playerX = clamp(width * 0.18, 130, 250);
    this.lanes = [height * 0.62, height * 0.735, height * 0.85];
    this.playerBaseScale = this.getPlayerScale();
    this.lobsterBaseWidth = clamp(width * 0.085, 70, 118);

    if (this.player) {
      this.player.x = this.playerX;
      this.player.y = this.lanes[this.sim.snapshot.playerLane];
      this.player.setScale(this.playerBaseScale);
    }

    if (this.ghostSprite) {
      this.ghostSprite.setScale(this.playerBaseScale);
    }

    this.drawLanes();
    this.updateRecordingOverlay();
  };

  private drawLanes() {
    const width = this.scale.width;
    const accent = SEGMENT_ACCENTS[this.sim.snapshot.segmentId] ?? 0x63e5ff;
    this.laneGraphics.clear();

    for (let index = 0; index < this.lanes.length; index += 1) {
      const y = this.lanes[index];
      const alpha = index === this.sim.snapshot.playerLane ? 0.24 : 0.13;
      this.laneGraphics.fillStyle(0xffffff, alpha);
      this.laneGraphics.fillRoundedRect(40, y - 14, width - 80, 28, 16);
      this.laneGraphics.lineStyle(2, index === this.sim.snapshot.playerLane ? 0xffd86d : accent, 0.42);
      this.laneGraphics.lineBetween(70, y + 15, width - 70, y + 15);
    }
  }

  private drawSegmentWash(snapshot: GameSnapshot) {
    const accent = SEGMENT_ACCENTS[snapshot.segmentId] ?? 0x65f4ff;
    const height = this.scale.height;
    this.segmentGraphics.clear();

    if (snapshot.phase !== 'playing') {
      return;
    }

    this.segmentGraphics.fillStyle(accent, snapshot.activeEvent === 'convoy' ? 0.09 : 0.045);
    this.segmentGraphics.fillRect(0, height * 0.46, this.scale.width, height * 0.44);

    if (snapshot.activeBoon && !this.reducedMotion) {
      this.segmentGraphics.lineStyle(2, accent, 0.22);
      const pulse = (Math.sin(snapshot.elapsedMs / 130) + 1) * 0.5;
      for (let index = 0; index < 3; index += 1) {
        this.segmentGraphics.lineBetween(this.playerX - 140 - pulse * 30, this.lanes[index] - 34, this.playerX + 30, this.lanes[index] - 18);
      }
    }
  }

  private updateGhost(snapshot: GameSnapshot) {
    if (!this.ghostSamples.length || snapshot.phase !== 'playing') {
      this.ghostSprite.setAlpha(0);
      return;
    }

    const current = this.findGhostSample(snapshot.elapsedMs);
    if (!current) {
      this.ghostSprite.setAlpha(0);
      return;
    }

    const laneY = this.lanes[current.lane] - current.y;
    const playerPose = current.slide ? HERMES_SLIDE_FRAMES[0] : HERMES_RUN_FRAMES[0];
    const ghostFrame = current.slide ? 1 : current.y > 4 ? 3 : Math.floor(current.t / 74) % HERMES_RUN_FRAMES.length;
    const ghostRunFrame = !current.slide && current.y <= 4 ? HERMES_RUN_FRAMES[ghostFrame] : undefined;
    this.ghostSprite
      .setFrame(ghostFrame)
      .setFlipX(ghostRunFrame?.flipX ?? false)
      .setAlpha(this.reducedMotion ? 0.18 : 0.28)
      .setScale(this.playerBaseScale * playerPose.scaleX, this.playerBaseScale * (current.slide ? 0.74 : 1) * playerPose.scaleY)
      .setPosition(this.playerX - 56 + (ghostRunFrame?.offsetX ?? 0) * this.playerBaseScale, laneY + playerPose.y * this.playerBaseScale)
      .setAngle(current.slide ? -8 : 0);
  }

  private findGhostSample(elapsedMs: number) {
    if (!this.ghostSamples.length) {
      return undefined;
    }

    let best = this.ghostSamples[0];
    for (const sample of this.ghostSamples) {
      if (sample.t > elapsedMs) {
        break;
      }
      best = sample;
    }
    return best;
  }

  private drawTrail(speed: number, width: number, height: number) {
    this.trailGraphics.clear();

    if (speed <= 0) {
      return;
    }

    const intensity = clamp((speed - 320) / 600, 0.25, 1);
    const baseY = this.player.y - this.player.displayHeight * 0.2;
    const routeAccent = SEGMENT_ACCENTS[this.sim.snapshot.segmentId] ?? this.trailColor;
    const color = this.sim.snapshot.activeBoon ? routeAccent : this.trailColor;
    this.trailGraphics.lineStyle(2, color, 0.22 * intensity);

    const lineCount = this.reducedMotion ? 2 : this.sim.snapshot.activeBoon ? 7 : 5;
    for (let i = 0; i < lineCount; i += 1) {
      const y = baseY + Phaser.Math.Between(-80, 100);
      const x1 = this.player.x - Phaser.Math.Between(70, 180);
      const x2 = Math.max(0, x1 - Phaser.Math.Between(70, Math.max(90, width * 0.22)));
      this.trailGraphics.lineBetween(x1, y, x2, y + Phaser.Math.Between(-6, 6));
    }

    if (this.sim.snapshot.invulnerable) {
      this.trailGraphics.lineStyle(5, color, 0.32);
      this.trailGraphics.lineBetween(this.player.x - 20, height * 0.19, this.player.x - 160, height * 0.12);
      this.trailGraphics.lineBetween(this.player.x + 22, height * 0.16, this.player.x - 110, height * 0.08);
    }
  }

  private spawnLobsterLine(
    lane: LaneIndex = this.randomLane(),
    count = Phaser.Math.Between(1, this.sim.snapshot.elapsedMs > 18000 ? 4 : 3),
    startOffsetX = 0,
    forceGolden = false
  ) {
    const golden = forceGolden || Phaser.Math.FloatBetween(0, 1) > 0.9;

    for (let i = 0; i < count; i += 1) {
      this.spawnLobster(lane, startOffsetX + i * 92, golden && i === count - 1);
    }
  }

  private spawnLobster(lane: LaneIndex, offsetX: number, golden = false) {
    const width = this.lobsterBaseWidth;
    const sprite = this.add.sprite(this.scale.width + 120 + offsetX, this.lanes[lane] - 54, AssetKeys.lobster).setDepth(4);
    sprite.setDisplaySize(width, width * 0.66);
    sprite.setTint(golden ? 0xffd85f : 0xffffff);
    const baseAngle = Phaser.Math.Between(-3, 5);
    sprite.setAngle(baseAngle);

    const entity = {
      id: this.nextEntityId++,
      kind: golden ? 'golden-lobster' : 'lobster',
      lane,
      object: sprite,
      width,
      height: width * 0.58,
      collected: false,
      animOffsetMs: Phaser.Math.Between(0, 640),
      baseScaleX: sprite.scaleX,
      baseScaleY: sprite.scaleY,
      baseAngle
    } satisfies RunnerEntity;
    this.entities.push(entity);
    return entity;
  }

  private spawnObstacle(lane: LaneIndex = this.randomLane(), high = Phaser.Math.FloatBetween(0, 1) > 0.55, offsetX = 0) {
    const entity = high ? this.createHighObstacle(lane) : this.createLowObstacle(lane);
    entity.object.x += offsetX;
    this.entities.push(entity);
    this.showObstacleTeaching(high);
  }

  private spawnJumpSlidePair(lane: LaneIndex, firstHigh: boolean) {
    const gap = this.sim.snapshot.elapsedMs > 45000 ? 340 : 410;
    this.spawnObstacle(lane, firstHigh);
    this.spawnObstacle(lane, !firstHigh, gap);
  }

  private spawnSplitLaneTrap(obstacleLane: LaneIndex, rewardLane: LaneIndex, high: boolean, rewardCount: number) {
    this.spawnObstacle(obstacleLane, high);
    this.spawnLobsterLine(rewardLane, rewardCount, 70);
  }

  private createLowObstacle(lane: LaneIndex): RunnerEntity {
    const width = clamp(this.scale.width * 0.09, 82, 116);
    const height = width * 0.67;
    const x = this.scale.width + 130;
    const y = this.lanes[lane];
    const container = this.add.container(x, y).setDepth(3);
    const warningGlow = this.add.ellipse(0, -height * 0.42, width * 1.08, height * 0.72, 0xff4e2d, 0.17);
    const sprite = this.add.sprite(0, 0, AssetKeys.obstacleLow).setOrigin(0.5, 1).setDisplaySize(width, height);
    container.add([warningGlow, sprite]);

    return {
      id: this.nextEntityId++,
      kind: 'obstacle-low',
      lane,
      object: container,
      width,
      height,
      collected: false
    };
  }

  private createHighObstacle(lane: LaneIndex): RunnerEntity {
    const width = clamp(this.scale.width * 0.118, 118, 162);
    const height = width * 0.32;
    const x = this.scale.width + 135;
    const y = this.lanes[lane] - clamp(this.getPlayerBaseDimensions().height * 0.72, 96, 138);
    const container = this.add.container(x, y).setDepth(4);
    const warningGlow = this.add.ellipse(0, 0, width * 0.9, height * 0.9, 0xff5a36, 0.2);
    const sprite = this.add.sprite(0, 0, AssetKeys.obstacleHigh).setDisplaySize(width, height);
    container.add([warningGlow, sprite]);

    return {
      id: this.nextEntityId++,
      kind: 'obstacle-high',
      lane,
      object: container,
      width,
      height,
      collected: false
    };
  }

  private spawnPowerUp(lane: LaneIndex = this.randomLane(), offsetX = 0, forcedPower?: PowerUpKind) {
    const power = forcedPower ?? POWER_SEQUENCE[Phaser.Math.Between(0, POWER_SEQUENCE.length - 1)];
    const size = clamp(this.scale.width * 0.062, 58, 78);
    const x = this.scale.width + 140 + offsetX;
    const y = this.lanes[lane] - clamp(this.scale.height * 0.14, 76, 105);
    const container = this.add.container(x, y).setDepth(4);
    const g = this.add.graphics();
    g.fillStyle(0x65f4ff, 0.14);
    g.fillCircle(0, 0, size * 0.62);
    g.lineStyle(3, 0xffdc73, 0.88);
    g.strokeCircle(0, 0, size * 0.57);
    g.lineStyle(2, 0x76f8ff, 0.75);
    g.strokeCircle(0, 0, size * 0.48);
    const sprite = this.add.sprite(0, 0, POWER_ASSET_KEYS[power]);
    const source = this.textures.get(POWER_ASSET_KEYS[power]).getSourceImage() as HTMLImageElement;
    const spriteScale = Math.min((size * 0.98) / source.width, (size * 0.98) / source.height);
    sprite.setScale(spriteScale);
    container.add([g, sprite]);

    const entity = {
      id: this.nextEntityId++,
      kind: 'powerup',
      lane,
      object: container,
      width: size,
      height: size,
      power,
      collected: false,
      pulseOffset: Phaser.Math.FloatBetween(0, Math.PI * 2)
    } satisfies RunnerEntity;
    this.entities.push(entity);
    return entity;
  }

  private spawnHeraldGate(choices: GateChoice[]) {
    this.flash(0x65f4ff, 180);
    this.floatText('HERALD GATE', this.scale.width * 0.5, this.scale.height * 0.26, '#d6fbff');

    for (const choice of choices) {
      const width = clamp(this.scale.width * 0.105, 112, 148);
      const height = clamp(this.scale.height * 0.16, 108, 148);
      const x = this.scale.width + 180;
      const y = this.lanes[choice.lane] - clamp(this.scale.height * 0.125, 78, 118);
      const container = this.add.container(x, y).setDepth(4);
      const accent = SEGMENT_ACCENTS[choice.segmentId];
      const g = this.add.graphics();
      g.fillStyle(0x08133c, 0.9);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
      g.lineStyle(4, accent, 0.95);
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
      g.lineStyle(2, 0xfff2ad, 0.72);
      g.lineBetween(-width * 0.34, -height * 0.1, width * 0.34, -height * 0.1);
      g.strokeCircle(0, height * 0.17, width * 0.22);

      const label = this.add
        .text(0, -height * 0.22, getSegmentLabel(choice.segmentId).replace(' ', '\n'), {
          align: 'center',
          color: '#fff8d6',
          fontFamily: 'Arial Black, Impact, sans-serif',
          fontSize: `${Math.round(width * 0.12)}px`,
          lineSpacing: -4,
          stroke: '#071033',
          strokeThickness: 4
        })
        .setOrigin(0.5);
      const boon = this.add
        .text(0, height * 0.28, getBoonLabel(choice.boon).toUpperCase(), {
          align: 'center',
          color: '#d9fbff',
          fontFamily: 'Arial Black, Impact, sans-serif',
          fontSize: `${Math.round(width * 0.09)}px`,
          stroke: '#071033',
          strokeThickness: 3
        })
        .setOrigin(0.5);
      container.add([g, label, boon]);

      this.entities.push({
        id: this.nextEntityId++,
        kind: 'gate',
        lane: choice.lane,
        object: container,
        width,
        height,
        gateChoice: choice,
        collected: false
      });
    }
  }

  private spawnWarning(lanes: LaneIndex[], label: string, durationMs: number) {
    for (const lane of lanes) {
      const width = clamp(this.scale.width * 0.22, 180, 300);
      const height = 42;
      const x = this.scale.width + width * 0.7;
      const y = this.lanes[lane] - 44;
      const container = this.add.container(x, y).setDepth(6);
      const g = this.add.graphics();
      g.fillStyle(0xff3d2e, 0.22);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
      g.lineStyle(3, 0xff9a66, 0.86);
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
      g.lineStyle(2, 0xfff2ad, 0.75);
      g.lineBetween(-width * 0.42, 0, width * 0.42, 0);
      const text = this.add
        .text(0, 0, label, {
          color: '#fff4b7',
          fontFamily: 'Arial Black, Impact, sans-serif',
          fontSize: `${clamp(this.scale.width * 0.012, 12, 16)}px`,
          stroke: '#071033',
          strokeThickness: 4
        })
        .setOrigin(0.5);
      container.add([g, text]);

      this.entities.push({
        id: this.nextEntityId++,
        kind: 'warning',
        lane,
        object: container,
        width,
        height,
        collected: false,
        expiresAtMs: this.time.now + durationMs + 1200
      });
    }

    this.emitSfx('bolt');
    this.shake(120, 0.0035);
  }

  private spawnConvoy(lanes: LaneIndex[], rewardLane: LaneIndex, sealReward: number) {
    this.floatText('OPENCLAW CONVOY', this.scale.width * 0.55, this.scale.height * 0.25, '#ffd2c7');

    lanes.forEach((lane, index) => {
      const entity = this.createConvoyObstacle(lane, index * 96);
      this.entities.push(entity);
    });

    this.spawnLobsterLine(rewardLane, 4, 70, true);
    this.spawnCourierSeal(rewardLane, 470, sealReward);
    this.flash(0xff6241, 180);
  }

  private createConvoyObstacle(lane: LaneIndex, offsetX: number): RunnerEntity {
    const width = clamp(this.scale.width * 0.12, 116, 156);
    const height = clamp(this.scale.height * 0.12, 76, 104);
    const x = this.scale.width + 170 + offsetX;
    const y = this.lanes[lane];
    const container = this.add.container(x, y).setDepth(5);
    const g = this.add.graphics();
    g.fillStyle(0x101a48, 0.96);
    g.fillRoundedRect(-width / 2, -height, width, height, 12);
    g.lineStyle(4, 0xff6241, 0.96);
    g.strokeRoundedRect(-width / 2, -height, width, height, 12);
    g.fillStyle(0x65f4ff, 0.26);
    g.fillCircle(0, -height * 0.56, height * 0.26);
    const sprite = this.add.sprite(0, -height * 0.26, AssetKeys.lobster).setTint(0xff6b49);
    sprite.setDisplaySize(width * 0.92, width * 0.62);
    const text = this.add
      .text(0, -height * 0.73, 'OPENCLAW', {
        color: '#fff4b7',
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: `${Math.round(width * 0.095)}px`,
        stroke: '#071033',
        strokeThickness: 3
      })
      .setOrigin(0.5);
    container.add([g, sprite, text]);

    return {
      id: this.nextEntityId++,
      kind: 'obstacle-low',
      lane,
      object: container,
      width,
      height,
      collected: false
    };
  }

  private spawnCourierSeal(lane: LaneIndex, offsetX: number, sealReward: number) {
    const size = clamp(this.scale.width * 0.07, 66, 86);
    const x = this.scale.width + 150 + offsetX;
    const y = this.lanes[lane] - clamp(this.scale.height * 0.16, 86, 118);
    const container = this.add.container(x, y).setDepth(5);
    const g = this.add.graphics();
    g.fillStyle(0xffd86d, 0.96);
    g.fillCircle(0, 0, size / 2);
    g.lineStyle(5, 0x65f4ff, 0.95);
    g.strokeCircle(0, 0, size / 2);
    g.lineStyle(2, 0x101a48, 0.78);
    g.strokeCircle(0, 0, size * 0.34);
    const text = this.add
      .text(0, 1, 'SEAL', {
        color: '#101a48',
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: `${Math.round(size * 0.22)}px`
      })
      .setOrigin(0.5);
    container.add([g, text]);

    this.entities.push({
      id: this.nextEntityId++,
      kind: 'courier-seal',
      lane,
      object: container,
      width: size,
      height: size,
      sealReward,
      collected: false
    });
  }

  private showObstacleTeaching(high: boolean) {
    if (this.sim.snapshot.canEatObstacles) {
      return;
    }

    if (high) {
      this.showTeachingHint('obstacle-high', 'SLIDE UNDER ZAPS', '#ffd6a0');
      return;
    }

    this.showTeachingHint('obstacle-low', 'JUMP LOW BLOCKS', '#ffd6a0');
  }

  private showSmashTeachingForPower(power: PowerUpKind) {
    if (power === 'chomp') {
      this.showTeachingHint('smash-mode', 'SMASH MODE: OBSTACLES ARE SAFE', '#fff2a6');
    }
  }

  private showSmashTeachingForBoon(boon: ActiveBoon) {
    if (boon.kind === 'storm-shield') {
      this.showTeachingHint('smash-mode', 'SMASH MODE: OBSTACLES ARE SAFE', '#fff2a6');
    }
  }

  private showTeachingHint(id: string, text: string, color: string) {
    if (this.taughtHints.has(id)) {
      return;
    }

    this.taughtHints.add(id);
    const hint = { id, text, color };
    if (this.time.now < this.teachingHintUntilMs) {
      this.teachingHintQueue.push(hint);
      return;
    }

    this.presentTeachingHint(hint);
  }

  private presentTeachingHint(hint: { id: string; text: string; color: string }) {
    this.floatText(hint.text, this.scale.width * 0.5, this.scale.height * 0.32, hint.color);
    window.dispatchEvent(new CustomEvent('game:teaching', { detail: { id: hint.id, text: hint.text } }));
    this.teachingHintUntilMs = this.time.now + 820;
    this.time.delayedCall(840, () => {
      if (this.sim.snapshot.phase !== 'playing') {
        return;
      }

      const next = this.teachingHintQueue.shift();
      if (next) {
        this.presentTeachingHint(next);
      }
    });
  }

  private randomLane() {
    return Phaser.Math.Between(0, 2) as LaneIndex;
  }

  private normalizeLane(lane?: LaneIndex) {
    return lane === 0 || lane === 1 || lane === 2 ? lane : this.sim.snapshot.playerLane;
  }

  private pickOtherLane(lane: LaneIndex) {
    const lanes = ([0, 1, 2] as LaneIndex[]).filter((candidate) => candidate !== lane);
    return lanes[Phaser.Math.Between(0, lanes.length - 1)];
  }

  private applyPowerUp(kind: PowerUpKind) {
    if (kind === 'bolt') {
      for (const entity of this.entities) {
        if (entity.kind !== 'powerup' && entity.kind !== 'gate' && entity.object.x > this.player.x + 40) {
          entity.collected = true;
          this.burst(entity.object.x, entity.object.y - entity.height / 2, 0x92f8ff, 7);
          entity.object.destroy();
        }
      }
      this.entities = this.entities.filter((entity) => !entity.collected);
      this.flash(0xb9fbff, 260);
      this.shake(220, 0.006);
    }
  }

  private endRun(x: number, y: number) {
    this.sim.gameOver();
    this.burst(x, y - 52, 0xff4d35, 14);
    this.flash(0xff5c47, 200);
    this.emitSfx('gameover');
    this.shake(310, 0.009);
    this.dispatchSnapshot();
    this.dispatchPhase('gameover');
  }

  private getPlayerBaseDimensions() {
    const width = AssetManifest.hermesRun.frameWidth * this.playerBaseScale;
    return {
      width,
      height: width * (374 / 640)
    };
  }

  private getPlayerHazardHurtbox() {
    const snapshot = this.sim.snapshot;
    const base = this.getPlayerBaseDimensions();
    const width = base.width * (snapshot.isSliding ? 0.31 : 0.22);
    const height = base.height * (snapshot.isSliding ? 0.15 : 0.88);
    const x = this.player.x - width * 0.5;
    const y = snapshot.isSliding ? this.player.y - height * 0.86 : this.player.y - height;
    return new Phaser.Geom.Rectangle(x, y, width, height);
  }

  private getPlayerPickupBox() {
    const base = this.getPlayerBaseDimensions();
    const width = base.width * 0.38;
    const height = base.height * 0.82;
    return new Phaser.Geom.Rectangle(this.player.x - width * 0.52, this.player.y - height, width, height);
  }

  private isHazardEntity(entity: RunnerEntity) {
    return entity.kind === 'obstacle-low' || entity.kind === 'obstacle-high';
  }

  private getEntityHurtbox(entity: RunnerEntity) {
    const profile = ENTITY_COLLISION_PROFILES[entity.kind];
    const width = entity.width * profile.widthScale;
    const height = entity.height * profile.heightScale;
    const centerY = entity.object.y + entity.height * profile.centerYOffset;
    return new Phaser.Geom.Rectangle(entity.object.x - width / 2, centerY - height / 2, width, height);
  }

  private drawDebugHitboxes() {
    this.hitboxGraphics.clear();
    if (!this.showDebugHitboxes) {
      return;
    }

    const playerRect = this.getPlayerHazardHurtbox();
    this.hitboxGraphics.lineStyle(2, 0xfff2a6, 0.9);
    this.hitboxGraphics.strokeRect(playerRect.x, playerRect.y, playerRect.width, playerRect.height);
    const pickupRect = this.getPlayerPickupBox();
    this.hitboxGraphics.lineStyle(2, 0x65f4ff, 0.9);
    this.hitboxGraphics.strokeRect(pickupRect.x, pickupRect.y, pickupRect.width, pickupRect.height);

    for (const entity of this.entities) {
      if (entity.collected || entity.kind === 'warning') {
        continue;
      }

      const rect = this.getEntityHurtbox(entity);
      const color =
        entity.kind === 'obstacle-low' || entity.kind === 'obstacle-high'
          ? 0xff6241
          : entity.kind === 'powerup' || entity.kind === 'courier-seal'
            ? 0x65f4ff
            : 0xffd86d;
      this.hitboxGraphics.lineStyle(2, color, 0.88);
      this.hitboxGraphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private getPlayerScale() {
    const targetWidth = clamp(this.scale.width * 0.23, 176, 292);
    return targetWidth / AssetManifest.hermesRun.frameWidth;
  }

  private getHermesFrame(snapshot: GameSnapshot) {
    if (snapshot.phase !== 'playing') {
      return 0;
    }

    if (snapshot.isSliding) {
      return 1;
    }

    if (snapshot.verticalOffset > 4) {
      return 3;
    }

    const frameMs = clamp(112 - (snapshot.speed - 360) * 0.055, 68, 112);
    return Math.floor(snapshot.elapsedMs / frameMs) % HERMES_RUN_FRAMES.length;
  }

  private getActiveHermesRunFrame(snapshot: GameSnapshot, frame: number) {
    if (snapshot.phase !== 'playing' || snapshot.isSliding || snapshot.verticalOffset > 4) {
      return undefined;
    }

    return HERMES_RUN_FRAMES[frame];
  }

  private getHermesPose(snapshot: GameSnapshot): PoseFrame {
    if (snapshot.phase !== 'playing') {
      return HERMES_RUN_FRAMES[0];
    }

    if (snapshot.isSliding) {
      return this.getPoseFrame(HERMES_SLIDE_FRAMES, snapshot.elapsedMs, 58);
    }

    if (snapshot.verticalOffset > 4) {
      return this.getPoseFrame(HERMES_AIR_FRAMES, snapshot.elapsedMs, 74);
    }

    const frameMs = clamp(112 - (snapshot.speed - 360) * 0.055, 68, 112);
    return this.getPoseFrame(HERMES_RUN_FRAMES, snapshot.elapsedMs, frameMs);
  }

  private applyLobsterPose(entity: RunnerEntity, elapsedMs: number, speed: number, baseYOverride?: number) {
    const sprite = entity.object as Phaser.GameObjects.Sprite;
    const frameMs = clamp(86 - (speed - 360) * 0.032, 48, 86);
    const frame = this.getPoseFrame(LOBSTER_SCUTTLE_FRAMES, elapsedMs + (entity.animOffsetMs ?? 0), frameMs);
    const scale = entity.width / 96;
    const yScale = baseYOverride === undefined ? 1 : 0.18;
    const baseY = baseYOverride ?? this.lanes[entity.lane] - 54;
    sprite.y = baseY + frame.y * scale * yScale;

    sprite.setScale((entity.baseScaleX ?? sprite.scaleX) * frame.scaleX, (entity.baseScaleY ?? sprite.scaleY) * frame.scaleY);
    sprite.angle = (entity.baseAngle ?? 0) + frame.angle;
  }

  private getPoseFrame(frames: PoseFrame[], elapsedMs: number, frameMs: number) {
    const index = Math.floor(elapsedMs / frameMs) % frames.length;
    return frames[index];
  }

  private clearEntities() {
    for (const entity of this.entities) {
      entity.object.destroy();
    }
    this.entities = [];
  }

  private destroyGateEntities() {
    for (const entity of this.entities) {
      if (entity.kind === 'gate') {
        entity.collected = true;
        entity.object.destroy();
      }
    }

    this.entities = this.entities.filter((entity) => entity.kind !== 'gate');
  }

  private burst(x: number, y: number, color: number, count: number) {
    const particleCount = this.reducedMotion ? Math.max(3, Math.floor(count * 0.45)) : count;
    for (let i = 0; i < particleCount; i += 1) {
      const dot = this.add.circle(x, y, Phaser.Math.Between(3, 7), color, 0.95).setDepth(8);
      this.tweens.add({
        targets: dot,
        x: x + Phaser.Math.Between(-90, 90),
        y: y + Phaser.Math.Between(-70, 42),
        alpha: 0,
        scale: 0.15,
        duration: Phaser.Math.Between(300, 620),
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy()
      });
    }
  }

  private floatText(text: string, x: number, y: number, color: string) {
    const maxWidth = Math.min(this.scale.width - 36, 620);
    const baseFontSize = clamp(this.scale.width * 0.026, 18, 28);
    const fontSize = Math.max(15, Math.min(baseFontSize, (maxWidth / Math.max(text.length, 1)) * 1.85));
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: `${fontSize}px`,
      color,
      align: 'center',
      stroke: '#10143b',
      strokeThickness: 5,
      wordWrap: { width: maxWidth, useAdvancedWrap: true }
    }).setOrigin(0.5).setDepth(9);

    this.tweens.add({
      targets: label,
      y: y - 56,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }

  private chompFlash(golden: boolean) {
    const text = golden ? 'GOLD CHOMP' : 'CHOMP';
    this.floatText(text, this.player.x + 76, this.player.y - 110, golden ? '#ffe680' : '#ff9168');
  }

  private updateRecordingOverlay() {
    const recordingState = this.recordingSnapshot?.state;
    const showRecording = recordingState === 'recording' || recordingState === 'finalizing';

    if (!showRecording) {
      this.recordingGraphics.clear();
      this.recordingText.setVisible(false);
      this.recordingFinalText.setVisible(false);
      return;
    }

    const snapshot = this.sim.snapshot;
    const width = this.scale.width;
    const height = this.scale.height;
    const x = 18;
    const y = Math.max(82, height * 0.12);
    const panelWidth = Math.min(width - 36, 460);
    const panelHeight = 48;

    this.recordingGraphics.clear();
    this.recordingGraphics.fillStyle(0x08113b, 0.72);
    this.recordingGraphics.fillRoundedRect(x, y, panelWidth, panelHeight, 8);
    this.recordingGraphics.lineStyle(2, 0xff6241, 0.9);
    this.recordingGraphics.strokeRoundedRect(x, y, panelWidth, panelHeight, 8);
    this.recordingGraphics.fillStyle(0xff3d2e, 1);
    this.recordingGraphics.fillCircle(x + 22, y + 24, 7);

    const power = snapshot.activePowerLabel === 'Ready' ? 'No Power' : snapshot.activePowerLabel;
    this.recordingText
      .setText(`REC  Score ${snapshot.score.toLocaleString()}  Lobsters ${snapshot.lobsters}  Speed ${snapshot.speed}  ${power}`)
      .setPosition(x + 38, y + 12)
      .setFontSize(Math.max(12, Math.min(16, width * 0.018)))
      .setVisible(true);

    if (recordingState === 'finalizing') {
      const finalScore = this.recordingSnapshot?.finalScore ?? snapshot.score;
      const finalLobsters = this.recordingSnapshot?.finalLobsters ?? snapshot.lobsters;
      this.recordingFinalText
        .setText(`RUN COMPLETE\nSCORE ${finalScore.toLocaleString()}   LOBSTERS ${finalLobsters}`)
        .setPosition(width / 2, height * 0.36)
        .setFontSize(Math.max(20, Math.min(34, width * 0.04)))
        .setVisible(true);
    } else {
      this.recordingFinalText.setVisible(false);
    }
  }

  private flash(color: number, duration: number) {
    const rect = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, color, this.reducedMotion ? 0.06 : 0.18)
      .setOrigin(0, 0)
      .setDepth(20);
    this.tweens.add({
      targets: rect,
      alpha: 0,
      duration: this.reducedMotion ? Math.min(duration, 120) : duration,
      ease: 'Sine.easeOut',
      onComplete: () => rect.destroy()
    });
  }

  private getTrailInterval(invulnerable: boolean) {
    if (this.reducedMotion) {
      return invulnerable ? 150 : 220;
    }

    return invulnerable ? 64 : 96;
  }

  private shake(duration: number, intensity: number) {
    if (this.reducedMotion) {
      return;
    }

    this.cameras.main.shake(duration, intensity);
  }

  private powerLabel(power: PowerUpKind) {
    const labels: Record<PowerUpKind, string> = {
      chomp: 'DIVINE CHOMP',
      sandals: 'WINGED',
      goblet: '3X SCORE',
      bolt: 'ZEUS BOLT',
      magnet: 'MAGNET'
    };
    return labels[power];
  }

  private emitSfx(name: SfxName) {
    window.dispatchEvent(new CustomEvent('game:sfx', { detail: name }));
  }

  private dispatchSnapshot() {
    window.dispatchEvent(new CustomEvent('game:snapshot', { detail: this.sim.snapshot }));
  }

  private dispatchPhase(phase: string) {
    window.dispatchEvent(new CustomEvent('game:phase', { detail: phase }));
  }
}
