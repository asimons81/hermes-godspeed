import Phaser from 'phaser';
import { AssetKeys, AssetManifest } from '../assets/manifest';

type IntroCaptionDetail = {
  text: string;
};

type IntroBeat = {
  key: string;
  startMs: number;
  caption: string;
  panFromX: number;
  panToX: number;
  panFromY: number;
  panToY: number;
  zoomFrom: number;
  zoomTo: number;
  title?: boolean;
};

const INTRO_DURATION_MS = 29200;
const FADE_MS = 520;

const INTRO_BEATS: IntroBeat[] = [
  {
    key: AssetKeys.introOlympusSignal,
    startMs: 0,
    caption: 'Olympus is losing its signal.',
    panFromX: -0.018,
    panToX: 0.018,
    panFromY: -0.01,
    panToY: 0.01,
    zoomFrom: 1.1,
    zoomTo: 1.16
  },
  {
    key: AssetKeys.introOpenclawSurge,
    startMs: 3900,
    caption: 'OpenClaws jam the road to dawn.',
    panFromX: 0.026,
    panToX: -0.026,
    panFromY: 0,
    panToY: 0.014,
    zoomFrom: 1.12,
    zoomTo: 1.18
  },
  {
    key: AssetKeys.introHermesLaunch,
    startMs: 7600,
    caption: 'Every stolen spark slows Olympus. Hermes runs the relay.',
    panFromX: -0.012,
    panToX: 0.024,
    panFromY: 0.01,
    panToY: -0.012,
    zoomFrom: 1.08,
    zoomTo: 1.14
  },
  {
    key: AssetKeys.introGodspeedRun,
    startMs: 14500,
    caption: 'Jump the faults. Slide the sparks. Chain the chomp. Chase the laurel.',
    panFromX: -0.03,
    panToX: 0.018,
    panFromY: -0.006,
    panToY: 0.012,
    zoomFrom: 1.12,
    zoomTo: 1.2
  },
  {
    key: AssetKeys.introTitleBackdrop,
    startMs: 23500,
    caption: 'Hermes: Godspeed. One more run.',
    panFromX: 0,
    panToX: 0,
    panFromY: 0.012,
    panToY: -0.006,
    zoomFrom: 1.05,
    zoomTo: 1.1,
    title: true
  }
];

export class IntroScene extends Phaser.Scene {
  private currentImage?: Phaser.GameObjects.Image;
  private vignette?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private titleSubtext?: Phaser.GameObjects.Text;
  private skipHandler = () => this.finish();
  private finished = false;
  private reducedMotion = false;

  constructor() {
    super('intro');
  }

  preload() {
    for (const asset of Object.values(AssetManifest.cutscene)) {
      this.load.image(asset.key, asset.url);
    }
  }

  create() {
    this.reducedMotion = document.body.dataset.reducedMotion === 'true';
    document.body.dataset.phase = 'intro';
    window.addEventListener('intro:skip', this.skipHandler);
    window.dispatchEvent(new CustomEvent('intro:ready'));
    this.scale.on('resize', this.refreshLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('intro:skip', this.skipHandler);
      this.scale.off('resize', this.refreshLayout, this);
    });

    this.vignette = this.add.graphics().setDepth(8);
    this.titleText = this.add
      .text(0, 0, 'HERMES:\nGODSPEED', {
        align: 'center',
        color: '#fff8d6',
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '72px',
        lineSpacing: -8,
        stroke: '#0a1238',
        strokeThickness: 10
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(10);
    this.titleSubtext = this.add
      .text(0, 0, 'ONE MORE RUN', {
        align: 'center',
        color: '#65f4ff',
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '24px',
        stroke: '#0a1238',
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(10);

    this.refreshLayout();
    this.playTimeline();
  }

  private playTimeline() {
    for (const beat of INTRO_BEATS) {
      this.time.delayedCall(beat.startMs, () => this.showBeat(beat));
    }

    this.time.delayedCall(INTRO_DURATION_MS, this.finish);
  }

  private showBeat(beat: IntroBeat) {
    if (this.finished) {
      return;
    }

    const previousImage = this.currentImage;
    const image = this.add.image(0, 0, beat.key).setOrigin(0.5).setAlpha(0).setDepth(1);
    this.currentImage = image;
    this.fitImage(image, beat);

    this.tweens.add({
      targets: image,
      alpha: 1,
      duration: this.reducedMotion ? 180 : FADE_MS,
      ease: 'Sine.easeOut'
    });

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: image,
        x: this.scale.width / 2 + this.scale.width * beat.panToX,
        y: this.scale.height / 2 + this.scale.height * beat.panToY,
        scale: this.getCoverScale(beat.key) * beat.zoomTo,
        duration: this.getBeatDuration(beat),
        ease: 'Sine.easeInOut'
      });
    }

    if (previousImage) {
      this.tweens.add({
        targets: previousImage,
        alpha: 0,
        duration: this.reducedMotion ? 160 : FADE_MS,
        ease: 'Sine.easeIn',
        onComplete: () => previousImage.destroy()
      });
    }

    this.dispatchCaption(beat.caption);
    this.setTitleVisible(Boolean(beat.title));
  }

  private getBeatDuration(beat: IntroBeat) {
    const nextBeat = INTRO_BEATS.find((candidate) => candidate.startMs > beat.startMs);
    return (nextBeat?.startMs ?? INTRO_DURATION_MS) - beat.startMs + FADE_MS;
  }

  private fitImage(image: Phaser.GameObjects.Image, beat: IntroBeat) {
    const scale = this.getCoverScale(beat.key) * (this.reducedMotion ? 1.02 : beat.zoomFrom);
    image
      .setScale(scale)
      .setPosition(
        this.scale.width / 2 + this.scale.width * beat.panFromX,
        this.scale.height / 2 + this.scale.height * beat.panFromY
      );
  }

  private getCoverScale(key: string) {
    const source = this.textures.get(key).getSourceImage();
    return Math.max(this.scale.width / source.width, this.scale.height / source.height);
  }

  private refreshLayout = () => {
    this.vignette?.clear();
    this.vignette?.fillStyle(0x05091c, 0.22);
    this.vignette?.fillRect(0, 0, this.scale.width, this.scale.height);
    this.vignette?.fillStyle(0x05091c, 0.44);
    this.vignette?.fillRect(0, 0, this.scale.width, Math.max(82, this.scale.height * 0.12));
    this.vignette?.fillRect(0, this.scale.height - Math.max(132, this.scale.height * 0.22), this.scale.width, Math.max(132, this.scale.height * 0.22));

    this.titleText
      ?.setPosition(this.scale.width / 2, this.scale.height * 0.42)
      .setFontSize(Math.max(38, Math.min(82, this.scale.width * 0.068)));
    this.titleSubtext
      ?.setPosition(this.scale.width / 2, this.scale.height * 0.58)
      .setFontSize(Math.max(16, Math.min(28, this.scale.width * 0.024)));

    if (this.currentImage) {
      const beat = INTRO_BEATS.find((candidate) => candidate.key === this.currentImage?.texture.key) ?? INTRO_BEATS[0];
      this.fitImage(this.currentImage, beat);
    }
  };

  private setTitleVisible(visible: boolean) {
    if (!this.titleText || !this.titleSubtext) {
      return;
    }

    this.tweens.killTweensOf([this.titleText, this.titleSubtext]);
    this.tweens.add({
      targets: [this.titleText, this.titleSubtext],
      alpha: visible ? 1 : 0,
      yoyo: false,
      duration: this.reducedMotion ? 160 : 700,
      ease: 'Sine.easeOut'
    });
  }

  private dispatchCaption(text: string) {
    window.dispatchEvent(new CustomEvent<IntroCaptionDetail>('intro:caption', { detail: { text } }));
  }

  private finish = () => {
    if (this.finished) {
      return;
    }

    this.finished = true;
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.currentImage?.destroy();
    this.vignette?.destroy();
    this.titleText?.destroy();
    this.titleSubtext?.destroy();
    this.currentImage = undefined;
    this.vignette = undefined;
    this.titleText = undefined;
    this.titleSubtext = undefined;
    this.dispatchCaption('');
    window.dispatchEvent(new CustomEvent('intro:complete'));
    this.scene.start('runner');
  };
}
