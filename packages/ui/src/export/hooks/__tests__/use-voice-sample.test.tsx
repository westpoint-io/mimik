// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVoiceSample } from '../use-voice-sample';

const signals: AbortSignal[] = [];

vi.mock('@mimik/core/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mimik/core/env')>()),
  localStorage: { get: async () => ({}), set: async () => {} },
}));

vi.mock('@mimik/core/export/voiceover/sample', () => ({
  sampleVoiceover: (_config: unknown, _text: string, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise(() => {});
  },
}));

describe('useVoiceSample', () => {
  it('stops a sample still loading when the voice settings change', async () => {
    const { result, rerender } = renderHook(({ settings }) => useVoiceSample(settings), {
      initialProps: { settings: 'alloy' },
    });

    act(() => {
      void result.current.test('Hello');
    });
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    expect(result.current.status.state).toBe('loading');

    rerender({ settings: 'nova' });

    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.status.state).toBe('idle');
  });
});
