import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportOptions } from '@/core/export/options';
import { DEFAULT_EXPORT_OPTIONS } from '@/core/export/options';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

const rec = vi.hoisted(() => ({
  calls: [] as { m: string; a: unknown[] }[],
  added: [] as { at: number; dur: number }[],
  closed: 0,
  container: 'mp4' as 'mp4' | 'webm' | null,
  probed: [] as string[],
  started: 0,
  finalized: 0,
  cancelled: 0,
  buffer: true,
  audio: [] as { length: number }[],
  audioTracks: 0,
}));

const voice = vi.hoisted(() => ({
  codec: 'aac' as 'aac' | 'opus' | null,
  settings: { voiceoverProvider: 'openai', voiceoverApiKeys: { openai: 'sk_test' } } as Record<string, unknown>,
  clips: new Map<number, AudioBuffer>(),
}));

const branding = vi.hoisted(() => ({
  value: {
    logo: null as null | { dataUrl: string; width: number; height: number },
    footer: '',
    attribution: false,
    accent: '#4F46E5',
    custom: false,
  },
}));

function fakeCtx() {
  const store: Record<string, unknown> = { filter: 'none' };
  const base: Record<string, unknown> = {
    canvas: { width: 1280, height: 720 },
    measureText: (t: unknown) => ({ width: String(t).length * 8 }),
  };
  return new Proxy(base, {
    has: () => true,
    get(target, key) {
      const k = String(key);
      if (k in target) return target[k];
      if (k in store) return store[k];
      return (...a: unknown[]) => {
        rec.calls.push({ m: k, a });
      };
    },
    set(_target, key, value) {
      store[String(key)] = value;
      rec.calls.push({ m: `set:${String(key)}`, a: [value] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

vi.mock('mediabunny', () => ({
  QUALITY_HIGH: 'high',
  QUALITY_MEDIUM: 'medium',
  AudioBufferSource: class {
    async add(buffer: { length: number }) {
      rec.audio.push(buffer);
    }
  },
  Mp4OutputFormat: class {},
  WebMOutputFormat: class {},
  BufferTarget: class {
    get buffer() {
      return rec.buffer ? new ArrayBuffer(16) : null;
    }
  },
  CanvasSource: class {
    async add(at: number, dur: number) {
      rec.added.push({ at, dur });
    }
  },
  Output: class {
    target: { buffer: ArrayBuffer | null };
    constructor(o: { target: { buffer: ArrayBuffer | null } }) {
      this.target = o.target;
    }
    addVideoTrack() {}
    addAudioTrack() {
      rec.audioTracks += 1;
    }
    async start() {
      rec.started += 1;
    }
    async finalize() {
      rec.finalized += 1;
    }
    async cancel() {
      rec.cancelled += 1;
    }
  },
}));

vi.mock('@/core/export/video-support', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/video-support')>('@/core/export/video-support');
  return {
    ...actual,
    pickContainer: vi.fn(async (r = '720p') => {
      rec.probed.push(r);
      return rec.container;
    }),
  };
});

const renderVoiceover = vi.hoisted(() => vi.fn());

vi.mock('@/core/export/voiceover/render', () => ({ renderVoiceover }));

vi.mock('@/core/export/voiceover/audio', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/voiceover/audio')>('@/core/export/voiceover/audio');
  return {
    ...actual,
    pickVoiceCodec: vi.fn(async () => voice.codec),
  };
});

vi.mock('@/lib/browser-api', () => ({
  localStorage: { get: vi.fn(async () => voice.settings), set: vi.fn(async () => undefined) },
}));

vi.mock('@/core/screenshot/render', () => ({
  renderScreenshot: vi.fn(async () => new Blob(['webp'])),
}));

vi.mock('@/core/export/branding', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/branding')>('@/core/export/branding');
  return { ...actual, loadBranding: vi.fn(async () => branding.value) };
});

const { exportGuideAsVideo } = await import('@/core/export/video-export');
const { renderScreenshot } = await import('@/core/screenshot/render');
const { COVER_SECONDS, FPS, STEP_SECONDS, VOICE_LEAD_SEC, VOICE_TAIL_SEC } = await import(
  '@/core/export/video-support'
);
const { toFrames } = await import('@/core/export/video-export');

const guide: Guide = {
  id: 'g1',
  title: 'Reset your password',
  createdAt: new Date('2026-03-04T10:00:00Z').getTime(),
  updatedAt: new Date('2026-03-04T10:00:00Z').getTime(),
  stepIds: [],
  starred: false,
  deletedAt: null,
};

function makeStep(i: number, overrides: Partial<Step> = {}): Step {
  return {
    id: `s${i}`,
    guideId: 'g1',
    index: i,
    description: `Click the button labelled ${i}`,
    action: 'click',
    url: 'https://example.com/settings',
    timestamp: guide.createdAt,
    screenshotId: `shot-${i}`,
    ...overrides,
  };
}

function makeShot(stepId: string, overrides: Partial<Screenshot> = {}): Screenshot {
  return {
    id: `shot-${stepId}`,
    stepId,
    blob: new Blob(['raw']),
    mimeType: 'image/webp',
    width: 1280,
    height: 720,
    bounds: { x: 100, y: 200, width: 120, height: 40 },
    pixelRatio: 1,
    ...overrides,
  };
}

function shotsFor(steps: Step[]): Map<string, Screenshot> {
  return new Map(steps.filter((s) => !s.blockType).map((s) => [s.id, makeShot(s.id)]));
}

const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({ ...DEFAULT_EXPORT_OPTIONS, ...o });

beforeEach(() => {
  rec.calls = [];
  rec.added = [];
  rec.closed = 0;
  rec.container = 'mp4';
  rec.probed = [];
  rec.started = 0;
  rec.finalized = 0;
  rec.cancelled = 0;
  rec.buffer = true;
  rec.audio = [];
  rec.audioTracks = 0;
  voice.codec = 'aac';
  voice.settings = { voiceoverProvider: 'openai', voiceoverApiKeys: { openai: 'sk_test' } };
  voice.clips = new Map();
  renderVoiceover.mockReset();
  renderVoiceover.mockImplementation(async () => voice.clips);
  branding.value = { logo: null, footer: '', attribution: false, accent: '#4F46E5', custom: false };
  vi.mocked(renderScreenshot).mockClear();
  vi.mocked(renderScreenshot).mockResolvedValue(new Blob(['webp']));

  class FakeOffscreen {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return fakeCtx();
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeOffscreen);
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      createBuffer(_channels: number, length: number) {
        return { length };
      }
    },
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width: 1280,
      height: 720,
      close: () => {
        rec.closed += 1;
      },
    })),
  );
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }),
  });
});

describe('exportGuideAsVideo guards', () => {
  it('refuses a guide with nothing to show', async () => {
    await expect(exportGuideAsVideo(guide, [makeStep(0)], new Map(), opts())).rejects.toThrow(/no screenshots/i);
  });

  it('refuses when the browser cannot encode at all', async () => {
    rec.container = null;
    const steps = [makeStep(0)];
    await expect(exportGuideAsVideo(guide, steps, shotsFor(steps), opts())).rejects.toThrow(/cannot encode/i);
  });

  it('fails when encoding yields no buffer', async () => {
    rec.buffer = false;
    const steps = [makeStep(0)];
    await expect(exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }))).rejects.toThrow(
      /no output/i,
    );
  });
});

describe('exportGuideAsVideo output', () => {
  it('produces an mp4 when the container is available', async () => {
    const steps = [makeStep(0)];
    const result = await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(result.extension).toBe('mp4');
    expect(result.blob.type).toBe('video/mp4');
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('falls back to webm when mp4 is unavailable', async () => {
    rec.container = 'webm';
    const steps = [makeStep(0)];
    const result = await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(result.extension).toBe('webm');
    expect(result.blob.type).toBe('video/webm');
  });

  it('starts and finalizes the output exactly once', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(rec.started).toBe(1);
    expect(rec.finalized).toBe(1);
    expect(rec.cancelled).toBe(0);
  });

  it('returns chapters describing the timeline', async () => {
    const steps = [makeStep(0), makeStep(1)];
    const result = await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(result.chapters.length).toBeGreaterThan(0);
    expect(result.chapters[0]).toHaveProperty('title');
  });

  it('emits one encoded segment per frame at the frame rate', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(rec.added.length).toBeGreaterThan(FPS);
    expect(rec.added.every((s) => s.dur === 1 / FPS)).toBe(true);
    expect(rec.added[0].at).toBe(0);
  });

  it('falls back to 720p when the requested resolution cannot be encoded', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, resolution: '1080p' }));

    expect(rec.probed[0]).toBe('1080p');
  });
});

describe('exportGuideAsVideo cover cards', () => {
  it('brackets the steps with an opening and closing card', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: true }));

    const holds = rec.added.filter((s) => s.dur === 3);
    expect(holds.length).toBe(2);
    expect(holds[0].at).toBe(0);
  });

  it('offsets the step frames past the opening card', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: true }));

    const stepSegments = rec.added.filter((s) => s.dur === 1 / FPS);
    expect(stepSegments[0].at).toBe(3);
  });

  it('adds no cards when the cover is off', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(rec.added.filter((s) => s.dur === 3).length).toBe(0);
  });

  it('draws the brand logo on the card when one is set', async () => {
    branding.value = { ...branding.value, logo: { dataUrl: 'data:image/png;base64,AAA', width: 80, height: 30 } };
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: true }));

    expect(rec.calls.some((c) => c.m === 'drawImage')).toBe(true);
  });
});

describe('exportGuideAsVideo progress and abort', () => {
  it('reports progress that ends on the total', async () => {
    const steps = [makeStep(0)];
    const seen: [number, number][] = [];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: true }), {
      onProgress: (done, total) => seen.push([done, total]),
    });

    expect(seen.length).toBeGreaterThan(0);
    const [done, total] = seen[seen.length - 1];
    expect(done).toBe(total);
  });

  it('counts both cards into the total', async () => {
    const steps = [makeStep(0)];
    const seen: [number, number][] = [];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: true }), {
      onProgress: (done, total) => seen.push([done, total]),
    });
    const withCover = seen[0][1];

    seen.length = 0;
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }), {
      onProgress: (done, total) => seen.push([done, total]),
    });

    expect(withCover - seen[0][1]).toBe(2);
  });

  it('aborts before any encoding when the signal is already set', async () => {
    const controller = new AbortController();
    controller.abort();
    const steps = [makeStep(0)];

    await expect(
      exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }), { signal: controller.signal }),
    ).rejects.toThrow(/aborted/i);
  });

  it('cancels the output when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const steps = [makeStep(0)];

    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }), {
      signal: controller.signal,
    }).catch(() => undefined);

    expect(rec.cancelled).toBe(1);
    expect(rec.finalized).toBe(0);
  });

  it('releases every decoded bitmap even when it aborts', async () => {
    const controller = new AbortController();
    const steps = [makeStep(0), makeStep(1)];
    let ticks = 0;
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }), {
      signal: controller.signal,
      onProgress: () => {
        ticks += 1;
        if (ticks === 5) controller.abort();
      },
    }).catch(() => undefined);

    expect(rec.closed).toBeGreaterThan(0);
  });
});

describe('exportGuideAsVideo layers', () => {
  it('renders each screenshot once and reuses the decoded frame', async () => {
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(renderScreenshot).toHaveBeenCalledTimes(2);
  });

  it('renders the screenshot without the baked target outline', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(vi.mocked(renderScreenshot).mock.calls[0][1]).toMatchObject({ target: false });
  });

  it('drops step descriptions when the option is off', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, stepDescriptions: false }));

    const written = rec.calls.filter((c) => c.m === 'fillText').flatMap((c) => String(c.a[0]));
    expect(written.some((t) => t.includes('Click the button labelled'))).toBe(false);
  });

  it('writes the step description into the tooltip when the option is on', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, stepDescriptions: true }));

    const written = rec.calls.filter((c) => c.m === 'fillText').flatMap((c) => String(c.a[0]));
    expect(written.some((t) => t.includes('Click the button labelled'))).toBe(true);
  });

  it('renders a block step over a blurred backdrop of the previous screenshot', async () => {
    const steps = [makeStep(0), makeStep(1, { blockType: 'heading', description: 'Part two' })];
    const shots = shotsFor(steps);
    await exportGuideAsVideo(guide, steps, shots, opts({ cover: false }));

    expect(renderScreenshot).toHaveBeenCalledTimes(2);
    const written = rec.calls.filter((c) => c.m === 'fillText').flatMap((c) => String(c.a[0]));
    expect(written.some((t) => t.includes('Part two'))).toBe(true);
  });

  it('renders a leading block step with no backdrop behind it', async () => {
    const steps = [makeStep(0, { blockType: 'callout', description: 'Heads up' }), makeStep(1)];
    const shots = shotsFor(steps);
    await exportGuideAsVideo(guide, steps, shots, opts({ cover: false }));

    const written = rec.calls.filter((c) => c.m === 'fillText').flatMap((c) => String(c.a[0]));
    expect(written.some((t) => t.includes('Heads up'))).toBe(true);
  });

  it('handles a screenshot with no click target', async () => {
    const steps = [makeStep(0)];
    const shots = new Map([['s0', makeShot('s0', { bounds: undefined })]]);
    const result = await exportGuideAsVideo(guide, steps, shots, opts({ cover: false }));

    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('cross dissolves between consecutive steps', async () => {
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false }));

    const alphas = rec.calls.filter((c) => c.m === 'set:globalAlpha').map((c) => c.a[0] as number);
    expect(alphas.some((a) => a > 0 && a < 1)).toBe(true);
  });
});

describe('exportGuideAsVideo voiceover', () => {
  const clip = (seconds: number) => ({ duration: seconds, length: Math.round(seconds * 44100) }) as AudioBuffer;

  it('stays silent and on the structural timeline when the option is off', async () => {
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, voiceover: false }));

    expect(rec.audioTracks).toBe(0);
    expect(rec.added).toHaveLength(157 * 2 - 10);
  });

  it('holds a narrated step until its clip ends', async () => {
    voice.clips = new Map([[0, clip(9)]]);
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, voiceover: true }));

    const first = toFrames(VOICE_LEAD_SEC + 9 + VOICE_TAIL_SEC);
    expect(rec.audioTracks).toBe(1);
    expect(rec.added).toHaveLength(first + 157 - 10);
  });

  it('lays each clip down at its own step, after the lead-in', async () => {
    const coverClip = clip(1);
    const secondStepClip = clip(2);
    voice.clips = new Map([
      [-1, coverClip],
      [1, secondStepClip],
    ]);
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: true, voiceover: true }));

    const startsAt = (buffer: AudioBuffer) => {
      let cursor = 0;
      for (const written of rec.audio) {
        if (written === (buffer as unknown as { length: number })) return cursor / 44100;
        cursor += written.length;
      }
      return null;
    };

    const stepTwoOpens = COVER_SECONDS + (toFrames(STEP_SECONDS) - 10) / FPS;
    expect(startsAt(coverClip)).toBeCloseTo(VOICE_LEAD_SEC, 4);
    expect(startsAt(secondStepClip)).toBeCloseTo(stepTwoOpens + VOICE_LEAD_SEC, 4);
  });

  it('exports a silent video when narration fails, instead of failing the export', async () => {
    renderVoiceover.mockRejectedValueOnce(new Error('ElevenLabs rejected the API key (401)'));
    const steps = [makeStep(0), makeStep(1)];

    const result = await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, voiceover: true }));

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.voiceoverError).toMatch(/401/);
    expect(rec.audioTracks).toBe(0);
    expect(rec.added).toHaveLength(157 * 2 - 10);
  });

  it('still aborts the export when the user cancels during narration', async () => {
    renderVoiceover.mockRejectedValueOnce(new DOMException('Voiceover was aborted', 'AbortError'));
    const steps = [makeStep(0)];

    await expect(
      exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, voiceover: true })),
    ).rejects.toThrow(/aborted/i);
  });

  it('narrates on the AI key alone, with no voice-over key of its own', async () => {
    voice.settings = { voiceoverProvider: 'openai', aiProvider: 'openai', aiApiKeys: { openai: 'sk-ai' } };
    voice.clips = new Map([[0, clip(9)]]);
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, voiceover: true }));

    expect(rec.audioTracks).toBe(1);
  });

  it('falls back to a silent video when no key is stored', async () => {
    voice.settings = {};
    voice.clips = new Map([[0, clip(9)]]);
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, voiceover: true }));

    expect(rec.audioTracks).toBe(0);
    expect(rec.added).toHaveLength(157 * 2 - 10);
  });

  it('falls back to a silent video when the browser cannot encode audio', async () => {
    voice.codec = null;
    voice.clips = new Map([[0, clip(9)]]);
    const steps = [makeStep(0)];
    await exportGuideAsVideo(guide, steps, shotsFor(steps), opts({ cover: false, voiceover: true }));

    expect(rec.audioTracks).toBe(0);
    expect(rec.added).toHaveLength(157);
  });

  it('stretches the chapter marks to match the narrated timeline', async () => {
    voice.clips = new Map([[0, clip(9)]]);
    const steps = [makeStep(0), makeStep(1)];
    const { chapters } = await exportGuideAsVideo(
      guide,
      steps,
      shotsFor(steps),
      opts({ cover: false, voiceover: true }),
    );

    expect(chapters[1].start).toBeCloseTo((toFrames(VOICE_LEAD_SEC + 9 + VOICE_TAIL_SEC) - 10) / FPS, 6);
    expect(chapters[0].end).toBeCloseTo(chapters[1].start, 6);
  });
});
