import { contextBridge, ipcRenderer } from 'electron';
import type { CaptureInsert } from '../main/capture/insert';
import type { CaptureSettings } from '../main/capture/settings';
import type { OverlayAiFailure } from '../main/overlay';
import type { CapturePermissions, PermissionKind } from '../main/permissions';

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

const api = {
  version: (): Promise<string> => ipcRenderer.invoke('mimik:version'),
  capture: {
    region: (): Promise<Region> => ipcRenderer.invoke('mimik:capture:region'),
    edit: (insert?: CaptureInsert): Promise<void> => ipcRenderer.invoke('mimik:capture:edit', insert),
    arm: (insert?: CaptureInsert): Promise<void> => ipcRenderer.invoke('mimik:capture:arm', insert),
    described: (stepId: string, description: string | null, failure: OverlayAiFailure | null): void =>
      ipcRenderer.send('mimik:capture:described', stepId, description, failure),
    settings: {
      get: (): Promise<CaptureSettings> => ipcRenderer.invoke('mimik:capture:settings:get'),
      set: (patch: Partial<CaptureSettings>): Promise<CaptureSettings> =>
        ipcRenderer.invoke('mimik:capture:settings:set', patch),
    },
    onOpenSheet: (handler: () => void): void => {
      ipcRenderer.on('mimik:capture:openSheet', () => handler());
    },
    onCommand: (handler: (command: string, state: string, region: Region, guideId: string | null) => void): void => {
      ipcRenderer.on(
        'mimik:capture:command',
        (_event, command: string, state: string, region: Region, guideId: string | null) =>
          handler(command, state, region, guideId),
      );
    },
  },
  permissions: {
    get: (): Promise<CapturePermissions & { pending: boolean }> => ipcRenderer.invoke('mimik:permissions:get'),
    request: (kind: PermissionKind): Promise<void> => ipcRenderer.invoke('mimik:permissions:request', kind),
    continue: (): void => ipcRenderer.send('mimik:permissions:continue'),
    cancel: (): void => ipcRenderer.send('mimik:permissions:cancel'),
    restart: (): void => ipcRenderer.send('mimik:permissions:restart'),
    onShow: (handler: () => void): void => {
      ipcRenderer.on('mimik:permissions:show', () => handler());
    },
  },
  ai: {
    fetch: (request: unknown): Promise<unknown> => ipcRenderer.invoke('mimik:ai:fetch', request),
    abort: (id: string): void => ipcRenderer.send('mimik:ai:abort', id),
  },
  onRequest: (channel: string, handler: (payload: unknown) => Promise<unknown>): void => {
    ipcRenderer.on(channel, async (_event, replyChannel: string, payload: unknown) => {
      try {
        ipcRenderer.send(replyChannel, await handler(payload));
      } catch (error) {
        ipcRenderer.send(replyChannel, { error: error instanceof Error ? error.message : String(error) });
      }
    });
  },
  relocalise: (): void => ipcRenderer.send('mimik:app:relocalise'),
  onOpen: (handler: (target: 'library' | 'capture' | 'settings') => void): void => {
    ipcRenderer.on('mimik:app:open', (_event, target) => handler(target));
  },
  locale: (code: string): void => ipcRenderer.send('mimik:app:locale', code),
  updates: {
    check: (): Promise<void> => ipcRenderer.invoke('mimik:updates:check'),
  },
  screenshots: {
    sweep: (keep: string[]): Promise<number> => ipcRenderer.invoke('mimik:screenshots:sweep', keep),
  },
  openedFile: {
    take: (): Promise<{ name: string; bytes: Uint8Array } | null> => ipcRenderer.invoke('mimik:app:takeOpenedFile'),
    onOpen: (handler: () => void): void => {
      ipcRenderer.on('mimik:app:fileOpened', () => handler());
    },
  },
  openAtLogin: {
    get: (): Promise<boolean> => ipcRenderer.invoke('mimik:openAtLogin:get'),
    set: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('mimik:openAtLogin:set', enabled),
  },
};

contextBridge.exposeInMainWorld('mimik', api);

export type MimikDesktopApi = typeof api;
