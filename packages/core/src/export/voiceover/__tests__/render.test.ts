import { beforeEach, describe, expect, it, vi } from 'vitest';

const synthesizeSpeech = vi.fn();
const decodeClip = vi.fn();
const readClip = vi.fn();
const writeClip = vi.fn();
const deleteClip = vi.fn();

vi.mock('../client', () => ({ synthesizeSpeech: (...args: unknown[]) => synthesizeSpeech(...args) }));
vi.mock('../audio', () => ({ decodeClip: (...args: unknown[]) => decodeClip(...args) }));
vi.mock('../cache', () => ({
  clipKey: async (_provider: string, _voice: string, _model: string, text: string) => `key:${text}`,
  readClip: (...args: unknown[]) => readClip(...args),
  writeClip: (...args: unknown[]) => writeClip(...args),
  deleteClip: (...args: unknown[]) => deleteClip(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import type { VoiceoverConfig } from '../config';
import { renderVoiceover } from '../render';
import type { VoiceoverSegment } from '../script';

const CONFIG: VoiceoverConfig = {
  provider: 'openai',
  apiKey: 'sk',
  voiceId: 'alloy',
  modelId: 'tts-1',
};
const SEGMENTS: VoiceoverSegment[] = [{ index: 0, text: 'Open billing' }];
const BUFFER = { length: 10 } as AudioBuffer;

beforeEach(() => {
  vi.clearAllMocks();
  readClip.mockResolvedValue(null);
  writeClip.mockResolvedValue(undefined);
  deleteClip.mockResolvedValue(undefined);
  decodeClip.mockResolvedValue(BUFFER);
});

describe('renderVoiceover', () => {
  it('pays for a clip once when two exports ask for it at the same time', async () => {
    let finish!: (bytes: ArrayBuffer) => void;
    synthesizeSpeech.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const preview = renderVoiceover(SEGMENTS, CONFIG);
    const download = renderVoiceover(SEGMENTS, CONFIG);
    await new Promise((resolve) => setTimeout(resolve, 0));
    finish(new ArrayBuffer(4));

    const [a, b] = await Promise.all([preview, download]);
    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(a.get(0)).toBe(BUFFER);
    expect(b.get(0)).toBe(BUFFER);
  });

  it('does not cache a clip that cannot be decoded', async () => {
    synthesizeSpeech.mockResolvedValue(new ArrayBuffer(0));
    decodeClip.mockRejectedValue(new Error('Unable to decode audio data'));

    await expect(renderVoiceover(SEGMENTS, CONFIG)).rejects.toThrow('Unable to decode');
    expect(writeClip).not.toHaveBeenCalled();
  });

  it('throws out a cached clip that no longer decodes and fetches it again', async () => {
    readClip.mockResolvedValue(new ArrayBuffer(0));
    decodeClip.mockRejectedValueOnce(new Error('Unable to decode audio data')).mockResolvedValue(BUFFER);
    synthesizeSpeech.mockResolvedValue(new ArrayBuffer(4));

    const clips = await renderVoiceover(SEGMENTS, CONFIG);

    expect(deleteClip).toHaveBeenCalledWith('key:Open billing');
    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(clips.get(0)).toBe(BUFFER);
  });

  it('starts its own request when the export it was waiting on is cancelled', async () => {
    const preview = new AbortController();
    let rejectFirst!: (error: unknown) => void;
    synthesizeSpeech
      .mockReturnValueOnce(new Promise((_resolve, reject) => (rejectFirst = reject)))
      .mockResolvedValueOnce(new ArrayBuffer(4));

    const previewing = renderVoiceover(SEGMENTS, CONFIG, { signal: preview.signal });
    const downloading = renderVoiceover(SEGMENTS, CONFIG);
    await new Promise((resolve) => setTimeout(resolve, 0));
    preview.abort();
    rejectFirst(new DOMException('Voiceover was aborted', 'AbortError'));

    await expect(previewing).rejects.toMatchObject({ name: 'AbortError' });
    expect((await downloading).get(0)).toBe(BUFFER);
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
  });
});
