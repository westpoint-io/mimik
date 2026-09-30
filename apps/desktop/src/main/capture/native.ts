import type { ActiveWindow, HookEvent, UiElement } from '@mimik/capture-native';

export type Addon = {
  elementAtPoint(x: number, y: number): Promise<UiElement | null>;
  focusedElement(): Promise<UiElement | null>;
  activeWindow(): ActiveWindow | null;
  windowAt(x: number, y: number): ActiveWindow | null;
  keyLabel(keycode: number): string | null;
  resolveKey(keycode: number, shift: boolean, ctrl: boolean, alt: boolean): string | null;
  clearDeadKey(): void;
  isSupported(): boolean;
  startInputHook(callback: (event: HookEvent) => void): void;
};

let addon: Addon | null | undefined;

export async function loadNative(): Promise<Addon | null> {
  if (addon === undefined) {
    try {
      addon = (await import('@mimik/capture-native')) as unknown as Addon;
    } catch {
      addon = null;
    }
  }
  return addon;
}
