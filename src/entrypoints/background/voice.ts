import { logger } from '@mimik/core/logger';
import { CaptureState } from '@/core/capture/machine';
import { hasVoiceApiKey, VOICE_KEY_SETTINGS } from '@/core/capture/voice/api-key';
import { narrationUpdates } from '@/core/capture/voice/narration-updates';
import { applyNarrationToSteps, findExistingStepIds, getStepsForGuide } from '@/core/guides/service';
import { localStorage, onMessage as onRuntimeMessage } from '@/lib/browser-api';
import {
  closeVoiceHost,
  closeVoiceHostIfIdle,
  ensureVoiceHost,
  flushVoiceCapture,
  hasVoiceHost,
  openMicPermissionPage,
  queryMicPermission,
  registerVoicePanelRelay,
  startVoiceCapture,
  stopVoiceCapture,
  supportsVoice,
} from '@/lib/offscreen';
import type { VoicePhase } from '@/lib/port';
import { broadcastVoiceToPanel, type PanelVoiceUpdate } from '@/lib/port';
import {
  isVoiceMessageFor,
  VOICE_BACKGROUND_TARGET,
  type VoiceErrorEvent,
  type VoiceEvent,
  type VoiceHandoffEvent,
  VoiceMessage,
  type VoicePermissionResultEvent,
  type VoiceResultEvent,
  type VoiceStepMark,
} from '@/lib/voice-messages';
import { narrateRecording, readTranscriptionSettings, type VoiceRecording } from '@/lib/voice-narration';
import { handedOffPcm, voiceStopAction } from '@/lib/voice-recovery';
import { discardDeferred } from './deferred-descriptions';
import { describeStepNow, describeUnnarratedSteps } from './describe-unnarrated';

const START_TIMEOUT_MS = 8000;

let resumeNarration: (() => Promise<unknown>) | null = null;

const narratedSteps = new Map<string, Set<string>>();

export function recordNarrated(guideId: string, stepIds: readonly string[]): void {
  const seen = narratedSteps.get(guideId) ?? new Set<string>();
  for (const stepId of stepIds) seen.add(stepId);
  narratedSteps.set(guideId, seen);
}

export function takeNarrated(guideId: string): string[] {
  const seen = narratedSteps.get(guideId);
  narratedSteps.delete(guideId);
  return seen ? [...seen] : [];
}

let phase: PanelVoiceUpdate = { type: 'VOICE_UPDATE', phase: 'idle' };

export function getVoiceUpdate(): PanelVoiceUpdate {
  return phase;
}

function report(update: Omit<PanelVoiceUpdate, 'type'>): void {
  phase = { type: 'VOICE_UPDATE', ...update };
  broadcastVoiceToPanel(phase);
}

function withTimeout(work: Promise<void>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      logger.warn('voice: giving up waiting for the microphone');
      resolve();
    }, ms);
    const settle = () => {
      clearTimeout(timer);
      resolve();
    };
    work.then(settle, settle);
  });
}

async function readVoiceSettings(): Promise<{ enabled: boolean; hasApiKey: boolean; microphoneId?: string }> {
  const stored = await localStorage.get([...VOICE_KEY_SETTINGS, 'voiceEnabled', 'voiceMicrophoneId']);
  const microphoneId = typeof stored.voiceMicrophoneId === 'string' ? stored.voiceMicrophoneId.trim() : '';
  return {
    enabled: stored.voiceEnabled === true,
    hasApiKey: hasVoiceApiKey(stored),
    microphoneId: microphoneId || undefined,
  };
}

let orphanAudio: VoiceRecording | null = null;
let transcribingGuideId: string | null = null;
let settleNarration: (() => void) | null = null;
let narrationSettled: Promise<void> | null = null;

const NARRATION_SETTLE_TIMEOUT_MS = 30000;

export function whenNarrationSettled(): Promise<void> {
  if (!narrationSettled) return Promise.resolve();
  return Promise.race([
    narrationSettled,
    new Promise<void>((resolve) => setTimeout(resolve, NARRATION_SETTLE_TIMEOUT_MS)),
  ]);
}

function markNarrationPending(): void {
  narrationSettled = new Promise<void>((resolve) => {
    settleNarration = resolve;
  });
}

function markNarrationSettled(): void {
  settleNarration?.();
  settleNarration = null;
  narrationSettled = null;
}

function requestMicPermission(tabId?: number): void {
  void openMicPermissionPage(tabId).catch((error) => logger.error('voice: mic permission page failed to open', error));
}

async function beginVoiceCapture(microphoneId: string | undefined, tabId: number | undefined): Promise<void> {
  if (!(await ensureVoiceHost())) {
    report({ phase: 'error', reason: 'unsupported', error: 'The offscreen document could not be created' });
    return;
  }

  const permission = await queryMicPermission().catch(() => ({ state: 'unknown' as const }));
  if (permission.state === 'denied' || permission.state === 'prompt') {
    logger.info('voice: microphone permission not granted yet', permission.state);
    report({ phase: 'error', reason: 'permission-denied', error: 'Microphone access has not been granted' });
    requestMicPermission(tabId);
    await closeVoiceHostIfIdle();
    return;
  }

  const started = await startVoiceCapture(microphoneId);
  if (started.started) {
    logger.info('voice: narration recording started', started);
    report({ phase: 'recording' });
    return;
  }

  logger.warn('voice: narration unavailable, recording without it', started);
  report({ phase: 'error', reason: started.reason, error: started.error });
  if (started.reason === 'permission-denied') requestMicPermission(tabId);
  await closeVoiceHost();
}

export function canStartNarrationNow(captureState: string, voicePhase: VoicePhase): boolean {
  return captureState === CaptureState.RECORDING && voicePhase !== 'recording' && voicePhase !== 'transcribing';
}

export type PermissionOutcome = 'start' | 'report-denied' | 'ignore';

export function permissionOutcome(state: 'granted' | 'denied', voicePhase: VoicePhase): PermissionOutcome {
  if (voicePhase === 'recording' || voicePhase === 'transcribing') return 'ignore';
  return state === 'granted' ? 'start' : 'report-denied';
}

export async function startVoiceNarration(tabId?: number): Promise<void> {
  if (!supportsVoice()) {
    logger.warn('voice: no microphone host available in this browser, recording without narration');
    return;
  }
  try {
    const { enabled, hasApiKey, microphoneId } = await readVoiceSettings();
    if (!enabled) {
      logger.info('voice: narration is turned off, recording without it');
      return;
    }
    if (!hasApiKey) {
      logger.warn('voice: no transcription API key, recording without narration');
      report({ phase: 'error', reason: 'missing-api-key', error: 'No transcription API key is configured' });
      return;
    }
    await withTimeout(beginVoiceCapture(microphoneId, tabId), START_TIMEOUT_MS);
  } catch (error) {
    logger.error('voice: narration could not be started', error);
    report({ phase: 'error', reason: 'unknown', error: String(error) });
  }
}

function stepMarks(steps: Array<{ id: string; timestamp: number }>): VoiceStepMark[] {
  return steps.map((step) => ({ stepId: step.id, timestamp: step.timestamp }));
}

async function recoverNarration(guideId: string): Promise<void> {
  const audio = orphanAudio;
  orphanAudio = null;
  if (!audio || import.meta.env.BROWSER !== 'firefox') return;

  const settings = await readTranscriptionSettings();
  if (!settings.apiKey) {
    report({ phase: 'error', reason: 'missing-api-key', error: 'No transcription API key is configured' });
    return;
  }

  logger.warn('voice: transcribing narration captured before the microphone host went away');
  transcribingGuideId = guideId;
  report({ phase: 'transcribing' });
  const steps = await getStepsForGuide(guideId);
  const result = await narrateRecording(audio, stepMarks(steps), settings);
  await applyNarration(guideId, result);
}

export async function flushNarrationForStep(guideId: string, stepId: string, timestamp: number): Promise<void> {
  if (phase.phase !== 'recording') return;
  try {
    const settings = await readTranscriptionSettings();
    if (!settings.apiKey) return;
    const response = await flushVoiceCapture(guideId, { stepId, timestamp }, settings);
    if (!response.ok) {
      logger.warn('voice: could not narrate the step yet', response);
      describeStepNow(guideId, stepId);
      return;
    }
    if (!response.flushed) describeStepNow(guideId, stepId);
  } catch (error) {
    logger.warn('voice: narrating the step while recording failed', error);
    describeStepNow(guideId, stepId);
  }
}

export async function stopVoiceNarration(guideId: string): Promise<void> {
  if (!supportsVoice()) return;
  try {
    const action = voiceStopAction({
      hostAlive: await hasVoiceHost(),
      hasOrphanAudio: orphanAudio !== null,
      wasRecording: phase.phase === 'recording',
    });

    if (action === 'skip') return;
    if (action === 'recover') {
      await recoverNarration(guideId);
      return;
    }
    if (action === 'report-lost') {
      report({ phase: 'error', reason: 'stream-ended', error: 'The microphone stopped before recording ended' });
      return;
    }

    const steps = await getStepsForGuide(guideId);
    const settings = await readTranscriptionSettings();
    const response = await stopVoiceCapture(guideId, stepMarks(steps), settings);

    if (response.ok) {
      logger.info('voice: transcribing narration', response);
      transcribingGuideId = guideId;
      markNarrationPending();
      if (phase.phase === 'recording') report({ phase: 'transcribing' });
      return;
    }

    logger.warn('voice: no narration to apply', response);
    report({ phase: 'error', reason: response.reason, error: response.error });
    await closeVoiceHostIfIdle();
  } catch (error) {
    logger.error('voice: narration could not be stopped', error);
    report({ phase: 'error', reason: 'unknown', error: String(error) });
    await closeVoiceHostIfIdle();
  }
}

async function applyNarration(guideId: string, result: VoiceResultEvent['result']): Promise<void> {
  const final = transcribingGuideId === guideId;
  try {
    if (final) transcribingGuideId = null;
    const narrated = result.descriptions.map((entry) => entry.stepId);
    const surviving = await findExistingStepIds(narrated);
    const updates = narrationUpdates(result, surviving);
    await applyNarrationToSteps(updates);
    const narratedIds = updates.map((update) => update.stepId);
    discardDeferred(guideId, narratedIds);
    recordNarrated(guideId, narratedIds);
    logger.info('voice: narration applied', {
      narrated: updates.length,
      of: narrated.length,
      final,
      stats: result.stats,
    });
    if (final) {
      const narratedSoFar = takeNarrated(guideId);
      report({ phase: 'idle', narrated: narratedSoFar.length });
      describeUnnarratedSteps(guideId, narratedSoFar);
    }
  } catch (error) {
    logger.error('voice: narration could not be applied', error);
    if (final) report({ phase: 'error', reason: 'unknown', error: String(error) });
  } finally {
    if (final) {
      markNarrationSettled();
      await closeVoiceHostIfIdle();
    }
  }
}

function handleVoiceError(event: VoiceErrorEvent): void {
  logger.warn('voice: microphone reported an error', event.reason, event.error);
  report({ phase: 'error', reason: event.reason, error: event.error });
}

function handleVoiceHandoff(event: VoiceHandoffEvent): void {
  const pcm = handedOffPcm(event.pcm);
  if (!pcm) {
    logger.error('voice: handed-off audio did not survive the message boundary', typeof event.pcm);
    return;
  }

  orphanAudio = {
    pcm,
    sampleRate: event.sampleRate,
    audioEpochMs: event.audioEpochMs,
    durationSeconds: event.durationSeconds,
  };
  logger.warn('voice: microphone host handed off captured audio', {
    samples: pcm.length,
    durationSeconds: event.durationSeconds,
  });
  if (transcribingGuideId) void recoverNarration(transcribingGuideId);
}

function handlePermissionResult(event: VoicePermissionResultEvent): void {
  logger.info('voice: microphone permission', event.state);
  const outcome = permissionOutcome(event.state, phase.phase);
  if (outcome === 'ignore') return;
  if (outcome === 'report-denied') {
    report({ phase: 'error', reason: 'permission-denied', error: 'Microphone access was refused' });
    return;
  }
  if (phase.phase === 'error') report({ phase: 'idle' });
  void resumeNarration?.();
}

export function registerVoiceListeners(onMicrophoneGranted?: () => Promise<unknown>): void {
  if (!supportsVoice()) return;

  resumeNarration = onMicrophoneGranted ?? null;
  registerVoicePanelRelay();

  onRuntimeMessage((message) => {
    if (!isVoiceMessageFor(VOICE_BACKGROUND_TARGET, message)) return undefined;
    const event = message as VoiceEvent;

    switch (event.type) {
      case VoiceMessage.VOICE_RESULT:
        void applyNarration(event.guideId, event.result);
        return undefined;
      case VoiceMessage.VOICE_HANDOFF:
        handleVoiceHandoff(event);
        return undefined;
      case VoiceMessage.VOICE_ERROR:
        handleVoiceError(event);
        return undefined;
      case VoiceMessage.VOICE_PERMISSION_RESULT:
        handlePermissionResult(event);
        return undefined;
      case VoiceMessage.VOICE_EPOCH:
        logger.debug('voice: audio epoch', event.audioEpochMs);
        return undefined;
      default:
        return undefined;
    }
  });
}
