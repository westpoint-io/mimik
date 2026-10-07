import type { Rect } from '@mimik/core/rect';
import { contextBridge, ipcRenderer } from 'electron';
import type { OverlayView } from '../main/overlay';

const api = {
  region: (): Promise<Rect> => ipcRenderer.invoke('mimik:overlay:region'),
  view: (): Promise<OverlayView> => ipcRenderer.invoke('mimik:overlay:view'),
  setRegion: (region: Rect): void => ipcRenderer.send('mimik:overlay:setRegion', region),
  command: (command: string): void => ipcRenderer.send('mimik:overlay:command', command),
  size: (width: number, height: number): void => ipcRenderer.send('mimik:overlay:size', width, height),
  onUpdate: (handler: (view: OverlayView) => void): void => {
    ipcRenderer.on('mimik:overlay:update', (_event, view: OverlayView) => handler(view));
  },
};

contextBridge.exposeInMainWorld('mimikOverlay', api);

export type MimikOverlayApi = typeof api;
