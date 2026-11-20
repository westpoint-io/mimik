import { decodeClip } from './audio';
import { synthesizeSpeech } from './client';
import type { VoiceoverConfig } from './config';
import { SpeechError } from './speech-error';

export type VoiceSample =
  | { ok: true; buffer: AudioBuffer }
  | { ok: false; reason: 'failed'; detail: string; suspectVoice: boolean }
  | { ok: false; reason: 'unreadable' };

function unexplained(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === 'TimeoutError';
  if (!(error instanceof SpeechError) || error.explained) return false;
  return error.status === 400 || error.status === 422 || error.status >= 500;
}

export async function sampleVoiceover(
  config: VoiceoverConfig,
  text: string,
  signal?: AbortSignal,
): Promise<VoiceSample> {
  let bytes: ArrayBuffer;
  try {
    bytes = await synthesizeSpeech(config, text, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      ok: false,
      reason: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      suspectVoice: config.provider === 'server' && unexplained(error),
    };
  }

  try {
    return { ok: true, buffer: await decodeClip(bytes) };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
