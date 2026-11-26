import { CaptureState } from '@mimik/core/capture/machine';
import type { Addon } from './native';

type CaptureActor = { subscribe(listener: (snapshot: { value: unknown }) => void): unknown };
type Accessibility = Pick<Addon, 'turnOnAccessibility' | 'restoreAccessibility' | 'releaseWebContent' | 'wakeApps'>;

export function followAccessibility(capture: CaptureActor, native: Accessibility, marker: string): () => void {
  native.restoreAccessibility(marker);
  let capturing = false;
  let armed = false;
  let on: Promise<void> = Promise.resolve();
  const leave = () => {
    if (!capturing) return;
    capturing = false;
    native.releaseWebContent();
    native.restoreAccessibility(marker);
  };
  capture.subscribe(({ value }) => {
    if (value === CaptureState.IDLE) leave();
    else if (!capturing) {
      capturing = true;
      on = native.turnOnAccessibility(marker).catch(() => undefined);
    }
    if (value === CaptureState.ARMED && !armed) void on.then(() => native.wakeApps());
    armed = value === CaptureState.ARMED;
  });
  return leave;
}
