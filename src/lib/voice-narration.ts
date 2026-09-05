import { resolveVoiceApiKey, VOICE_KEY_SETTINGS } from '@/core/capture/voice/api-key';
import { detectSpeechByEnergy } from '@/core/capture/voice/energy-gate';
import { runNarrationPipeline } from '@/core/capture/voice/pipeline';
import { buildStepWindows } from '@/core/capture/voice/step-windows';
import { createTranscriber, type VoiceProvider } from '@/core/capture/voice/transcribe';
import type { NarrationResult } from '@/core/capture/voice/types';
import { localStorage } from './browser-api';
import { logger } from './logger';
import type { VoiceStepMark } from './voice-messages';

export interface TranscriptionSettings {
  provider: VoiceProvider;
  apiKey: string;
  language?: string;
  baseURL?: string;
  model?: string;
}

export interface VoiceRecording {
  pcm: Int16Array;
  sampleRate: number;
  audioEpochMs: number;
  durationSeconds: number;
}

export const EMPTY_NARRATION: NarrationResult = {
  descriptions: [],
  stats: {
    batches: 0,
    failedBatches: 0,
    droppedBatches: 0,
    forcedSplits: 0,
    verbatimSegments: 0,
    splitSegments: 0,
    rejectedSegments: 0,
  },
};

export async function readTranscriptionSettings(): Promise<TranscriptionSettings> {
  const stored = await localStorage.get([...VOICE_KEY_SETTINGS, 'voiceLanguage', 'aiLanguage']);
  const { provider, apiKey, baseURL, model } = resolveVoiceApiKey(stored);
  const locale = (stored.voiceLanguage ?? stored.aiLanguage) as string | undefined;
  return {
    provider,
    apiKey,
    language: locale ? locale.split('-')[0] : undefined,
    baseURL,
    model,
  };
}

export async function narrateRecording(
  recording: VoiceRecording,
  steps: VoiceStepMark[],
  settings: TranscriptionSettings,
): Promise<NarrationResult> {
  try {
    const result = await runNarrationPipeline({
      pcm: recording.pcm,
      sampleRate: recording.sampleRate,
      steps: buildStepWindows(steps, recording.audioEpochMs, recording.durationSeconds),
      detectSpeech: detectSpeechByEnergy,
      transcribe: createTranscriber(settings),
    });
    logger.info('voice: narration pipeline finished', result.stats);
    return result;
  } catch (error) {
    logger.error('voice: narration pipeline failed', error);
    return EMPTY_NARRATION;
  }
}
