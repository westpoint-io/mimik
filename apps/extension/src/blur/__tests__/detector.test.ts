// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlurDetector } from '@/core/blur/detector';
import type { PresetKey } from '@/core/blur/patterns';
import { BlurManager } from '../manager';

const stored: { blurPresets?: Record<PresetKey, boolean> } = {};

vi.mock('#imports', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async () => stored),
        set: vi.fn(async (items: Record<string, unknown>) => Object.assign(stored, items)),
      },
    },
  },
}));

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(async () => undefined) }));

vi.mock('../mount-blur-panel', () => ({
  mountBlurPanel: () => () => {},
}));

function recordingDetector() {
  const calls: string[] = [];
  const presets: PresetKey[][] = [];
  const detector: BlurDetector = {
    start: (p) => {
      calls.push('start');
      presets.push(p);
    },
    updatePresets: (p) => {
      calls.push('updatePresets');
      presets.push(p);
    },
    unblurAll: () => calls.push('unblurAll'),
    detach: () => calls.push('detach'),
    stop: () => calls.push('stop'),
  };
  return { detector, calls, presets };
}

beforeEach(() => {
  document.body.innerHTML = '';
  for (const key of Object.keys(stored)) delete (stored as Record<string, unknown>)[key];
});

describe('BlurManager against a detector that is not the DOM scanner', () => {
  it('starts it with the categories that are switched on', async () => {
    const { detector, calls, presets } = recordingDetector();

    await new BlurManager(detector).start();

    expect(calls).toEqual(['start']);
    expect(presets[0]).toEqual(['email', 'phone']);
  });

  it('routes a category change through the interface', async () => {
    const { detector, calls, presets } = recordingDetector();
    await new BlurManager(detector).start();

    document.dispatchEvent(
      new CustomEvent('mimik-blur:update-presets', { detail: { presets: ['ssn', 'creditCard'] } }),
    );

    expect(calls).toContain('updatePresets');
    expect(presets.at(-1)).toEqual(['ssn', 'creditCard']);
  });

  it('routes a reset through the interface', async () => {
    const { detector, calls } = recordingDetector();
    await new BlurManager(detector).start();

    document.dispatchEvent(new CustomEvent('mimik-blur:reset'));

    expect(calls).toContain('unblurAll');
  });

  it('tears the detector down on stop', async () => {
    const { detector, calls } = recordingDetector();
    const manager = new BlurManager(detector);
    await manager.start();

    manager.stop();

    expect(calls).toContain('stop');
  });
});
