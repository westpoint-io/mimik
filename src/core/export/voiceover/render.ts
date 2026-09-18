import { logger } from '@/lib/logger';
import { decodeClip } from './audio';
import { clipKey, readClip, writeClip } from './cache';
import { synthesizeSpeech } from './client';
import type { VoiceoverConfig } from './config';
import type { VoiceoverSegment } from './script';

export interface VoiceoverControls {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

const RETRY_DELAY_MS = 1500;

function aborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Voiceover was aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function clipBytes(
  segment: VoiceoverSegment,
  config: VoiceoverConfig,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const key = await clipKey(config.provider, config.voiceId, config.modelId, segment.text);
  const cached = await readClip(key);
  if (cached) return cached;

  let bytes: ArrayBuffer;
  try {
    bytes = await synthesizeSpeech(config, segment.text, signal);
  } catch (error) {
    if (aborted(error)) throw error;
    logger.error('[voiceover] synthesis retrying', error);
    await wait(RETRY_DELAY_MS, signal);
    bytes = await synthesizeSpeech(config, segment.text, signal);
  }

  await writeClip(key, bytes);
  return bytes;
}

export async function renderVoiceover(
  segments: VoiceoverSegment[],
  config: VoiceoverConfig,
  controls: VoiceoverControls = {},
): Promise<Map<number, AudioBuffer>> {
  const { signal, onProgress } = controls;
  const clips = new Map<number, AudioBuffer>();
  let done = 0;

  onProgress?.(0, segments.length);

  for (const segment of segments) {
    if (signal?.aborted) throw new DOMException('Voiceover was aborted', 'AbortError');
    clips.set(segment.index, await decodeClip(await clipBytes(segment, config, signal)));
    onProgress?.(++done, segments.length);
  }

  return clips;
}
