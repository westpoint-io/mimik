import { applyNarrationResult } from '@mimik/core/capture/voice/apply-narration-result';
import { deferDescription } from '@mimik/core/capture/voice/deferred-descriptions';
import { describeStepNow, describeUnnarratedSteps } from '@mimik/core/capture/voice/describe-unnarrated';
import { MicRecorder } from '@mimik/core/capture/voice/mic-recorder';
import { narrateRecording, type VoiceRecording } from '@mimik/core/capture/voice/narrate-recording';
import { NARRATION_SETTLE_MS } from '@mimik/core/capture/voice/narration-settle-ms';
import { partialRecording } from '@mimik/core/capture/voice/partial-recording';
import { readTranscriptionSettings } from '@mimik/core/capture/voice/read-transcription-settings';
import { readVoiceSettings } from '@mimik/core/capture/voice/read-voice-settings';
import { startFailureReason } from '@mimik/core/capture/voice/start-failure-reason';
import type { StepMark } from '@mimik/core/capture/voice/step-windows';
import { usableRecording } from '@mimik/core/capture/voice/usable-recording';
import type { VoiceUpdate } from '@mimik/core/capture/voice/voice-update';
import type { Describe } from '@mimik/core/capture/write-step';
import { assetUrl, localStorage } from '@mimik/core/env';
import { clearStepAiPending, getStepsForGuide } from '@mimik/core/guides/service';
import { logger } from '@mimik/core/logger';

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
    deferDescription(guideId, mark.stepId, describe ?? (() => this.undescribed(mark.stepId)));
    const mic = this.mic;
    this.track(async () => {
      const full = mic && usableRecording(mic.snapshot());
      const closesAt = full ? (mark.timestamp - full.audioEpochMs) / 1000 : 0;
      const slice = full && closesAt > this.flushedUpTo ? partialRecording(full, this.flushedUpTo, closesAt) : null;
      if (!slice) {
        describeStepNow(guideId, mark.stepId);
        return;
      }
      this.flushedUpTo = closesAt;
      const narrated = await this.transcribe(guideId, slice, [mark]);
      if (!narrated.includes(mark.stepId)) describeStepNow(guideId, mark.stepId);
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
      describeUnnarratedSteps(guideId, []);
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
    if (guideId) describeUnnarratedSteps(guideId, []);
    if (this.current.phase === 'recording') this.report({ phase: 'idle' });
  }

  async settle(): Promise<void> {
    this.stop();
    await Promise.race([Promise.all(this.pending), new Promise((resolve) => setTimeout(resolve, NARRATION_SETTLE_MS))]);
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

  private async undescribed(stepId: string): Promise<void> {
    await clearStepAiPending(stepId);
    window.mimik.capture.described(stepId, null, null);
  }

  private track(work: () => Promise<void>): void {
    const running = work()
      .catch((error) => logger.error('voice: narration could not be applied', error))
      .finally(() => this.pending.delete(running));
    this.pending.add(running);
  }

  private async open(): Promise<MicRecorder | null> {
    const voice = await readVoiceSettings();
    if (!voice.enabled) return null;
    if (!voice.hasApiKey) {
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
      await mic.start(voice.microphoneId);
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
    const updates = await applyNarrationResult(guideId, await narrateRecording(audio, marks, settings));
    this.narrated += updates.length;
    for (const { stepId, description } of updates) {
      window.mimik.capture.described(stepId, description, null, 'narration');
    }
    return updates.map((update) => update.stepId);
  }
}
