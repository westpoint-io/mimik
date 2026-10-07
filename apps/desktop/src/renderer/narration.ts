import { queueDescription } from '@mimik/core/capture/ai/description-queue';
import { hasVoiceApiKey, VOICE_KEY_SETTINGS } from '@mimik/core/capture/voice/api-key';
import { MicRecorder } from '@mimik/core/capture/voice/mic-recorder';
import { narrateRecording, type VoiceRecording } from '@mimik/core/capture/voice/narrate-recording';
import { narrationUpdates } from '@mimik/core/capture/voice/narration-updates';
import { partialRecording } from '@mimik/core/capture/voice/partial-recording';
import { readTranscriptionSettings } from '@mimik/core/capture/voice/read-transcription-settings';
import { startFailureReason } from '@mimik/core/capture/voice/start-failure-reason';
import type { StepMark } from '@mimik/core/capture/voice/step-windows';
import { usableRecording } from '@mimik/core/capture/voice/usable-recording';
import type { VoiceUpdate } from '@mimik/core/capture/voice/voice-update';
import { assetUrl, localStorage } from '@mimik/core/env';
import {
  applyNarrationToSteps,
  clearStepAiPending,
  findExistingStepIds,
  getStepsForGuide,
  saveTranscript,
} from '@mimik/core/guides/service';
import { logger } from '@mimik/core/logger';

const SETTLE_MS = 30_000;

type Describe = () => Promise<void>;

export class DesktopNarration {
  private live: Promise<MicRecorder | null> | null = null;
  private mic: MicRecorder | null = null;
  private guideId: string | null = null;
  private flushedUpTo = 0;
  private narrated = 0;
  private lost = false;
  private current: VoiceUpdate = { phase: 'idle' };
  private readonly listeners = new Set<(update: VoiceUpdate) => void>();
  private readonly pending = new Set<Promise<void>>();
  private readonly deferredDescriptions = new Map<string, { guideId: string; describe: Describe | null }>();

  get update(): VoiceUpdate {
    return this.current;
  }

  onUpdate(listener: (update: VoiceUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(guideId: string): void {
    if (this.guideId !== guideId) this.narrated = 0;
    this.guideId = guideId;
    this.live ??= this.open();
  }

  flushForStep(guideId: string, mark: StepMark, describe: Describe | null): void {
    this.deferredDescriptions.set(mark.stepId, { guideId, describe });
    const mic = this.mic;
    this.track(async () => {
      const full = mic && usableRecording(mic.snapshot());
      const closesAt = full ? (mark.timestamp - full.audioEpochMs) / 1000 : 0;
      const slice = full && closesAt > this.flushedUpTo ? partialRecording(full, this.flushedUpTo, closesAt) : null;
      if (!slice) {
        this.describeStepNow(mark.stepId);
        return;
      }
      this.flushedUpTo = closesAt;
      const narrated = await this.transcribe(guideId, slice, [mark]);
      if (!narrated.includes(mark.stepId)) this.describeStepNow(mark.stepId);
    });
  }

  stop(): void {
    const opening = this.live;
    const guideId = this.guideId;
    const from = this.flushedUpTo;
    this.live = null;
    this.mic = null;
    this.flushedUpTo = 0;
    window.mimik.capture.narration(null);
    if (!opening || !guideId) return;
    if (this.current.phase === 'recording') this.report({ phase: 'transcribing' });
    const inflight = [...this.pending];
    this.track(async () => {
      const mic = await opening;
      const audio = mic && usableRecording(mic.stop());
      window.mimik.capture.narration(null);
      await Promise.all(inflight);
      const tail = audio && from > 0 ? partialRecording(audio, from, audio.durationSeconds) : audio;
      const steps = await getStepsForGuide(guideId);
      if (tail && steps.length > 0) {
        await this.transcribe(
          guideId,
          tail,
          steps.map((step) => ({ stepId: step.id, timestamp: step.timestamp })),
        );
      }
      this.describeDeferred(guideId);
      this.settled();
    });
  }

  abort(): void {
    const opening = this.live;
    const guideId = this.guideId;
    this.live = null;
    this.mic = null;
    this.flushedUpTo = 0;
    window.mimik.capture.narration(null);
    void opening?.then((mic) => {
      mic?.release();
      window.mimik.capture.narration(null);
    });
    if (guideId) this.describeDeferred(guideId);
    if (this.current.phase === 'recording') this.report({ phase: 'idle' });
  }

  async settle(): Promise<void> {
    this.stop();
    await Promise.race([Promise.all(this.pending), new Promise((resolve) => setTimeout(resolve, SETTLE_MS))]);
  }

  private report(update: VoiceUpdate): void {
    this.current = update;
    if (update.phase === 'error') window.mimik.capture.narration({ level: 0, speaking: false, reason: update.reason });
    for (const listener of this.listeners) listener(update);
  }

  private settled(): void {
    if (this.live || this.pending.size > 1) return;
    if (this.lost) {
      this.lost = false;
      this.report({ phase: 'error', reason: 'stream-ended' });
      return;
    }
    if (this.current.phase === 'transcribing') this.report({ phase: 'idle', narrated: this.narrated });
  }

  private describeDeferred(guideId: string): void {
    for (const [stepId, entry] of [...this.deferredDescriptions]) {
      if (entry.guideId === guideId) this.describeStepNow(stepId);
    }
  }

  private track(work: () => Promise<void>): void {
    const running = work()
      .catch((error) => logger.error('voice: narration could not be applied', error))
      .finally(() => this.pending.delete(running));
    this.pending.add(running);
  }

  private describeStepNow(stepId: string): void {
    const entry = this.deferredDescriptions.get(stepId);
    if (!entry) return;
    this.deferredDescriptions.delete(stepId);
    if (entry.describe) {
      queueDescription(entry.guideId, entry.describe);
      return;
    }
    void clearStepAiPending(stepId).then(() => window.mimik.capture.described(stepId, null, null));
  }

  private async open(): Promise<MicRecorder | null> {
    const stored = await localStorage.get([...VOICE_KEY_SETTINGS, 'voiceEnabled', 'voiceMicrophoneId']);
    if (stored.voiceEnabled !== true) return null;
    if (!hasVoiceApiKey(stored)) {
      this.report({ phase: 'error', reason: 'missing-api-key' });
      return null;
    }
    const mic = new MicRecorder(assetUrl('pcm-processor.js'), {
      onEpoch: () => undefined,
      onLevel: (level, speaking) => window.mimik.capture.narration({ level, speaking }),
      onStreamEnded: () => {
        this.lost = true;
        this.stop();
      },
    });
    try {
      await mic.start(stored.voiceMicrophoneId || undefined);
      if (!this.live) {
        mic.release();
        return null;
      }
      this.mic = mic;
      this.report({ phase: 'recording' });
      window.mimik.capture.narration({ level: 0, speaking: false });
      return mic;
    } catch (error) {
      mic.release();
      logger.warn('voice: narration could not start, recording without it', error);
      const reason = startFailureReason(error);
      this.report({ phase: 'error', reason });
      if (reason === 'permission-denied') await localStorage.set({ voiceEnabled: false });
      return null;
    }
  }

  private async transcribe(guideId: string, audio: VoiceRecording, marks: StepMark[]): Promise<string[]> {
    const settings = await readTranscriptionSettings();
    if (!settings.apiKey) return [];
    const result = await narrateRecording(audio, marks, settings);
    await saveTranscript(guideId, result.transcript);
    const surviving = await findExistingStepIds(result.descriptions.map((entry) => entry.stepId));
    const updates = narrationUpdates(result, surviving);
    await applyNarrationToSteps(updates, result.transcript.epochMs);
    this.narrated += updates.length;
    for (const { stepId, description } of updates) {
      this.deferredDescriptions.delete(stepId);
      window.mimik.capture.described(stepId, description, null, 'narration');
    }
    return updates.map((update) => update.stepId);
  }
}
