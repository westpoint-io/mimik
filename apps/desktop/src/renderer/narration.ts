import { queueDescription } from '@mimik/core/capture/ai/description-queue';
import { hasVoiceApiKey, VOICE_KEY_SETTINGS } from '@mimik/core/capture/voice/api-key';
import { MicRecorder } from '@mimik/core/capture/voice/mic-recorder';
import { narrateRecording, type VoiceRecording } from '@mimik/core/capture/voice/narrate-recording';
import { narrationUpdates } from '@mimik/core/capture/voice/narration-updates';
import { partialRecording } from '@mimik/core/capture/voice/partial-recording';
import { readTranscriptionSettings } from '@mimik/core/capture/voice/read-transcription-settings';
import type { StepMark } from '@mimik/core/capture/voice/step-windows';
import { usableRecording } from '@mimik/core/capture/voice/usable-recording';
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
const REFUSED = ['NotAllowedError', 'SecurityError'];

type Describe = () => Promise<void>;

export class DesktopNarration {
  private live: Promise<MicRecorder | null> | null = null;
  private mic: MicRecorder | null = null;
  private guideId: string | null = null;
  private flushedUpTo = 0;
  private readonly pending = new Set<Promise<void>>();
  private readonly deferred = new Map<string, { guideId: string; describe: Describe | null }>();

  async wanted(): Promise<boolean> {
    const stored = await localStorage.get([...VOICE_KEY_SETTINGS, 'voiceEnabled']);
    return stored.voiceEnabled === true && hasVoiceApiKey(stored);
  }

  get capturing(): boolean {
    return this.mic !== null;
  }

  listen(guideId: string): void {
    this.guideId = guideId;
    this.live ??= this.open();
  }

  step(guideId: string, mark: StepMark, describe: Describe | null): void {
    this.deferred.set(mark.stepId, { guideId, describe });
    const mic = this.mic;
    this.track(async () => {
      const full = mic && usableRecording(mic.snapshot());
      const closesAt = full ? (mark.timestamp - full.audioEpochMs) / 1000 : 0;
      const slice = full && closesAt > this.flushedUpTo ? partialRecording(full, this.flushedUpTo, closesAt) : null;
      if (!slice) {
        this.describeNow(mark.stepId);
        return;
      }
      this.flushedUpTo = closesAt;
      const narrated = await this.transcribe(guideId, slice, [mark]);
      if (!narrated.includes(mark.stepId)) this.describeNow(mark.stepId);
    });
  }

  cut(): void {
    const opening = this.live;
    const guideId = this.guideId;
    const from = this.flushedUpTo;
    this.live = null;
    this.mic = null;
    this.flushedUpTo = 0;
    window.mimik.capture.narration(null);
    if (!opening || !guideId) return;
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
      for (const [stepId, entry] of [...this.deferred]) {
        if (entry.guideId === guideId) this.describeNow(stepId);
      }
    });
  }

  abort(): void {
    const opening = this.live;
    this.live = null;
    this.mic = null;
    this.flushedUpTo = 0;
    this.deferred.clear();
    window.mimik.capture.narration(null);
    void opening?.then((mic) => {
      mic?.release();
      window.mimik.capture.narration(null);
    });
  }

  async finish(): Promise<void> {
    this.cut();
    await Promise.race([Promise.all(this.pending), new Promise((resolve) => setTimeout(resolve, SETTLE_MS))]);
  }

  private track(work: () => Promise<void>): void {
    const running = work()
      .catch((error) => logger.error('voice: narration could not be applied', error))
      .finally(() => this.pending.delete(running));
    this.pending.add(running);
  }

  private describeNow(stepId: string): void {
    const entry = this.deferred.get(stepId);
    if (!entry) return;
    this.deferred.delete(stepId);
    if (entry.describe) {
      queueDescription(entry.guideId, entry.describe);
      return;
    }
    void clearStepAiPending(stepId).then(() => window.mimik.capture.described(stepId, null, null));
  }

  private async open(): Promise<MicRecorder | null> {
    if (!(await this.wanted())) return null;
    const { voiceMicrophoneId } = await localStorage.get(['voiceMicrophoneId']);
    const mic = new MicRecorder(assetUrl('pcm-processor.js'), {
      onEpoch: () => undefined,
      onLevel: (level, speaking) => window.mimik.capture.narration({ level, speaking }),
      onStreamEnded: () => this.cut(),
    });
    try {
      await mic.start(voiceMicrophoneId || undefined);
      if (!this.live) {
        mic.release();
        return null;
      }
      this.mic = mic;
      window.mimik.capture.narration({ level: 0, speaking: false });
      return mic;
    } catch (error) {
      mic.release();
      logger.warn('voice: narration could not start, recording without it', error);
      if (error instanceof Error && REFUSED.includes(error.name)) await localStorage.set({ voiceEnabled: false });
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
    for (const { stepId, description } of updates) {
      this.deferred.delete(stepId);
      window.mimik.capture.described(stepId, description, null, 'narration');
    }
    return updates.map((update) => update.stepId);
  }
}
