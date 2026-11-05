import { browser } from '#imports';
import type { CaptureStateUpdate } from '@/core/capture/capture-state-update';
import { isLive } from '@/core/capture/is-live';
import { CaptureState } from '@/core/capture/machine';

export function showStepBadge({ state, stepCount }: CaptureStateUpdate): void {
  const action = browser.action ?? browser.browserAction;
  void action.setBadgeText({ text: isLive(state) ? String(stepCount) : '' });
  void action.setBadgeBackgroundColor({ color: state === CaptureState.PAUSED ? '#6B7280' : '#1E1B4B' });
  void action.setBadgeTextColor?.({ color: '#FFFFFF' });
}
