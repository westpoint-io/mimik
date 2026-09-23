import { logger } from '@mimik/core/logger';
import { detectSpeechByEnergy } from '@/core/capture/voice/energy-gate';
import { runNarrationPipeline } from '@/core/capture/voice/pipeline';
import { buildStepWindows } from '@/core/capture/voice/step-windows';
import { createTranscriber } from '@/core/capture/voice/transcribe';
import type { NarrationResult } from '@/core/capture/voice/types';
import type { TranscriptionSettings } from './read-transcription-settings';
import type { VoiceStepMark } from './voice-message';

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
