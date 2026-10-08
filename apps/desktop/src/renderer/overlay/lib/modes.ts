import { AppWindow, Crop, Monitor } from 'lucide-react';

export const MODES = [
  { id: 'window', label: 'desktop.modeWindow', Icon: AppWindow },
  { id: 'screen', label: 'desktop.modeScreen', Icon: Monitor },
  { id: 'area', label: 'desktop.modeArea', Icon: Crop },
] as const;
