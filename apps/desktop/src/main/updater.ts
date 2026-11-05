import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from './ipc';

const { autoUpdater } = electronUpdater;
const FIRST_CHECK_MS = 60 * 1000;
const RECHECK_MS = 4 * 60 * 60 * 1000;

export function createUpdater(onChange: (status: UpdateStatus) => void) {
  const stampFile = join(app.getPath('userData'), 'last-update-check');
  let checkedAt: number | null = null;
  try {
    checkedAt = Number(readFileSync(stampFile, 'utf8')) || null;
  } catch {}
  let status: UpdateStatus = { phase: 'idle', percent: 0, version: null, checkedAt };
  let byUser = false;

  const set = (next: Partial<UpdateStatus>) => {
    status = { ...status, ...next };
    onChange(status);
  };
  const stamp = () => {
    const now = Date.now();
    try {
      writeFileSync(stampFile, String(now));
    } catch {}
    return now;
  };

  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => set({ phase: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    set({ phase: 'downloading', percent: 0, version: info.version, checkedAt: stamp() }),
  );
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.floor(progress.percent);
    if (percent !== status.percent) set({ phase: 'downloading', percent });
  });
  autoUpdater.on('update-downloaded', (info) => set({ phase: 'ready', percent: 100, version: info.version }));
  autoUpdater.on('update-not-available', () => set({ phase: byUser ? 'upToDate' : 'idle', checkedAt: stamp() }));
  autoUpdater.on('error', (error: Error & { code?: string }) => {
    if (!byUser) set({ phase: 'idle' });
    else set({ phase: error.code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' ? 'unavailable' : 'error' });
  });

  const check = (fromUser: boolean) => {
    if (!app.isPackaged || ['checking', 'downloading', 'ready'].includes(status.phase)) return;
    byUser = fromUser;
    autoUpdater.checkForUpdates().catch(() => {});
  };

  return {
    status: () => status,
    check,
    start: () => {
      setTimeout(() => check(false), FIRST_CHECK_MS);
      setInterval(() => check(false), RECHECK_MS);
    },
    install: () => {
      if (status.phase === 'ready') autoUpdater.quitAndInstall(true, true);
    },
  };
}
