import type { PresetKey } from './patterns';

export interface BlurDetector {
  start(presets: PresetKey[]): void;
  updatePresets(presets: PresetKey[]): void;
  unblurAll(): void;
  detach(): void;
  stop(): void;
}
