import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type QueueModule = typeof import('../description-queue');

interface Job {
  run: () => Promise<void>;
  settle: () => void;
  fail: (reason: unknown) => void;
  started: boolean;
  finished: boolean;
}

let queueDescription: QueueModule['queueDescription'];
let drainDescriptions: QueueModule['drainDescriptions'];

function job(): Job {
  let settle!: () => void;
  let fail!: (reason: unknown) => void;
  const gate = new Promise<void>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  const state: Job = {
    run: async () => {
      state.started = true;
      try {
        await gate;
      } finally {
        state.finished = true;
      }
    },
    settle,
    fail,
    started: false,
    finished: false,
  };
  return state;
}

function watch<T>(promise: Promise<T>): { promise: Promise<T>; done: () => boolean } {
  let done = false;
  const observed = promise.then((value) => {
    done = true;
    return value;
  });
  return { promise: observed, done: () => done };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function raceAgainstDelay<T>(promise: Promise<T>, ms: number): Promise<T | 'blocked'> {
  return Promise.race([
    promise,
    new Promise<'blocked'>((resolve) => {
      setTimeout(() => resolve('blocked'), ms);
    }),
  ]);
}

beforeEach(async () => {
  vi.resetModules();
  ({ queueDescription, drainDescriptions } = await import('../description-queue'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('description queue', () => {
  it('resolves immediately for a guide with nothing queued', async () => {
    vi.useFakeTimers();

    await expect(drainDescriptions('guide-a')).resolves.toBeUndefined();
  });

  it('resolves immediately for a guide whose tasks all settled earlier', async () => {
    const first = job();
    queueDescription('guide-a', first.run);
    first.settle();
    await drainDescriptions('guide-a');

    vi.useFakeTimers();

    await expect(drainDescriptions('guide-a')).resolves.toBeUndefined();
  });

  it('waits for the guide task to settle before resolving', async () => {
    const only = job();
    queueDescription('guide-a', only.run);

    const drain = watch(drainDescriptions('guide-a'));
    await flushMicrotasks();
    expect(only.started).toBe(true);
    expect(drain.done()).toBe(false);

    only.settle();
    await drain.promise;

    expect(drain.done()).toBe(true);
  });

  it('runs one task at a time and waits for every task belonging to the guide', async () => {
    const first = job();
    const second = job();
    queueDescription('guide-a', first.run);
    queueDescription('guide-a', second.run);

    const drain = watch(drainDescriptions('guide-a'));
    await flushMicrotasks();
    expect(second.started).toBe(false);

    first.settle();
    await flushMicrotasks();
    expect(second.started).toBe(true);
    expect(drain.done()).toBe(false);

    second.settle();
    await drain.promise;

    expect(first.finished).toBe(true);
    expect(second.finished).toBe(true);
  });

  it('resolves for one guide while another guide still has work in flight', async () => {
    const forA = job();
    const forB = job();
    queueDescription('guide-a', forA.run);
    queueDescription('guide-b', forB.run);

    const drain = watch(drainDescriptions('guide-a'));
    await flushMicrotasks();
    expect(drain.done()).toBe(false);

    forA.settle();

    await expect(
      raceAgainstDelay(
        drain.promise.then(() => 'drained' as const),
        200,
      ),
    ).resolves.toBe('drained');
    expect(forB.finished).toBe(false);

    forB.settle();
    await drainDescriptions('guide-b');
  });

  it('resolves for one guide while another guide still has work queued behind it', async () => {
    const forA = job();
    const forB = job();
    queueDescription('guide-b', forB.run);
    queueDescription('guide-a', forA.run);
    const stillQueued = job();

    const drain = watch(drainDescriptions('guide-a'));
    await flushMicrotasks();
    expect(forA.started).toBe(false);

    forB.settle();
    await flushMicrotasks();
    queueDescription('guide-b', stillQueued.run);
    forA.settle();

    await expect(
      raceAgainstDelay(
        drain.promise.then(() => 'drained' as const),
        200,
      ),
    ).resolves.toBe('drained');
    expect(stillQueued.finished).toBe(false);

    stillQueued.settle();
    await drainDescriptions('guide-b');
  });

  it('swallows a failing task so the drain still resolves', async () => {
    const failing = job();
    queueDescription('guide-a', failing.run);

    const drain = watch(drainDescriptions('guide-a'));
    await flushMicrotasks();
    failing.fail(new Error('model unreachable'));

    await expect(drain.promise).resolves.toBeUndefined();
  });

  it('gives up after the twenty second cap when a task never settles', async () => {
    vi.useFakeTimers();
    const stuck = job();
    queueDescription('guide-a', stuck.run);

    const drain = watch(drainDescriptions('guide-a'));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(drain.done()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    await expect(drain.promise).resolves.toBeUndefined();
    expect(stuck.finished).toBe(false);
  });

  it('leaves no cap timer behind once the tasks settle on their own', async () => {
    vi.useFakeTimers();
    const only = job();
    queueDescription('guide-a', only.run);

    const drain = watch(drainDescriptions('guide-a'));
    await flushMicrotasks();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    only.settle();
    await drain.promise;
    await flushMicrotasks();

    expect(vi.getTimerCount()).toBe(0);
  });
});
