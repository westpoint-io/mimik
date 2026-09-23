import { logger } from '@mimik/core/logger';
import { partialRecording } from '@/core/capture/voice/partial-recording';
import type { NarrationResult } from '@/core/capture/voice/types';
import { getExtensionURL, onMessage, sendMessage } from './browser-api';
import { MicRecorder, type MicRecording } from './mic-recorder';
import {
  isVoiceMessageFor,
  VOICE_BACKGROUND_TARGET,
  VOICE_OFFSCREEN_TARGET,
  VOICE_SIDEPANEL_TARGET,
  type VoiceEpochEvent,
  type VoiceErrorEvent,
  type VoiceErrorReason,
  type VoiceEvent,
  type VoiceFlushRequest,
  type VoiceFlushResponse,
  type VoiceHandoffEvent,
  type VoiceLevelEvent,
  VoiceMessage,
  type VoicePermissionQueryResponse,
  type VoicePermissionState,
  type VoiceRequest,
  type VoiceResultEvent,
  type VoiceStartRequest,
  type VoiceStartResponse,
  type VoiceStatusResponse,
  type VoiceStopRequest,
  type VoiceStopResponse,
  voiceMessage,
} from './voice-messages';
import { EMPTY_NARRATION, narrateRecording, type TranscriptionSettings, type VoiceRecording } from './voice-narration';

export interface VoiceHost {
  handle(request: VoiceRequest): Promise<unknown>;
  status(): VoiceStatusResponse;
  surrender(): void;
}

function emit(event: VoiceEvent): void {
  void sendMessage(event as unknown as Record<string, unknown>).catch(() => undefined);
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function startFailureReason(error: unknown): VoiceErrorReason {
  if (!(error instanceof Error)) return 'unknown';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'permission-denied';
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'no-device';
  if (error.name === 'NotSupportedError') return 'unsupported';
  return 'unknown';
}

function usableRecording(recording: MicRecording): VoiceRecording | null {
  if (recording.audioEpochMs === null || recording.pcm.length === 0) return null;
  return {
    pcm: recording.pcm,
    sampleRate: recording.sampleRate,
    audioEpochMs: recording.audioEpochMs,
    durationSeconds: recording.durationSeconds,
  };
}

async function permissionState(): Promise<VoicePermissionQueryResponse> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return { state: result.state as VoicePermissionState };
  } catch {
    return { state: 'unknown' };
  }
}

export function createVoiceHost(): VoiceHost {
  let pending = 0;
  let retained: VoiceRecording | null = null;
  let flushedUpToSeconds = 0;

  const recorder = new MicRecorder(getExtensionURL('/pcm-processor.js'), {
    onEpoch: (audioEpochMs) =>
      emit(
        voiceMessage<VoiceEpochEvent>({
          type: VoiceMessage.VOICE_EPOCH,
          target: VOICE_BACKGROUND_TARGET,
          audioEpochMs,
        }),
      ),
    onLevel: (level, speaking) =>
      emit(
        voiceMessage<VoiceLevelEvent>({
          type: VoiceMessage.VOICE_LEVEL,
          target: VOICE_SIDEPANEL_TARGET,
          level,
          speaking,
        }),
      ),
    onStreamEnded: () => reportStreamEnded(),
  });

  function reportStreamEnded(): void {
    emit(
      voiceMessage<VoiceErrorEvent>({
        type: VoiceMessage.VOICE_ERROR,
        target: VOICE_BACKGROUND_TARGET,
        reason: 'stream-ended',
        error: 'The microphone stream ended before recording stopped',
      }),
    );
  }

  function deliver(guideId: string, result: NarrationResult): void {
    emit(
      voiceMessage<VoiceResultEvent>({
        type: VoiceMessage.VOICE_RESULT,
        target: VOICE_BACKGROUND_TARGET,
        guideId,
        result,
      }),
    );
  }

  function handOff(audio: VoiceRecording): void {
    emit(
      voiceMessage<VoiceHandoffEvent>({
        type: VoiceMessage.VOICE_HANDOFF,
        target: VOICE_BACKGROUND_TARGET,
        pcm: audio.pcm,
        sampleRate: audio.sampleRate,
        audioEpochMs: audio.audioEpochMs,
        durationSeconds: audio.durationSeconds,
      }),
    );
  }

  async function handleStart(request: VoiceStartRequest): Promise<VoiceStartResponse> {
    if (recorder.recording) {
      return { started: false, reason: 'already-recording', error: 'Microphone capture is already running' };
    }
    try {
      flushedUpToSeconds = 0;
      const stream = await recorder.start(request.deviceId);
      logger.info('voice: microphone capture started', stream);
      return { started: true, ...stream };
    } catch (error) {
      recorder.release();
      logger.error('voice: microphone capture failed to start', error);
      return { started: false, reason: startFailureReason(error), error: describe(error) };
    }
  }

  async function transcribeInBackground(
    guideId: string,
    audio: VoiceRecording,
    steps: VoiceStopRequest['steps'],
    settings: TranscriptionSettings,
  ): Promise<void> {
    pending += 1;
    const result = await narrateRecording(audio, steps, settings);
    pending -= 1;
    retained = null;
    deliver(guideId, result);
  }

  async function handleFlush(request: VoiceFlushRequest): Promise<VoiceFlushResponse> {
    if (!recorder.recording) {
      return { ok: false, reason: 'not-recording', error: 'Microphone capture is not running' };
    }
    if (!request.settings?.apiKey) {
      return { ok: false, reason: 'missing-api-key', error: 'No transcription API key is configured' };
    }

    const full = usableRecording(recorder.snapshot());
    if (!full) return { ok: true, flushed: false };

    const closesAt = (request.step.timestamp - full.audioEpochMs) / 1000;
    const slice = partialRecording(full, flushedUpToSeconds, closesAt);
    if (!slice) return { ok: true, flushed: false };

    flushedUpToSeconds = closesAt;
    pending += 1;
    try {
      const result = await narrateRecording(slice, [request.step], request.settings);
      if (result.descriptions.length > 0) deliver(request.guideId, result);
      return { ok: true, flushed: result.descriptions.length > 0 };
    } finally {
      pending -= 1;
    }
  }

  async function handleStop(request: VoiceStopRequest): Promise<VoiceStopResponse> {
    if (!recorder.recording) {
      return { ok: false, reason: 'not-recording', error: 'Microphone capture is not running' };
    }

    const audio = usableRecording(recorder.stop());
    if (!audio) {
      return { ok: false, reason: 'no-audio', error: 'No microphone audio was captured' };
    }

    const { audioEpochMs, durationSeconds } = audio;
    if (request.steps.length === 0) {
      deliver(request.guideId, EMPTY_NARRATION);
      return { ok: true, audioEpochMs, durationSeconds };
    }

    const settings = request.settings;
    if (!settings?.apiKey) {
      return { ok: false, reason: 'missing-api-key', error: 'No transcription API key is configured' };
    }

    const tail = flushedUpToSeconds > 0 ? partialRecording(audio, flushedUpToSeconds, audio.durationSeconds) : audio;
    if (!tail) {
      deliver(request.guideId, EMPTY_NARRATION);
      return { ok: true, audioEpochMs, durationSeconds };
    }

    retained = tail;
    void transcribeInBackground(request.guideId, tail, request.steps, settings);
    return { ok: true, audioEpochMs, durationSeconds };
  }

  function status(): VoiceStatusResponse {
    return {
      recording: recorder.recording,
      transcribing: pending > 0,
      audioEpochMs: recorder.audioEpochMs,
      sampleRate: recorder.sampleRate,
      samples: recorder.sampleCount,
      durationSeconds: recorder.durationSeconds,
    };
  }

  function handle(request: VoiceRequest): Promise<unknown> {
    switch (request.type) {
      case VoiceMessage.VOICE_START:
        return handleStart(request);
      case VoiceMessage.VOICE_FLUSH:
        return handleFlush(request);
      case VoiceMessage.VOICE_STOP:
        return handleStop(request);
      case VoiceMessage.VOICE_ABORT:
        recorder.release();
        retained = null;
        return Promise.resolve({ ok: true });
      case VoiceMessage.VOICE_STATUS:
        return Promise.resolve(status());
      case VoiceMessage.VOICE_PERMISSION_QUERY:
        return permissionState();
      default:
        return Promise.resolve(undefined);
    }
  }

  function surrender(): void {
    if (recorder.recording) {
      const audio = usableRecording(recorder.stop());
      if (audio) handOff(audio);
      reportStreamEnded();
      return;
    }
    if (pending > 0 && retained) handOff(retained);
  }

  return { handle, status, surrender };
}

export function startVoiceHost(): VoiceHost {
  const host = createVoiceHost();

  onMessage((message, _sender, sendResponse) => {
    if (!isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, message)) return undefined;
    host
      .handle(message as VoiceRequest)
      .then(sendResponse)
      .catch((error: unknown) => {
        logger.error('voice: host could not handle request', message, error);
        sendResponse({ ok: false, started: false, reason: 'unknown', error: String(error) });
      });
    return true;
  });

  return host;
}
