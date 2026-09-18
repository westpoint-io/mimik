// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AVC_CODEC,
  COVER_SECONDS,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  STEP_SECONDS,
  TRANSITION_SECONDS,
  uniformTimeline,
  VOICE_LEAD_SEC,
  VOICE_TAIL_SEC,
  VP9_CODEC,
  videoSeconds,
  voiceTimeline,
} from '@/core/export/video-support';

interface ProbedConfig {
  codec: string;
  width: number;
  height: number;
}

afterEach(() => vi.unstubAllGlobals());

async function freshModule() {
  vi.resetModules();
  return import('@/core/export/video-support');
}

function stubEncoder(supported: (codec: string) => boolean, probed: ProbedConfig[] = []) {
  vi.stubGlobal('VideoEncoder', {
    isConfigSupported: async (config: ProbedConfig) => {
      probed.push(config);
      return { supported: supported(config.codec) };
    },
  });
  return probed;
}

describe('codec strings', () => {
  it('is the exact H.264 string mediabunny emits for 1280x720 at high quality', () => {
    expect(AVC_CODEC).toBe('avc1.64001f');
  });

  it('is the exact VP9 string mediabunny emits for 1280x720 at high quality', () => {
    expect(VP9_CODEC).toBe('vp09.00.31.08');
  });
});

describe('pickContainer', () => {
  it('returns mp4 when the High Profile string encodes', async () => {
    stubEncoder((codec) => codec === AVC_CODEC);
    const { pickContainer } = await freshModule();
    expect(await pickContainer()).toBe('mp4');
  });

  it('probes at the frame size the encoder will use, since the level depends on it', async () => {
    const probed = stubEncoder(() => false);
    const { pickContainer } = await freshModule();
    await pickContainer();
    expect(probed.length).toBeGreaterThan(0);
    expect(probed.every((c) => c.width === FRAME_WIDTH && c.height === FRAME_HEIGHT)).toBe(true);
  });

  it('never asks for a level below the one that carries 1280x720', async () => {
    const probed = stubEncoder(() => false);
    const { pickContainer } = await freshModule();
    await pickContainer();
    expect(probed.some((c) => c.codec.startsWith('avc1.6400'))).toBe(true);
    expect(probed.some((c) => /^avc1\.6400(0[0-9a-f]|1[0-9a-e])$/i.test(c.codec))).toBe(false);
  });

  it('falls back to webm when only Baseline encodes, since mediabunny would still ask for High', async () => {
    stubEncoder((codec) => codec.startsWith('avc1.42E0') || codec.startsWith('vp09'));
    const { pickContainer } = await freshModule();
    expect(await pickContainer()).toBe('webm');
  });

  it('falls back to webm when avc does not encode but vp9 does', async () => {
    stubEncoder((codec) => codec === VP9_CODEC);
    const { pickContainer } = await freshModule();
    expect(await pickContainer()).toBe('webm');
  });

  it('returns null when nothing encodes', async () => {
    stubEncoder(() => false);
    const { pickContainer } = await freshModule();
    expect(await pickContainer()).toBeNull();
  });

  it('returns null when WebCodecs is absent entirely', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    const { pickContainer } = await freshModule();
    expect(await pickContainer()).toBeNull();
  });

  it('treats a throwing probe as unsupported rather than crashing', async () => {
    vi.stubGlobal('VideoEncoder', {
      isConfigSupported: async () => {
        throw new TypeError('bad config');
      },
    });
    const { pickContainer } = await freshModule();
    expect(await pickContainer()).toBeNull();
  });

  it('probes the browser only once across repeated calls', async () => {
    const probed = stubEncoder(() => false);
    const { pickContainer } = await freshModule();
    await pickContainer();
    const afterFirst = probed.length;
    await pickContainer();
    expect(probed.length).toBe(afterFirst);
  });
});

describe('canExportVideo', () => {
  it('is true when the browser can encode the container we would write', async () => {
    stubEncoder((codec) => codec === AVC_CODEC);
    const { canExportVideo } = await freshModule();
    expect(await canExportVideo()).toBe(true);
  });

  it('is false when no codec we would request encodes', async () => {
    stubEncoder(() => false);
    const { canExportVideo } = await freshModule();
    expect(await canExportVideo()).toBe(false);
  });

  it('shares the memoised probe rather than testing the browser again', async () => {
    const probed = stubEncoder((codec) => codec === AVC_CODEC);
    const { canExportVideo, pickContainer } = await freshModule();
    await canExportVideo();
    const afterFirst = probed.length;
    await pickContainer();
    expect(probed.length).toBe(afterFirst);
  });
});

describe('voiceTimeline', () => {
  it('leaves an unnarrated guide on the structural timeline', () => {
    expect(voiceTimeline(3, new Map())).toEqual(uniformTimeline(3));
  });

  it('never shortens a step whose narration is briefer than the animation', () => {
    expect(voiceTimeline(1, new Map([[0, 0.5]])).stepSeconds[0]).toBe(STEP_SECONDS);
  });

  it('holds a step until a long narration finishes, with a lead-in and a tail', () => {
    expect(voiceTimeline(1, new Map([[0, 9]])).stepSeconds[0]).toBeCloseTo(VOICE_LEAD_SEC + 9 + VOICE_TAIL_SEC, 10);
  });

  it('stretches the cover card for the spoken title', () => {
    expect(voiceTimeline(1, new Map([[-1, 6]])).coverSeconds).toBeCloseTo(VOICE_LEAD_SEC + 6 + VOICE_TAIL_SEC, 10);
    expect(voiceTimeline(1, new Map([[-1, 0.2]])).coverSeconds).toBe(COVER_SECONDS);
  });

  it('sizes each step from its own clip', () => {
    const timeline = voiceTimeline(3, new Map([[1, 8]]));
    expect(timeline.stepSeconds[0]).toBe(STEP_SECONDS);
    expect(timeline.stepSeconds[1]).toBeGreaterThan(STEP_SECONDS);
    expect(timeline.stepSeconds[2]).toBe(STEP_SECONDS);
  });
});

describe('videoSeconds', () => {
  it('is nothing for a guide with no frames', () => {
    expect(videoSeconds(0, true)).toBe(0);
  });

  it('counts one step as its full hold', () => {
    expect(videoSeconds(1, false)).toBeCloseTo(STEP_SECONDS, 10);
  });

  it('takes the cross-dissolve off each join', () => {
    expect(videoSeconds(3, false)).toBeCloseTo(3 * STEP_SECONDS - 2 * TRANSITION_SECONDS, 10);
  });

  it('adds both cards when the cover is on', () => {
    expect(videoSeconds(1, true) - videoSeconds(1, false)).toBeCloseTo(2 * COVER_SECONDS, 10);
  });

  it('grows with a narrated timeline, which is what the estimate is for', () => {
    const narrated = voiceTimeline(2, new Map([[0, 9]]));
    expect(videoSeconds(2, false, narrated)).toBeGreaterThan(videoSeconds(2, false));
    expect(videoSeconds(2, false, narrated)).toBeCloseTo(
      VOICE_LEAD_SEC + 9 + VOICE_TAIL_SEC + STEP_SECONDS - TRANSITION_SECONDS,
      10,
    );
  });
});
