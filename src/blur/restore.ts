import type { CaptureStateUpdate } from '@/core/capture/capture-state-update';
import { CaptureState } from '@/core/capture/machine';

export function shouldReopenBlur(state: CaptureStateUpdate, isTopFrame: boolean): boolean {
  return isTopFrame && state.state === CaptureState.PAUSED && state.pauseReason === 'blur';
}
