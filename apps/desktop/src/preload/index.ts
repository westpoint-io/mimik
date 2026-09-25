import { contextBridge, ipcRenderer } from 'electron';
import type { CaptureSettings } from '../main/capture/settings';
import type { OverlayAiFailure } from '../main/overlay';

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
    edit: (): Promise<void> => ipcRenderer.invoke('mimik:capture:edit'),
    arm: (): Promise<void> => ipcRenderer.invoke('mimik:capture:arm'),
    described: (stepId: string, description: string | null, failure: OverlayAiFailure | null): void =>
      ipcRenderer.send('mimik:capture:described', stepId, description, failure),
    settings: {
      get: (): Promise<CaptureSettings> => ipcRenderer.invoke('mimik:capture:settings:get'),
      set: (patch: Partial<CaptureSettings>): Promise<CaptureSettings> =>
        ipcRenderer.invoke('mimik:capture:settings:set', patch),
    },
    onCommand: (handler: (command: string, state: string, region: Region, guideId: string | null) => void): void => {
      ipcRenderer.on(
        'mimik:capture:command',
        (_event, command: string, state: string, region: Region, guideId: string | null) =>
          handler(command, state, region, guideId),
      );
    },
  },
  ai: {
    fetch: (request: unknown): Promise<unknown> => ipcRenderer.invoke('mimik:ai:fetch', request),
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
  updates: {
    check: (): Promise<void> => ipcRenderer.invoke('mimik:updates:check'),
  },
  screenshots: {
    sweep: (keep: string[]): Promise<number> => ipcRenderer.invoke('mimik:screenshots:sweep', keep),
  },
  openAtLogin: {
    get: (): Promise<boolean> => ipcRenderer.invoke('mimik:openAtLogin:get'),
    set: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('mimik:openAtLogin:set', enabled),
  },
};

contextBridge.exposeInMainWorld('mimik', api);

export type MimikDesktopApi = typeof api;
