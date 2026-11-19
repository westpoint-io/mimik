import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateStatus } from '../ipc';

const updater = vi.hoisted(() => {
  const listeners = new Map<string, ((payload?: unknown) => void)[]>();
  return {
    autoDownload: false,
    checkForUpdates: vi.fn(() => Promise.resolve(null)),
    quitAndInstall: vi.fn(),
    on: (event: string, listener: (payload?: unknown) => void) =>
      listeners.set(event, [...(listeners.get(event) ?? []), listener]),
    emit: (event: string, payload?: unknown) => {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    },
    removeAllListeners: () => listeners.clear(),
  };
});

vi.mock('electron', () => ({ app: { isPackaged: true, getPath: () => '/nowhere' } }));
vi.mock('electron-updater', () => ({ default: { autoUpdater: updater } }));
vi.mock('node:fs', () => ({
  readFileSync: () => {
    throw new Error('no stamp');
  },
  writeFileSync: () => {},
}));

import { createUpdater } from '../updater';

function setup() {
  updater.removeAllListeners();
  updater.checkForUpdates.mockClear();
  updater.quitAndInstall.mockClear();
  const seen: UpdateStatus[] = [];
  const instance = createUpdater((status) => seen.push(status));
  return { instance, last: () => seen[seen.length - 1] as UpdateStatus };
}

describe('createUpdater', () => {
  beforeEach(() => vi.useRealTimers());

  it('says up to date only when the user asked', () => {
    const { instance, last } = setup();
    instance.check(true);
    updater.emit('update-not-available');
    expect(last().phase).toBe('upToDate');
    expect(last().checkedAt).toEqual(expect.any(Number));

    instance.check(false);
    updater.emit('update-not-available');
    expect(last().phase).toBe('idle');
  });

  it('reports a failure only when the user asked', () => {
    const { instance, last } = setup();
    instance.check(false);
    updater.emit('error', new Error('offline'));
    expect(last().phase).toBe('idle');

    instance.check(true);
    updater.emit('error', new Error('offline'));
    expect(last().phase).toBe('error');
  });

  it('tells the user when this platform has no update yet, instead of a failure', () => {
    const { instance, last } = setup();
    const missing = Object.assign(new Error('Cannot find latest-mac.yml'), {
      code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
    });
    instance.check(true);
    updater.emit('error', missing);
    expect(last().phase).toBe('unavailable');

    instance.check(false);
    updater.emit('error', missing);
    expect(last().phase).toBe('idle');
  });

  it('walks from checking through the download to ready', () => {
    const { instance, last } = setup();
    instance.check(false);
    updater.emit('checking-for-update');
    expect(last().phase).toBe('checking');
    updater.emit('update-available', { version: '1.2.0' });
    expect(last()).toMatchObject({ phase: 'downloading', percent: 0, version: '1.2.0' });
    updater.emit('download-progress', { percent: 42.7 });
    expect(last().percent).toBe(42);
    updater.emit('update-downloaded', { version: '1.2.0' });
    expect(last()).toMatchObject({ phase: 'ready', version: '1.2.0' });
  });

  it('starts no second check while one is running, downloading or ready', () => {
    const { instance } = setup();
    instance.check(false);
    updater.emit('checking-for-update');
    instance.check(true);
    updater.emit('update-available', { version: '1.2.0' });
    instance.check(true);
    updater.emit('update-downloaded', { version: '1.2.0' });
    instance.check(true);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('installs only a downloaded update, silently, and reopens Mimik', () => {
    const { instance } = setup();
    instance.install();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    updater.emit('update-downloaded', { version: '1.2.0' });
    instance.install();
    expect(updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(true, true);
  });

  it('waits a minute after launch, then checks every four hours', () => {
    vi.useFakeTimers();
    const { instance } = setup();
    instance.start();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60 * 1000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    updater.emit('update-not-available');
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });
});
