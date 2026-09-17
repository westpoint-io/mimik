import { CaptureState } from '@/core/capture/machine';
import type { GetStateResponse } from '@/lib/messaging';

export function shouldReopenBlur(state: GetStateResponse, isTopFrame: boolean): boolean {
  return isTopFrame && state.state === CaptureState.PAUSED && state.pauseReason === 'blur';
}
