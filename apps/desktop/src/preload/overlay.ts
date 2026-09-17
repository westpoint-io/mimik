import { contextBridge, ipcRenderer } from 'electron';

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LastStep {
  index: number;
  title: string;
  src: string;
}

const api = {
  region: (): Promise<Region> => ipcRenderer.invoke('mimik:overlay:region'),
  state: (): Promise<string> => ipcRenderer.invoke('mimik:overlay:state'),
  last: (): Promise<LastStep> => ipcRenderer.invoke('mimik:overlay:last'),
  mode: (): Promise<string> => ipcRenderer.invoke('mimik:overlay:mode'),
  busy: (): Promise<boolean> => ipcRenderer.invoke('mimik:overlay:busy'),
  setRegion: (region: Region): void => ipcRenderer.send('mimik:overlay:setRegion', region),
  command: (command: string): void => ipcRenderer.send('mimik:overlay:command', command),
  size: (width: number, height: number): void => ipcRenderer.send('mimik:overlay:size', width, height),
  onUpdate: (
    handler: (state: string, region: Region, last: LastStep | null, mode: string, busy: boolean) => void,
  ): void => {
    ipcRenderer.on(
      'mimik:overlay:update',
      (_event, state: string, region: Region, last: LastStep | null, mode: string, busy: boolean) =>
        handler(state, region, last, mode, busy),
    );
  },
};

contextBridge.exposeInMainWorld('mimikOverlay', api);

export type MimikOverlayApi = typeof api;
