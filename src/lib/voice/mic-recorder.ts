import { SPEECH_RMS_THRESHOLD } from '@/core/capture/voice/energy-gate';
import { concat } from './concat';
import { openStream } from './open-stream';

export const TARGET_SAMPLE_RATE = 16000;
export const PCM_WORKLET_NAME = 'pcm-processor';

const ANALYSER_FFT_SIZE = 2048;
const LEVEL_FLOOR_DB = -60;
const LEVEL_SMOOTHING = 0.6;
const MS_PER_S = 1000;

export interface MicRecorderEvents {
  onEpoch(audioEpochMs: number): void;
  onLevel(level: number, speaking: boolean): void;
  onStreamEnded(): void;
}

export interface MicStreamInfo {
  deviceId: string | null;
  usedFallbackDevice: boolean;
}

export interface MicRecording {
  pcm: Int16Array;
  sampleRate: number;
  audioEpochMs: number | null;
  durationSeconds: number;
}

export class MicRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserFrame: Float32Array<ArrayBuffer> | null = null;
  private chunks: Int16Array[] = [];
  private samples = 0;
  private epochMs: number | null = null;
  private rate = TARGET_SAMPLE_RATE;
  private level = 0;
  private active = false;

  constructor(
    private readonly workletUrl: string,
    private readonly events: MicRecorderEvents,
  ) {}

  get recording(): boolean {
    return this.active;
  }

  get audioEpochMs(): number | null {
    return this.epochMs;
  }

  get sampleRate(): number {
    return this.rate;
  }

  get sampleCount(): number {
    return this.samples;
  }

  get durationSeconds(): number {
    return this.samples / this.rate;
  }

  async start(deviceId?: string): Promise<MicStreamInfo> {
    if (this.active) throw new Error('Microphone capture is already running');

    const { stream, usedFallbackDevice } = await openStream(deviceId);
    this.stream = stream;

    const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    this.context = context;
    this.rate = context.sampleRate;
    await context.audioWorklet.addModule(this.workletUrl);
    if (context.state === 'suspended') await context.resume();

    this.source = context.createMediaStreamSource(stream);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = ANALYSER_FFT_SIZE;
    this.analyserFrame = new Float32Array(this.analyser.fftSize);
    this.worklet = new AudioWorkletNode(context, PCM_WORKLET_NAME);
    this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => this.appendFrame(event.data);

    this.source.connect(this.analyser);
    this.analyser.connect(this.worklet);
    this.worklet.connect(context.destination);

    for (const track of stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        if (this.active) this.events.onStreamEnded();
      });
    }

    this.active = true;
    return { deviceId: stream.getAudioTracks()[0]?.getSettings().deviceId ?? null, usedFallbackDevice };
  }

  snapshot(): MicRecording {
    return {
      pcm: concat(this.chunks, this.samples),
      sampleRate: this.rate,
      audioEpochMs: this.epochMs,
      durationSeconds: this.durationSeconds,
    };
  }

  stop(): MicRecording {
    const recording = this.snapshot();
    this.release();
    return recording;
  }

  release(): void {
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.disconnect();
    }
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close().catch(() => undefined);
    for (const track of this.stream?.getTracks() ?? []) track.stop();

    this.worklet = null;
    this.source = null;
    this.analyser = null;
    this.analyserFrame = null;
    this.context = null;
    this.stream = null;
    this.chunks = [];
    this.samples = 0;
    this.epochMs = null;
    this.level = 0;
    this.active = false;
  }

  private appendFrame(buffer: ArrayBuffer): void {
    const frame = new Int16Array(buffer);
    if (this.epochMs === null) {
      this.epochMs = Date.now() - Math.round((frame.length / this.rate) * MS_PER_S);
      this.events.onEpoch(this.epochMs);
    }
    this.chunks.push(frame);
    this.samples += frame.length;
    this.emitLevel();
  }

  private emitLevel(): void {
    if (!this.analyser || !this.analyserFrame) return;
    this.analyser.getFloatTimeDomainData(this.analyserFrame);

    let sum = 0;
    for (const sample of this.analyserFrame) sum += sample * sample;
    const rms = Math.sqrt(sum / this.analyserFrame.length);

    const db = rms > 0 ? 20 * Math.log10(rms) : LEVEL_FLOOR_DB;
    const normalised = Math.min(1, Math.max(0, (db - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB));
    this.level = this.level * LEVEL_SMOOTHING + normalised * (1 - LEVEL_SMOOTHING);
    this.events.onLevel(this.level, rms > SPEECH_RMS_THRESHOLD);
  }
}
