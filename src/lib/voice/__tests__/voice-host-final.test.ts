import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMessage = vi.fn();
const narrateRecording = vi.fn();

vi.mock('../../browser-api/get-extension-url', () => ({ getExtensionURL: (path: string) => path }));
vi.mock('../../browser-api/send-message', () => ({ sendMessage: (...args: unknown[]) => sendMessage(...args) }));

vi.mock('@mimik/core/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const recorderState = {
  recording: false,
  audioEpochMs: 1_700_000_000_000 as number | null,
  sampleRate: 16000,
  sampleCount: 16000,
  durationSeconds: 1,
};

vi.mock('@/core/capture/voice/mic-recorder', () => ({
  MicRecorder: class {
    get recording() {
      return recorderState.recording;
    }
    get audioEpochMs() {
      return recorderState.audioEpochMs;
    }
    get sampleRate() {
      return recorderState.sampleRate;
    }
    get sampleCount() {
      return recorderState.sampleCount;
    }
    get durationSeconds() {
      return recorderState.durationSeconds;
    }
    stop() {
      recorderState.recording = false;
      return {
        pcm: new Int16Array(recorderState.sampleCount),
        sampleRate: recorderState.sampleRate,
        audioEpochMs: recorderState.audioEpochMs,
        durationSeconds: recorderState.durationSeconds,
      };
    }
    snapshot() {
      return this.stop();
    }
    release() {}
  },
}));

vi.mock('@/core/capture/voice/narrate-recording', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/capture/voice/narrate-recording')>();
  return { ...actual, narrateRecording: (...args: unknown[]) => narrateRecording(...args) };
});

import { createVoiceHost } from '../create-voice-host';
import { VOICE_BACKGROUND_TARGET, VoiceMessage } from '../voice-message';

const SETTINGS = { provider: 'openai', apiKey: 'sk-test' };

function deliveredResults(): Array<{ final: boolean }> {
  return sendMessage.mock.calls
    .map(([event]) => event as { type: string; target: string; final: boolean })
    .filter((event) => event.type === VoiceMessage.VOICE_RESULT && event.target === VOICE_BACKGROUND_TARGET);
}

beforeEach(() => {
  sendMessage.mockReset().mockResolvedValue(undefined);
  narrateRecording.mockReset();
  recorderState.recording = true;
  recorderState.audioEpochMs = 1_700_000_000_000;
  recorderState.sampleCount = 160000;
  recorderState.durationSeconds = 10;
});

describe('the final flag on a delivered narration result', () => {
  it('is true when a stop has no steps to attribute to', async () => {
    const host = createVoiceHost();

    await host.handle({
      type: VoiceMessage.VOICE_STOP,
      target: 'voice-offscreen',
      guideId: 'g1',
      steps: [],
      settings: SETTINGS,
    } as never);

    expect(deliveredResults().map((event) => event.final)).toEqual([true]);
  });

  it('is false for a mid-recording flush', async () => {
    narrateRecording.mockResolvedValue({
      descriptions: [{ stepId: 's1', text: 'Open billing' }],
      transcript: { epochMs: 1_700_000_000_000, lines: [{ start: 0, end: 1, text: 'Open billing', stepId: 's1' }] },
      stats: {},
    });
    const host = createVoiceHost();

    await host.handle({
      type: VoiceMessage.VOICE_FLUSH,
      target: 'voice-offscreen',
      guideId: 'g1',
      step: { stepId: 's1', timestamp: 1_700_000_005_000 },
      settings: SETTINGS,
    } as never);

    expect(deliveredResults().map((event) => event.final)).toEqual([false]);
  });
});
