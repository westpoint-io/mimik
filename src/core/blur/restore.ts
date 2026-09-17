import { CaptureState } from '@/core/capture/machine';
import type { GetStateResponse } from '@/lib/messaging';

/**
 * Whether a frame booting mid-recording should re-open the blur overlay.
 *
 * Only the top frame ever hosts it, and only while the recording is paused
 * *for blur* — a manual pause has no overlay to restore, and a live recording
 * must not have one dropped on top of it. Without this the page that loads
 * after a navigation mid-blur would have no Done button, leaving the user
 * paused with no way back from the page itself.
 */
export function shouldReopenBlur(state: GetStateResponse, isTopFrame: boolean): boolean {
  return isTopFrame && state.state === CaptureState.PAUSED && state.pauseReason === 'blur';
}
