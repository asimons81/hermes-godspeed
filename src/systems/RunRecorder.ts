export type RunRecorderState = 'unsupported' | 'idle' | 'armed' | 'recording' | 'finalizing' | 'ready' | 'error';

export type RunRecordingStats = {
  score: number;
  lobsters: number;
  timestamp: Date;
};

export type RunRecorderSnapshot = {
  state: RunRecorderState;
  supported: boolean;
  mimeType: string;
  statusLabel: string;
  errorMessage: string;
  objectUrl?: string;
  fileName?: string;
  blobSize: number;
  finalScore?: number;
  finalLobsters?: number;
};

type RunRecorderOptions = {
  forceUnsupported?: boolean;
  onChange?: (snapshot: RunRecorderSnapshot) => void;
};

const MP4_MIME_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4'
];

const STATUS_LABELS: Record<RunRecorderState, string> = {
  unsupported: 'MP4 unavailable',
  idle: 'Off',
  armed: 'Armed',
  recording: 'Recording',
  finalizing: 'Finalizing',
  ready: 'Ready to save',
  error: 'Recording error'
};

export class RunRecorder {
  private stateValue: RunRecorderState;
  private mimeTypeValue = '';
  private errorMessageValue = '';
  private mediaRecorder?: MediaRecorder;
  private canvasStream?: MediaStream;
  private combinedStream?: MediaStream;
  private audioContext?: AudioContext;
  private audioDestination?: MediaStreamAudioDestinationNode;
  private audioKeepAliveSource?: OscillatorNode;
  private audioKeepAliveGain?: GainNode;
  private chunks: Blob[] = [];
  private blob?: Blob;
  private objectUrl?: string;
  private fileName?: string;
  private finalStats?: RunRecordingStats;
  private finalizeTimer = 0;
  private readonly onChange?: (snapshot: RunRecorderSnapshot) => void;
  private readonly targetFps = 30;
  private readonly videoBitsPerSecond = 3200000;

  constructor(options: RunRecorderOptions = {}) {
    this.onChange = options.onChange;
    this.mimeTypeValue = options.forceUnsupported ? '' : this.resolveMimeType();
    this.stateValue = this.mimeTypeValue ? 'idle' : 'unsupported';
  }

  get state() {
    return this.stateValue;
  }

  get supported() {
    return this.stateValue !== 'unsupported' && Boolean(this.mimeTypeValue);
  }

  get snapshot(): RunRecorderSnapshot {
    return {
      state: this.stateValue,
      supported: this.supported,
      mimeType: this.mimeTypeValue,
      statusLabel: this.errorMessageValue || STATUS_LABELS[this.stateValue],
      errorMessage: this.errorMessageValue,
      objectUrl: this.objectUrl,
      fileName: this.fileName,
      blobSize: this.blob?.size ?? 0,
      finalScore: this.finalStats?.score,
      finalLobsters: this.finalStats?.lobsters
    };
  }

  setAudioContext(audioContext: AudioContext) {
    if (this.audioContext === audioContext && this.audioDestination) {
      return;
    }

    this.audioContext = audioContext;
    this.audioDestination = audioContext.createMediaStreamDestination();
  }

  getActiveAudioDestination() {
    if (this.stateValue !== 'recording' && this.stateValue !== 'finalizing') {
      return undefined;
    }

    return this.audioDestination;
  }

  arm() {
    if (!this.supported || this.stateValue === 'recording' || this.stateValue === 'finalizing') {
      return;
    }

    this.setState('armed');
  }

  disarm() {
    if (this.stateValue === 'armed') {
      this.setState(this.objectUrl ? 'ready' : 'idle');
    }
  }

  start(canvas: HTMLCanvasElement) {
    if (!this.supported) {
      this.setError('MP4 recording is not supported in this browser.');
      return false;
    }

    if (this.stateValue === 'recording' || this.stateValue === 'finalizing') {
      return false;
    }

    try {
      this.revokeRecording();
      this.clearRecorder();
      this.errorMessageValue = '';
      this.finalStats = undefined;
      this.chunks = [];

      if (!('captureStream' in canvas)) {
        this.setError('Canvas recording is not supported in this browser.');
        return false;
      }

      this.startCanvasCapture(canvas);
      const canvasStream = this.canvasStream;
      if (!canvasStream) {
        this.setError('Canvas recording failed to create a video stream.');
        return false;
      }

      const tracks = [...canvasStream.getVideoTracks()];
      this.startAudioKeepAlive();
      const audioTrack = this.audioDestination?.stream.getAudioTracks()[0];

      if (audioTrack) {
        tracks.push(audioTrack);
      }

      this.combinedStream = new MediaStream(tracks);
      this.mediaRecorder = new MediaRecorder(this.combinedStream, {
        mimeType: this.mimeTypeValue,
        audioBitsPerSecond: 96000,
        videoBitsPerSecond: this.videoBitsPerSecond
      });

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      });

      this.mediaRecorder.addEventListener('stop', () => this.completeRecording());
      this.mediaRecorder.addEventListener('error', () => this.setError('Recording failed while encoding the run.'));
      this.mediaRecorder.start(1000);
      this.setState('recording');
      return true;
    } catch (error) {
      this.setError(error instanceof Error ? error.message : 'Recording failed to start.');
      return false;
    }
  }

  finish(stats: Omit<RunRecordingStats, 'timestamp'>, delayMs = 650) {
    if (this.stateValue !== 'recording') {
      return;
    }

    this.finalStats = {
      score: stats.score,
      lobsters: stats.lobsters,
      timestamp: new Date()
    };
    this.setState('finalizing');

    window.clearTimeout(this.finalizeTimer);
    this.finalizeTimer = window.setTimeout(() => this.stop(), delayMs);
  }

  save() {
    if (!this.objectUrl || !this.fileName) {
      return false;
    }

    const link = document.createElement('a');
    link.href = this.objectUrl;
    link.download = this.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  dispose() {
    window.clearTimeout(this.finalizeTimer);
    this.clearRecorder();
    this.revokeRecording();
  }

  private stop() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.completeRecording();
      return;
    }

    this.mediaRecorder.stop();
  }

  private completeRecording() {
    window.clearTimeout(this.finalizeTimer);

    if (!this.chunks.length) {
      this.clearRecorder();
      this.setError('Recording produced no video data.');
      return;
    }

    this.blob = new Blob(this.chunks, { type: this.mimeTypeValue });
    this.objectUrl = URL.createObjectURL(this.blob);
    this.fileName = this.buildFileName();
    this.clearRecorder();
    this.setState('ready');
  }

  private clearRecorder() {
    this.stopAudioKeepAlive();
    this.canvasStream?.getVideoTracks().forEach((track) => track.stop());
    this.canvasStream = undefined;
    this.combinedStream = undefined;
    this.mediaRecorder = undefined;
    this.chunks = [];
  }

  private revokeRecording() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }

    this.objectUrl = undefined;
    this.blob = undefined;
    this.fileName = undefined;
  }

  private setError(message: string) {
    this.errorMessageValue = message;
    this.clearRecorder();
    this.setState(this.supported ? 'error' : 'unsupported');
  }

  private setState(state: RunRecorderState) {
    this.stateValue = state;
    this.onChange?.(this.snapshot);
  }

  private resolveMimeType() {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

    if (typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) {
      return '';
    }

    return MP4_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
  }

  private startCanvasCapture(canvas: HTMLCanvasElement) {
    this.canvasStream = canvas.captureStream(this.targetFps);
  }

  private startAudioKeepAlive() {
    if (!this.audioContext || !this.audioDestination) {
      return;
    }

    this.stopAudioKeepAlive();
    this.audioKeepAliveSource = this.audioContext.createOscillator();
    this.audioKeepAliveGain = this.audioContext.createGain();
    this.audioKeepAliveSource.type = 'sine';
    this.audioKeepAliveSource.frequency.setValueAtTime(22, this.audioContext.currentTime);
    this.audioKeepAliveGain.gain.setValueAtTime(0.00008, this.audioContext.currentTime);
    this.audioKeepAliveSource.connect(this.audioKeepAliveGain);
    this.audioKeepAliveGain.connect(this.audioDestination);
    this.audioKeepAliveSource.start();
  }

  private stopAudioKeepAlive() {
    try {
      this.audioKeepAliveSource?.stop();
    } catch {
      // The source may already have been stopped by the recorder lifecycle.
    }

    this.audioKeepAliveSource?.disconnect();
    this.audioKeepAliveGain?.disconnect();
    this.audioKeepAliveSource = undefined;
    this.audioKeepAliveGain = undefined;
  }

  private buildFileName() {
    const score = this.finalStats?.score ?? 0;
    const lobsters = this.finalStats?.lobsters ?? 0;
    const timestamp = (this.finalStats?.timestamp ?? new Date())
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '-')
      .replace('Z', '');

    return `hermes-godspeed-score-${score}-lobsters-${lobsters}-${timestamp}.mp4`;
  }
}
