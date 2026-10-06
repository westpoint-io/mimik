import { logger } from '@/core/logger';
import { detectSpeechByEnergy } from './energy-gate';
import { runNarrationPipeline } from './pipeline';
import type { TranscriptionSettings } from './read-transcription-settings';
import type { StepMark } from './step-windows';
import { buildStepWindows } from './step-windows';
import { createTranscriber } from './transcribe';
import type { NarrationResult } from './types';

export interface VoiceRecording {
  pcm: Int16Array;
  sampleRate: number;
  audioEpochMs: number;
  durationSeconds: number;
}

export const EMPTY_NARRATION: NarrationResult = {
  descriptions: [],
  transcript: { epochMs: 0, lines: [] },
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
  steps: StepMark[],
  settings: TranscriptionSettings,
): Promise<NarrationResult> {
  try {
    const result = await runNarrationPipeline({
      pcm: recording.pcm,
      sampleRate: recording.sampleRate,
      steps: buildStepWindows(steps, recording.audioEpochMs, recording.durationSeconds),
      audioEpochMs: recording.audioEpochMs,
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
