import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sent = vi.fn();
vi.mock('@/lib/port/broadcast-card-to-panel', () => ({ broadcastCardToPanel: (u: unknown) => sent(u) }));
const getStep = vi.fn();
vi.mock('@/core/guides/service', () => ({
  getStep: (...args: unknown[]) => getStep(...args),
  getStepsForGuide: vi.fn(),
  getScreenshotsForSteps: vi.fn(),
}));

import { cardFeed } from '../card-feed';

const last = () =>
  sent.mock.calls.at(-1)?.[0] as {
    busy: boolean;
    step: { number: number; pending: boolean } | null;
    progress: { percent: number };
  };

describe('cardFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sent.mockClear();
    cardFeed.reset();
    vi.runAllTimers();
    sent.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('holds the printing state so a fast capture still animates', () => {
    cardFeed.setBusy(true);
    expect(last().busy).toBe(true);
    cardFeed.setBusy(false);
    expect(last().busy).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(last().busy).toBe(false);
  });

  it('numbers steps as they arrive and renumbers after a removal', () => {
    const a = cardFeed.add({
      id: 'a',
      title: 'A',
      action: 'click',
      src: '',
      source: 'heuristic',
      pending: false,
      url: 'https://x.io/p',
    });
    const b = cardFeed.add({
      id: 'b',
      title: 'B',
      action: 'click',
      src: '',
      source: 'heuristic',
      pending: false,
      url: 'https://x.io/p',
    });
    expect([a.number, b.number]).toEqual([1, 2]);
    cardFeed.remove('a');
    expect(last().step).toMatchObject({ number: 1 });
  });

  it('watches a pending step until the description settles', async () => {
    getStep.mockResolvedValue({ aiPending: false, description: 'Described', descriptionSource: 'ai' });
    cardFeed.add({
      id: 'p',
      title: 'Raw',
      action: 'click',
      src: '',
      source: 'heuristic',
      pending: true,
      url: 'https://x.io',
    });
    expect(last().progress.percent).toBe(95);
    await vi.advanceTimersByTimeAsync(900);
    expect(last().step).toMatchObject({ pending: false, title: 'Described' });
    expect(last().progress.percent).toBe(100);
  });
});

describe('cardFeed.attach', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cardFeed.reset();
    vi.runAllTimers();
    sent.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('hands a card opened on a new page a settled view, mid-capture or mid-hold', () => {
    cardFeed.add({
      id: 's',
      title: 'A step',
      action: 'click',
      src: 'shot',
      source: 'heuristic',
      pending: true,
      url: 'https://x.io',
    });
    cardFeed.setBusy(true);
    cardFeed.setProgress(90, 250);
    cardFeed.setPrint({ src: 'film', aim: { x: 0.5, y: 0.5, aspect: 1 } });
    const attached = cardFeed.attach();
    expect(attached.busy).toBe(false);
    expect(attached.progress.percent).toBe(0);
    expect(attached.print).toEqual({ src: null, aim: null });
    expect(attached.step).toMatchObject({ id: 's', pending: true });
  });
});

describe('cardFeed.attach replay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cardFeed.reset();
    vi.runAllTimers();
    sent.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('replays the landing for a step captured just before the card appears', () => {
    cardFeed.setBusy(true);
    cardFeed.add({
      id: 's',
      title: 'A step',
      action: 'click',
      src: 'shot-data',
      source: 'heuristic',
      pending: false,
      url: 'https://x.io',
    });
    cardFeed.setBusy(false);
    const attached = cardFeed.attach();
    expect(attached.busy).toBe(true);
    expect(attached.progress.percent).toBe(100);
    expect(attached.print.src).toBe('shot-data');
    expect(attached.step).toBeNull();
    vi.advanceTimersByTime(500);
    expect(last().busy).toBe(false);
    expect(last().step).toMatchObject({ id: 's' });
  });

  it('still replays when the new page took several seconds to load', () => {
    cardFeed.setBusy(true);
    cardFeed.add({
      id: 's',
      title: 'A step',
      action: 'click',
      src: 'shot-data',
      source: 'heuristic',
      pending: false,
      url: 'https://x.io',
    });
    cardFeed.setBusy(false);
    vi.advanceTimersByTime(6000);
    expect(cardFeed.attach().busy).toBe(true);
  });

  it('does not replay a second card that already saw the step', () => {
    cardFeed.setBusy(true);
    cardFeed.add({
      id: 's',
      title: 'A step',
      action: 'click',
      src: 'shot-data',
      source: 'heuristic',
      pending: false,
      url: 'https://x.io',
    });
    cardFeed.setBusy(false);
    expect(cardFeed.attach().busy).toBe(true);
    expect(cardFeed.attach().busy).toBe(false);
  });

  it('does not replay while a capture is still in progress', () => {
    cardFeed.setBusy(true);
    cardFeed.add({
      id: 's',
      title: 'A step',
      action: 'click',
      src: 'shot-data',
      source: 'heuristic',
      pending: false,
      url: 'https://x.io',
    });
    expect(cardFeed.attach().busy).toBe(false);
  });
});
