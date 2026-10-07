import { beforeAll, describe, expect, it, vi } from 'vitest';

type Collector = {
  port: { postMessage: ReturnType<typeof vi.fn> };
  process(inputs: Float32Array[][]): boolean;
};
type CollectorClass = new (options?: { processorOptions?: { frameMs?: number } }) => Collector;

let Registered: CollectorClass;
let registeredName = '';

beforeAll(async () => {
  Object.assign(globalThis, {
    sampleRate: 16000,
    AudioWorkletProcessor: class {
      port = { postMessage: vi.fn() };
    },
    registerProcessor: (name: string, processor: CollectorClass) => {
      registeredName = name;
      Registered = processor;
    },
  });
  await import(new URL('../../../../public/mic-frames.js', import.meta.url).href);
});

function posted(collector: Collector): Int16Array[] {
  return collector.port.postMessage.mock.calls.map(([buffer]) => new Int16Array(buffer as ArrayBuffer));
}

describe('mic-frames worklet', () => {
  it('registers under the name the recorder asks for', () => {
    expect(registeredName).toBe('mic-frames');
  });

  it('sends one frame per frameMs of audio, sized from the sample rate', () => {
    const collector = new Registered({ processorOptions: { frameMs: 1 } });
    collector.process([[new Float32Array(40)]]);

    expect(posted(collector).map((frame) => frame.length)).toEqual([16, 16]);
  });

  it('clamps and scales samples symmetrically into 16-bit integers', () => {
    const collector = new Registered({ processorOptions: { frameMs: 0.375 } });
    collector.process([[Float32Array.from([2, 1, 0.5, 0, -0.5, -1])]]);

    expect([...posted(collector)[0]!]).toEqual([32767, 32767, 16384, 0, -16383, -32767]);
  });

  it('carries a frame across render quanta and ignores an empty input', () => {
    const collector = new Registered({ processorOptions: { frameMs: 0.25 } });
    collector.process([[Float32Array.from([0.1, 0.2, 0.3])]]);
    collector.process([[]]);
    collector.process([[Float32Array.from([0.4, 0.5])]]);

    expect(posted(collector).map((frame) => frame.length)).toEqual([4]);
  });
});
