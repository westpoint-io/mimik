// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

let resolvePresets: ((v: unknown) => void) | null = null;

vi.mock('#imports', () => ({
  browser: {
    storage: {
      local: {
        get: () =>
          new Promise((resolve) => {
            resolvePresets = resolve;
          }),
        set: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn().mockResolvedValue(undefined) }));

import { BlurManager } from '../manager';

function overlayHosts(): number {
  return document.documentElement.querySelectorAll(':scope > [data-mimik-ignore]').length;
}

async function settle() {
  resolvePresets?.({ blurPresets: { email: true } });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  for (const el of document.documentElement.querySelectorAll(':scope > [data-mimik-ignore]')) {
    el.remove();
  }
  document.body.innerHTML = '';
  resolvePresets = null;
});

describe('BlurManager start/stop races', () => {
  it('mounts the overlay once the presets load', async () => {
    const manager = new BlurManager();
    manager.start();
    await settle();

    expect(overlayHosts()).toBe(1);
  });

  it('does not mount the overlay when stop lands while the presets load', async () => {
    const manager = new BlurManager();
    manager.start();
    manager.stop();
    await settle();

    expect(overlayHosts()).toBe(0);
  });

  it('does not mount the overlay when dismiss lands while the presets load', async () => {
    const manager = new BlurManager();
    manager.start();
    manager.dismiss();
    await settle();

    expect(overlayHosts()).toBe(0);
  });

  it('can be started again after a stop that interrupted a start', async () => {
    const manager = new BlurManager();
    manager.start();
    manager.stop();
    await settle();

    manager.start();
    await settle();

    expect(overlayHosts()).toBe(1);
  });

  it('dismiss closes the overlay but leaves the masks and styles in place', async () => {
    document.body.innerHTML = '<p>ada@example.com</p>';
    const manager = new BlurManager();
    manager.start();
    await settle();
    expect(document.querySelectorAll('[data-mimik-blur]')).toHaveLength(1);

    manager.dismiss();

    expect(overlayHosts()).toBe(0);
    expect(document.querySelectorAll('[data-mimik-blur]')).toHaveLength(1);
    expect(document.getElementById('mimik-blur-style')).not.toBeNull();
  });

  it('stop removes the masks and the styles as well as the overlay', async () => {
    document.body.innerHTML = '<p>ada@example.com</p>';
    const manager = new BlurManager();
    manager.start();
    await settle();
    expect(document.querySelectorAll('[data-mimik-blur]')).toHaveLength(1);

    manager.stop();

    expect(overlayHosts()).toBe(0);
    expect(document.querySelectorAll('[data-mimik-blur]')).toHaveLength(0);
    expect(document.getElementById('mimik-blur-style')).toBeNull();
  });

  it('stop still clears the masks after a dismiss has already run', async () => {
    document.body.innerHTML = '<p>ada@example.com</p>';
    const manager = new BlurManager();
    manager.start();
    await settle();
    manager.dismiss();

    manager.stop();

    expect(document.querySelectorAll('[data-mimik-blur]')).toHaveLength(0);
    expect(document.getElementById('mimik-blur-style')).toBeNull();
  });

  it('does not mount two panels when a dismiss and a restart share one await', async () => {
    const manager = new BlurManager();
    manager.start();
    manager.dismiss();
    manager.start();
    await settle();

    expect(overlayHosts()).toBe(1);
  });

  it('removes the overlay on a stop after a completed start', async () => {
    const manager = new BlurManager();
    manager.start();
    await settle();
    manager.stop();

    expect(overlayHosts()).toBe(0);
  });
});
