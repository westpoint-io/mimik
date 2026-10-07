import { describe, expect, it } from 'vitest';
import { runNarrationPipeline } from '../pipeline';
import { absoluteSeconds, type StepWindow } from '../types';

const steps: StepWindow[] = [
  { stepId: 's1', from: absoluteSeconds(0), to: absoluteSeconds(10) },
  { stepId: 's2', from: absoluteSeconds(10), to: absoluteSeconds(20) },
];
const pcm = new Int16Array(16000 * 20);
const scores = { no_speech_prob: 0.01, avg_logprob: -0.2, compression_ratio: 1.4 };
const speech = (start: number, end: number) => [{ start: absoluteSeconds(start), end: absoluteSeconds(end) }];

const run = (segments: unknown[], words?: unknown[], detected = speech(1, 18)) =>
  runNarrationPipeline({
    pcm,
    sampleRate: 16000,
    steps,
    audioEpochMs: 1_700_000_000_000,
    detectSpeech: async () => detected,
    transcribe: async () => ({ segments, words }) as never,
  });

describe('the transcript the pipeline keeps', () => {
  it('keeps a line a filter threw away, with the reason it was thrown away', async () => {
    const result = await run([
      { start: 0, end: 3, text: 'Open the settings menu.', ...scores },
      { start: 3, end: 5, text: 'Thanks for watching', ...scores },
    ]);

    expect(result.descriptions).toEqual([{ stepId: 's1', text: 'Open the settings menu.' }]);
    expect(result.transcript.lines).toContainEqual(
      expect.objectContaining({ text: 'Open the settings menu.', stepId: 's1', rejectReason: null }),
    );
    const rejected = result.transcript.lines.find((line) => line.text === 'Thanks for watching');
    expect(rejected?.rejectReason).toBe('blocklist:thanks for watching');
    expect(rejected?.stepId).toBeNull();
  });

  it('keeps a line no step claimed', async () => {
    const result = await run(
      [{ start: 0, end: 2, text: 'Let me find my notes.', ...scores }],
      undefined,
      speech(25, 28),
    );

    expect(result.descriptions).toEqual([]);
    expect(result.transcript.lines).toEqual([
      expect.objectContaining({ text: 'Let me find my notes.', stepId: null, rejectReason: null }),
    ]);
  });

  it('carries the step onto an ordinary attributed line', async () => {
    const result = await run([
      { start: 0, end: 3, text: 'Open the settings menu.', ...scores },
      { start: 11, end: 14, text: 'Then save it.', ...scores },
    ]);

    expect(result.transcript.lines.map((line) => [line.stepId, line.text])).toEqual([
      ['s1', 'Open the settings menu.'],
      ['s2', 'Then save it.'],
    ]);
  });

  it('stamps the audio epoch so slices can be ordered later', async () => {
    const result = await run([{ start: 0, end: 3, text: 'Open the settings menu.', ...scores }]);
    expect(result.transcript.epochMs).toBe(1_700_000_000_000);
  });

  it('records each side of a segment split across two steps', async () => {
    const result = await run(
      [{ start: 8, end: 12, text: 'Open settings then save it', ...scores }],
      [
        { word: 'Open', start: 8, end: 8.4 },
        { word: 'settings', start: 8.5, end: 9 },
        { word: 'then', start: 10.5, end: 10.8 },
        { word: 'save', start: 11, end: 11.3 },
        { word: 'it', start: 11.4, end: 11.6 },
      ],
      speech(0, 20),
    );

    expect(result.transcript.lines.map((line) => [line.stepId, line.text])).toEqual([
      ['s1', 'Open settings'],
      ['s2', 'then save it'],
    ]);
  });

  it('keeps a split segment whole and unattributed when there are no word timings', async () => {
    const result = await run([{ start: 8, end: 12, text: 'Open settings then save it', ...scores }], [], speech(0, 20));

    expect(result.descriptions).toEqual([]);
    expect(result.transcript.lines).toEqual([
      expect.objectContaining({ text: 'Open settings then save it', stepId: null }),
    ]);
  });

  it('has nothing to keep when there was no speech to transcribe', async () => {
    const result = await run([], undefined, []);
    expect(result.transcript.lines).toEqual([]);
  });
});
