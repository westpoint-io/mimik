import { logger } from '@/core/logger';
import { decodeClip } from './audio';
import { clipKey, deleteClip, readClip, writeClip } from './cache';
import { synthesizeSpeech } from './client';
import type { VoiceoverConfig } from './config';
import type { VoiceoverSegment } from './script';

export interface VoiceoverControls {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, next?: string) => void;
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

const inFlight = new Map<string, Promise<AudioBuffer>>();

function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Voiceover was aborted', 'AbortError'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

async function synthesizeAndStore(
  key: string,
  text: string,
  config: VoiceoverConfig,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  let bytes: ArrayBuffer;
  try {
    bytes = await synthesizeSpeech(config, text, signal);
  } catch (error) {
    if (aborted(error)) throw error;
    logger.error('[voiceover] synthesis retrying', error);
    await wait(RETRY_DELAY_MS, signal);
    bytes = await synthesizeSpeech(config, text, signal);
  }

  const buffer = await decodeClip(bytes);
  await writeClip(key, bytes);
  return buffer;
}

async function sharedSynthesis(
  key: string,
  text: string,
  config: VoiceoverConfig,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  const pending = inFlight.get(key);
  if (pending) {
    try {
      return await untilAborted(pending, signal);
    } catch (error) {
      if (!aborted(error) || signal?.aborted) throw error;
    }
  }

  const request = synthesizeAndStore(key, text, config, signal);
  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}

async function clipBuffer(
  segment: VoiceoverSegment,
  config: VoiceoverConfig,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  const key = await clipKey(config.provider, config.voiceId, config.modelId, segment.text);
  const cached = await readClip(key);
  if (cached) {
    try {
      return await decodeClip(cached);
    } catch (error) {
      logger.error('[voiceover] cached clip could not be decoded, synthesising it again', error);
      await deleteClip(key);
    }
  }
  return sharedSynthesis(key, segment.text, config, signal);
}

export async function renderVoiceover(
  segments: VoiceoverSegment[],
  config: VoiceoverConfig,
  controls: VoiceoverControls = {},
): Promise<Map<number, AudioBuffer>> {
  const { signal, onProgress } = controls;
  const clips = new Map<number, AudioBuffer>();
  let done = 0;

  onProgress?.(0, segments.length, segments[0]?.text);

  for (const segment of segments) {
    if (signal?.aborted) throw new DOMException('Voiceover was aborted', 'AbortError');
    clips.set(segment.index, await clipBuffer(segment, config, signal));
    onProgress?.(++done, segments.length, segments[done]?.text);
  }

  return clips;
}
